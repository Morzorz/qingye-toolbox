const {contextBridge,ipcRenderer,webUtils}=require('electron');
const call=async(channel,...args)=>{const r=await ipcRenderer.invoke(channel,...args);if(!r.ok)throw new Error(r.error);return r.value;};
const listen=(channel,cb)=>{const listener=(_e,v)=>cb(v);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
contextBridge.exposeInMainWorld('qingye',{
 pickFiles:op=>call('files:pick',op),dropFiles:(files,op)=>call('files:drop',Array.from(files).map(f=>webUtils.getPathForFile(f)),op),pickFolder:()=>call('folder:pick'),
 start:r=>call('job:start',r),cancel:id=>call('job:cancel',id),status:id=>call('job:status',id),reveal:p=>call('file:reveal',p),onEvent:cb=>listen('job:event',cb),
 settings:()=>call('settings:get'),addRoot:()=>call('settings:add-root'),removeRoot:p=>call('settings:remove-root',p),copyConfig:k=>call('settings:copy',k),
 installComponent:k=>call('component:install',k),selectComponent:k=>call('component:select',k),cancelDownload:()=>call('component:cancel'),onComponent:cb=>listen('component:event',cb)
});
