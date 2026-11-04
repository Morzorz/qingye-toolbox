import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream,constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {JobService} from '../src/jobs.mjs';
import {OPERATIONS} from '../src/catalog.mjs';
import {componentStatus} from '../src/components.mjs';
import {hwStatus} from '../src/hwaccel.mjs';
import {createLocalMcpServer} from './local-mcp.mjs';
import {startWebEntry,resolveWebEntryOptions} from './web-entry.mjs';

export const VERSION='1.2.14.0';
export const PREFIX='/app/qingye';
export const CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";

const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_ENTRIES=5000;          // /api/nas/list 返回条目上限（超出截断并给 warnings）
const MAX_CHILDREN=10000;        // 单个目录子项上限（超出 413 TOO_MANY）
const MAX_SELECT=100;            // /api/nas/select 一次最多文件数
const MAX_FOLDER=100;            // /api/nas/folder 一次最多加入文件数
const MAX_EXAMINED=10000;        // /api/nas/folder 最多检查目录项
const MAX_GRANTS=100;            // granted-roots.json 最多保留的目录数
// 控制字符与双向控制符在展示名称中替换为替换字符，避免列表显示错乱；`path` 保留原始值。
const CONTROL=/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

const inside=(root,p)=>{const r=path.relative(root,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
const display=value=>String(value??'').replace(CONTROL,'\uFFFD');
const extOf=name=>{const e=path.extname(name);return e?e.slice(1).toLowerCase():'';};
const fail=(message,status=400,code='BAD_REQUEST',hints=null)=>Object.assign(new Error(message),{status,code,hints});
const stamp=date=>date instanceof Date&&!Number.isNaN(date.getTime())?date.toISOString():null;

// 可执行的中文指引：按飞牛官方语义——ACL 由系统在授权时自动授予，授权结果即时返回，无需重启。
// 不要要求用户设置继承/子级权限，也不要要求重启应用。
const readHints=()=>[
 '轻页以独立应用账号运行，只读取飞牛明确授权给轻页的目录。',
 '在轻页的 NAS 选择弹窗里点「重新授权此文件夹」，飞牛授权完成后立即可用，无需重启应用。',
 '仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。',
 '如果目录刚被移动、改名或所在存储空间已卸载，请选择新的路径。'
];
const writeHints=()=>[
 '轻页以独立应用账号运行，只能写入飞牛明确授权给轻页的目录。',
 '在轻页的 NAS 选择弹窗里点「重新授权此文件夹」，飞牛授权完成后立即可用，无需重启应用。',
 '仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。',
 '如果目录刚被移动、改名或所在存储空间已卸载，请选择新的路径。'
];
const outsideHints=name=>[
 `该路径不在轻页已授权的目录内：${name}。`,
 '在轻页的 NAS 选择弹窗里点「重新授权此文件夹」，飞牛授权完成后立即可用，无需重启应用。',
 '仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。',
 '如果目录刚被移动、改名或所在存储空间已卸载，请选择新的路径。'
];
const grantDeniedHints=name=>[
 `飞牛还没有把该目录授权给轻页的应用账号：${name}。`,
 '在轻页的 NAS 选择弹窗里点「重新授权此文件夹」，飞牛授权完成后立即可用，无需重启应用。',
 '仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。',
 '如果目录刚被移动、改名或所在存储空间已卸载，请选择新的路径。'
];
const missingHints=name=>[
 `该路径不存在：${name}。`,
 '如果文件或文件夹被移动、改名或所在存储空间已卸载，请在「从 NAS 上选择」窗口中重新选择。',
 '如果该目录来自飞牛应用授权，请在 NAS 选择弹窗里点「重新授权此文件夹」。'
];
// 文件级指引（契约 §2.5c）：文件夹可读 ≠ 文件可读。重新授权只覆盖目录 ACE，不重写子文件的显式权限。
const childFileHints=()=>[
 '文件夹本身可读，但这些文件的权限没有包含轻页账号（常见于 0600 或属主为其他应用账号的历史文件）。',
 '飞牛的文件管理器 → 选中这些文件/上级文件夹 → 详细信息 → 权限 → 高级：把权限应用到此文件夹、子文件夹和文件（或对该文件夹执行“重置子级权限”），再回到轻页刷新。',
 '也可以把它们复制/移动到 qingye/files 共享目录，共享目录由飞牛自动授权给轻页，复制后的新文件会继承目录权限。',
 '如果确认上级目录已经授权仍然不行，请在弹窗内点「重新授权此文件夹」；授权只覆盖该目录的 ACE，不会重写子文件的显式权限。'
];
const fileHints=name=>[
 `轻页无法读取这个文件：${name}。`,
 '常见原因是文件的权限没有包含轻页账号（如 0600/0640，或属主是其他应用账号），也可能是文件上带着显式的 ACL 条目。',
 '飞牛的文件管理器 → 选中该文件 → 详细信息 → 权限 → 高级：为轻页的运行账号补上读取权限；或把文件复制到 qingye/files 共享目录，新文件会继承目录权限。',
 '「重新授权此文件夹」只覆盖目录 ACE，不会重写子文件的显式权限。'
];
const localHints=name=>[
 `${name} 属于轻页的应用内部目录（应用数据、程序文件或运行配置）。`,
 '请在 NAS 选择弹窗里选择共享目录，或点「重新授权此文件夹」授权一个普通文件夹。'
];

// 只暴露页面真正引用的三个静态资源；其余（catalog.mjs、bridge.js 等）在构建期已打进 app.js。
const assets={
 'app.js':{file:'fnos/web/app.bundle.js',type:'text/javascript; charset=utf-8'},
 'app.css':{file:'src/ui/app.css',type:'text/css; charset=utf-8'},
 'styles.css':{file:'src/styles.css',type:'text/css; charset=utf-8'}
};

/**
 * 共享目录候选（按官方机制探测，任一命中即用）：
 * 1) TRIM_DATA_SHARE_PATHS 第一段；2) dirname(TRIM_APPDEST)/share/files；
 * 3) TRIM_APPDEST/share/files；4) /var/apps/{appname}/share/files 软链。
 * `name=qingye/files` 的软链只取最后一段（files）。
 */
function defaultShareCandidates(appName){
 const list=[];
 const first=(process.env.TRIM_DATA_SHARE_PATHS||'').split(':').filter(Boolean)[0];
 if(first)list.push(first);
 const dest=process.env.TRIM_APPDEST||'';
 if(dest){list.push(path.join(path.dirname(dest),'share','files'));list.push(path.join(dest,'share','files'));}
 list.push(`/var/apps/${appName}/share/files`);
 return list;
}

export async function createApplication({roots=[],share=null,shares=null,shareName=null,stateDir,label='飞牛独立版',version=VERSION,defaultOutput=process.env.QINGYE_DEFAULT_OUTPUT||null,web=null}={}){
 // 状态目录（应用数据）：不可写时退避到系统临时目录，绝不让启动因为日志/历史文件失败。
 const requestedState=path.resolve(stateDir||path.join(os.tmpdir(),'qingye-state'));
 let stateHome=requestedState;
 try{await fs.mkdir(stateHome,{recursive:true});}
 catch{try{stateHome=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-state-'));await fs.mkdir(stateHome,{recursive:true});}catch{stateHome=path.join(os.tmpdir(),'qingye-state');await fs.mkdir(stateHome,{recursive:true}).catch(()=>{});}}
 const logFile=path.join(stateHome,'app.log');
 const log=async message=>{try{await fs.appendFile(logFile,`${new Date().toISOString()} ${message}\n`);}catch{}};
 await log(`启动轻页 ${label} ${version}`);

 const appName=process.env.TRIM_APPNAME||'qingye';
 const missingRoots=[];          // 授权过但当前不可解析的路径：只用于提示，不阻断启动
 const rootMap=new Map();        // realpath → {path, shared}
 const granted=[];               // 已持久化的即时授权目录（realpath）

 async function registerRoot(requested,shared=false){
  const candidate=typeof requested==='string'?requested.trim():'';
  if(!candidate)return null;
  let real;
  try{real=await fs.realpath(candidate);}
  catch(error){missingRoots.push(candidate);await log(`跳过不可用的授权目录：${candidate}（${error.code||error.message}）`);return null;}
  const stat=await fs.stat(real).catch(()=>null);
  if(!stat||!stat.isDirectory()){missingRoots.push(candidate);await log(`跳过不是文件夹的授权目录：${candidate}`);return null;}
  const existing=rootMap.get(real);
  if(existing){if(shared)existing.shared=true;return real;}
  rootMap.set(real,{path:real,shared:!!shared});
  return real;
 }

 // 共享目录：只探测一次；不存在时 mkdir -p 兜底（安装后系统本应已创建），全部失败才报错。
 const shareCandidates=[...new Set([
  ...(Array.isArray(shares)?shares:shares?[shares]:[]),
  ...(Array.isArray(share)?share:share?[share]:[]),
  ...defaultShareCandidates(appName)
 ].filter(Boolean))];
 let sharedRoot=null;
 for(const candidate of shareCandidates){
  let real=null;
  try{real=await fs.realpath(candidate);}
  catch(error){
   if(error.code!=='ENOENT')await log(`共享目录不可用：${candidate}（${error.code||error.message}）`);
   try{await fs.mkdir(candidate,{recursive:true});real=await fs.realpath(candidate);await log(`已创建共享目录：${candidate}`);}
   catch(createError){await log(`共享目录创建失败：${candidate}（${createError.code||createError.message}）`);continue;}
  }
  if(!real)continue;
  const stat=await fs.stat(real).catch(()=>null);
  if(!stat||!stat.isDirectory()){await log(`共享目录不是文件夹：${candidate}`);continue;}
  sharedRoot=real;break;
 }
 if(!sharedRoot)throw Error('飞牛共享目录尚未创建。请在飞牛「应用中心 → 轻页」重新安装或启动应用，让系统创建共享目录 qingye/files。');
 rootMap.set(sharedRoot,{path:sharedRoot,shared:true});

 // 即时授权（§2.5b）：启动时逐条 realpath 校验，失效的丢弃并计入 missingRoots。
 const grantedFile=path.join(stateHome,'granted-roots.json');
 const writeGranted=async()=>{
  try{const temp=grantedFile+'.tmp';await fs.writeFile(temp,JSON.stringify(granted,null,2),{mode:0o600});await fs.rename(temp,grantedFile);await fs.chmod(grantedFile,0o600).catch(()=>{});}
  catch(error){await log(`即时授权写入失败：${error.message}`);}
 };
 try{
  const stored=JSON.parse(await fs.readFile(grantedFile,'utf8'));
  const items=Array.isArray(stored)?stored.slice(0,MAX_GRANTS).filter(item=>typeof item==='string'):[];
  let dropped=0;
  for(const item of items){
   const real=await registerRoot(item,false);
   if(real){if(!granted.includes(real))granted.push(real);}else dropped++;
  }
  if(dropped){await log(`丢弃 ${dropped} 个已失效的即时授权目录`);await writeGranted();}
 }catch(error){if(error.code!=='ENOENT')await log(`即时授权记录读取失败：${error.message}`);}

 // 其余授权目录：按路径排序后逐个登记；单个失效只跳过并记录。
 const rest=[...new Set([...roots.filter(Boolean),...(process.env.TRIM_DATA_ACCESSIBLE_PATHS||'').split(':').filter(Boolean)])].map(String).sort((a,b)=>a.localeCompare(b));
 for(const candidate of rest)await registerRoot(candidate,false);

 let rootList=[];
 // 顺序：共享目录在前，其余授权目录按路径排序。
 const refreshRoots=()=>{rootList=[...rootMap.values()].sort((a,b)=>Number(b.shared)-Number(a.shared)||a.path.localeCompare(b.path));};
 refreshRoots();
 if(!rootList.length)await log('没有可用的共享或授权目录，页面会给出授权指引。');

 const protectedRoots=(await Promise.all([stateHome,project,process.env.TRIM_PKGETC,process.env.TRIM_PKGHOME].filter(Boolean).map(p=>fs.realpath(p).catch(()=>path.resolve(p))))).filter(Boolean);

 // 读/写判定：目录需要 R_OK|X_OK（遍历要执行位），文件用 R_OK，写统一 W_OK。
 const canRead=p=>fs.access(p,constants.R_OK).then(()=>true,()=>false);
 const canTraverse=p=>fs.access(p,constants.R_OK|constants.X_OK).then(()=>true,()=>false);
 const canWrite=p=>fs.access(p,constants.W_OK).then(()=>true,()=>false);
 const isDirectory=p=>fs.stat(p).then(stat=>stat.isDirectory(),()=>false);
 const readablePath=async p=>await isDirectory(p)?canTraverse(p):canRead(p);
 const rootName=root=>{
  if(shareName&&root===sharedRoot)return shareName;
  const base=path.basename(root),parent=path.basename(path.dirname(root));
  return parent===appName?`${appName}/${base}`:base;
 };

 const jobs=new JobService({historyFile:path.join(stateHome,'jobs.json')}),uploads=new Map();
 await jobs.loadHistory().catch(error=>log(`历史任务读取失败：${error.message}`));
 let closing=false,currentUid=null;
 let defaultOutputPath=null;
 for(const candidate of [defaultOutput,sharedRoot,...rootList.map(root=>root.path)].filter(Boolean)){
  try{const real=await fs.realpath(candidate);
   if(!rootList.some(root=>inside(root.path,real)))continue;
   if(protectedRoots.some(root=>inside(root,real)))continue;
   if(!(await canWrite(real)))continue;
   defaultOutputPath=real;break;
  }catch{}
 }

 const uploadBase=()=>path.join(sharedRoot,'上传文件');
 // 清理上次异常退出留下的分片临时文件，保留已完成文件。
 try{
  const base=uploadBase();
  if((await fs.lstat(base)).isDirectory())
   for(const entry of await fs.readdir(base,{withFileTypes:true})){
    if(!entry.isDirectory()||!/^\d+$/.test(entry.name))continue;
    const dir=path.join(base,entry.name);
    for(const file of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[]))
     if(file.isFile()&&/^\.upload-[a-f0-9-]{36}$/.test(file.name))await fs.unlink(path.join(dir,file.name)).catch(()=>{});
   }
 }catch(error){if(error.code!=='ENOENT')await log(`上传临时文件清理跳过：${error.message}`);}

 /** 解析并校验路径：绝对路径 → realpath → 位于授权根内 → 不属于应用内部目录。 */
 async function resolvePath(raw,{label:what='文件' }={}){
  if(typeof raw!=='string'||!raw.trim())throw fail(`需要提供${what}的绝对路径`,400,'INVALID_PATH');
  if(!path.isAbsolute(raw))throw fail(`需要提供${what}的绝对路径`,400,'INVALID_PATH');
  let real;
  try{real=await fs.realpath(raw);}
  catch(error){
   if(error.code==='ENOENT')throw fail(`文件或目录不存在：${display(path.basename(raw))}`,404,'NOT_FOUND',missingHints(display(raw)));
   if(error.code==='EACCES'||error.code==='EPERM')throw fail(`轻页没有访问权限：${display(raw)}`,403,'NO_READ',readHints());
   if(error.code==='ELOOP')throw fail('符号链接循环，无法访问该路径',400,'SYMLINK_LOOP');
   throw fail(`无法访问该路径：${display(raw)}（${error.code||error.message}）`,400,'PATH_ERROR');
  }
  if(!rootList.some(root=>inside(root.path,real)))throw fail(`该路径不在轻页的授权目录内：${display(raw)}`,403,'OUTSIDE_ROOT',outsideHints(display(raw)));
  if(protectedRoots.some(root=>inside(root,real)))throw fail(`该路径是轻页的应用内部目录，不能处理：${display(raw)}`,403,'PROTECTED_PATH',localHints(display(path.basename(real))));
  return real;
 }
 const rootOf=real=>rootList.find(root=>inside(root.path,real))?.path||null;
 /** 解析路径并校验可读（目录按 R_OK|X_OK）。 */
 async function location(raw){
  const real=await resolvePath(raw);
  if(!(await readablePath(real)))throw fail(`轻页没有读取此路径的权限：${display(path.basename(real))}`,403,'NO_READ',readHints());
  return real;
 }
 /** JobService 授权回调：输入需可读、输出需可写，全部位于授权根内。 */
 async function authorize(inputs=[],outputDir){
  for(const input of inputs){
   const real=await resolvePath(input);
   if(!(await canRead(real)))throw fail(`轻页没有读取此文件的权限：${display(path.basename(real))}`,403,'NO_READ',readHints());
  }
  if(outputDir){
   const real=await resolvePath(outputDir,{label:'输出目录'});
   if(!(await canWrite(real)))throw fail(`轻页没有写入此输出文件夹的权限：${display(real)}`,403,'NO_WRITE',writeHints());
  }
 }

 function own(uid,id){if(jobs.jobs.get(id)?.owner!==uid)throw fail('任务不存在或无权访问',404,'JOB_NOT_FOUND');return jobs.snapshot(id);}
 function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>65536)throw fail('请求过大',413,'BODY_TOO_LARGE');}try{return JSON.parse(text||'{}');}catch{throw fail('无效 JSON',400,'INVALID_JSON');}}
 async function rawBody(req,limit){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail('上传分块过大',413,'CHUNK_TOO_LARGE');chunks.push(chunk);}return Buffer.concat(chunks,size);}
 const uploadLimit=operation=>['audio_convert','video_convert'].includes(operation)?20*1024**3:500*1024**2;
 const uploadInfo=(operation,name)=>{
  if(!OPERATIONS[operation]||typeof name!=='string'||!name||name!==path.basename(name)||name.startsWith('.')||/[\\/\x00-\x1f]/.test(name)||name.length>200||!OPERATIONS[operation].extensions.includes(extOf(name)))throw fail('不支持的上传文件',400,'UNSUPPORTED_UPLOAD',[`当前处理方式只接受 ${(OPERATIONS[operation]?.extensions||[]).map(ext=>ext.toUpperCase()).join('、')||'已支持类型'} 文件；文件名不能包含路径分隔符或控制字符。`]);
  return uploadLimit(operation);
 };
 const session=(id,uid)=>{const item=uploads.get(id);if(!item||item.uid!==uid)throw fail('上传会话不存在或已过期',404,'UPLOAD_SESSION');return item;};
 const updateUpload=(id,uid,patch)=>{if(!id)return;uploads.set(id,{...(uploads.get(id)||{uid,createdAt:Date.now()}),...patch,uid,updatedAt:Date.now()});while(uploads.size>100)uploads.delete(uploads.keys().next().value);};

 /** 单个目录项的展示事实：绝不因为 stat/realpath 失败而丢弃条目。 */
 async function describeEntry(dir,item,root,extensions){
  const raw=path.join(dir,item.name);
  const result={name:display(item.name),path:raw,kind:item.isDirectory()?'dir':'file',size:0,mtime:null,extension:extOf(item.name),mode:null,owner:null,matches:false,readable:false,writable:false,disabled:false,disabledReason:null,note:null};
  const block=reason=>{result.disabled=true;result.disabledReason=reason;};
  // 目录不可读与「目录可读、文件不可读」是两种不同的权限问题，文案必须区分（契约 §2.5c）。
  const noReadReason=()=>result.kind==='dir'?'没有读取权限（文件夹）':'没有读取权限（文件权限未包含轻页账号）';
  const finishInfo=()=>{result.matches=result.kind!=='dir'&&extensions.includes(result.extension);return result;};
  let real;
  try{real=await fs.realpath(raw);}
  catch(error){
   block(error.code==='ELOOP'?'符号链接循环，无法访问':error.code==='EACCES'||error.code==='EPERM'?noReadReason():'链接已失效（目标不存在）');
   if(item.isSymbolicLink())result.note='符号链接';
   return finishInfo();
  }
  if(!inside(root,real)){block('链接指向授权目录之外');if(item.isSymbolicLink())result.note='符号链接';return finishInfo();}
  if(protectedRoots.some(guard=>inside(guard,real))){block('属于轻页应用内部目录');if(item.isSymbolicLink())result.note='符号链接';return finishInfo();}
  let stat;
  try{stat=await fs.stat(real);}
  catch{block('无法读取文件信息');if(item.isSymbolicLink())result.note='符号链接';return finishInfo();}
  result.path=real;
  result.kind=stat.isDirectory()?'dir':stat.isFile()?'file':'other';
  result.size=stat.isFile()?stat.size:0;
  result.mtime=stamp(stat.mtime);
  result.extension=stat.isDirectory()?'':extOf(real);
  result.mode=`${(0o7777&stat.mode).toString(8).padStart(4,'0')}`;
  result.owner=`${stat.uid}:${stat.gid}`;
  if(item.isSymbolicLink())result.note='符号链接';
  result.readable=result.kind==='dir'?await canTraverse(real):await canRead(real);
  result.writable=await canWrite(real);
  if(!result.readable)block(noReadReason());
  else if(result.kind==='other')block('不是普通文件或文件夹');
  return finishInfo();
 }

 /** settings 与 grant 共用的 roots 投影。 */
 async function rootsPayload(){
  const out=[];
  for(const root of rootList)out.push({path:root.path,name:rootName(root.path),writable:await canWrite(root.path),shared:root.shared});
  return out;
 }

 async function settingsPayload(){
  const components=await componentStatus().catch(()=>({media:null,office:null}));
  // 契约 §2.8：飞牛版只可能跑在 Linux，用内置 ffmpeg 只探测 VAAPI（结果按 binary+mtime+device 缓存）。
  const hardware=await hwStatus(components.media,{backends:['vaapi']}).catch(()=>({available:false,reason:'硬件探测失败'}));
  return {
   version,label,
   user:{uid:currentUid??null},
   roots:await rootsPayload(),
   sharedDirectory:sharedRoot,
   defaultOutput:defaultOutputPath,
   missingRoots:[...missingRoots],
   components,
   hardware,
   web:web&&web.url?{url:web.url,loopback:true}:null,
   config:{json:JSON.stringify({mcp:{servers:{qingye:{url:'http://127.0.0.1:32180/mcp',transport:'streamable-http',enabled:true}}}},null,2)}
  };
 }

 /** 契约 2.2：列目录（根列表 / 子目录），绝不静默丢条目。 */
 async function listHandler(url,res){
  const operation=url.searchParams.get('operation')||'';
  const extensions=OPERATIONS[operation]?.extensions||[];
  const requested=url.searchParams.get('path')||'';
  if(!requested){
   const entries=[],warnings=[];
   for(const root of rootList){
    const readable=await canTraverse(root.path),writable=await canWrite(root.path);
    const info=await fs.stat(root.path).catch(()=>null);
    entries.push({name:rootName(root.path),path:root.path,kind:'dir',size:0,mtime:stamp(info?.mtime),extension:'',mode:info?`${(0o7777&info.mode).toString(8).padStart(4,'0')}`:null,owner:info?`${info.uid}:${info.gid}`:null,matches:false,readable,writable,disabled:!readable,disabledReason:readable?null:'没有读取权限（文件夹）',note:null,root:true,shared:root.shared});
   }
   if(!entries.length)warnings.push('还没有可用的授权目录。请在 NAS 选择弹窗里点「重新授权此文件夹」，或到飞牛应用设置 → 目录授权添加文件夹。');
   if(missingRoots.length)warnings.push(`有 ${missingRoots.length} 个目录已失效并被跳过：${missingRoots.map(display).join('、')}。请在 NAS 选择弹窗里重新授权，或到飞牛应用设置 → 目录授权重新选择。`);
   json(res,{path:null,name:null,parent:null,root:null,operation:operation||null,extensions,permissions:{read:true,write:entries.some(entry=>entry.writable)},counts:{directories:entries.length,files:0,matched:0,hidden:0,blocked:entries.filter(entry=>entry.disabled).length},entries,warnings});
   return;
  }
  const dir=await resolvePath(requested,{label:'目录'});
  const root=rootOf(dir);
  const stat=await fs.stat(dir).catch(()=>null);
  if(!stat)throw fail(`无法读取文件夹：${display(requested)}`,400,'PATH_ERROR');
  if(!stat.isDirectory())throw fail(`不是文件夹：${display(path.basename(dir))}`,400,'NOT_DIRECTORY',['请选择一个文件夹；在「从 NAS 上选择」窗口中单击文件夹即可进入。']);
  const name=display(path.basename(dir));
  if(!(await canTraverse(dir)))throw fail(`轻页无法读取此文件夹：${name}`,403,'NO_READ',readHints());
  let children;
  try{children=await fs.readdir(dir,{withFileTypes:true});}
  catch(error){
   if(error.code==='EACCES'||error.code==='EPERM')throw fail(`轻页无法读取此文件夹：${name}`,403,'NO_READ',readHints());
   throw fail(`无法打开文件夹：${name}`,400,'PATH_ERROR');
  }
  if(children.length>MAX_CHILDREN)throw fail(`目录项目过多（${children.length} 个），请进入更具体的子文件夹`,413,'TOO_MANY',[`单个文件夹最多列出 ${MAX_CHILDREN} 个项目；请进入子文件夹后再选择。`]);
  const counts={directories:0,files:0,matched:0,hidden:0,blocked:0},entries=[],warnings=[];
  for(const child of children){
   if(child.name.startsWith('.')){counts.hidden++;continue;}
   entries.push(await describeEntry(dir,child,root||dir,extensions));
  }
  for(const entry of entries){
   if(entry.kind==='dir')counts.directories++;else counts.files++;
   if(entry.matches)counts.matched++;
   if(entry.disabled)counts.blocked++;
  }
  entries.sort((a,b)=>Number(b.kind==='dir')-Number(a.kind==='dir')||a.name.localeCompare(b.name,'zh-CN'));
  let visible=entries;
  if(entries.length>MAX_ENTRIES){visible=entries.slice(0,MAX_ENTRIES);warnings.push(`目录项目过多，只显示前 ${MAX_ENTRIES} 项；请进入更具体的子文件夹。`);}
  if(counts.blocked)warnings.push(`${counts.blocked} 个项目不可用（没有读取权限或链接越界），已在列表中标注原因`);
  if(!visible.length&&!counts.hidden)warnings.push('这个文件夹是空的');
  const parent=path.dirname(dir);
  json(res,{path:dir,name,parent:root&&inside(root,parent)?parent:null,root,operation:operation||null,extensions,permissions:{read:true,write:await canWrite(dir)},counts,entries:visible,warnings});
 }

 /** 契约 2.3：文件选择，每项独立失败。 */
 async function selectHandler(req,res){
  const {paths,operation}=await body(req);
  const extensions=OPERATIONS[operation]?.extensions;
  if(!extensions)throw fail('不支持的处理方式',400,'INVALID_OPERATION',['请在页面顶部的「处理方式」下拉框中选择一种方式后重试。']);
  if(!Array.isArray(paths)||paths.length>MAX_SELECT)throw fail(`一次最多选择 ${MAX_SELECT} 个文件`,400,'INVALID_SELECTION');
  const added=[],errors=[],skipped=[];
  for(const item of paths){
   const label=display(typeof item==='string'?path.basename(item):String(item));
   try{
    const real=await resolvePath(item);
    const stat=await fs.stat(real).catch(()=>{throw fail('不是普通文件',400,'NOT_FILE');});
    if(!stat.isFile())throw fail('不是普通文件',400,'NOT_FILE');
    if(!extensions.includes(extOf(real)))throw fail(`不支持此文件类型（当前处理方式只接受 ${extensions.map(ext=>ext.toUpperCase()).join('、')}）`,400,'UNSUPPORTED_TYPE');
    if(!(await canRead(real)))throw fail('没有读取权限',403,'NO_READ');
    added.push({path:real,name:path.basename(real),size:stat.size});
   }catch(error){
    errors.push(`${label}：${error.message}`);
    skipped.push({path:typeof item==='string'?item:null,reason:error.message,code:error.code||'ERROR'});
   }
  }
  json(res,{added,errors,skipped});
 }

 /** 契约 2.4：文件夹递归批量加入（BFS，最多 100 个文件 / 10000 个目录项）。 */
 async function folderHandler(req,res){
  const {folder,operation}=await body(req);
  const extensions=OPERATIONS[operation]?.extensions;
  if(!extensions)throw fail('不支持的处理方式',400,'INVALID_OPERATION',['请在页面顶部的「处理方式」下拉框中选择一种方式后重试。']);
  const start=await resolvePath(folder,{label:'文件夹'});
  const stat=await fs.stat(start).catch(()=>null);
  if(!stat||!stat.isDirectory())throw fail(`不是文件夹：${display(path.basename(start))}`,400,'NOT_DIRECTORY',['请选择一个文件夹；在「从 NAS 上选择」窗口中单击文件夹即可进入。']);
  const name=display(path.basename(start));
  if(!(await canTraverse(start)))throw fail(`轻页无法读取此文件夹：${name}`,403,'NO_READ',readHints());
  const root=rootOf(start)||start;
  const queue=[start],added=[],errors=[];let examined=0,folders=0,truncated=false;
  const relative=p=>display(path.relative(start,p)||path.basename(p));
  while(queue.length&&added.length<MAX_FOLDER){
   const dir=queue.shift();folders++;
   let items;
   try{items=await fs.readdir(dir,{withFileTypes:true});}
   catch(error){errors.push(`${relative(dir)}：${error.code==='EACCES'||error.code==='EPERM'?'没有读取权限':'无法打开文件夹'}`);continue;}
   items.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
   for(const item of items){
    if(++examined>MAX_EXAMINED){truncated=true;break;}
    if(item.name.startsWith('.'))continue;
    const candidate=path.join(dir,item.name);
    if(item.isSymbolicLink()){
     let real;
     try{real=await fs.realpath(candidate);}catch{continue;}
     if(!inside(root,real))continue;
     const target=await fs.stat(real).catch(()=>null);
     if(!target)continue;
     if(target.isDirectory()){queue.push(real);continue;}
     if(!target.isFile()||!extensions.includes(extOf(real)))continue;
     if(!(await canRead(real))){errors.push(`${relative(real)}：没有读取权限`);continue;}
     added.push({path:real,name:path.relative(start,real),size:target.size});
     if(added.length>=MAX_FOLDER)break;
     continue;
    }
    if(item.isDirectory()){queue.push(candidate);continue;}
    if(!item.isFile())continue;
    if(!extensions.includes(extOf(item.name)))continue;
    let real,target;
    try{real=await fs.realpath(candidate);target=await fs.stat(real);}
    catch(error){errors.push(`${display(item.name)}：${error.code==='ENOENT'?'已不存在':'无法读取文件信息'}`);continue;}
    if(!(await canRead(real))){errors.push(`${display(item.name)}：没有读取权限`);continue;}
    added.push({path:real,name:path.relative(start,real),size:target.size});
    if(added.length>=MAX_FOLDER)break;
   }
   if(truncated)break;
  }
  if(truncated||added.length>=MAX_FOLDER)truncated=true;
  if(!added.length&&!errors.length)errors.push(`所选文件夹及其子文件夹中没有 ${extensions.map(ext=>ext.toUpperCase()).join('、')} 文件`);
  if(truncated)errors.push(`一次最多加入 ${MAX_FOLDER} 个文件、扫描 ${MAX_EXAMINED} 个目录项；请缩小文件夹范围后重试`);
  json(res,{added,errors,summary:{matched:added.length,examined,truncated,folders}});
 }

 /** 契约 2.5：权限诊断，永不抛错。 */
 async function permissionHandler(req,res){
  const {path:rawPath,mode='r'}=await body(req);
  const target=typeof rawPath==='string'?rawPath:'';
  const name=display(target);
  const base={path:target||null,exists:false,kind:null,readable:false,writable:false,mode:null,owner:null,insideGrant:false,hints:[]};
  const reply=payload=>json(res,{...base,...payload});
  if(!target||!path.isAbsolute(target))return reply({hints:['需要提供绝对路径。请在「从 NAS 上选择」窗口中使用「检查目录权限」，或点「重新授权此文件夹」。']});
  let info;
  try{info=await fs.lstat(target);}
  catch(error){
   if(error.code==='EACCES'||error.code==='EPERM')return reply({exists:true,kind:null,hints:readHints()});
   return reply({hints:missingHints(name)});
  }
  let real;
  try{real=await fs.realpath(target);}
  catch{
   return reply({exists:true,kind:info.isSymbolicLink()?'symlink':null,hints:['该路径是失效的符号链接（目标已不存在）。','在「从 NAS 上选择」窗口中刷新目录，或删除失效链接后重新选择目标。']});
  }
  const within=rootList.some(root=>inside(root.path,real))&&!protectedRoots.some(root=>inside(root,real));
  const stat=await fs.stat(real).catch(()=>null);
  const kind=stat?(stat.isDirectory()?'directory':stat.isFile()?'file':'other'):null;
  const readable=stat?(stat.isDirectory()?await canTraverse(real):await canRead(real)):false;
  const writable=stat?await canWrite(real):false;
  // 目录可读时再给出子项权限分布：区分「目录不可读」与「目录可读、子文件不可读」（契约 §2.5c）。
  const children=kind==='directory'&&readable?await childSummary(real):null;
  const hints=[];
  if(!within)hints.push(...outsideHints(name));
  else if(!readable)hints.push(...(kind==='directory'?readHints():fileHints(display(path.basename(real)))));
  else if(mode==='w'&&!writable)hints.push(...writeHints());
  else if(children&&children.blocked>0)hints.push(...childFileHints());
  const payload={
   path:real,exists:true,kind,
   readable,writable,
   mode:stat?`${(0o7777&stat.mode).toString(8).padStart(4,'0')}`:null,
   owner:stat?`${stat.uid}:${stat.gid}`:null,
   insideGrant:within,
   hints
  };
  if(children)payload.children=children;
  reply(payload);
 }

 /** 契约 §2.5c：可读目录的子项权限分布（最多扫描 200 项，单项失败不影响整体）。 */
 async function childSummary(dir){
  const MAX_SCAN=200,MAX_SAMPLES=10;
  const summary={scanned:0,readable:0,blocked:0,truncated:false,owners:[],modes:[],samples:[]};
  let items;
  try{items=await fs.readdir(dir,{withFileTypes:true});}
  catch{return summary;}
  const visible=items.filter(item=>!item.name.startsWith('.'));
  summary.truncated=visible.length>MAX_SCAN;
  const owners=new Map(),modes=new Map();
  for(const item of visible.slice(0,MAX_SCAN)){
   summary.scanned++;
   const target=path.join(dir,item.name);
   let mode=null,owner=null,readable=false;
   try{
    const childStat=await fs.stat(target).catch(()=>null);
    if(childStat){
     mode=`${(0o7777&childStat.mode).toString(8).padStart(4,'0')}`;
     owner=`${childStat.uid}:${childStat.gid}`;
     readable=childStat.isDirectory()?await canTraverse(target):await canRead(target);
    }
   }catch{readable=false;}
   if(mode)modes.set(mode,(modes.get(mode)||0)+1);
   if(owner)owners.set(owner,(owners.get(owner)||0)+1);
   if(readable)summary.readable++;else summary.blocked++;
   if(!readable&&summary.samples.length<MAX_SAMPLES)summary.samples.push({name:display(item.name),mode,owner,readable:false});
  }
  const byCount=(a,b)=>b.count-a.count||String(a.value).localeCompare(String(b.value));
  summary.owners=[...owners].map(([owner,count])=>({owner,count,value:owner})).sort(byCount).map(({owner,count})=>({owner,count}));
  summary.modes=[...modes].map(([mode,count])=>({mode,count,value:mode})).sort(byCount).map(({mode,count})=>({mode,count}));
  return summary;
 }

 /** 契约 2.5b：飞牛授权完成后即时并入进程内授权集，并持久化到 granted-roots.json。 */
 async function grantHandler(req,res){
  const {path:rawPath}=await body(req);
  const target=typeof rawPath==='string'?rawPath.trim():'';
  const deny=message=>{throw fail(message,403,'GRANT_DENIED',grantDeniedHints(display(target||'（空）')));};
  if(!target||!path.isAbsolute(target))deny('需要提供文件夹的绝对路径');
  let real;
  try{real=await fs.realpath(target);}
  catch{deny('该文件夹不存在或链接已失效');}
  const stat=await fs.stat(real).catch(()=>null);
  if(!stat||!stat.isDirectory())deny('只能授权已存在的文件夹');
  if(protectedRoots.some(root=>inside(root,real)))deny('该文件夹属于轻页的应用内部目录，不能授权');
  if(!(await canTraverse(real)))deny('飞牛尚未把该文件夹授权给轻页的应用账号，暂时无法读取');
  rootMap.set(real,{path:real,shared:sharedRoot===real});
  if(!granted.includes(real)){
   granted.push(real);
   if(granted.length>MAX_GRANTS)granted.splice(0,granted.length-MAX_GRANTS);
   await writeGranted();
  }
  refreshRoots();
  await log(`即时授权目录：${real}`);
  json(res,{path:real,roots:await rootsPayload()});
 }

 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',CSP);
  try{
   if(closing)throw fail('应用正在停止，请稍后重新打开轻页',503,'CLOSING');
   const uid=req.headers['x-trim-userid'];
   if(typeof uid!=='string'||!/^\d+$/.test(uid)||req.headers['x-trim-isadmin']!=='true')throw fail('请使用飞牛管理员账号从桌面打开轻页',403,'AUTH_REQUIRED',['轻页首版只允许飞牛管理员使用。','请在飞牛桌面用管理员账号打开「轻页文件工具箱」。']);
   const url=new URL(req.url,'http://gateway.local');
   if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))throw fail('页面不存在',404,'NOT_FOUND');
   // 飞牛网关会改写 Host 但保留浏览器 Origin；跨站请求无法在不触发预检的情况下附加自定义请求头。
   if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(!['http:','https:'].includes(origin.protocol))throw Error('protocol');}catch{throw fail('无效来源',403,'BAD_ORIGIN');}}
   const route=url.pathname.slice(PREFIX.length)||'/';
   if(req.method==='POST'&&req.headers['x-qingye-request']!=='1')throw fail('无效请求标记',403,'BAD_REQUEST_MARKER');

   if(req.method==='GET'&&route==='/'){
    if(url.pathname===PREFIX){res.writeHead(302,{Location:PREFIX+'/'});res.end();return;}
    let html;
    try{html=await fs.readFile(path.join(project,'fnos/web/index.html'));}
    catch{throw fail('页面资源缺失：fnos/web/index.html 尚未构建。请运行 node fnos/build-client.mjs 生成前端资源后重新启动轻页。',503,'PAGE_MISSING');}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
   }
   const asset=req.method==='GET'?assets[route.slice(1)]:null;
   if(asset){
    let data;
    try{data=await fs.readFile(path.join(project,asset.file));}
    catch{throw fail(`静态资源缺失：${path.basename(asset.file)}。请运行 node fnos/build-client.mjs 重新构建前端资源。`,404,'ASSET_MISSING');}
    res.writeHead(200,{'Content-Type':asset.type,'Cache-Control':'no-store'});res.end(data);return;
   }

   if(req.method==='GET'&&route==='/api/settings'){currentUid=uid;json(res,await settingsPayload());return;}
   if(req.method==='GET'&&route==='/api/nas/list'){await listHandler(url,res);return;}
   if(req.method==='POST'&&route==='/api/nas/select'){await selectHandler(req,res);return;}
   if(req.method==='POST'&&route==='/api/nas/folder'){await folderHandler(req,res);return;}
   if(req.method==='POST'&&route==='/api/nas/permission'){await permissionHandler(req,res);return;}
   if(req.method==='POST'&&route==='/api/nas/grant'){await grantHandler(req,res);return;}

   if(req.method==='GET'&&route==='/api/upload-status'){
    const id=url.searchParams.get('id'),upload=uploads.get(id);
    if(!upload||upload.uid!==uid)throw fail('上传记录不存在或已过期',404,'UPLOAD_SESSION');
    json(res,upload);return;
   }
   if(req.method==='POST'&&route==='/api/upload-start'){
    const {operation,name,size,id}=await body(req),limit=uploadInfo(operation,name);
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(id)||!Number.isSafeInteger(size)||size<1||size>limit)throw fail('上传参数无效',400,'INVALID_UPLOAD',[`单个文件不能超过 ${Math.round(limit/1024/1024)} MB，且需要有效的上传标识。`]);
    const base=uploadBase();
    await fs.mkdir(base,{recursive:true});await location(base);
    const folder=path.join(base,uid);await fs.mkdir(folder,{recursive:true});await location(folder);
    const partial=path.join(folder,'.upload-'+id);
    await fs.writeFile(partial,Buffer.alloc(0),{flag:'wx',mode:0o600});
    updateUpload(id,uid,{id,operation,name,size,folder,partial,received:0,stage:'已创建上传会话',status:'receiving'});
    json(res,{id,chunkSize:512*1024});return;
   }
   if(req.method==='POST'&&route==='/api/upload-chunk'){
    const id=url.searchParams.get('id'),item=session(id,uid),chunk=await rawBody(req,512*1024);
    if(!chunk.length||item.received+chunk.length>item.size)throw fail('上传分块无效',400,'INVALID_CHUNK');
    await fs.appendFile(item.partial,chunk,{mode:0o600});
    updateUpload(id,uid,{stage:'正在写入 NAS',received:item.received+chunk.length,status:'receiving'});
    json(res,{received:item.received+chunk.length,size:item.size});return;
   }
   if(req.method==='POST'&&route==='/api/upload-finish'){
    const {id}=await body(req),item=session(id,uid);
    if(item.received!==item.size)throw fail('文件尚未完整上传',400,'UPLOAD_INCOMPLETE');
    try{
     await location(item.folder);
     updateUpload(id,uid,{stage:'文件已收到，正在保存到共享目录',status:'saving'});
     let dest;
     for(let n=0;n<10000;n++){
      dest=path.join(item.folder,n?`${path.basename(item.name,path.extname(item.name))} (${n})${path.extname(item.name)}`:item.name);
      try{await fs.copyFile(item.partial,dest,constants.COPYFILE_EXCL);break;}
      catch(error){if(error.code!=='EEXIST'||n===9999)throw error;}
     }
     await fs.unlink(item.partial).catch(()=>{});
     updateUpload(id,uid,{stage:'保存完成',status:'completed',path:dest});
     json(res,{added:[{path:dest,name:path.basename(dest),size:item.size}],errors:[]});
    }catch(error){updateUpload(id,uid,{stage:'上传失败：'+error.message,status:'failed'});await log(`上传失败：${error.message}`);throw error;}
    return;
   }
   if(req.method==='POST'&&route==='/api/upload-cancel'){
    const {id}=await body(req),item=session(id,uid);
    await fs.unlink(item.partial).catch(()=>{});
    updateUpload(id,uid,{stage:'上传已取消',status:'cancelled'});
    json(res,{ok:true});return;
   }
   if(req.method==='POST'&&route==='/api/upload'){
    const operation=url.searchParams.get('operation'),name=url.searchParams.get('name'),uploadId=url.searchParams.get('id');
    if(uploadId&&!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId))throw fail('上传标识无效',400,'INVALID_UPLOAD');
    const limit=uploadInfo(operation,name);
    if(Number(req.headers['content-length'])>limit)throw fail('上传文件过大',413,'UPLOAD_TOO_LARGE',[`单个文件不能超过 ${Math.round(limit/1024/1024)} MB。`]);
    const base=uploadBase();
    await fs.mkdir(base,{recursive:true});await location(base);
    const folder=path.join(base,uid);await fs.mkdir(folder,{recursive:true});await location(folder);
    const partial=path.join(folder,'.upload-'+randomUUID());let count=0;
    updateUpload(uploadId,uid,{name,stage:'正在接收文件',received:0,status:'receiving'});
    try{
     await pipeline(req,new Transform({transform(chunk,encoding,callback){count+=chunk.length;updateUpload(uploadId,uid,{name,stage:'正在写入 NAS',received:count,status:'receiving'});callback(count>limit?fail('上传文件超出大小限制',413,'UPLOAD_TOO_LARGE'):null,chunk);}}),createWriteStream(partial,{flags:'wx',mode:0o600}));
     if(!count)throw fail('空文件',400,'EMPTY_FILE');
     await location(folder);
     updateUpload(uploadId,uid,{name,stage:'文件已收到，正在保存到共享目录',received:count,status:'saving'});
     let dest;
     for(let n=0;n<10000;n++){
      dest=path.join(folder,n?`${path.basename(name,path.extname(name))} (${n})${path.extname(name)}`:name);
      try{await fs.copyFile(partial,dest,constants.COPYFILE_EXCL);break;}
      catch(error){if(error.code!=='EEXIST'||n===9999)throw error;}
     }
     updateUpload(uploadId,uid,{name,stage:'保存完成',received:count,status:'completed',path:dest});
     json(res,{added:[{path:dest,name:path.basename(dest),size:count}],errors:[]});
    }catch(error){updateUpload(uploadId,uid,{name,stage:'上传失败：'+error.message,received:count,status:'failed'});await log(`上传失败：${error.message}`);throw error;}
    finally{await fs.unlink(partial).catch(()=>{});}
    return;
   }

   // JobService 的校验失败（已有任务在执行、输入/输出不合法）属于客户端问题，统一映射为 400 JOB_REJECTED，
   // 不要让它们冒泡成 500 INTERNAL。
   const submitJob=async request=>{try{return await jobs.submit(request,authorize,uid);}catch(error){if(error.status)throw error;throw fail(error.message,400,'JOB_REJECTED');}};
   if(req.method==='POST'&&route==='/api/jobs'){const request=await body(req);json(res,await submitJob(request));return;}
   if(req.method==='GET'&&route==='/api/history'){json(res,jobs.history().filter(job=>job.owner===uid));return;}
   if(req.method==='POST'&&route==='/api/retry'){const {id}=await body(req),previous=own(uid,id);json(res,await submitJob({operation:previous.operation,inputs:previous.inputs,outputDir:previous.outputDir,options:previous.options}));return;}
   if(req.method==='GET'&&route==='/api/job'){json(res,own(uid,url.searchParams.get('id')));return;}
   if(req.method==='POST'&&route==='/api/cancel'){const {id}=await body(req);own(uid,id);json(res,jobs.cancel(id));return;}
   if(req.method==='GET'&&route==='/api/download'){
    const job=own(uid,url.searchParams.get('id')),file=url.searchParams.get('path');
    if(!job.results.some(result=>result.outputs.includes(file)))throw fail('该文件不是本次任务的输出文件，只能下载本次任务生成的结果',403,'NOT_TASK_OUTPUT',['轻页只提供本次任务生成文件的下载；其它文件请在飞牛文件管理器中查看。']);
    const real=await location(file);
    const stat=await fs.stat(real);
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':stat.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(real))}`,'Cache-Control':'no-store'});
    await pipeline(createReadStream(real),res);return;
   }
   throw fail('接口不存在',404,'NOT_FOUND');
  }catch(error){
   if(!res.headersSent&&!res.destroyed){
    const status=error.status||500;
    if(!error.status)await log(`请求失败：${req.method} ${req.url} ${error.stack||error.message}`);
    const payload={error:error.message||'服务器内部错误',code:error.status?error.code||'BAD_REQUEST':'INTERNAL'};
    if(Array.isArray(error.hints)&&error.hints.length)payload.hints=error.hints;
    json(res,payload,status);
   }else res.destroy();
  }
 });

 async function close(){
  closing=true;
  const stopped=new Promise(resolve=>server.close(resolve));
  server.closeIdleConnections?.();
  if(jobs.active){
   const id=jobs.active;
   const done=new Promise(resolve=>{
    const listener=job=>{if(job.id===id&&job.status!=='running'){jobs.off('update',listener);resolve();}};
    jobs.on('update',listener);
   });
   jobs.cancel(id);
   await done;
  }
  server.closeAllConnections?.();
  await stopped;
  await log('轻页已停止');
 }

 return {
  server,jobs,authorize,
  get roots(){return rootList.map(root=>root.path);},
  get rootList(){return rootList;},
  missingRoots,sharedRoot,stateDir:stateHome,log,close
 };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const envShares=(process.env.TRIM_DATA_SHARE_PATHS||'').split(':').filter(Boolean);
  const accessible=(process.env.TRIM_DATA_ACCESSIBLE_PATHS||'').split(':').filter(Boolean);
  // 共享目录由 createApplication 按官方机制探测：TRIM_DATA_SHARE_PATHS 第一段 → dirname(TRIM_APPDEST)/share/files → TRIM_APPDEST/share/files → /var/apps/{app}/share/files。
  const webRef={url:null};
  const app=await createApplication({roots:[...new Set([...envShares.slice(1),...accessible])],stateDir:process.env.TRIM_PKGVAR,web:webRef});
  await app.log(`授权目录：${app.roots.join('、')||'（无）'}${app.missingRoots.length?`；已跳过失效目录：${app.missingRoots.join('、')}`:''}`);
  const socket=path.join(process.env.TRIM_APPDEST||os.tmpdir(),'app.sock');
  const mcp=createLocalMcpServer({jobs:app.jobs,authorize:app.authorize,roots:app.roots});
  await fs.unlink(socket).catch(error=>{if(error.code!=='ENOENT')throw error;});
  await new Promise((resolve,reject)=>mcp.once('error',reject).listen(32180,'127.0.0.1',resolve));
  // 本机 Web 入口：默认关闭。回环端口对 NAS 上所有本地用户可见，会给请求注入应用身份，
  // 因此只有管理员显式设置 QINGYE_WEB=1 且给出 QINGYE_WEB_UID 时才启动。
  let web=null;
  const webOptions=resolveWebEntryOptions(process.env);
  if(webOptions){
   try{
    web=await startWebEntry({socketPath:socket,...webOptions});
    webRef.url=web.url;
    await app.log(`本机 Web 入口已启用：${web.url}（仅回环，需 SSH 隧道或反向代理）`);
   }catch(error){web=null;await app.log(`本机 Web 入口未启用：${error.message}`);console.error('轻页本机 Web 入口未启用：'+error.message);}
  }
  app.server.listen(socket,async()=>{await fs.chmod(socket,0o660).catch(()=>{});console.log(`Qingye fnOS ${VERSION} ready; gateway socket + local MCP http://127.0.0.1:32180/mcp${web?` + web ${web.url}`:''}`);});
  app.server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{const stopWeb=web?web.close():Promise.resolve();stopWeb.catch(()=>{}).then(()=>new Promise(resolve=>mcp.close(resolve))).then(()=>app.close()).then(()=>fs.unlink(socket).catch(()=>{})).then(()=>process.exit(0)).catch(()=>process.exit(1));});
 }catch(error){
  console.error(`轻页启动失败：${error.message}`);
  process.exitCode=1;
 }
}
