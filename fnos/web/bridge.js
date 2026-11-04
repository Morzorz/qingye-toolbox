import {TrimApp} from '@trimjs/web-app';

/**
 * 飞牛版 API 适配层。
 *
 * 只暴露 UI 真正需要的方法：
 *  - 目录与文件：list / select / folder / permission
 *  - 上传：upload（分片，带进度）
 *  - 任务：start / status / cancel / onEvent / history / retry / downloadUrl
 *  - 宿主：settings / openAppSetting
 *
 * 约定：
 *  - 所有请求走 `/app/qingye/api/...`；POST 必须带 `X-Qingye-Request: 1`。
 *  - 失败时抛出 Error，`message` 取后端 `body.error`，并挂载：
 *      error.status   HTTP 状态码
 *      error.code     后端错误码（如 `NO_READ` / `TOO_MANY`）
 *      error.hints    后端可执行的中文步骤（可能为空数组）
 */
const PREFIX = '/app/qingye';
const MARKER = 'X-Qingye-Request';

let hostCache;

function host() {
  if (hostCache === undefined) {
    try {
      hostCache = new TrimApp({});
    } catch (error) {
      hostCache = null;
      if (window.console) console.warn('[轻页] 飞牛宿主接口不可用：' + error.message);
    }
  }
  return hostCache;
}

function failure(payload, status) {
  const error = new Error(payload?.error || `请求失败（HTTP ${status}）`);
  error.status = status;
  error.code = payload?.code || null;
  error.hints = Array.isArray(payload?.hints) ? payload.hints.filter((hint) => typeof hint === 'string' && hint.trim()) : [];
  return error;
}

async function parse(response) {
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 300) || `请求失败（HTTP ${response.status}）` };
    }
  }
  if (!response.ok || payload.error) throw failure(payload, response.status);
  return payload;
}

async function request(route, body) {
  const url = `${PREFIX}/api/${route}`;
  const init = body === undefined
    ? { method: 'GET', headers: {} }
    : { method: 'POST', headers: { 'Content-Type': 'application/json', [MARKER]: '1' }, body: JSON.stringify(body) };
  return parse(await fetch(url, init));
}

async function postRaw(route, blob) {
  const response = await fetch(`${PREFIX}/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', [MARKER]: '1' },
    body: blob,
  });
  return parse(response);
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function uploadOne(file, operation, onProgress) {
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 40);
  let started = false;
  try {
    const session = await request('upload-start', { id, operation, name: file.name, size: file.size });
    started = true;
    const chunkSize = Number(session.chunkSize) || 512 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const data = await postRaw(`upload-chunk?id=${encodeURIComponent(id)}`, chunk);
      const percent = Math.min(100, Math.floor((Number(data.received) || offset + chunk.size) / file.size * 100));
      onProgress?.(`正在上传 ${file.name}… ${percent}%`, percent);
    }
    onProgress?.(`文件已收到，正在保存 ${file.name}…`, 100);
    return await request('upload-finish', { id });
  } catch (error) {
    if (started) request('upload-cancel', { id }).catch(() => {});
    throw error;
  }
}

async function upload(files, operation, options = {}) {
  if (!files?.length) return { added: [], errors: [] };
  if (files.length > 100) throw new Error('每批最多上传 100 个文件');
  const added = [];
  const errors = [];
  for (const file of files) {
    try {
      const data = await uploadOne(file, operation, options.onProgress);
      added.push(...(data.added || []));
    } catch (error) {
      errors.push(`${file.name}：${error.message}`);
      if (Array.isArray(error.hints)) options.onHints?.(error.hints);
    }
  }
  return { added, errors };
}

let active = null;
let timer = null;
const listeners = new Set();

function emit(job) {
  active = job;
  for (const listener of listeners) {
    try {
      listener(job);
    } catch (error) {
      if (window.console) console.error(error);
    }
  }
}

async function poll() {
  if (!active) return;
  try {
    emit(await request(`job?id=${encodeURIComponent(active.id)}`));
    if (active.status === 'running') timer = setTimeout(poll, 700);
  } catch (error) {
    timer = setTimeout(poll, 3000);
    for (const listener of listeners) {
      try {
        listener({ ...active, pollError: error.message });
      } catch {}
    }
  }
}

async function openAppSetting() {
  const instance = host();
  if (!instance) throw new Error('当前页面不在飞牛桌面中，请从飞牛桌面打开轻页');
  if (instance.isStandaloneWeb) throw new Error('当前页面不在飞牛桌面中，请从飞牛桌面打开轻页');
  await instance.openAppSetting();
}

/**
 * 重新授权一个目录：走飞牛官方 `authorizeSharedFile`。
 * 官方文档写 `data: string[]`，0.5.0 的 .d.ts 写 `boolean`，两种都兼容。
 * 非管理员/未在飞牛桌面打开时 `code !== 0`，直接抛出宿主的 `msg`。
 */
async function authorizeFolder(path) {
  const instance = host();
  if (!instance) throw new Error('当前页面不在飞牛桌面中，请从飞牛桌面打开轻页后再授权目录');
  if (instance.isStandaloneWeb) throw new Error('当前页面不在飞牛桌面中，请从飞牛桌面打开轻页后再授权目录');
  if (!path) throw new Error('请先进入要授权的文件夹');
  const result = await instance.authorizeSharedFile(path);
  if (!result) throw new Error('已取消授权');
  if (result.code !== 0) throw new Error(result.msg || '授权未完成');
  const paths = Array.isArray(result.data) ? result.data : [];
  return { code: result.code, msg: result.msg || '', paths };
}

/**
 * 在飞牛文件管理器中定位一个路径（例如权限有问题的文件，用户需要去改属主/权限）。
 * 不在飞牛桌面里、或宿主版本不支持时只抛出可读提示，由调用方展示在面板里。
 */
async function openFileManager(target) {
  const instance = host();
  if (!instance) throw new Error('当前页面不在飞牛桌面中，请从飞牛桌面打开轻页');
  if (instance.isStandaloneWeb) throw new Error('当前页面不在飞牛桌面中，请从飞牛桌面打开轻页');
  if (!target) throw new Error('没有可打开的路径');
  if (typeof instance.openFileManager !== 'function') throw new Error('当前飞牛版本不支持从页面打开文件管理器，请手动打开「文件管理器」定位该路径');
  await instance.openFileManager(target);
}

function hostState() {
  const instance = host();
  if (!instance) return { available: false, standalone: true };
  return { available: true, standalone: Boolean(instance.isStandaloneWeb) };
}

window.qingye = {
  // 宿主标识 + 能力表：共用 UI 靠这两个字段切换按钮文案与设置页分块。
  host: 'fnos',
  capabilities: {
    nas: true,
    upload: true,
    pickFiles: false,
    pickFolder: false,
    pickFolderBatch: false,
    dropFiles: true,
    reveal: true,
    downloadUrl: true,
    history: true,
    retry: true,
    editableRoots: false,
    mcpConfig: false,
    installComponents: false,
    hardware: true,
    openAppSetting: true,
    openFileManager: true,
  },
  settings: () => request('settings'),
  list: (path, operation) => request(`nas/list${query({ path, operation })}`),
  select: (paths, operation) => request('nas/select', { paths, operation }),
  folder: (folder, operation) => request('nas/folder', { folder, operation }),
  permission: (path, mode = 'r') => request('nas/permission', { path, mode }),
  grant: (path) => request('nas/grant', { path }),
  authorizeFolder,
  openFileManager,
  hostState,
  upload,
  start: async (payload) => {
    clearTimeout(timer);
    const started = await request('jobs', payload);
    active = { id: started.jobId, status: 'running', percent: 0, stage: '已提交' };
    timer = setTimeout(poll, 150);
    return started;
  },
  status: (id) => request(`job?id=${encodeURIComponent(id)}`),
  cancel: (id) => {
    clearTimeout(timer);
    return request('cancel', { id });
  },
  history: () => request('history'),
  retry: (id) => request('retry', { id }),
  onEvent: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  downloadUrl: (id, path) => `${PREFIX}/api/download${query({ id, path })}`,
  openAppSetting,
};
