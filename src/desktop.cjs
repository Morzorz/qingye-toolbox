const {app,BrowserWindow,ipcMain,dialog,shell,Menu,clipboard}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const MAX_BATCH_FILES=100,MAX_BATCH_EXAMINED=10000;
// 纯扫描（不碰 Electron）：递归 BFS、按名称排序，跳过点号项与符号链接，
// 最多返回 maxFiles 个匹配文件、最多检查 maxExamined 个目录项。
async function scanFolder(root,extensions,{maxFiles=MAX_BATCH_FILES,maxExamined=MAX_BATCH_EXAMINED}={}){
 const queue=[root],files=[];let examined=0,truncated=false;
 while(queue.length&&files.length<maxFiles){
  const dir=queue.shift();
  let items;
  try{items=await fs.readdir(dir,{withFileTypes:true});}catch{continue;}
  items.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
  for(const item of items){
   if(++examined>maxExamined){truncated=true;break;}
   if(item.name.startsWith('.')||item.isSymbolicLink())continue;
   const candidate=path.join(dir,item.name);
   if(item.isDirectory()){queue.push(candidate);continue;}
   if(!item.isFile()||!extensions.includes(path.extname(item.name).slice(1).toLowerCase()))continue;
   files.push(candidate);
   if(files.length>=maxFiles)break;
  }
  if(truncated)break;
 }
 return {files,examined,truncated};
}
exports.scanFolder=scanFolder;
exports.start=async function(){
 const {JobService}=await import('./jobs.mjs'),{OPERATIONS}=await import('./catalog.mjs'),{settings,updateSettings}=await import('./settings.mjs'),{componentStatus,runProcess,findEngine}=await import('./components.mjs'),{installComponent}=await import('./downloads.mjs'),{hwStatus}=await import('./hwaccel.mjs');
 // 历史持久化到 userData/jobs.json：重启后仍能看到最近任务并原参数重试（契约 §3）。
 const historyFile=path.join(app.getPath('userData'),'jobs.json');
 const jobs=new JobService({historyFile});
 await jobs.loadHistory().catch(e=>process.stderr.write(`历史任务读取失败：${e.message}\n`));
 let win,download=null,quitAfterDownload=false;const selected=new Set(),outputs=new Set();
 const config=()=>{const command=process.execPath,args=app.isPackaged?['--mcp']:[app.getAppPath(),'--mcp'];return {json:JSON.stringify({mcpServers:{qingye:{command,args}}},null,2),toml:`[mcp_servers.qingye]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\nstartup_timeout_sec = 30\n`,command,args};};
 const emit=(channel,value)=>{if(win&&!win.isDestroyed())win.webContents.send(channel,value);};
 jobs.on('update',j=>{for(const r of j.results)for(const p of r.outputs)outputs.add(p);emit('job:event',j);});
 function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{if(!win||event.sender!==win.webContents)throw Error('无效请求');try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message};}});}
 async function addFiles(files,operation){if(jobs.active)throw Error('请先等待任务完成');const op=OPERATIONS[operation];if(!op||!Array.isArray(files)||files.length>MAX_BATCH_FILES)throw Error('文件或操作无效');const added=[],errors=[];for(const file of files){try{const real=await fs.realpath(file),s=await fs.stat(real);if(!s.isFile()||!op.extensions.includes(path.extname(real).slice(1).toLowerCase()))throw Error('不支持此文件类型');selected.add(real);added.push({path:real,name:path.basename(real),size:s.size});}catch(e){errors.push(`${path.basename(String(file))}：${e.message}`);}}return {added,errors};}
 // 桌面端「选择文件夹」：递归(BFS,按名称排序)扫描，跳过点号项与符号链接。
 async function batchFolder(operation){
  const op=OPERATIONS[operation];if(!op)throw Error('无效操作');
  if(jobs.active)throw Error('请先等待任务完成');
  const picked=await dialog.showOpenDialog(win,{title:'选择要加入的文件夹',properties:['openDirectory']});
  if(picked.canceled)return {added:[],errors:[]};
  const root=await fs.realpath(picked.filePaths[0]);
  const {files:found,truncated}=await scanFolder(root,op.extensions);
  const added=[],errors=[];
  for(const file of found){
   try{const real=await fs.realpath(file),s=await fs.stat(real);selected.add(real);added.push({path:real,name:path.relative(root,real),size:s.size});}
   catch(e){errors.push(`${path.basename(file)}：${e.message}`);}
  }
  if(!added.length&&!errors.length)errors.push(`所选文件夹及其子文件夹中没有 ${op.extensions.map(e=>e.toUpperCase()).join('、')} 文件`);
  if(truncated||found.length>=MAX_BATCH_FILES)errors.push(`一次最多加入 ${MAX_BATCH_FILES} 个文件、扫描 ${MAX_BATCH_EXAMINED} 个目录项；请缩小文件夹范围后重试`);
  return {added,errors};
 }
 handle('files:pick',async op=>{if(!OPERATIONS[op])throw Error('无效操作');const r=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:OPERATIONS[op].label,extensions:OPERATIONS[op].extensions}]});return r.canceled?{added:[],errors:[]}:addFiles(r.filePaths,op);});handle('files:drop',addFiles);
 handle('folder:batch',batchFolder);
 handle('folder:pick',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];});
 handle('job:start',r=>{if(download)throw Error('请等待组件安装完成');if(!r.inputs?.every(p=>selected.has(p)))throw Error('请通过选择器或拖放添加文件');return jobs.submit(r);});handle('job:cancel',id=>jobs.cancel(id));handle('job:status',id=>jobs.snapshot(id));
 handle('job:history',()=>jobs.history());
 handle('job:retry',async id=>{if(download)throw Error('请等待组件安装完成');const previous=jobs.jobs.get(id);if(!previous)throw Error('任务不存在或已过期');const snapshot=jobs.snapshot(id);return jobs.submit({operation:snapshot.operation,inputs:snapshot.inputs,outputDir:snapshot.outputDir,options:snapshot.options});});
 handle('file:reveal',p=>{if(!outputs.has(p))throw Error('只能打开本次生成的文件');shell.showItemInFolder(p);});
 handle('settings:get',async()=>{const engine=await findEngine('media');return {...await settings(),components:await componentStatus(),hardware:engine?await hwStatus(engine):{available:false,reason:'音视频组件未就绪'},config:config(),version:app.getVersion()};});
 handle('settings:add-root',async()=>{const r=await dialog.showOpenDialog(win,{title:'选择允许 AI 读写的文件夹',properties:['openDirectory']});if(r.canceled)return settings();const root=await fs.realpath(r.filePaths[0]),s=await settings();return updateSettings({roots:[...new Set([...s.roots,root])]});});
 handle('settings:remove-root',async root=>{const s=await settings();return updateSettings({roots:s.roots.filter(p=>p!==root)});});handle('settings:copy',kind=>{if(!['json','toml'].includes(kind))throw Error('无效配置类型');clipboard.writeText(config()[kind]);});
 handle('component:select',async kind=>{if(!['media','office'].includes(kind)||jobs.active||download)throw Error('请在空闲时选择组件');const r=await dialog.showOpenDialog(win,{title:kind==='media'?'选择 ffmpeg 可执行文件':'选择 soffice 或 LibreOffice.app',properties:['openFile']});if(r.canceled)return;let binary=r.filePaths[0];if(binary.endsWith('.app')&&kind==='office')binary=path.join(binary,'Contents','MacOS','soffice');await runProcess(binary,[kind==='media'?'-version':'--version'],{timeoutMs:30000});const s=await settings();await updateSettings({engines:{...s.engines,[kind]:binary}});});
 handle('component:install',async kind=>{if(!['media','office'].includes(kind)||jobs.active||download)throw Error('请等待当前任务结束');download=new AbortController();try{return await installComponent(kind,{fetchImpl:require('electron').net.fetch,signal:download.signal,progress:p=>emit('component:event',p),openInstaller:p=>shell.openPath(p)});}finally{download=null;if(quitAfterDownload){win?.destroy();app.quit();}}});handle('component:cancel',()=>download?.abort());
 function createWindow(){win=new BrowserWindow({width:1120,height:820,minWidth:900,minHeight:700,backgroundColor:'#f4f7f6',title:'轻页文件工具箱',webPreferences:{preload:path.join(__dirname,'preload-toolbox.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.loadFile(path.join(__dirname,'toolbox.html'));
  win.on('close',event=>{if(jobs.active||download){const choice=dialog.showMessageBoxSync(win,{message:'仍有任务正在进行',detail:'退出将停止未完成的处理，已导出文件会保留。',buttons:['继续处理','停止并退出'],defaultId:0,cancelId:0});if(choice===0){event.preventDefault();return;}event.preventDefault();download?.abort();if(jobs.active){const id=jobs.active,close=j=>{if(j.id===id&&j.status!=='running'){jobs.off('update',close);win.destroy();app.quit();}};jobs.on('update',close);jobs.cancel(id);}else{quitAfterDownload=true;}}});win.on('closed',()=>win=null);}
 Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform==='darwin'?[{label:'轻页文件工具箱',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'quit'}]},{role:'editMenu'},{role:'windowMenu'}]:[{role:'editMenu'}]));app.setAboutPanelOptions({applicationName:'轻页文件工具箱',applicationVersion:app.getVersion(),copyright:'AGPL-3.0-or-later · MuPDF © Artifex Software'});createWindow();app.on('activate',()=>{if(!win)createWindow();});app.on('window-all-closed',()=>app.quit());
};
