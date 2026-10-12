const $ = id => document.getElementById(id);
const files = new Map(); let busy = false;
const format = n => n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
const showError = e => { $('message').textContent = e.message || String(e); };
async function safe(fn) { try { return await fn(); } catch (e) { showError(e); } }
function render() {
  $('files').replaceChildren(); $('empty').hidden = files.size > 0; $('count').textContent = `${files.size} 个文件`;
  $('start').disabled = busy || !files.size; $('clear').disabled = busy || !files.size;
  $('pick').disabled = busy; $('folder-pick').disabled = busy; $('folder-reset').disabled = busy;
  $('cancel').hidden = !busy;
  document.querySelectorAll('input[name=preset]').forEach(e => e.disabled = busy);
  document.body.classList.toggle('busy', busy);
  for (const f of files.values()) {
    const row = document.createElement('div'); row.className = 'file';
    const icon = document.createElement('span'); icon.className = 'pdf-icon'; icon.textContent = 'PDF';
    const info = document.createElement('div'); info.className = 'file-info';
    const name = document.createElement('div'); name.className = 'filename'; name.textContent = f.name; name.title = f.path;
    const detail = document.createElement('div'); detail.className = 'file-detail';
    const text = document.createElement('span');
    if (f.status === 'done') {
      text.textContent = `${format(f.before)} → ${format(f.after)}`; detail.append(text);
      const saved = document.createElement('span'); saved.className = 'saving'; saved.textContent = f.reduced ? `减少 ${((1 - f.after / f.before) * 100).toFixed(1)}%` : '已是较小体积'; detail.append(saved);
    } else {
      text.textContent = `${format(f.size)} · ${f.status === 'running' ? (f.stage || '正在压缩…') : f.status === 'failed' ? f.error : f.status === 'cancelled' ? '已取消' : f.status === 'queued' ? '等待压缩' : '准备就绪'}`;
      detail.append(text); if (f.status === 'failed') detail.classList.add('error');
    }
    info.append(name, detail);
    if (f.status === 'running') { const p = document.createElement('progress'); p.max = 100; p.value = f.percent || 0; p.setAttribute('aria-label','压缩进度'); info.append(p); }
    row.append(icon, info);
    if (f.status === 'done') { const open = document.createElement('button'); open.className = 'link'; open.textContent = '打开位置'; open.onclick = () => safe(() => window.qingye.reveal(f.id)); row.append(open); }
    const remove = document.createElement('button'); remove.className = 'link remove'; remove.textContent = '×'; remove.disabled = busy; remove.setAttribute('aria-label', `移除 ${f.name}`); remove.onclick = () => safe(async () => { await window.qingye.remove(f.id); files.delete(f.id); render(); }); row.append(remove);
    $('files').append(row);
  }
}
function added(result) { if (!result) return; for (const f of result.added) files.set(f.id, { ...f, status: 'ready' }); $('message').textContent = result.errors.join('\n'); render(); }
$('pick').onclick = e => { e.stopPropagation(); if (!busy) safe(async () => added(await window.qingye.pickFiles())); };
$('dropzone').onclick = () => { if (!busy) safe(async () => added(await window.qingye.pickFiles())); };
$('dropzone').onkeydown = e => { if (e.target === $('dropzone') && ['Enter',' '].includes(e.key)) { e.preventDefault(); $('dropzone').click(); } };
for (const event of ['dragover', 'drop']) document.addEventListener(event, e => e.preventDefault());
$('dropzone').ondragover = e => { e.preventDefault(); if (!busy) $('dropzone').classList.add('drag'); };
$('dropzone').ondragleave = () => $('dropzone').classList.remove('drag');
$('dropzone').ondrop = e => { e.preventDefault(); $('dropzone').classList.remove('drag'); if (!busy) safe(async () => added(await window.qingye.dropFiles(Array.from(e.dataTransfer.files)))); };
document.querySelectorAll('input[name=preset]').forEach(input => input.onchange = () => { document.querySelectorAll('.preset').forEach(e => e.classList.toggle('selected', e.querySelector('input').checked)); });
$('clear').onclick = () => safe(async () => { await window.qingye.clear(); files.clear(); $('message').textContent = ''; $('summary').textContent = '准备好，让文件变轻'; render(); });
$('folder-pick').onclick = () => safe(async () => { const folder = await window.qingye.pickFolder(); if (folder) { $('folder').textContent = folder; $('folder').title = folder; $('folder-reset').hidden = false; } });
$('folder-reset').onclick = () => safe(async () => { await window.qingye.resetFolder(); $('folder').textContent = '原文件所在文件夹'; $('folder').title = '原文件所在文件夹'; $('folder-reset').hidden = true; });
$('start').onclick = () => safe(async () => {
  busy = true; $('message').textContent = ''; $('summary').textContent = '正在压缩，请稍候…'; $('hint').textContent = '文件在本机处理，可随时取消。';
  for (const f of files.values()) { f.status = 'queued'; delete f.error; }
  render();
  try { await window.qingye.start([...files.keys()], document.querySelector('input[name=preset]:checked').value); }
  catch (e) { busy = false; for (const f of files.values()) f.status = 'ready'; render(); throw e; }
});
$('cancel').onclick = () => safe(async () => { $('cancel').disabled = true; await window.qingye.cancel(); $('summary').textContent = '正在停止…'; });
window.qingye.onEvent(e => {
  const f = files.get(e.id);
  if (f) {
    if (e.type === 'started') { f.status = 'running'; f.percent = 0; f.stage = '正在读取文件…'; }
    if (e.type === 'progress') { f.percent = e.percent; f.stage = e.stage; }
    if (e.type === 'done') Object.assign(f, e, { status: 'done' });
    if (e.type === 'failed') { f.status = 'failed'; f.error = e.error; }
    if (e.type === 'cancelled') f.status = 'cancelled';
  }
  if (e.type === 'finished') {
    busy = false; $('cancel').disabled = false;
    for (const file of files.values()) if (['queued','running'].includes(file.status)) file.status = 'cancelled';
    const done = [...files.values()].filter(f => f.status === 'done'); const saved = done.reduce((sum,f) => sum + f.before - f.after, 0);
    $('summary').textContent = `${e.cancelled ? '任务已停止' : '压缩完成'} · ${e.completed} 个成功${e.failed ? `，${e.failed} 个失败` : ''}`;
    $('hint').textContent = `共节省 ${format(saved)} · 原文件始终保留。`;
  }
  render();
});
render();
