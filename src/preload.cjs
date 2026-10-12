const { contextBridge, ipcRenderer, webUtils } = require('electron');
const call = async (channel, ...args) => { const r = await ipcRenderer.invoke(channel, ...args); if (!r.ok) throw new Error(r.error); return r.value; };
contextBridge.exposeInMainWorld('qingye', {
  pickFiles: () => call('files:pick'),
  dropFiles: files => call('files:drop', Array.from(files).map(f => webUtils.getPathForFile(f))),
  remove: id => call('files:remove', id), clear: () => call('files:clear'),
  pickFolder: () => call('folder:pick'), resetFolder: () => call('folder:reset'),
  start: (ids, preset) => call('job:start', { ids, preset }), cancel: () => call('job:cancel'),
  reveal: id => call('file:reveal', id),
  onEvent: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('job:event', listener); return () => ipcRenderer.removeListener('job:event', listener); }
});
