import { OPERATIONS, validateOptions } from '../../src/catalog.mjs';

/**
 * 轻页文件工具箱 · 飞牛独立版 UI（1.2.13）
 *
 * 与桌面端的区别：
 *  - 主卡片只有两个按钮：从 NAS 上选择 / 上传电脑文件；拖拽仍然可用。
 *  - 唯一的 NAS 弹窗：既能勾选文件，也能把整个文件夹递归加入。
 *  - 列表绝不静默丢条目：不可用条目置灰并给出原因。
 *  - 目录权限失败时在弹窗内逐条展示后端 hints，并提供「打开应用设置」。
 */

const $ = (id) => document.getElementById(id);
const api = window.qingye;

const GROUPS = {
  pdf: { label: 'PDF 工具', subtitle: '压缩、合并与格式转换，保留你的原文件。' },
  office: { label: '办公文档', subtitle: 'Word / Excel / PPT 转 PDF，排版以本机字体为准。' },
  image: { label: '图片处理', subtitle: '格式转换与尺寸压缩，批量处理更省事。' },
  audio: { label: '音频转换', subtitle: '转换格式或从视频中提取音轨。' },
  video: { label: '视频转换', subtitle: '统一转成 MP4 或按高度压缩。' },
  settings: { label: '组件与目录', subtitle: '查看授权目录、转换组件与任务历史。' },
};

const PRESET_HIDDEN = ['pdf_merge', 'pdf_split', 'images_to_pdf', 'office_to_pdf'];
const MAX_FILES = 100;

const state = {
  group: 'pdf',
  operation: 'pdf_compress',
  files: [],
  outputDir: null,
  settings: null,
  job: null,
  busy: false,
  uploading: false,
  history: [],
};

/* ------------------------------------------------------------------ 工具函数 */

const pad = (n) => String(n).padStart(2, '0');

function formatSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '大小未知';
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatTime(value) {
  if (!value) return '时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMoment(ms) {
  if (!ms) return '时间未知';
  const date = new Date(Number(ms));
  if (Number.isNaN(date.getTime())) return '时间未知';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const baseName = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || String(p || '');
const dirName = (p) => {
  const text = String(p || '');
  const index = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
  return index > 0 ? text.slice(0, index) : '';
};
const extOf = (name) => {
  const text = String(name || '');
  const index = text.lastIndexOf('.');
  return index > 0 ? text.slice(index + 1).toUpperCase() : 'FILE';
};

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

/**
 * 把后端 `children.modes` / `children.owners` 这类「值 → 数量」结构统一成 [{key,count}]。
 * 后端可能给对象映射、[key,count] 数组或 [{mode,count}] 数组，这里都容错。
 */
function countPairs(value, keyName) {
  const out = [];
  const push = (key, count) => {
    if (key === undefined || key === null || key === '') return;
    const number = Number(count);
    out.push({ key: String(key), count: Number.isFinite(number) ? number : null });
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        push(item, null);
        continue;
      }
      if (Array.isArray(item)) {
        push(item[0], item[1]);
        continue;
      }
      if (item && typeof item === 'object') {
        push(item[keyName] ?? item.mode ?? item.owner ?? item.name ?? item.key ?? item.value, item.count ?? item.n ?? item.total);
      }
    }
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, count] of Object.entries(value)) push(key, count);
  }
  return out;
}

const formatPairs = (pairs) => pairs.map(({ key, count }) => (count === null ? key : `${key} × ${count}`)).join('、');

function relativeTo(root, target) {
  const base = String(root || '').replace(/[\\/]+$/, '');
  const text = String(target || '');
  if (!base || !text.startsWith(base)) return '';
  const rest = text.slice(base.length).replace(/^[\\/]+/, '');
  return rest.split(/[\\/]+/).filter(Boolean).join('/');
}

/** 队列里显示相对授权根的路径（契约 §6）。 */
function relativePath(path) {
  const roots = [...(state.settings?.roots || [])].map((root) => (typeof root === 'string' ? root : root.path)).filter(Boolean);
  let best = null;
  for (const root of roots) {
    const rest = relativeTo(root, path);
    if (rest && (!best || root.length > best.root.length)) best = { root, rest };
  }
  return best ? best.rest : String(path || '');
}

function operationExtensions(operation) {
  return OPERATIONS[operation]?.extensions || [];
}

function setMessage(text, kind = '') {
  const node = $('message');
  node.textContent = text || '';
  node.classList.toggle('is-error', kind === 'error');
  node.classList.toggle('is-info', kind === 'info');
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ 应用设置 */

function applySettings(settings) {
  state.settings = settings;
  const version = [settings?.label, settings?.version].filter(Boolean).join(' ') || '飞牛独立版 1.2.13.5';
  $('version-badge').textContent = version;
  $('sidebar-version').textContent = version;
  renderFolder();
}

async function ensureSettings() {
  if (state.settings) return state.settings;
  try {
    const settings = await api.settings();
    applySettings(settings);
    return settings;
  } catch (error) {
    setMessage(`读取应用信息失败：${error.message}`, 'error');
    return null;
  }
}

/* ------------------------------------------------------------------ 文件队列 */

function addFiles(items = [], extra = {}) {
  let added = 0;
  const overflow = [];
  for (const item of items) {
    if (!item?.path) continue;
    if (state.files.some((file) => file.path === item.path)) continue;
    if (state.files.length >= MAX_FILES) {
      overflow.push(item.name || baseName(item.path));
      continue;
    }
    state.files.push({
      path: item.path,
      name: item.name || baseName(item.path),
      size: item.size,
      mtime: item.mtime || null,
      source: extra.source || 'nas',
    });
    added += 1;
  }
  return { added, overflow };
}

function mergeResult(result, extra = {}) {
  if (!result) return;
  const { added, overflow } = addFiles(result.added || [], extra);
  const errors = [...(result.errors || [])];
  if (overflow.length) errors.push(`列表一次最多 ${MAX_FILES} 个文件，${overflow.length} 个未加入，请分批处理`);
  state.job = null;
  render();
  if (errors.length) setMessage(errors.join('\n'), 'error');
  else if (added) setMessage('', '');
  return { added, errors };
}

function resultFor(file) {
  return state.job?.results?.find((result) => Array.isArray(result.inputs) && result.inputs.includes(file.path));
}

function statusText(result) {
  if (!result) return state.busy ? '等待处理' : '等待开始';
  if (result.status === 'done') {
    const before = formatSize(result.before);
    const after = formatSize(result.after);
    const merged = Array.isArray(result.inputs) && result.inputs.length > 1 ? '合并合计：' : '';
    return `${merged}${before} → ${after} · ${result.outputs?.length || 0} 个输出文件`;
  }
  if (result.status === 'failed') return result.error || '处理失败';
  if (result.status === 'cancelled') return '已取消';
  if (result.status === 'running') return `处理中 ${state.job?.percent ?? 0}%`;
  return '等待处理';
}

function renderQueue() {
  const list = $('files');
  list.replaceChildren();
  $('empty').hidden = state.files.length > 0;
  $('count').textContent = `${state.files.length} 个文件`;

  state.files.forEach((file, index) => {
    const result = resultFor(file);
    const row = element('div', 'file');
    row.dataset.path = file.path;

    const badge = element('span', 'type-badge', extOf(file.name));
    badge.classList.add(file.name.includes('.') ? 'has-ext' : 'no-ext');

    const main = element('div', 'file-main');
    const name = element('div', 'file-name', file.name);
    name.title = file.path;
    const meta = element('div', 'file-meta');
    const source = element('span', `source-tag ${file.source === 'pc' ? 'is-pc' : 'is-nas'}`,
      `${file.source === 'pc' ? '电脑上传' : 'NAS'} · ${relativePath(file.path)}`);
    source.title = file.path;
    meta.append(source, element('span', 'dot', '·'), element('span', 'size', formatSize(file.size)));
    if (file.mtime) meta.append(element('span', 'dot', '·'), element('span', 'mtime', formatTime(file.mtime)));
    const status = element('span', 'file-state', statusText(result));
    if (result?.status === 'failed') status.classList.add('is-error');
    if (result?.status === 'done') status.classList.add('is-done');
    meta.append(element('span', 'dot', '·'), status);
    main.append(name, meta);

    if (result?.status === 'running') {
      const progress = document.createElement('progress');
      progress.max = 100;
      progress.value = state.job?.percent ?? 0;
      main.append(progress);
    }

    const actions = element('div', 'file-actions');
    if (result?.outputs?.length) {
      const open = element('button', 'link', '打开位置');
      open.type = 'button';
      open.onclick = () => showResultDialog(file);
      actions.append(open);
    }
    if (!state.busy) {
      const move = (label, aria, delta) => {
        const button = element('button', 'link move', label);
        button.type = 'button';
        button.setAttribute('aria-label', `${aria} ${file.name}`);
        button.disabled = (delta === -1 && index === 0) || (delta === 1 && index === state.files.length - 1);
        button.onclick = () => {
          const target = index + delta;
          [state.files[index], state.files[target]] = [state.files[target], state.files[index]];
          state.job = null;
          render();
        };
        actions.append(button);
      };
      move('↑', '上移', -1);
      move('↓', '下移', 1);
      const remove = element('button', 'link remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `移除 ${file.name}`);
      remove.onclick = () => {
        state.files.splice(index, 1);
        state.job = null;
        render();
      };
      actions.append(remove);
    }

    row.append(badge, main, actions);
    list.append(row);
  });
}

/* ------------------------------------------------------------------ 结果弹窗 */

function openDialog({ title, subtitle, className = 'result-dialog' }) {
  const dialog = document.createElement('dialog');
  dialog.className = className;
  const head = element('header', `${className}-head`);
  const heading = element('h2', '', title);
  head.append(heading);
  if (subtitle) head.append(element('p', `${className}-sub`, subtitle));
  const body = element('div', `${className}-body`);
  const foot = element('footer', `${className}-foot`);
  dialog.append(head, body, foot);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
  const closeButton = element('button', 'secondary', '关闭');
  closeButton.type = 'button';
  closeButton.onclick = () => dialog.close();
  foot.append(closeButton);
  return { dialog, body, foot, close: () => dialog.close() };
}

function showResultDialog(file) {
  const result = resultFor(file);
  if (!result?.outputs?.length) return;
  const job = state.job;
  const { body } = openDialog({ title: '处理结果', subtitle: file.name });
  const list = element('div', 'result-list');
  for (const output of result.outputs) {
    const row = element('div', 'result-row');
    const info = element('div', 'result-info');
    const label = element('div', 'result-name', baseName(output));
    label.title = output;
    info.append(label, element('div', 'result-path', relativePath(output)));
    const link = element('a', 'link', '下载到电脑');
    link.href = api.downloadUrl(job?.id, output);
    link.setAttribute('download', '');
    row.append(info, link);
    list.append(row);
  }
  body.append(list);
}

/* ------------------------------------------------------------------ NAS 弹窗 */

function canUse(entry, operation, mode) {
  if (!entry) return '不可用';
  if (entry.kind === 'file' && mode === 'output') return '保存位置只能选择文件夹';
  if (entry.disabled) return entry.disabledReason || '不可用';
  if (entry.kind === 'file' && entry.matches === false) {
    const extensions = operationExtensions(operation);
    return `不匹配当前处理方式（需要 ${extensions.map((ext) => ext.toUpperCase()).join(' / ') || '匹配的文件'}）`;
  }
  return null;
}

function openNasPicker({ mode = 'files', operation, startPath = null }) {
  const outputMode = mode === 'output';
  const extensions = operationExtensions(operation);

  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'nas-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'nas-title');
    dialog.innerHTML = `
      <header class="nas-head">
        <h2 id="nas-title">${outputMode ? '选择保存文件夹' : '从 NAS 上选择'}</h2>
        <p class="nas-sub">${outputMode
          ? '保存位置只能选已授权的文件夹，结果写入这里，原文件不动。'
          : '只显示飞牛已授权的目录；灰色条目不可选，原因写在条目下方。'}</p>
      </header>
      <div class="nas-toolbar">
        <nav class="nas-crumbs" id="nas-crumbs" aria-label="目录路径"></nav>
        <button type="button" class="link" id="nas-up">上一级</button>
        <label class="nas-toggle"><input type="checkbox" id="nas-matched">仅显示匹配项</label>
      </div>
      <div class="nas-search">
        <input type="search" id="nas-search" placeholder="筛选文件名" aria-label="筛选文件名" autocomplete="off">
      </div>
      <div class="nas-scroll">
        <div class="nas-list" id="nas-list" role="list"></div>
        <div class="nas-panel" id="nas-panel" hidden></div>
      </div>
      <div class="nas-status" id="nas-status" role="status" aria-live="polite">正在读取目录…</div>
      <footer class="nas-foot">
        <button type="button" class="secondary" id="nas-folder" ${outputMode ? 'hidden' : ''}>加入当前文件夹</button>
        <button type="button" class="link" id="nas-authorize">重新授权此文件夹</button>
        <button type="button" class="link" id="nas-check">检查目录权限</button>
        <span class="nas-spacer"></span>
        <button type="button" class="secondary" id="nas-cancel">取消</button>
        <button type="button" class="primary" id="nas-confirm">${outputMode ? '使用此文件夹' : '添加所选文件'}</button>
      </footer>`;
    document.body.append(dialog);

    const listNode = dialog.querySelector('#nas-list');
    const panel = dialog.querySelector('#nas-panel');
    const statusNode = dialog.querySelector('#nas-status');
    const crumbs = dialog.querySelector('#nas-crumbs');
    const searchInput = dialog.querySelector('#nas-search');
    const matchedInput = dialog.querySelector('#nas-matched');
    const upButton = dialog.querySelector('#nas-up');
    const folderButton = dialog.querySelector('#nas-folder');
    const authorizeButton = dialog.querySelector('#nas-authorize');
    const checkButton = dialog.querySelector('#nas-check');
    const confirmButton = dialog.querySelector('#nas-confirm');
    const cancelButton = dialog.querySelector('#nas-cancel');

    const selected = new Map();
    let listing = null;
    let token = 0;
    let settled = false;
    let pending = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      if (dialog.open) dialog.close();
      else dialog.remove();
    };
    dialog.addEventListener('close', () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
      dialog.remove();
    }, { once: true });

    const setPending = (value) => {
      pending = value;
      dialog.classList.toggle('is-busy', value);
      for (const button of [folderButton, authorizeButton, checkButton, confirmButton, upButton]) {
        button.disabled = value || button.dataset.off === '1';
      }
    };

    const clearPanel = () => {
      panel.hidden = true;
      panel.replaceChildren();
    };

    const openSettingsLink = (note) => {
      const button = element('button', 'link nas-settings', '打开应用设置');
      button.type = 'button';
      button.onclick = async () => {
        button.disabled = true;
        try {
          await api.openAppSetting();
          note.textContent = '已尝试打开飞牛应用设置；授权完成后回到轻页刷新列表即可，无需重启应用。';
        } catch (error) {
          note.textContent = `无法自动打开应用设置：${error.message}。请手动进入飞牛「应用中心 → 轻页 → 应用设置 → 目录授权」检查。`;
        } finally {
          button.disabled = false;
        }
      };
      return button;
    };

    const showFailure = (error) => {
      listNode.replaceChildren();
      panel.hidden = false;
      panel.replaceChildren();
      panel.append(element('p', 'nas-error', error.message || '读取目录失败'));
      const hints = Array.isArray(error.hints) ? error.hints : [];
      if (hints.length) {
        const block = element('div', 'nas-hints');
        block.append(element('strong', '', '可以这样处理：'));
        const ul = element('ul', '');
        for (const hint of hints) ul.append(element('li', '', hint));
        block.append(ul);
        const note = element('p', 'nas-note', '');
        block.append(note, openSettingsLink(note));
        panel.append(block);
      } else if (error.code === 'NO_READ' || error.status === 403) {
        const block = element('div', 'nas-hints');
        block.append(element('strong', '', '无法读取此目录'));
        // 官方机制：轻页以独立应用账号运行，ACL 由飞牛在授权时自动授予，不需要用户勾选继承，也不需要重启。
        block.append(element('p', 'nas-note', '轻页以独立应用账号运行，只读取飞牛明确授权给轻页的目录。请点下面的「重新授权此文件夹」，授权完成后立即可用，无需重启应用。'));
        const note = element('p', 'nas-note', '');
        block.append(note, openSettingsLink(note));
        panel.append(block);
      }
      updateStatus();
    };

    const panelTitle = (text) => {
      const row = element('div', 'nas-panel-head');
      row.append(element('h3', 'nas-panel-title', text));
      const close = element('button', 'link nas-panel-close', '收起');
      close.type = 'button';
      close.onclick = () => {
        panel.hidden = true;
        panel.replaceChildren();
      };
      row.append(close);
      return row;
    };

    /**
     * 目录权限分布：只有后端返回 `children` 时才渲染，字段名容错，
     * 缺字段就少显示一行，绝不自己编造统计。
     */
    const renderChildren = (children) => {
      if (!children || typeof children !== 'object') return null;
      const scanned = firstNumber(children.scanned, children.total, children.count, children.examined);
      const readable = firstNumber(children.readable, children.readableCount);
      const blocked = firstNumber(children.unreadable, children.blocked, children.unreadableCount);
      const modes = countPairs(children.modes, 'mode');
      const owners = countPairs(children.owners, 'owner');
      const samples = Array.isArray(children.samples)
        ? children.samples
          .map((item) => (typeof item === 'string' ? item : item?.name || item?.path || ''))
          .filter(Boolean)
          .slice(0, 6)
        : [];
      if (scanned === null && readable === null && blocked === null && !modes.length && !owners.length && !samples.length) return null;

      const box = element('div', 'nas-children');
      const head = [];
      if (scanned !== null) head.push(`共扫描 ${scanned} 项`);
      if (readable !== null) head.push(`可读 ${readable}`);
      if (blocked !== null) head.push(`不可读 ${blocked}`);
      if (head.length) box.append(element('p', 'nas-children-head', head.join(' · ')));
      if (modes.length) box.append(element('p', 'nas-children-line', `权限位：${formatPairs(modes)}`));
      if (owners.length) box.append(element('p', 'nas-children-line', `所有者：${formatPairs(owners)}`));
      if (samples.length) box.append(element('p', 'nas-children-line', `示例：${samples.join('、')}`));
      return box;
    };

    const openFileManagerLink = (target, note) => {
      const button = element('button', 'link nas-filemanager', '在文件管理器中打开');
      button.type = 'button';
      button.onclick = async () => {
        button.disabled = true;
        try {
          await api.openFileManager(target);
          note.textContent = '已请求飞牛打开文件管理器；如果没有弹出窗口，请手动打开「文件管理器」定位该路径。';
        } catch (error) {
          note.textContent = `无法自动打开文件管理器：${error.message}。`;
        } finally {
          button.disabled = false;
        }
      };
      return button;
    };

    /**
     * 权限面板。文案全部来自后端（hints / children）；前端只负责排版。
     * options.title 用于「为什么“xxx”不可用」，options.reason 是列表里的不可用原因。
     */
    const renderPermission = (data, options = {}) => {
      panel.hidden = false;
      panel.replaceChildren();
      const target = data.path || options.path || '';
      if (options.title) panel.append(panelTitle(options.title));

      const head = element('div', 'nas-perm-head', target);
      head.title = target;
      panel.append(head);

      if (data.exists === false) {
        panel.append(element('p', 'nas-error', '这个位置已经不存在：可能已被移动、改名或所在存储空间已卸载。'));
      } else {
        const kindText = data.kind === 'directory' ? '文件夹' : data.kind === 'file' ? '文件' : data.kind || '未知';
        const facts = [
          `类型：${kindText}`,
          `权限位：${data.mode || '未知'}`,
          `所有者：${data.owner || '未知'}`,
          `读取：${data.readable ? '可以' : '不可以'}`,
          `写入：${data.writable ? '可以' : '不可以'}`,
        ];
        if (options.reason) facts.push(`不可用原因：${options.reason}`);
        const grid = element('div', 'nas-perm-grid');
        for (const fact of facts) grid.append(element('span', 'nas-perm-fact', fact));
        panel.append(grid);
      }

      const childrenBox = renderChildren(data.children);
      if (childrenBox) panel.append(childrenBox);

      // 修复入口放在 hints 之前：看完权限位就能直接跳去改权限，不用先滚动。
      const links = element('div', 'nas-panel-links');
      const note = element('p', 'nas-note', '');
      links.append(openSettingsLink(note), openFileManagerLink(target, note));
      panel.append(links, note);

      // 后端 hints 是唯一文案来源，这里只负责逐条渲染。
      const hints = Array.isArray(data.hints) ? data.hints : [];
      if (hints.length) {
        const block = element('div', 'nas-hints');
        block.append(element('strong', '', options.reason ? '为什么不可用，可以这样处理：' : '按下面的步骤修复权限：'));
        const ul = element('ul', '');
        for (const hint of hints) ul.append(element('li', '', hint));
        block.append(ul);
        panel.append(block);
      }
    };

    /** 点击不可用条目：查该条目自己的权限并解释原因（不用 alert）。 */
    const explainEntry = async (entry, reason) => {
      setPending(true);
      panel.hidden = false;
      panel.replaceChildren(element('p', 'nas-note', '正在读取该条目的权限信息…'));
      try {
        const data = await api.permission(entry.path, 'r');
        renderPermission(data, {
          title: `为什么“${entry.name}”不可用`,
          reason,
          path: entry.path,
        });
      } catch (error) {
        panel.replaceChildren();
        const block = element('div', 'nas-hints');
        block.append(element('strong', '', '无法读取该条目的权限信息'));
        block.append(element('p', 'nas-error', error.message));
        for (const hint of Array.isArray(error.hints) ? error.hints : []) block.append(element('p', 'nas-note', `· ${hint}`));
        const note = element('p', 'nas-note', '');
        block.append(note);
        const links = element('div', 'nas-panel-links');
        links.append(openSettingsLink(note), openFileManagerLink(entry.path, note));
        block.append(links);
        panel.append(block);
      } finally {
        setPending(false);
        updateStatus();
      }
    };

    const updateStatus = () => {
      const counts = listing?.counts || {};
      const matched = Number.isFinite(counts.matched) ? counts.matched : (listing?.entries || []).filter((entry) => entry.kind === 'file' && entry.matches).length;
      const parts = [];
      if (outputMode) {
        parts.push(`当前目录 ${Number.isFinite(counts.directories) ? counts.directories : (listing?.entries || []).filter((entry) => entry.kind === 'dir').length} 个文件夹`);
      } else {
        parts.push(`已选 ${selected.size} 个文件`);
        parts.push(`当前目录 ${matched} 个匹配`);
      }
      if (Number.isFinite(counts.blocked) && counts.blocked > 0) parts.push(`${counts.blocked} 个不可用`);
      if (Number.isFinite(counts.hidden) && counts.hidden > 0) parts.push(`${counts.hidden} 个隐藏项`);
      statusNode.textContent = pending ? '正在处理…' : listing ? parts.join(' · ') : '未选择目录';
      confirmButton.textContent = outputMode ? '使用此文件夹' : `添加所选文件${selected.size ? `（${selected.size}）` : ''}`;
      confirmButton.disabled = pending || (outputMode ? !listing?.path : selected.size === 0);
      confirmButton.dataset.off = confirmButton.disabled ? '1' : '0';
      const hasPath = Boolean(listing?.path);
      folderButton.dataset.off = hasPath ? '0' : '1';
      folderButton.disabled = pending || !hasPath;
      folderButton.title = hasPath ? '' : '授权目录根位置不能整体加入，请先进入一个文件夹';
      upButton.disabled = pending || !listing?.parent;
      authorizeButton.dataset.off = (listing?.path || listing?.root || startPath) ? '0' : '1';
      authorizeButton.disabled = pending || authorizeButton.dataset.off === '1';
      authorizeButton.title = '向飞牛申请这个文件夹的访问权限，授权完成后立即可用，无需重启应用';
      checkButton.disabled = pending || !(listing?.path || listing?.root || startPath);
    };

    const renderCrumbs = () => {
      crumbs.replaceChildren();
      const home = element('button', 'crumb', '全部授权目录');
      home.type = 'button';
      home.onclick = () => load(null);
      crumbs.append(home);
      if (!listing?.path) {
        home.classList.add('is-current');
        home.setAttribute('aria-current', 'true');
        return;
      }
      const root = listing.root || startPath || listing.path;
      const pieces = relativeTo(root, listing.path).split('/').filter(Boolean);
      const join = (value) => (root.endsWith('/') || root.endsWith('\\') ? root + value : `${root}/${value}`);
      const separator = () => element('span', 'crumb-sep', '/');
      let current = root;
      for (let index = 0; index <= pieces.length; index += 1) {
        const label = index === 0 ? baseName(root) : pieces[index - 1];
        if (index > 0) current = join(pieces.slice(0, index).join('/'));
        const crumb = element('button', 'crumb', label);
        crumb.type = 'button';
        crumb.title = current;
        crumb.onclick = () => load(current);
        if (index === pieces.length) crumb.classList.add('is-current');
        crumbs.append(separator(), crumb);
      }
      const last = crumbs.querySelector('.is-current');
      if (last) last.setAttribute('aria-current', 'true');
    };

    const renderRows = () => {
      listNode.replaceChildren();
      const entries = [...(listing?.entries || [])];
      const term = searchInput.value.trim().toLowerCase();
      const visible = entries.filter((entry) => {
        if (term && !String(entry.name || '').toLowerCase().includes(term)) return false;
        if (matchedInput.checked && entry.kind === 'file' && !entry.matches) return false;
        return true;
      });
      visible.sort((a, b) => {
        const rank = (entry) => (entry.kind === 'dir' ? 0 : entry.matches ? 1 : 2);
        return rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), 'zh-CN');
      });

      for (const entry of visible) {
        if (entry.kind === 'dir') {
          const row = element('div', 'nas-row is-dir');
          row.dataset.path = entry.path;
          row.dataset.kind = 'dir';
          if (entry.root) row.dataset.root = 'true';
          const button = element('button', 'nas-row-main');
          button.type = 'button';
          button.setAttribute('aria-label', `打开文件夹 ${entry.name}`);
          button.onclick = () => load(entry.path);
          const icon = element('span', 'nas-icon', '📁');
          icon.setAttribute('aria-hidden', 'true');
          const text = element('span', 'nas-text');
          const name = element('span', 'nas-name', entry.name);
          name.title = entry.path;
          const meta = element('span', 'nas-meta');
          meta.append(element('span', 'nas-kind', entry.root ? '授权目录' : '文件夹'));
          if (entry.writable === false) meta.append(element('span', 'nas-flag', '· 只读'));
          text.append(name, meta);
          button.append(icon, text);
          row.append(button);
          listNode.append(row);
          continue;
        }

        const reason = canUse(entry, operation, mode);
        const row = element('div', `nas-row is-file${reason ? ' is-disabled' : ''}`);
        row.dataset.path = entry.path;
        row.dataset.kind = 'file';
        row.dataset.matches = entry.matches ? 'true' : 'false';
        row.dataset.disabled = reason ? 'true' : 'false';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'nas-check';
        checkbox.disabled = Boolean(reason) || pending;
        checkbox.checked = selected.has(entry.path);
        checkbox.setAttribute('aria-label', `选择 ${entry.name}`);
        checkbox.onchange = () => {
          if (checkbox.checked) selected.set(entry.path, { path: entry.path, name: entry.name, size: entry.size, mtime: entry.mtime });
          else selected.delete(entry.path);
          updateStatus();
        };

        const icon = element('span', 'nas-icon', reason ? '⚠' : '📄');
        icon.setAttribute('aria-hidden', 'true');
        const text = element('span', 'nas-text');
        const name = element('span', 'nas-name', entry.name);
        name.title = entry.path;
        const meta = element('span', 'nas-meta');
        meta.append(element('span', 'nas-tag', extOf(entry.name)), element('span', 'nas-size', formatSize(entry.size)));
        meta.append(element('span', 'nas-dot', '·'), element('span', 'nas-time', formatTime(entry.mtime)));
        // 不可用条目用原因取代“匹配”标记，避免“匹配却不可选”的自相矛盾。
        if (!reason) meta.append(element('span', 'nas-dot', '·'), element('span', entry.matches ? 'nas-match' : 'nas-unmatch', entry.matches ? '匹配' : '不匹配'));
        text.append(name, meta);
        if (reason) text.append(element('span', 'nas-reason', reason));

        row.append(checkbox, icon, text);
        if (reason) {
          // 不可用条目：整行可点（而不是靠复选框），点开就能看到权限位/属主/原因。
          row.classList.add('is-clickable');
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-label', `为什么“${entry.name}”不可用，查看权限原因`);
          row.title = '点击查看该条目的权限位、所有者与修复步骤';
          text.append(element('span', 'nas-more', '查看原因'));
          const open = (event) => {
            if (event && event.target && event.target.closest && event.target.closest('input')) return;
            explainEntry(entry, reason);
          };
          row.addEventListener('click', open);
          row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          });
        }
        listNode.append(row);
      }

      if (!visible.length) {
        const entriesAll = entries.length;
        const emptyText = !listing?.path
          ? '还没有可用的授权目录：请点「重新授权此文件夹」，或到飞牛应用设置 → 目录授权添加文件夹。'
          : entriesAll && matchedInput.checked
            ? `此文件夹没有匹配当前处理方式的文件（共 ${entriesAll} 个条目，可取消「仅显示匹配项」查看全部）`
            : entriesAll
              ? '没有符合筛选条件的条目'
              : '此文件夹是空的';
        listNode.append(element('div', 'nas-empty', emptyText));
      }

      const warnings = Array.isArray(listing?.warnings) ? listing.warnings : [];
      if (warnings.length) {
        const box = element('div', 'nas-warn');
        for (const warning of warnings) box.append(element('p', '', warning));
        listNode.append(box);
      }
    };

    async function load(target) {
      const current = ++token;
      listNode.setAttribute('aria-busy', 'true');
      statusNode.textContent = '正在读取目录…';
      try {
        const data = await api.list(target ?? null, operation);
        if (current !== token) return;
        listing = data;
        clearPanel();
        renderCrumbs();
        renderRows();
        updateStatus();
      } catch (error) {
        if (current !== token) return;
        listing = null;
        renderCrumbs();
        showFailure(error);
      } finally {
        if (current === token) listNode.removeAttribute('aria-busy');
      }
    }

    const commit = (result) => {
      const errors = [...(result?.errors || [])];
      for (const skipped of result?.skipped || []) {
        errors.push(`${baseName(skipped.path)}：${skipped.reason || '无法加入'}`);
      }
      // 勾选时已经拿到修改时间，合并进 added，队列里就能直接显示时间。
      const added = (result?.added || []).map((item) => ({
        ...item,
        mtime: selected.get(item.path)?.mtime ?? item.mtime ?? null,
      }));
      finish({ action: 'add', added, errors, summary: result?.summary || null });
    };

    const runSelect = async () => {
      if (!selected.size) {
        panel.hidden = false;
        panel.replaceChildren(element('p', 'nas-note', '请先在上面的列表里勾选文件。'));
        return;
      }
      if (selected.size > MAX_FILES) {
        panel.hidden = false;
        panel.replaceChildren(element('p', 'nas-error', `一次最多添加 ${MAX_FILES} 个文件，请分批选择。`));
        return;
      }
      setPending(true);
      try {
        commit(await api.select([...selected.keys()], operation));
      } catch (error) {
        showFailure(error);
      } finally {
        setPending(false);
      }
    };

    const runFolder = async () => {
      if (!listing?.path) return;
      setPending(true);
      try {
        commit(await api.folder(listing.path, operation));
      } catch (error) {
        showFailure(error);
      } finally {
        setPending(false);
      }
    };

    /**
     * 重新授权当前文件夹：飞牛授权 → 后端登记授权 → 刷新设置与当前目录。
     * 全程不需要用户重启应用；失败时把宿主的 msg / 后端 hints 展示在弹窗内。
     */
    const runAuthorize = async () => {
      const target = listing?.path || listing?.root || startPath;
      if (!target) return;
      setPending(true);
      panel.hidden = false;
      panel.replaceChildren(element('p', 'nas-note', '正在向飞牛申请该文件夹的访问权限…'));
      try {
        const authorized = await api.authorizeFolder(target);
        let granted = null;
        let grantError = null;
        try {
          granted = await api.grant(target);
        } catch (error) {
          grantError = error;
        }
        const settings = await api.settings().catch(() => null);
        if (settings) applySettings(settings);
        await load(granted?.path || target);
        panel.hidden = false;
        panel.replaceChildren();
        const lines = element('div', 'nas-hints');
        if (grantError) {
          lines.append(element('strong', '', '授权已提交，但轻页账号仍无法读取'));
          lines.append(element('p', 'nas-error', grantError.message));
          for (const hint of grantError.hints || []) lines.append(element('p', 'nas-note', `· ${hint}`));
          const note = element('p', 'nas-note', '');
          lines.append(note, openSettingsLink(note));
        } else {
          lines.append(element('strong', '', '授权已完成，这个文件夹现在可以直接使用'));
          lines.append(element('p', 'nas-note', granted?.path
            ? `已授权：${granted.path}`
            : '飞牛已返回授权结果，无需重启应用。'));
          if (authorized.paths.length) lines.append(element('p', 'nas-note', `本次授权返回 ${authorized.paths.length} 个目录。`));
        }
        panel.append(lines);
      } catch (error) {
        panel.replaceChildren();
        const block = element('div', 'nas-hints');
        block.append(element('strong', '', '重新授权未完成'));
        block.append(element('p', 'nas-error', error.message));
        block.append(element('p', 'nas-note', '仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。'));
        const note = element('p', 'nas-note', '');
        block.append(note, openSettingsLink(note));
        panel.append(block);
      } finally {
        setPending(false);
        updateStatus();
      }
    };

    const runCheck = async () => {
      const target = listing?.path || listing?.root || startPath;
      if (!target) return;
      setPending(true);
      try {
        renderPermission(await api.permission(target, 'r'));
        if (outputMode) statusNode.textContent = '已检查该文件夹的权限';
      } catch (error) {
        showFailure(error);
      } finally {
        setPending(false);
        updateStatus();
      }
    };

    searchInput.addEventListener('input', () => renderRows());
    matchedInput.addEventListener('change', () => renderRows());
    upButton.onclick = () => load(listing?.parent ?? null);
    folderButton.onclick = runFolder;
    authorizeButton.onclick = runAuthorize;
    checkButton.onclick = runCheck;
    confirmButton.onclick = () => {
      if (outputMode) finish({ action: 'output', folder: listing?.path || null });
      else runSelect();
    };
    cancelButton.onclick = () => finish(null);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(null);
    });

    dialog.showModal();
    renderCrumbs();
    updateStatus();
    load(startPath);
  });
}

/* ------------------------------------------------------------------ 处理设置 */

function buildOptions() {
  const container = $('options');
  container.replaceChildren();
  const operation = state.operation;
  const meta = OPERATIONS[operation];

  const field = (label, id, values, value, type = 'select', hint = '') => {
    const wrapper = element('label', 'option-field');
    wrapper.append(element('span', '', label));
    let control;
    if (type === 'select') {
      control = document.createElement('select');
      for (const item of values) {
        // 值可以是裸值（显示为大写）或 [value, 中文标签] 对，例如硬件加速 自动 / 关闭。
        const [optionValue, optionLabel] = Array.isArray(item) ? item : [item, String(item).toUpperCase()];
        const option = document.createElement('option');
        option.value = String(optionValue);
        option.textContent = String(optionLabel);
        control.append(option);
      }
    } else {
      control = document.createElement('input');
      control.type = type;
    }
    control.id = id;
    control.value = value;
    wrapper.append(control);
    if (hint) wrapper.append(element('span', 'option-hint', hint));
    container.append(wrapper);
    return control;
  };

  if (operation === 'pdf_compress') {
    const target = field('目标大小 MB（可选）', 'target-mb', [], '', 'number');
    target.min = '0.1';
    target.max = '500';
    target.step = '0.1';
    target.placeholder = '留空自动压缩';
  }
  if (operation === 'image_convert') field('输出格式', 'format', ['jpg', 'png', 'webp'], 'jpg');
  if (operation === 'pdf_to_images') field('输出格式', 'format', ['png', 'jpg'], 'png');
  if (['image_convert', 'pdf_to_images'].includes(operation)) field('最长边（像素）', 'dimension', [], 2600, 'number');
  if (operation === 'pdf_split') field('提取页码', 'pages', [], '1-3', 'text');
  if (operation === 'audio_convert') field('输出格式', 'format', ['mp3', 'wav', 'flac', 'm4a'], 'mp3');
  if (operation === 'video_convert') {
    field('最大高度', 'height', [480, 720, 1080, 2160], 1080);
    // 契约 §2.8：自动优先走核显，探测失败自动回退 CPU；关闭则直接软编。
    field('硬件加速', 'hw', [['auto', '自动'], ['off', '关闭']], 'auto', 'select', '无核显时自动用 CPU');
  }
  if (operation === 'office_to_pdf') container.append(element('span', 'note', '输出 PDF；排版可能受本机字体影响。缺少办公组件时任务会提示。'));

  document.querySelector('.presets').hidden = PRESET_HIDDEN.includes(operation);
  $('formats').textContent = `${(meta?.extensions || []).map((ext) => ext.toUpperCase()).join(' / ')} · 每批最多 ${MAX_FILES} 个文件`;
  $('operation-note').textContent = meta?.combined ? '按列表顺序合并，可用箭头调整顺序' : '';
}

function collectOptions() {
  const operation = state.operation;
  const options = { preset: document.querySelector('input[name=preset]:checked')?.value || 'balanced' };
  if ($('format')) options.format = $('format').value;
  if ($('dimension')?.value) options.maxDimension = Number($('dimension').value);
  if ($('height')?.value) options.maxHeight = Number($('height').value);
  if ($('pages')?.value) options.pages = $('pages').value.replace(/\s/g, '');
  if ($('target-mb')?.value) options.targetMB = Number($('target-mb').value);
  if ($('hw')?.value) options.hw = $('hw').value;
  const validated = validateOptions(operation, options);
  // 契约 §2.8：video_convert 必须显式带 hw，'off' 也要传，不能省略。
  if (operation === 'video_convert') validated.hw = options.hw === 'off' ? 'off' : 'auto';
  return validated;
}

function renderFolder() {
  const target = state.outputDir || state.settings?.defaultOutput || null;
  const label = $('folder');
  label.textContent = target || '与第一个文件相同的文件夹';
  label.title = target || '';
  $('folder-reset').hidden = !state.outputDir;
}

function renderControls() {
  const busy = state.busy || state.uploading;
  for (const id of ['pick-nas', 'upload-pc', 'operation', 'clear', 'folder-pick', 'folder-reset']) {
    if ($(id)) $(id).disabled = busy;
  }
  $('clear').disabled = busy || state.files.length === 0;
  $('start').disabled = busy || state.files.length === 0;
  $('cancel').hidden = !state.busy;
  document.querySelectorAll('input[name=preset],#options input,#options select,#nav button').forEach((node) => {
    node.disabled = busy;
  });
}

function renderSummary() {
  const job = state.job;
  if (job?.status === 'running') {
    // stage / percent 完全以后端为准：硬件失败回退 CPU 时后端会把 percent 归 0 并给出
    // 「硬件加速不可用，已改用 CPU 重新转换…」，进度回退是真实状态，不要在这里做单调修正。
    $('summary').textContent = `${job.stage || '正在处理'} ${job.percent ?? 0}%`;
    $('hint').textContent = '处理过程中可随时取消，原文件不受影响。';
    return;
  }
  if (!job) {
    $('summary').textContent = '准备好，开始处理文件';
    $('hint').textContent = '结果另存，原文件始终保留。';
    return;
  }
  const done = (job.results || []).filter((result) => result.status === 'done').length;
  const failed = (job.results || []).filter((result) => result.status === 'failed').length;
  const stopped = job.status === 'cancelled' || job.status === 'interrupted';
  $('summary').textContent = `${stopped ? '任务已停止' : '处理完成'} · ${done} 个成功${failed ? `，${failed} 个失败` : ''}`;
  const outputs = (job.results || []).reduce((sum, result) => sum + (result.outputs?.length || 0), 0);
  $('hint').textContent = `已生成 ${outputs} 个文件 · 原文件保留`;
  if (job.error) setMessage(job.error, 'error');
}

function render() {
  renderQueue();
  renderControls();
  renderSummary();
  renderFolder();
}

/* ------------------------------------------------------------------ 分组与操作 */

function switchGroup(group) {
  if (state.busy) return;
  state.group = group;
  const meta = GROUPS[group];
  $('title').textContent = meta.label;
  $('subtitle').textContent = meta.subtitle;
  document.querySelectorAll('#nav button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.group === group);
  });
  $('work-panel').hidden = group === 'settings';
  $('settings-panel').hidden = group !== 'settings';
  state.files = [];
  state.job = null;
  setMessage('');
  if (group === 'settings') {
    loadSettingsPage();
    return;
  }
  const operations = Object.entries(OPERATIONS).filter(([, value]) => value.group === group);
  const select = $('operation');
  select.replaceChildren();
  for (const [key, value] of operations) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = value.label;
    select.append(option);
  }
  state.operation = select.value || operations[0]?.[0] || 'pdf_compress';
  buildOptions();
  render();
}

/* ------------------------------------------------------------------ 上传 */

async function uploadLocal(files) {
  if (!files.length) return;
  if (state.uploading) return;
  state.uploading = true;
  render();
  setMessage(`正在上传 ${files.length} 个文件到共享目录…`, 'info');
  try {
    const result = await api.upload(files, state.operation, {
      onProgress: (text) => setMessage(text, 'info'),
      onHints: (hints) => setMessage(hints.join('\n'), 'error'),
    });
    state.uploading = false;
    mergeResult({ added: result.added, errors: result.errors }, { source: 'pc' });
    if (!result.errors.length && result.added.length) {
      setMessage(`已上传 ${result.added.length} 个文件，保存在「上传文件」目录。`, 'info');
    }
  } catch (error) {
    state.uploading = false;
    setMessage(error.message, 'error');
    render();
  }
}

/* ------------------------------------------------------------------ 开始 / 取消 */

async function startJob() {
  if (state.busy || state.uploading || !state.files.length) return;
  const meta = OPERATIONS[state.operation];
  let options;
  try {
    options = collectOptions();
  } catch (error) {
    setMessage(error.message, 'error');
    return;
  }
  if (meta?.combined && state.files.length < 2) {
    setMessage('合并任务至少需要 2 个文件', 'error');
    return;
  }
  await ensureSettings();
  const outputDir = state.outputDir || state.settings?.defaultOutput || dirName(state.files[0].path);
  if (!outputDir) {
    setMessage('请先选择保存位置', 'error');
    return;
  }
  state.busy = true;
  state.job = null;
  setMessage('');
  render();
  try {
    const { jobId } = await api.start({
      operation: state.operation,
      inputs: state.files.map((file) => file.path),
      outputDir,
      options,
    });
    const snapshot = await api.status(jobId);
    state.job = snapshot;
    state.busy = snapshot.status === 'running';
    render();
  } catch (error) {
    state.busy = false;
    state.job = null;
    setMessage(error.message, 'error');
    render();
  }
}

async function cancelJob() {
  if (!state.job?.id) return;
  try {
    state.job = await api.cancel(state.job.id);
    state.busy = state.job.status === 'running';
    render();
  } catch (error) {
    setMessage(error.message, 'error');
  }
}

/* ------------------------------------------------------------------ 组件与目录 */

/**
 * 重新授权一个目录：飞牛授权 → 后端登记 → 刷新 /api/settings。
 * 官方机制下授权结果即时返回，不需要重启应用。
 */
async function reauthorizeFolder(target) {
  await api.authorizeFolder(target);
  let granted = null;
  let grantError = null;
  try {
    granted = await api.grant(target);
  } catch (error) {
    grantError = error;
  }
  const settings = await api.settings().catch(() => null);
  if (settings) applySettings(settings);
  return { granted, grantError, settings };
}

function settingsButton(row, note) {
  const link = element('button', 'link', '打开应用设置');
  link.type = 'button';
  link.onclick = async () => {
    link.disabled = true;
    try {
      await api.openAppSetting();
      note.textContent = '已打开飞牛应用设置；授权完成后刷新页面即可，无需重启应用。';
    } catch (error) {
      note.textContent = `无法自动打开应用设置：${error.message}。请手动进入飞牛「应用中心 → 轻页 → 应用设置 → 目录授权」重新选择该目录。`;
    } finally {
      link.disabled = false;
    }
  };
  row.append(link);
  return link;
}

function renderRoots(roots = [], missingRoots = []) {
  const box = $('roots');
  box.replaceChildren();
  if (!roots.length) {
    const empty = element('p', 'roots-empty', '尚未授权任何目录，轻页无法读写 NAS 文件。请在飞牛应用设置 → 目录授权中选择文件夹，系统会自动为轻页账号授予 ACL。');
    const note = element('p', 'small-note', '');
    box.append(empty);
    settingsButton(box, note);
    box.append(note);
  }
  for (const root of roots) {
    const item = typeof root === 'string' ? { path: root, name: baseName(root), writable: null, shared: false } : root;
    const row = element('div', 'root-row');
    const info = element('div', 'root-info');
    const title = element('strong', '', item.name || baseName(item.path));
    const pathNode = element('span', 'root-path', item.path);
    pathNode.title = item.path;
    const flags = element('span', 'root-flags');
    if (item.shared) flags.append(element('span', 'tag', '共享目录'));
    flags.append(element('span', 'tag', item.writable === false ? '只读' : '可写'));
    info.append(title, pathNode, flags);
    const actions = element('div', 'root-actions');
    const result = element('div', 'root-result');

    const check = element('button', 'link', '检查权限');
    check.type = 'button';
    check.onclick = async () => {
      check.disabled = true;
      result.replaceChildren(element('span', 'small-note', '正在检查…'));
      try {
        const data = await api.permission(item.path, 'r');
        result.replaceChildren();
        result.append(element('span', `perm-line ${data.readable ? 'is-ok' : 'is-bad'}`,
          `读取：${data.readable ? '可以' : '不可以'} · 写入：${data.writable ? '可以' : '不可以'} · 权限位 ${data.mode || '未知'}`));
        // 后端 hints 逐条渲染，前端不另写一套权限步骤。
        if (Array.isArray(data.hints) && data.hints.length) {
          const ul = element('ul', 'hint-list');
          for (const hint of data.hints) ul.append(element('li', '', hint));
          result.append(ul);
          const note = element('p', 'small-note', '');
          const linkRow = element('div', 'root-result');
          settingsButton(linkRow, note);
          result.append(linkRow, note);
        }
      } catch (error) {
        result.replaceChildren(element('span', 'perm-line is-bad', error.message));
      } finally {
        check.disabled = false;
      }
    };

    const reauth = element('button', 'link', '重新授权');
    reauth.type = 'button';
    reauth.title = '向飞牛申请这个目录的访问权限，授权完成后立即可用，无需重启应用';
    reauth.onclick = async () => {
      reauth.disabled = true;
      check.disabled = true;
      result.replaceChildren(element('span', 'small-note', '正在向飞牛申请授权…'));
      try {
        const { granted, grantError } = await reauthorizeFolder(item.path);
        if (grantError) {
          result.replaceChildren();
          result.append(element('span', 'perm-line is-bad', `授权已提交，但轻页账号仍无法读取：${grantError.message}`));
          if (Array.isArray(grantError.hints) && grantError.hints.length) {
            const ul = element('ul', 'hint-list');
            for (const hint of grantError.hints) ul.append(element('li', '', hint));
            result.append(ul);
          }
          setSettingsNote('授权未真正落到轻页账号，请按提示重新选择该目录。', true);
        } else {
          setSettingsNote(`授权完成：${granted?.path || item.path}，无需重启应用。`);
          const settings = state.settings;
          if (settings) renderRoots(settings.roots || [], settings.missingRoots || []);
        }
      } catch (error) {
        result.replaceChildren(element('span', 'perm-line is-bad', error.message));
      } finally {
        reauth.disabled = false;
        check.disabled = false;
      }
    };

    actions.append(check, reauth);
    row.append(info, actions, result);
    box.append(row);
  }

  const warn = $('missing-roots');
  warn.replaceChildren();
  if (missingRoots.length) {
    warn.hidden = false;
    warn.append(element('strong', '', '以下授权目录已失效（不影响应用启动）：'));
    for (const path of missingRoots) warn.append(element('p', '', path));
    warn.append(element('p', '', '目录被移动、改名或所在存储空间卸载后会失效；请重新选择新的路径。'));
  } else {
    warn.hidden = true;
  }
}

/**
 * 契约 §2.8：`/api/settings.hardware` → `视频硬件加速：可用（VAAPI · /dev/dri/renderD128）`。
 * 字段做容错；没有 hardware 字段就整行不渲染。文案完全由后端数值决定，前端不推断能力。
 */
function hardwareLine(hardware) {
  if (!hardware || typeof hardware !== 'object') return null;
  const available = hardware.available ?? hardware.ok ?? hardware.enabled;
  if (available === undefined || available === null) return null;
  if (available) {
    const backend = String(hardware.backend || hardware.api || 'VAAPI').toUpperCase();
    const device = hardware.device || hardware.path || hardware.renderDevice || '';
    return { text: `视频硬件加速：可用（${backend}${device ? ` · ${device}` : ''}）`, ok: true };
  }
  const reason = hardware.reason || hardware.message || hardware.detail || '当前系统没有可用的视频硬件加速';
  return { text: `视频硬件加速：不可用（${reason}）`, ok: false };
}

function renderComponents(components = {}, hardware = null, webInfo = null) {
  const box = $('components');
  box.replaceChildren();
  const rows = [
    ['media', '音视频组件 · FFmpeg', components.media],
    ['office', '办公组件 · LibreOffice', components.office],
  ];
  for (const [, label, value] of rows) {
    const row = element('div', 'component-row');
    row.append(element('strong', '', label), element('span', `component-state ${value ? 'is-ok' : 'is-bad'}`, value ? `已就绪：${value}` : '未安装或未检测到'));
    box.append(row);
  }
  const hw = hardwareLine(hardware);
  if (hw) {
    const row = element('div', 'component-row hw-row');
    row.append(element('span', `hw-line ${hw.ok ? 'is-ok' : 'is-bad'}`, hw.text));
    box.append(row);
  }
  const web = webEntryLine(webInfo);
  if (web) {
    const row = element('div', 'component-row web-row');
    row.append(element('span', 'hw-line', web.text));
    box.append(row);
  }
}

/**
 * 契约 §2.9：`/api/settings.web` → 本机 Web 入口（仅回环）。
 * 没有 web 字段（或未启用）就整行不渲染。
 */
function webEntryLine(web) {
  if (!web || typeof web !== 'object' || !web.url) return null;
  return { text: `本机 Web 入口：${web.url}（仅本机回环，需 SSH 隧道或反向代理）` };
}

// JobService 的终态是 completed / completed_with_errors / cancelled / interrupted / failed。
const JOB_STATUS = {
  running: '进行中',
  completed: '已完成',
  completed_with_errors: '部分失败',
  cancelled: '已取消',
  interrupted: '已中断',
  failed: '失败',
};

function renderHistory(jobs = []) {
  const box = $('history');
  box.replaceChildren();
  if (!jobs.length) {
    box.append(element('p', 'history-empty', '暂无任务记录。'));
    return;
  }
  for (const job of jobs) {
    const row = element('div', 'history-row');
    const info = element('div', 'history-info');
    const label = OPERATIONS[job.operation]?.label || job.operation;
    info.append(element('strong', '', `${label} · ${job.results?.filter((result) => result.status === 'done').length || 0} 个成功`));
    info.append(element('span', 'history-meta', `${formatMoment(job.createdAt)} · ${JOB_STATUS[job.status] || '已结束'}`));
    const outputs = (job.results || []).flatMap((result) => result.outputs || []);
    info.append(element('span', 'history-path', outputs.length ? outputs.map((path) => relativePath(path)).join('、') : (job.stage || '无输出')));
    const retry = element('button', 'secondary', '按原参数重试');
    retry.type = 'button';
    retry.disabled = job.status === 'running';
    retry.onclick = async () => {
      retry.disabled = true;
      try {
        await api.retry(job.id);
        setSettingsNote('重试任务已提交，可在任务历史中查看进度。');
        setTimeout(loadHistory, 1200);
      } catch (error) {
        setSettingsNote(`重试失败：${error.message}`, true);
      } finally {
        retry.disabled = false;
      }
    };
    row.append(info, retry);
    box.append(row);
  }
}

function setSettingsNote(text, isError = false) {
  const node = $('settings-note');
  node.textContent = text || '';
  node.classList.toggle('is-error', isError);
}

async function loadHistory() {
  try {
    renderHistory(await api.history());
  } catch (error) {
    $('history').replaceChildren(element('p', 'is-error', `读取任务历史失败：${error.message}`));
  }
}

async function loadSettingsPage() {
  setSettingsNote('');
  const settings = await ensureSettings();
  if (settings) {
    renderRoots(settings.roots || [], settings.missingRoots || []);
    renderComponents(settings.components || {}, settings.hardware ?? null, settings.web ?? null);
  }
  await loadHistory();
}

/* ------------------------------------------------------------------ 事件绑定 */

function bind() {
  document.querySelectorAll('#nav button').forEach((button) => {
    button.onclick = () => switchGroup(button.dataset.group);
  });
  $('operation').onchange = () => {
    state.operation = $('operation').value;
    state.files = [];
    state.job = null;
    setMessage('');
    buildOptions();
    render();
  };
  document.querySelectorAll('input[name=preset]').forEach((input) => {
    input.onchange = () => {
      document.querySelectorAll('.preset').forEach((label) => {
        label.classList.toggle('selected', label.querySelector('input').checked);
      });
    };
  });

  $('pick-nas').onclick = async (event) => {
    event.stopPropagation();
    if (state.busy) return;
    const result = await openNasPicker({ mode: 'files', operation: state.operation });
    if (!result) return;
    mergeResult(result, { source: 'nas' });
  };

  $('upload-pc').onclick = (event) => {
    event.stopPropagation();
    if (state.busy) return;
    $('file-input').click();
  };
  $('file-input').onchange = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    await uploadLocal(files);
  };

  $('dropzone').addEventListener('keydown', (event) => {
    if (event.target !== $('dropzone')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      $('pick-nas').click();
    }
  });
  for (const type of ['dragenter', 'dragover', 'drop']) {
    document.addEventListener(type, (event) => event.preventDefault());
  }
  $('dropzone').addEventListener('dragover', () => {
    if (!state.busy && !state.uploading) $('dropzone').classList.add('is-drag');
  });
  $('dropzone').addEventListener('dragleave', () => $('dropzone').classList.remove('is-drag'));
  $('dropzone').addEventListener('drop', async (event) => {
    $('dropzone').classList.remove('is-drag');
    if (state.busy || state.uploading) return;
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) await uploadLocal(files);
  });

  $('clear').onclick = () => {
    state.files = [];
    state.job = null;
    setMessage('');
    render();
  };
  $('folder-pick').onclick = async () => {
    if (state.busy) return;
    const result = await openNasPicker({ mode: 'output', operation: state.operation });
    if (!result?.folder) return;
    state.outputDir = result.folder;
    renderFolder();
  };
  $('folder-reset').onclick = () => {
    state.outputDir = null;
    renderFolder();
  };
  $('start').onclick = startJob;
  $('cancel').onclick = cancelJob;
  $('open-settings').onclick = async () => {
    try {
      await api.openAppSetting();
      setSettingsNote('已尝试打开飞牛应用设置。');
    } catch (error) {
      setSettingsNote(`无法自动打开应用设置：${error.message}。请手动进入「应用中心 → 轻页 → 应用设置」。`, true);
    }
  };

  api.onEvent((job) => {
    if (!job?.id) return;
    state.job = job;
    state.busy = job.status === 'running';
    render();
    if (!state.busy && state.group === 'settings') loadHistory();
  });
}

/* ------------------------------------------------------------------ 启动 */

async function boot() {
  bind();
  // 先取一次 /api/settings：版本角标、默认保存位置、授权根都来自这里。
  await ensureSettings();
  buildOptions();
  render();
  switchGroup('pdf');
  window.qingyeReady = true;
}

boot().catch((error) => {
  setMessage(`界面启动失败：${error.message}。请刷新页面；如仍失败，请反馈这段提示。`, 'error');
  if (window.console) console.error(error);
});
