const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { Worker } = require('node:worker_threads');
const { randomUUID } = require('node:crypto');
let win, active = null, outputDir = null;
const entries = new Map();
const MAX_BYTES = 500 * 1024 * 1024;
const emit = data => { if (win && !win.isDestroyed()) win.webContents.send('job:event', data); };
function trusted(event) { if (!win || event.sender !== win.webContents) throw new Error('无效请求'); }
function handle(name, fn) { ipcMain.handle(name, async (event, ...args) => { trusted(event); try { return { ok: true, value: await fn(...args) }; } catch (e) { return { ok: false, error: e.message || '操作失败' }; } }); }
async function addFiles(paths) {
  if (active) throw new Error('请等待本次压缩完成');
  if (!Array.isArray(paths) || paths.length > 500) throw new Error('每次最多添加 500 个文件');
  const added = [], errors = [];
  for (const p of paths) {
    try {
      if (typeof p !== 'string' || path.extname(p).toLowerCase() !== '.pdf') throw new Error('仅支持 PDF 文件');
      const real = await fs.realpath(p), stat = await fs.stat(real);
      if (!stat.isFile() || stat.size === 0) throw new Error('文件为空或不是普通文件');
      if (stat.size > MAX_BYTES) throw new Error('单个文件不能超过 500 MB');
      if ([...entries.values()].some(e => e.path === real)) continue;
      const entry = { id: randomUUID(), path: real, name: path.basename(real), size: stat.size };
      entries.set(entry.id, entry); added.push(entry);
    } catch (e) { errors.push(`${path.basename(String(p))}：${e.message}`); }
  }
  return { added, errors };
}
async function saveUnique(entry, bytes, folder) {
  const base = path.basename(entry.path, path.extname(entry.path));
  const dir = folder || path.dirname(entry.path);
  const temp = path.join(dir, `.qingye-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, bytes, { flag: 'wx' });
    for (let i = 0; i < 10000; i++) {
      const target = path.join(dir, `${base}_压缩版${i ? ` (${i})` : ''}.pdf`);
      try {
        // COPYFILE_EXCL guarantees no existing file, including the source, is overwritten.
        await fs.copyFile(temp, target, require('node:fs').constants.COPYFILE_EXCL);
        return target;
      } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    throw new Error('同名文件过多，请更换保存位置');
  } finally { await fs.unlink(temp).catch(() => {}); }
}
function runWorker(job, entry, preset) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'worker.mjs'), { workerData: { input: entry.path, preset } });
    job.worker = worker;
    let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; job.worker = null; worker.terminate(); error ? reject(error) : resolve(value); };
    worker.on('message', m => {
      if (m.type === 'progress') emit({ type: 'progress', id: entry.id, ...m });
      if (m.type === 'result') finish(null, m.result);
      if (m.type === 'error') finish(new Error(m.error));
    });
    worker.on('error', e => finish(e));
    worker.on('exit', code => { if (!settled) finish(new Error(job.cancelled ? '已取消' : `压缩进程意外结束 (${code})`)); });
  });
}
async function runBatch(job) {
  let completed = 0, failed = 0;
  for (const id of job.ids) {
    if (job.cancelled) break;
    const entry = entries.get(id);
    emit({ type: 'started', id });
    try {
      const result = await runWorker(job, entry, job.preset);
      if (job.cancelled) { emit({ type: 'cancelled', id }); break; }
      // Save is deliberately a short non-cancellable commit. A completed output is always reported.
      const destination = await saveUnique(entry, result.bytes, job.folder);
      entry.output = destination;
      const { bytes, ...summary } = result;
      completed++;
      emit({ type: 'done', id, output: destination, ...summary });
    } catch (e) {
      if (job.cancelled) { emit({ type: 'cancelled', id }); break; }
      failed++; emit({ type: 'failed', id, error: e.code === 'EACCES' ? '没有写入权限，请更换保存位置' : e.message });
    }
  }
  active = null;
  emit({ type: 'finished', cancelled: job.cancelled, completed, failed });
}
handle('files:pick', async () => {
  const result = await dialog.showOpenDialog(win, { title: '添加 PDF 文件', properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] });
  return result.canceled ? { added: [], errors: [] } : addFiles(result.filePaths);
});
handle('files:drop', addFiles);
handle('files:remove', id => { if (active) throw new Error('压缩过程中不能移除文件'); entries.delete(id); });
handle('files:clear', () => { if (active) throw new Error('压缩过程中不能清空'); entries.clear(); });
handle('folder:pick', async () => {
  if (active) throw new Error('请等待本次压缩完成');
  const r = await dialog.showOpenDialog(win, { title: '选择压缩文件保存位置', properties: ['openDirectory', 'createDirectory'] });
  if (!r.canceled) outputDir = r.filePaths[0];
  return outputDir;
});
handle('folder:reset', () => { if (active) throw new Error('请等待本次压缩完成'); outputDir = null; });
handle('job:start', ({ ids, preset }) => {
  if (active) throw new Error('已有任务正在运行');
  if (!['clear', 'balanced', 'small'].includes(preset)) throw new Error('无效压缩档位');
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => !entries.has(id))) throw new Error('请选择有效文件');
  const job = { ids: [...new Set(ids)], preset, folder: outputDir, cancelled: false, worker: null };
  active = job; setImmediate(() => runBatch(job)); return true;
});
handle('job:cancel', () => { if (active) { active.cancelled = true; active.worker?.terminate(); } });
handle('file:reveal', id => { const entry = entries.get(id); if (entry?.output) shell.showItemInFolder(entry.output); });
function createWindow() {
  win = new BrowserWindow({ width: 1040, height: 760, minWidth: 820, minHeight: 640, backgroundColor: '#f4f7f6', title: '轻页 PDF 压缩', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('close', event => {
    if (active) {
      const choice = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['继续压缩', '停止并退出'], defaultId: 0, cancelId: 0, message: '还有文件正在压缩', detail: '已完成的文件会保留，未完成的任务将停止。' });
      if (choice === 0) { event.preventDefault(); return; }
      active.cancelled = true; active.worker?.terminate();
    }
  });
  win.on('closed', () => { win = null; });
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === 'darwin' ? [{ label: '轻页 PDF 压缩', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] }, { role: 'editMenu' }, { role: 'windowMenu' }] : [{ role: 'editMenu' }]));
  app.setAboutPanelOptions({ applicationName: '轻页 PDF 压缩', applicationVersion: '1.0.0', copyright: 'AGPL-3.0-or-later · MuPDF © Artifex Software' });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
