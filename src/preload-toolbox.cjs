const {contextBridge,ipcRenderer,webUtils}=require('electron');
const call=async(channel,...args)=>{const r=await ipcRenderer.invoke(channel,...args);if(!r.ok)throw new Error(r.error);return r.value;};
const listen=(channel,cb)=>{const listener=(_e,v)=>cb(v);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
// NAS 专属接口在桌面端一律为 null，共用 UI 用 capabilities 判断后隐藏对应入口（契约 §2）。
const nas=null;
contextBridge.exposeInMainWorld('qingye',{
 host:'desktop',
 capabilities:{
  nas:false,upload:false,downloadUrl:false,openAppSetting:false,openFileManager:false,
  pickFiles:true,pickFolder:true,pickFolderBatch:true,dropFiles:true,reveal:true,
  history:true,retry:true,editableRoots:true,mcpConfig:true,installComponents:true,hardware:true
 },
 // 文件：原生对话框 / 拖放 / 文件夹批量
 pickFiles:op=>call('files:pick',op),pickFolder:()=>call('folder:pick'),pickFolderBatch:op=>call('folder:batch',op),
 // 兼容两种入参：拖放事件里的 File 列表，或共用 UI 直接传的绝对路径数组（契约 §3 写的是 paths）。
 dropFiles:(items,op)=>call('files:drop',Array.from(items).map(item=>typeof item==='string'?item:webUtils.getPathForFile(item)),op),
 // NAS 专属（桌面端不可用）
 list:nas,select:nas,folder:nas,permission:nas,grant:nas,authorizeFolder:nas,openAppSetting:nas,openFileManager:nas,upload:nas,downloadUrl:nas,
 // 任务
 start:r=>call('job:start',r),cancel:id=>call('job:cancel',id),status:id=>call('job:status',id),onEvent:cb=>listen('job:event',cb),
 history:()=>call('job:history'),retry:id=>call('job:retry',id),reveal:p=>call('file:reveal',p),
 // 设置与组件
 settings:()=>call('settings:get'),addRoot:()=>call('settings:add-root'),removeRoot:p=>call('settings:remove-root',p),copyConfig:k=>call('settings:copy',k),
 installComponent:k=>call('component:install',k),selectComponent:k=>call('component:select',k),cancelDownload:()=>call('component:cancel'),onComponent:cb=>listen('component:event',cb)
});
