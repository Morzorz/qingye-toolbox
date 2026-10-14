import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream,constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {JobService} from '../src/jobs.mjs';
import {OPERATIONS} from '../src/catalog.mjs';
import {componentStatus} from '../src/components.mjs';
const basePolicy="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PREFIX='/app/qingye';
const inside=(root,p)=>{const r=path.relative(root,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export async function createApplication({roots,share,stateDir}){
 const allowed=await Promise.all(roots.filter(Boolean).map(p=>fs.realpath(p)));if(!allowed.length)throw Error('没有可用的共享或授权目录，请在飞牛应用设置中授权目录后重启应用');
 const inboxRoot=await fs.realpath(share);if(!allowed.some(r=>inside(r,inboxRoot)))throw Error('共享目录未授权');
 await fs.mkdir(stateDir,{recursive:true});
 const protectedRoots=await Promise.all([stateDir,project,process.env.TRIM_PKGETC,process.env.TRIM_PKGHOME].filter(Boolean).map(p=>fs.realpath(p).catch(()=>path.resolve(p))));
 const uploadBase=path.join(inboxRoot,'上传文件');
 try{if((await fs.lstat(uploadBase)).isDirectory())for(const entry of await fs.readdir(uploadBase,{withFileTypes:true})){if(!entry.isDirectory()||!/^\d+$/.test(entry.name))continue;const dir=path.join(uploadBase,entry.name);for(const f of await fs.readdir(dir,{withFileTypes:true}))if(f.isFile()&&/^\.upload-[a-f0-9-]{36}$/.test(f.name))await fs.unlink(path.join(dir,f.name));}}catch(e){if(e.code!=='ENOENT')throw e;}
 const jobs=new JobService(),owners=new Map(),uploads=new Map();let closing=false;
 const updateUpload=(id,uid,patch)=>{if(!id)return;uploads.set(id,{...(uploads.get(id)||{uid,createdAt:Date.now()}),...patch,uid,updatedAt:Date.now()});while(uploads.size>100)uploads.delete(uploads.keys().next().value);};
 async function authorize(inputs,out){for(const p of [...inputs,out]){if(typeof p!=='string'||!path.isAbsolute(p))throw fail('需要绝对路径');const real=await fs.realpath(p);if(!allowed.some(r=>inside(r,real))||protectedRoots.some(r=>inside(r,real)))throw fail('文件不在授权目录内或属于应用内部数据',403);}}
 async function location(p){await authorize([],p);return fs.realpath(p);}
 function own(uid,id){if(owners.get(id)!==uid)throw fail('任务不存在或无权访问',404);return jobs.snapshot(id);}
 function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>65536)throw fail('请求过大',413);}try{return JSON.parse(text);}catch{throw fail('无效 JSON');}}
 async function raw(req,limit){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail('上传分块过大',413);chunks.push(chunk);}return Buffer.concat(chunks,size);}
 const uploadInfo=(operation,name)=>{if(!OPERATIONS[operation]||typeof name!=='string'||name!==path.basename(name)||name.startsWith('.')||/[\\\x00-\x1f]/.test(name)||name.length>200||!OPERATIONS[operation].extensions.includes(path.extname(name).slice(1).toLowerCase()))throw fail('不支持的上传文件');return ['audio_convert','video_convert'].includes(operation)?20*1024**3:500*1024**2;};
 const session=(id,uid)=>{const item=uploads.get(id);if(!item||item.uid!==uid)throw fail('上传会话不存在或已过期',404);return item;};
 const assets={'styles.css':'src/styles.css','toolbox.css':'src/toolbox.css','catalog.mjs':'src/catalog.mjs','toolbox-ui.mjs':'src/toolbox-ui.mjs','bridge.js':'fnos/web/bridge.js','nas.css':'fnos/web/nas.css'};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',basePolicy);
  try{
   if(closing)throw fail('应用正在停止',503);
   const uid=req.headers['x-trim-userid'];if(typeof uid!=='string'||!/^\d+$/.test(uid)||req.headers['x-trim-isadmin']!=='true')throw fail('请使用飞牛管理员账号从桌面打开轻页',403);
   const url=new URL(req.url,'http://gateway.local');if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))throw fail('页面不存在',404);
   // fnOS gateway may rewrite Host while preserving the browser Origin. Cross-site requests cannot add our non-simple request header without a CORS preflight, and this Unix-socket service emits no CORS grant.
   if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(!['http:','https:'].includes(origin.protocol))throw Error('protocol');}catch{throw fail('无效来源',403);}}
   const route=url.pathname.slice(PREFIX.length)||'/';
   if(req.method==='POST'&&req.headers['x-qingye-request']!=='1')throw fail('无效请求标记',403);
   if(req.method==='GET'&&route==='/'){
    if(url.pathname===PREFIX){res.writeHead(302,{Location:PREFIX+'/'});res.end();return;}
    let html=await fs.readFile(path.join(project,'src/toolbox.html'),'utf8');html=html.replace("connect-src 'none'","connect-src 'self'").replace('<link rel="stylesheet" href="toolbox.css">','<link rel="stylesheet" href="toolbox.css"><link rel="stylesheet" href="nas.css">').replace('版本 1.1.1 · 支持 MCP','飞牛独立版 1.2.8').replaceAll('组件与 AI','组件与目录').replace('按需安装 · 离线转换','独立应用 · 本机转换').replace('让 AI 调用轻页','飞牛授权目录').replace('先授权文件夹，再将下方 MCP 配置加入支持本地 MCP 的 AI 客户端。无需额外安装 Node。','目录权限由飞牛应用设置管理。修改授权后请停止并重新启动轻页。').replace('仅处理授权目录中的文件，结果另存。普通网页聊天不会自动连接本地应用。','首版限飞牛管理员使用。只显示已授权目录，结果另存，原文件保留。').replace('按需安装组件','内置转换组件').replace('PDF 和图片功能已内置。音视频、办公文档组件安装一次后，可断网使用。','PDF、图片、音视频及办公转换组件随应用提供，无需另装。').replace('选择文件</button>','选择 NAS 文件</button>');
    // Deliver one hash-authorized classic script with the document. No module MIME or relative script URL dependency.
    const script=await fs.readFile(path.join(project,'fnos/web/app.bundle.js'),'utf8');
    const hash=createHash('sha256').update(script).digest('base64');
    const policy=basePolicy.replace("script-src 'self'",`script-src 'self' 'sha256-${hash}'`);
    html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'')
     .replace('<script type="module" src="toolbox-ui.mjs"></script>',()=>'<script>'+script+'</script>')
     .replace(/href="(styles\.css|toolbox\.css|nas\.css)"/g,(_,name)=>`href="${PREFIX}/${name}?v=1.2.8"`)
     .replace('<div id="message" role="status" aria-live="polite"></div>','<div id="message" role="status" aria-live="polite">界面正在加载；如菜单不能切换，请刷新页面。</div>');
    res.setHeader('Content-Security-Policy',policy);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
   }
   const asset=assets[route.slice(1)];if(req.method==='GET'&&asset){let data=await fs.readFile(path.join(project,asset));if(asset.endsWith('toolbox-ui.mjs'))data=Buffer.from(data.toString().replaceAll('组件与 AI','组件与目录'));res.writeHead(200,{'Content-Type':asset.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-cache'});res.end(data);return;}
   if(req.method==='GET'&&route==='/api/settings'){json(res,{roots:allowed,components:await componentStatus(),config:{json:''},user:{uid,name:req.headers['x-trim-username']||uid},sharedDirectory:inboxRoot});return;}
   if(req.method==='GET'&&route==='/api/list'){
    const requested=url.searchParams.get('path');if(!requested){json(res,{path:null,parent:null,entries:allowed.map(p=>({path:p,name:p,directory:true}))});return;}
    const dir=await location(requested);if(!(await fs.stat(dir)).isDirectory())throw fail('不是文件夹');const entries=[];
    const children=await fs.readdir(dir,{withFileTypes:true});if(children.length>10000)throw fail('目录项目过多，请直接输入更具体的子目录');
    for(const item of children){if(item.name.startsWith('.'))continue;try{const p=await location(path.join(dir,item.name)),s=await fs.stat(p);if(s.isDirectory()||s.isFile())entries.push({name:item.name,path:p,directory:s.isDirectory(),size:s.size});}catch{}}
    entries.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name,'zh-CN'));const parent=path.dirname(dir);json(res,{path:dir,parent:allowed.some(r=>inside(r,parent))?parent:null,entries});return;
   }
   if(req.method==='POST'&&route==='/api/select'){
    const {paths,operation}=await body(req);if(!OPERATIONS[operation]||!Array.isArray(paths)||paths.length>100)throw fail('文件选择无效');const added=[],errors=[];
    for(const p of paths){try{const real=await location(p),s=await fs.stat(real);if(!s.isFile()||!OPERATIONS[operation].extensions.includes(path.extname(real).slice(1).toLowerCase()))throw Error('不支持此文件类型');added.push({path:real,name:path.basename(real),size:s.size});}catch(e){errors.push(e.message);}}json(res,{added,errors});return;
   }
   if(req.method==='GET'&&route==='/api/upload-status'){const id=url.searchParams.get('id'),upload=uploads.get(id);if(!upload||upload.uid!==uid)throw fail('上传记录不存在或已过期',404);json(res,upload);return;}
   if(req.method==='POST'&&route==='/api/upload-start'){
    const {operation,name,size,id}=await body(req),limit=uploadInfo(operation,name);if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(id)||!Number.isSafeInteger(size)||size<1||size>limit)throw fail('上传参数无效');
    await fs.mkdir(uploadBase,{recursive:true});await location(uploadBase);const folder=path.join(uploadBase,uid);await fs.mkdir(folder,{recursive:true});await location(folder);
    const partial=path.join(folder,'.upload-'+id);await fs.writeFile(partial,Buffer.alloc(0),{flag:'wx',mode:0o600});updateUpload(id,uid,{id,operation,name,size,folder,partial,received:0,stage:'已创建上传会话',status:'receiving'});json(res,{id,chunkSize:512*1024});return;
   }
   if(req.method==='POST'&&route==='/api/upload-chunk'){
    const id=url.searchParams.get('id'),item=session(id,uid),chunk=await raw(req,512*1024);if(!chunk.length||item.received+chunk.length>item.size)throw fail('上传分块无效');await fs.appendFile(item.partial,chunk,{mode:0o600});updateUpload(id,uid,{stage:'正在写入 NAS',received:item.received+chunk.length,status:'receiving'});json(res,{received:item.received+chunk.length,size:item.size});return;
   }
   if(req.method==='POST'&&route==='/api/upload-finish'){
    const {id}=await body(req),item=session(id,uid);if(item.received!==item.size)throw fail('文件尚未完整上传');let dest;try{await location(item.folder);updateUpload(id,uid,{stage:'文件已收到，正在保存到共享目录',status:'saving'});for(let n=0;n<10000;n++){dest=path.join(item.folder,n?`${path.basename(item.name,path.extname(item.name))} (${n})${path.extname(item.name)}`:item.name);try{await fs.copyFile(item.partial,dest,constants.COPYFILE_EXCL);break;}catch(e){if(e.code!=='EEXIST'||n===9999)throw e;}}await fs.unlink(item.partial);updateUpload(id,uid,{stage:'保存完成',status:'completed',path:dest});json(res,{added:[{path:dest,name:path.basename(dest),size:item.size}],errors:[]});}catch(e){updateUpload(id,uid,{stage:'上传失败：'+e.message,status:'failed'});console.error('Qingye upload failed:',e.message);throw e;}return;
   }
   if(req.method==='POST'&&route==='/api/upload-cancel'){const {id}=await body(req),item=session(id,uid);await fs.unlink(item.partial).catch(()=>{});updateUpload(id,uid,{stage:'上传已取消',status:'cancelled'});json(res,{ok:true});return;}
   if(req.method==='POST'&&route==='/api/upload'){
    const operation=url.searchParams.get('operation'),name=url.searchParams.get('name'),uploadId=url.searchParams.get('id');if(uploadId&&!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId))throw fail('上传标识无效');if(!OPERATIONS[operation]||typeof name!=='string'||name!==path.basename(name)||name.startsWith('.')||/[\\\x00-\x1f]/.test(name)||name.length>200||!OPERATIONS[operation].extensions.includes(path.extname(name).slice(1).toLowerCase()))throw fail('不支持的上传文件');
    const limit=['audio_convert','video_convert'].includes(operation)?20*1024**3:500*1024**2;if(Number(req.headers['content-length'])>limit)throw fail('上传文件过大',413);
    await fs.mkdir(uploadBase,{recursive:true});await location(uploadBase);
    const folder=path.join(uploadBase,uid);await fs.mkdir(folder,{recursive:true});await location(folder);
    const partial=path.join(folder,'.upload-'+randomUUID());let count=0;updateUpload(uploadId,uid,{name,stage:'正在接收文件',received:0,status:'receiving'});
    try{await pipeline(req,new Transform({transform(chunk,enc,cb){count+=chunk.length;updateUpload(uploadId,uid,{name,stage:'正在写入 NAS',received:count,status:'receiving'});cb(count>limit?fail('上传文件超出大小限制',413):null,chunk);}}),createWriteStream(partial,{flags:'wx',mode:0o600}));if(!count)throw fail('空文件');await location(folder);let dest;updateUpload(uploadId,uid,{name,stage:'文件已收到，正在保存到共享目录',received:count,status:'saving'});
     for(let n=0;n<10000;n++){dest=path.join(folder,n?`${path.basename(name,path.extname(name))} (${n})${path.extname(name)}`:name);try{await fs.copyFile(partial,dest,constants.COPYFILE_EXCL);break;}catch(e){if(e.code!=='EEXIST'||n===9999)throw e;}}
     updateUpload(uploadId,uid,{name,stage:'保存完成',received:count,status:'completed',path:dest});json(res,{added:[{path:dest,name:path.basename(dest),size:count}],errors:[]});
    }catch(e){updateUpload(uploadId,uid,{name,stage:'上传失败：'+e.message,received:count,status:'failed'});console.error('Qingye upload failed:',e.message);throw e;}finally{await fs.unlink(partial).catch(()=>{});}return;
   }
   if(req.method==='POST'&&route==='/api/jobs'){const request=await body(req);const r=await jobs.submit(request,authorize);owners.set(r.jobId,uid);for(const id of owners.keys())if(!jobs.jobs.has(id))owners.delete(id);json(res,r);return;}
   if(req.method==='GET'&&route==='/api/job'){json(res,own(uid,url.searchParams.get('id')));return;}
   if(req.method==='POST'&&route==='/api/cancel'){const {id}=await body(req);own(uid,id);json(res,jobs.cancel(id));return;}
   if(req.method==='GET'&&route==='/api/download'){
    const j=own(uid,url.searchParams.get('id')),file=url.searchParams.get('path');if(!j.results.some(r=>r.outputs.includes(file)))throw fail('不是任务输出文件',403);const real=await location(file),s=await fs.stat(real);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':s.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(real))}`,'Cache-Control':'no-store'});await pipeline(createReadStream(real),res);return;
   }
   throw fail('接口不存在',404);
  }catch(e){if(!res.headersSent&&!res.destroyed)json(res,{error:e.code==='EACCES'?'目录无权限，请在飞牛应用设置中授权':e.code==='ENOENT'?'文件或目录不存在':e.message},e.status||400);else res.destroy();}
 });
 async function close(){closing=true;const stopped=new Promise(resolve=>server.close(resolve));server.closeIdleConnections();if(jobs.active){const id=jobs.active;const done=new Promise(resolve=>{const listener=j=>{if(j.id===id&&j.status!=='running'){jobs.off('update',listener);resolve();}};jobs.on('update',listener);});jobs.cancel(id);await done;}server.closeAllConnections();await stopped;}
 return {server,jobs,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const rootList=[...(process.env.TRIM_DATA_SHARE_PATHS||'').split(':'),...(process.env.TRIM_DATA_ACCESSIBLE_PATHS||'').split(':')].filter(Boolean),share=(process.env.TRIM_DATA_SHARE_PATHS||'').split(':').find(Boolean);
 if(!share)throw Error('飞牛共享目录尚未创建');
 const app=await createApplication({roots:rootList,share,stateDir:process.env.TRIM_PKGVAR}),socket=path.join(process.env.TRIM_APPDEST,'app.sock');
 await fs.unlink(socket).catch(e=>{if(e.code!=='ENOENT')throw e;});app.server.listen(socket,async()=>{await fs.chmod(socket,0o660);console.log('Qingye fnOS ready');});app.server.on('error',e=>{console.error(e.message);process.exitCode=1;});
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{app.close().then(()=>fs.unlink(socket).catch(()=>{})).then(()=>process.exit(0)).catch(()=>process.exit(1));});
}
