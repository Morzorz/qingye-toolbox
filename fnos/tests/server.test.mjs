import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createApplication,PREFIX,CSP,VERSION} from '../server.mjs';
import {startWebEntry} from '../web-entry.mjs';
import {fixture} from '../../tests/fixtures.mjs';

const project=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
// 模拟真实飞牛场景：目录已授权（可遍历），但文件自带显式 ACE 不含轻页账号。
// macOS 用 ACL 保持 mode=0600 同时拒绝读取；其它平台退化为去掉读位。
const runQuiet=(file,args)=>new Promise(resolve=>execFile(file,args,error=>resolve(!error)));
async function denyRead(file){
 if(await runQuiet('chmod',['+a','everyone deny read',file]))return {mode:'0600',acl:true};
 await fs.chmod(file,0o200);
 return {mode:'0200',acl:false};
}
const root=await fs.mkdtemp(path.join(os.tmpdir(),'qy-nas-'));
const share=path.join(root,'share'),state=path.join(root,'state'),socket=path.join(root,'test.sock'),gone=path.join(root,'gone-root'),outsideDir=path.join(root,'outside');
await fs.mkdir(share);await fs.mkdir(outsideDir);
const input=path.join(share,'中文.pdf');await fs.writeFile(input,fixture());
const secret=path.join(outsideDir,'secret.pdf');await fs.writeFile(secret,fixture());

// listcase：排序、点号项、越界软链、失效软链、无权限文件、控制字符文件名
const listcase=path.join(share,'listcase');await fs.mkdir(listcase);
await fs.mkdir(path.join(listcase,'合同'));await fs.mkdir(path.join(listcase,'zeta'));
await fs.writeFile(path.join(listcase,'a.pdf'),'%PDF-1.4 small');
await fs.writeFile(path.join(listcase,'b.txt'),'not a pdf');
await fs.writeFile(path.join(listcase,'.dot.pdf'),'hidden');
await fs.symlink(secret,path.join(listcase,'escape.pdf'));
await fs.symlink(path.join(listcase,'nope.pdf'),path.join(listcase,'dangling.pdf'));
const lockedFile=path.join(listcase,'locked.pdf');await fs.writeFile(lockedFile,'locked');await fs.chmod(lockedFile,0o000);
const oddName='bad\u202e.pdf';await fs.writeFile(path.join(listcase,oddName),'odd');

// 无读权限目录
const lockedDir=path.join(share,'locked');await fs.mkdir(lockedDir);await fs.writeFile(path.join(lockedDir,'inside.pdf'),'x');await fs.chmod(lockedDir,0o000);

// 文件夹批量
const batch=path.join(share,'batch');await fs.mkdir(path.join(batch,'deep'),{recursive:true});
await fs.writeFile(path.join(batch,'y.pdf'),'x');
await fs.writeFile(path.join(batch,'deep','x.pdf'),'x');
await fs.writeFile(path.join(batch,'skip.txt'),'x');
await fs.writeFile(path.join(batch,'.dot.pdf'),'x');
await fs.symlink(secret,path.join(batch,'escape.pdf'));
const onlyTxt=path.join(share,'only-txt');await fs.mkdir(onlyTxt);await fs.writeFile(path.join(onlyTxt,'note.txt'),'not a pdf');
const many=path.join(share,'many');await fs.mkdir(many);
await Promise.all(Array.from({length:120},(_,n)=>fs.writeFile(path.join(many,`file-${String(n).padStart(3,'0')}.pdf`),'x')));

// 契约 §2.5c：父目录可读、文件不可读
const musicDir=path.join(share,'music');await fs.mkdir(musicDir);await fs.chmod(musicDir,0o755);
const playableTrack=path.join(musicDir,'歌.mp3');await fs.writeFile(playableTrack,'x');await fs.chmod(playableTrack,0o644);
const blockedTrack=path.join(musicDir,'光.mp3');await fs.writeFile(blockedTrack,'x');await fs.chmod(blockedTrack,0o600);
const acl=await denyRead(blockedTrack);
// 权限分布全绿的目录：用于断言 hints 为空
const cleanDir=path.join(share,'clean');await fs.mkdir(cleanDir);await fs.writeFile(path.join(cleanDir,'ok.pdf'),'x');await fs.chmod(cleanDir,0o755);

// 上次异常退出遗留的分片临时文件
const staleDir=path.join(share,'上传文件','1000');await fs.mkdir(staleDir,{recursive:true});
const stale=path.join(staleDir,'.upload-11111111-1111-1111-1111-111111111111');await fs.writeFile(stale,'partial');
await fs.writeFile(path.join(staleDir,'keep.pdf'),fixture());

const app=await createApplication({roots:[share,gone],share,stateDir:state});
await new Promise(resolve=>app.server.listen(socket,resolve));
const realShare=await fs.realpath(share);
const realListcase=await fs.realpath(listcase);

function caller(sock){
 return (route,{method='GET',data,headers={}}={})=>new Promise((resolve,reject)=>{
  const pending=http.request({socketPath:sock,path:PREFIX+route,method,headers:{Host:'nas.local','X-Trim-Userid':'1000','X-Trim-Isadmin':'true','X-Qingye-Request':'1',...headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));
   res.on('end',()=>{const raw=Buffer.concat(chunks);let body;try{body=JSON.parse(raw);}catch{}resolve({status:res.statusCode,headers:res.headers,raw,body});});
  });
  pending.on('error',reject);
  pending.end(ArrayBuffer.isView(data)?Buffer.from(data.buffer,data.byteOffset,data.byteLength):data?JSON.stringify(data):undefined);
 });
}
const req=caller(socket);
async function wait(id,headers){
 let result;
 for(let n=0;n<200;n++){result=await req('/api/job?id='+id,{headers});if(result.body.status!=='running')return result.body;await new Promise(r=>setTimeout(r,30));}
 throw Error('任务等待超时');
}
const listOf=async(p,operation='pdf_compress')=>req(`/api/nas/list?path=${encodeURIComponent(p)}&operation=${operation}`);

test('startup tolerates a missing authorized root and still starts',async()=>{
 assert.equal(VERSION,'1.2.14.0');
 assert.deepEqual(app.roots,[realShare]);
 assert.deepEqual(app.missingRoots,[gone]);
 const log=await fs.readFile(path.join(state,'app.log'),'utf8');
 assert.match(log,/gone-root/);
 assert.deepEqual(await fs.readdir(staleDir).then(names=>names.filter(name=>name.startsWith('.upload-'))),[]);
 assert((await fs.stat(path.join(staleDir,'keep.pdf'))).size>0);
});

test('settings reports roots, shared directory and missing roots',async()=>{
 const response=await req('/api/settings');
 assert.equal(response.status,200,response.raw.toString());
 const body=response.body;
 assert.equal(body.version,'1.2.14.0');
 assert.equal(body.label,'飞牛独立版');
 assert.equal(body.roots.length,1);
 assert.deepEqual(Object.keys(body.roots[0]).sort(),['name','path','shared','writable']);
 assert.equal(body.roots[0].path,realShare);
 assert.equal(body.roots[0].shared,true);
 assert.equal(body.roots[0].writable,true);
 assert.equal(typeof body.roots[0].name,'string');
 assert.equal(body.sharedDirectory,realShare);
 assert.equal(body.defaultOutput,realShare);
 assert.deepEqual(body.missingRoots,[gone]);
 assert(typeof body.components.media==='string'||body.components.media===null);
 assert('office' in body.components);
 const config=JSON.parse(body.config.json);
 assert.equal(config.mcp.servers.qingye.url,'http://127.0.0.1:32180/mcp');
 // 契约 §2.8：/api/settings 暴露视频硬件加速探测结果（飞牛版只探测 VAAPI）
 assert('hardware' in body,'settings 缺少 hardware 字段');
 const hardware=body.hardware;
 assert.equal(typeof hardware.available,'boolean');
 assert.equal(hardware.available,false,'测试环境没有 /dev/dri/renderD*，应报告不可用');
 assert.equal(typeof hardware.reason,'string');
 assert(hardware.reason.length>0);
 assert.match(hardware.reason,/VAAPI|renderD|ffmpeg/,JSON.stringify(hardware));
 assert.equal(hardware.backend,undefined);
 assert.equal(hardware.device,undefined);
});

test('gateway, admin, origin and request marker boundaries',async()=>{
 assert.equal((await req('/',{headers:{'X-Trim-Userid':''}})).status,403);
 assert.equal((await req('/',{headers:{'X-Trim-Isadmin':'false'}})).status,403);
 const origin=await req('/api/jobs',{method:'POST',data:{},headers:{Origin:'notaurl'}});
 assert.equal(origin.status,403);assert.equal(origin.body.code,'BAD_ORIGIN');
 const marker=await req('/api/jobs',{method:'POST',data:{},headers:{'X-Qingye-Request':''}});
 assert.equal(marker.status,403);assert.equal(marker.body.code,'BAD_REQUEST_MARKER');
 assert.equal((await req('/api/nas/list')).status,200);
 const redirect=await req('',{});
 assert.equal(redirect.status,302);
});

test('page comes from fnos/web/index.html with a self-only CSP',async()=>{
 const pagePath=path.join(project,'fnos/web/index.html');
 const exists=await fs.access(pagePath).then(()=>true,()=>false);
 assert.ok(exists,'缺少 fnos/web/index.html：前端成员尚未交付页面骨架，页面路由无法验证');
 const page=await req('/');
 assert.equal(page.status,200,page.raw.toString());
 assert.match(page.headers['content-type'],/^text\/html; charset=utf-8$/);
 const html=page.raw.toString();
 assert.match(html,/<html lang="zh-CN">/);
 assert.match(html,/href="app\.css\?v=/);
 assert.match(html,/src="app\.js\?v=/);
 assert(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/.test(html),'页面不应包含内联脚本');
 assert.equal(page.headers['content-security-policy'],CSP);
 assert(page.headers['content-security-policy'].includes("script-src 'self'"));
 assert(!page.headers['content-security-policy'].includes('sha256-'));
 assert(!page.headers['content-security-policy'].includes("'unsafe-inline'"));
 assert.equal(page.headers['cache-control'],'no-store');
 assert.equal(page.headers['x-content-type-options'],'nosniff');
 assert.equal(page.headers['referrer-policy'],'same-origin');
});

test('static assets map to the fnos and desktop bundles',async()=>{
 const bundle=path.join(project,'fnos/web/app.bundle.js');
 const bundleExists=await fs.access(bundle).then(()=>true,()=>false);
 const js=await req('/app.js?v=1.2.14.0');
 assert.equal(js.status,bundleExists?200:404);
 if(bundleExists){assert.equal(js.headers['content-type'],'text/javascript; charset=utf-8');assert(js.raw.length>0);}
 else assert.equal(js.body.code,'ASSET_MISSING');
 const css=await req('/app.css?v=1.2.14.0');
 // 共用 UI 把样式迁到了 src/ui/app.css（docs/desktop-ui-unification.md §1），服务端也从这个路径下发。
 const cssExists=await fs.access(path.join(project,'src/ui/app.css')).then(()=>true,()=>false);
 assert(cssExists,'缺少 src/ui/app.css：共用 UI 样式未就绪');
 assert.equal(css.status,200);
 assert.equal(css.headers['content-type'],'text/css; charset=utf-8');
 const styles=await req('/styles.css');
 assert.equal(styles.status,200);assert.equal(styles.headers['content-type'],'text/css; charset=utf-8');
 // 只暴露页面引用的三个静态资源；构建期已打进 app.js 的源码不再单独下发给浏览器。
 assert.equal((await req('/catalog.mjs')).status,404);
 assert.equal((await req('/bridge.js')).status,404);
 assert.equal((await req('/toolbox.css')).status,404);
 assert.equal((await req('/package.json')).status,404);
});

test('loopback web entry injects its own identity and refuses spoofed gateway headers', async()=>{
 const web=await startWebEntry({socketPath:socket,port:0,uid:'4242',username:'web'});
 try{
  const call=(route,{method='GET',headers={},data}={})=>new Promise((resolve,reject)=>{
   const request=http.request({host:'127.0.0.1',port:web.port,path:PREFIX+route,method,headers},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));
    response.on('end',()=>{const raw=Buffer.concat(chunks);let body;try{body=JSON.parse(raw.toString());}catch{}resolve({status:response.statusCode,raw,body});});
   });request.on('error',reject);request.end(data?JSON.stringify(data):undefined);
  });
  const page=await call('/');assert.equal(page.status,200);assert.match(page.raw.toString(),/轻页/);
  // 客户端伪造 x-trim-userid/isadmin 也必须被丢弃，身份由代理注入。
  const settings=await call('/api/settings',{headers:{'x-trim-userid':'999','x-trim-isadmin':'false','x-trim-username':'spoof'}});
  assert.equal(settings.status,200,settings.raw?.toString());assert.equal(settings.body.user.uid,'4242');
  // 网关入口的鉴权仍然生效：不带身份头直接访问 socket 应 403。
  // 直接用裸 socket 访问，不带任何身份头：必须 403。连接显式 close，避免与上面的代理请求复用连接造成偶发误判。
  const anonymous=await new Promise((resolve,reject)=>{
   const r=http.request({socketPath:socket,path:PREFIX+'/api/settings',method:'GET',headers:{Host:'nas.local',Connection:'close'},agent:false},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode}));});
   r.on('error',reject);r.end();
  });
  assert.equal(anonymous.status,403);
  // POST 仍然受请求标记保护，代理不会替客户端补齐。
  const noMarker=await call('/api/nas/select',{method:'POST',headers:{'Content-Type':'application/json'},data:{paths:[],operation:'pdf_compress'}});
  assert.equal(noMarker.status,403);
  // 带标记的写请求同样以注入身份执行（不会采用客户端伪造的 x-trim-userid）。
  const selected=await call('/api/nas/select',{method:'POST',headers:{'Content-Type':'application/json','X-Qingye-Request':'1','x-trim-userid':'1000'},data:{paths:[],operation:'pdf_compress'}});
  assert.equal(selected.status,200,selected.raw?.toString());
 }finally{await web.close();}
});
test('root listing exposes only authorized roots',async()=>{
 const response=await req('/api/nas/list?operation=pdf_compress');
 assert.equal(response.status,200,response.raw.toString());
 const body=response.body;
 assert.equal(body.path,null);assert.equal(body.parent,null);assert.equal(body.root,null);
 assert.equal(body.entries.length,1);
 const entry=body.entries[0];
 assert.equal(entry.kind,'dir');assert.equal(entry.root,true);assert.equal(entry.path,realShare);
 assert.equal(entry.disabled,false);
 assert.equal(body.counts.directories,1);
 assert.equal(body.warnings.join('\n').length>0,true);
 assert(body.warnings.join('\n').includes('重新授权'),body.warnings.join('\n'));
});

test('directory listing keeps every entry, sorts and counts hidden items',async()=>{
 const response=await listOf(listcase);
 assert.equal(response.status,200,response.raw.toString());
 const body=response.body;
 assert.equal(body.path,realListcase);
 assert.equal(body.root,realShare);
 assert.equal(body.parent,realShare);
 assert.deepEqual(body.extensions,['pdf']);
 assert.deepEqual(body.permissions,{read:true,write:true});
 assert.equal(body.counts.directories,2);
 assert.equal(body.counts.files,6);
 assert.equal(body.counts.hidden,1);
 assert.equal(body.counts.matched,5);
 assert.equal(body.counts.blocked,3);
 assert.equal(body.entries.length,8);
 assert(!body.entries.some(entry=>entry.name==='.dot.pdf'));
 // 目录在前，其后按 zh-CN 名称排序
 const firstFile=body.entries.findIndex(entry=>entry.kind!=='dir');
 assert(firstFile>0);
 assert(body.entries.slice(0,firstFile).every(entry=>entry.kind==='dir'));
 assert(body.entries.slice(firstFile).every(entry=>entry.kind!=='dir'));
 assert.deepEqual(body.entries.slice(0,firstFile).map(entry=>entry.name),['合同','zeta']);
 const fileNames=body.entries.slice(firstFile).map(entry=>entry.name);
 assert.deepEqual(fileNames,[...fileNames].sort((a,b)=>a.localeCompare(b,'zh-CN')));
 assert.match(body.warnings.join('\n'),/3 个项目不可用/);
 // 匹配信息与大小、时间字段
 const pdf=body.entries.find(entry=>entry.name==='a.pdf');
 assert.equal(pdf.kind,'file');assert.equal(pdf.extension,'pdf');assert.equal(pdf.matches,true);
 assert.equal(pdf.readable,true);assert.equal(pdf.disabled,false);assert.equal(pdf.disabledReason,null);
 assert.equal(typeof pdf.size,'number');
 assert.match(pdf.mtime,/^\d{4}-\d{2}-\d{2}T/);
 const txt=body.entries.find(entry=>entry.name==='b.txt');
 assert.equal(txt.matches,false);assert.equal(txt.disabled,false);
 // 越界软链保留并标注
 const escape=body.entries.find(entry=>entry.name==='escape.pdf');
 assert(escape,'越界软链条目被丢弃');assert.equal(escape.disabled,true);
 assert.match(escape.disabledReason,/链接指向授权目录之外/);
 // 失效软链保留并标注
 const dangling=body.entries.find(entry=>entry.name==='dangling.pdf');
 assert(dangling,'失效软链条目被丢弃');assert.equal(dangling.disabled,true);
 assert.match(dangling.disabledReason,/失效|不存在/);
 // 无读权限保留并标注
 const locked=body.entries.find(entry=>entry.name==='locked.pdf');
 assert(locked,'无权限条目被丢弃');assert.equal(locked.disabled,true);assert.equal(locked.readable,false);
 assert.match(locked.disabledReason,/没有读取权限/);
 // 控制字符在名称中替换，路径保留原始值
 const odd=body.entries.find(entry=>entry.name.includes('bad'));
 assert(odd,'控制字符条目被丢弃');
 assert(odd.name.includes('\uFFFD'));
 assert(!odd.name.includes('\u202e'));
 assert(odd.path.includes('\u202e'));
});

test('listing reports actionable hints for unreadable or foreign directories',async()=>{
 const notDirectory=await listOf(input);
 assert.equal(notDirectory.status,400);assert.equal(notDirectory.body.code,'NOT_DIRECTORY');
 const foreign=await listOf(outsideDir);
 assert.equal(foreign.status,403);assert.equal(foreign.body.code,'OUTSIDE_ROOT');
 assert(foreign.body.hints.some(hint=>hint.includes('目录授权')));
 const noRead=await listOf(lockedDir);
 assert.equal(noRead.status,403);assert.equal(noRead.body.code,'NO_READ');
 assert.equal(noRead.body.hints.length,4,JSON.stringify(noRead.body.hints));
 assert.match(noRead.body.hints[0],/独立应用账号运行/);
 assert.match(noRead.body.hints[1],/重新授权此文件夹/);
 assert.match(noRead.body.hints[1],/无需重启应用/);
 assert.match(noRead.body.hints[2],/目录授权/);
 assert.match(noRead.body.hints[2],/ACL/);
 assert.match(noRead.body.hints[3],/移动/);
 const readHints=noRead.body.hints.join('\n');
 assert(!readHints.includes('应用于'),'不应要求勾选继承范围：'+readHints);
 assert(!readHints.includes('重置子级权限'),'不应要求重置子级权限：'+readHints);
 assert(!/停止并重新启动轻页/.test(readHints),'不应要求重启应用：'+readHints);
 assert.match(noRead.headers['content-type'],/application\/json; charset=utf-8/);
});

test('select validates each path independently',async()=>{
 const paths=[path.join(listcase,'a.pdf'),path.join(listcase,'b.txt'),path.join(listcase,'escape.pdf'),path.join(listcase,'locked.pdf'),secret,path.join(listcase,'missing.pdf')];
 const response=await req('/api/nas/select',{method:'POST',data:{paths,operation:'pdf_compress'}});
 assert.equal(response.status,200,response.raw.toString());
 const body=response.body;
 assert.equal(body.added.length,1);
 assert.equal(body.added[0].path,path.join(realListcase,'a.pdf'));
 assert.equal(body.added[0].name,'a.pdf');
 assert.equal(body.added[0].size>0,true);
 assert.equal(body.errors.length,5);
 assert(body.errors.every(message=>message.includes('：')));
 assert.match(body.errors.join('\n'),/b\.txt：不支持此文件类型/);
 assert.match(body.errors.join('\n'),/不在轻页的授权目录内/);
 assert.match(body.errors.join('\n'),/没有读取权限/);
 assert.match(body.errors.join('\n'),/不存在/);
 assert.equal(body.skipped.length,5);
 const skippedTxt=body.skipped.find(item=>item.path===path.join(listcase,'b.txt'));
 assert.equal(skippedTxt.code,'UNSUPPORTED_TYPE');
 assert.match(skippedTxt.reason,/不支持此文件类型/);
 assert.equal((await req('/api/nas/select',{method:'POST',data:{paths:Array.from({length:101},()=>input),operation:'pdf_compress'}})).status,400);
 assert.equal((await req('/api/nas/select',{method:'POST',data:{paths:[input],operation:'nope'}})).body.code,'INVALID_OPERATION');
});

test('folder batch walks subfolders, reports truncation and empty matches',async()=>{
 const batchResponse=await req('/api/nas/folder',{method:'POST',data:{folder:batch,operation:'pdf_compress'}});
 assert.equal(batchResponse.status,200,batchResponse.raw.toString());
 const batchBody=batchResponse.body;
 assert.deepEqual(batchBody.added.map(item=>item.name),['y.pdf',path.join('deep','x.pdf')]);
 assert.deepEqual(batchBody.errors,[]);
 assert.equal(batchBody.summary.matched,2);
 assert.equal(batchBody.summary.truncated,false);
 assert(batchBody.summary.examined>=5);
 assert(batchBody.summary.folders>=2);
 assert(batchBody.added.every(item=>item.path.startsWith(realShare)));
 const none=await req('/api/nas/folder',{method:'POST',data:{folder:onlyTxt,operation:'pdf_compress'}});
 assert.equal(none.status,200);
 assert.deepEqual(none.body.added,[]);
 assert.deepEqual(none.body.errors,['所选文件夹及其子文件夹中没有 PDF 文件']);
 const truncated=await req('/api/nas/folder',{method:'POST',data:{folder:many,operation:'pdf_compress'}});
 assert.equal(truncated.status,200);
 assert.equal(truncated.body.added.length,100);
 assert.equal(truncated.body.summary.truncated,true);
 assert.match(truncated.body.errors.join('\n'),/一次最多加入 100 个文件/);
 const notFolder=await req('/api/nas/folder',{method:'POST',data:{folder:input,operation:'pdf_compress'}});
 assert.equal(notFolder.status,400);assert.equal(notFolder.body.code,'NOT_DIRECTORY');
});

test('permission diagnostics answer with executable Chinese hints',async()=>{
 const locked=await req('/api/nas/permission',{method:'POST',data:{path:lockedDir,mode:'r'}});
 assert.equal(locked.status,200,locked.raw.toString());
 assert.equal(locked.body.exists,true);
 assert.equal(locked.body.kind,'directory');
 assert.equal(locked.body.readable,false);
 assert.match(locked.body.mode,/^[0-7]{4}$/);
 assert.match(locked.body.owner,/^\d+:\d+$/);
 assert.equal(locked.body.hints.length,4,JSON.stringify(locked.body.hints));
 assert.match(locked.body.hints[0],/独立应用账号运行/);
 assert.match(locked.body.hints[1],/重新授权此文件夹/);
 assert.match(locked.body.hints[1],/无需重启应用/);
 assert.match(locked.body.hints[2],/系统会自动为轻页账号授予 ACL/);
 assert.match(locked.body.hints[3],/移动、改名或所在存储空间已卸载/);
 const diagHints=locked.body.hints.join('\n');
 assert(!diagHints.includes('应用于'));
 assert(!diagHints.includes('重置子级权限'));
 assert(!/停止并重新启动轻页/.test(diagHints));
 const writable=await req('/api/nas/permission',{method:'POST',data:{path:cleanDir,mode:'w'}});
 assert.equal(writable.status,200,writable.raw.toString());
 assert.equal(writable.body.readable,true);assert.equal(writable.body.writable,true);
 assert.deepEqual(writable.body.hints,[]);
 assert.match(writable.body.mode,/^[0-7]{4}$/);
 assert(writable.body.children,'可读目录应带 children 摘要');
 assert.equal(writable.body.children.blocked,0);
 assert.equal(writable.body.children.truncated,false);
 const missing=await req('/api/nas/permission',{method:'POST',data:{path:path.join(share,'nope')}});
 assert.equal(missing.status,200);
 assert.equal(missing.body.exists,false);
 assert.match(missing.body.hints.join('\n'),/不存在/);
 const foreign=await req('/api/nas/permission',{method:'POST',data:{path:secret}});
 assert.equal(foreign.status,200);
 assert.equal(foreign.body.insideGrant,false);
 assert.match(foreign.body.hints.join('\n'),/不在轻页已授权的目录内/);
 const invalid=await req('/api/nas/permission',{method:'POST',data:{path:'relative/path'}});
 assert.equal(invalid.status,200);
 assert.match(invalid.body.hints.join('\n'),/绝对路径/);
});

test('share discovery creates the shared directory when it is missing',async()=>{
 const home=path.join(root,'share-create'),freshShare=path.join(home,'qingye','files'),sock=path.join(home,'share.sock');
 await fs.mkdir(home,{recursive:true});
 const noteFile=path.join(home,'note.txt');await fs.writeFile(noteFile,'不是文件夹');
 const created=await createApplication({roots:[noteFile],shares:[freshShare],stateDir:path.join(home,'state')});
 await new Promise(resolve=>created.server.listen(sock,resolve));
 try{
  const real=await fs.realpath(freshShare);
  assert.equal(created.sharedRoot,real);
  const call=caller(sock);
  const settings=await call('/api/settings');
  assert.equal(settings.body.sharedDirectory,real);
  assert.equal(settings.body.roots.length,1);
  assert.equal(settings.body.roots[0].shared,true);
  assert.deepEqual(created.missingRoots,[noteFile]);
  assert.deepEqual(settings.body.missingRoots,[noteFile]);
  const upload=await call('/api/upload-start',{method:'POST',data:{id:'share-create-abcdefgh',operation:'pdf_compress',name:'a.pdf',size:4}});
  assert.equal(upload.status,200,upload.raw.toString());
 }finally{await created.close();}
});

test('an unusable shared directory stops startup with an actionable message',async()=>{
 const home=path.join(root,'share-broken');
 await fs.mkdir(home,{recursive:true});
 const blocker=path.join(home,'blocker');await fs.writeFile(blocker,'x');
 await assert.rejects(createApplication({roots:[],shares:[path.join(blocker,'files')],stateDir:path.join(home,'state')}),/飞牛共享目录尚未创建/);
});

test('grant makes a folder usable immediately and survives restart',async()=>{
 const home=path.join(root,'grant-home'),shareDir=path.join(home,'share'),extra=path.join(home,'extra'),stateDir=path.join(home,'state');
 await fs.mkdir(shareDir,{recursive:true});await fs.mkdir(extra,{recursive:true});
 await fs.writeFile(path.join(extra,'granted.pdf'),'%PDF-1.4');
 const sockA=path.join(home,'a.sock'),sockB=path.join(home,'b.sock'),sockC=path.join(home,'c.sock');
 const realShare=await fs.realpath(shareDir),realExtra=await fs.realpath(extra);
 const first=await createApplication({roots:[],share:shareDir,stateDir});
 await new Promise(resolve=>first.server.listen(sockA,resolve));
 try{
  const call=caller(sockA);
  assert.deepEqual((await call('/api/settings')).body.roots.map(item=>item.path),[realShare]);
  const granted=await call('/api/nas/grant',{method:'POST',data:{path:extra}});
  assert.equal(granted.status,200,granted.raw.toString());
  assert.equal(granted.body.path,realExtra);
  const grantedRoot=granted.body.roots.find(item=>item.path===realExtra);
  assert(grantedRoot,'grant 响应未包含新目录');
  assert.equal(grantedRoot.shared,false);
  assert.deepEqual(Object.keys(grantedRoot).sort(),['name','path','shared','writable']);
  const settings=await call('/api/settings');
  assert.equal(settings.body.roots.length,2);
  assert(settings.body.roots.some(item=>item.path===realExtra));
  const listing=await call('/api/nas/list?path='+encodeURIComponent(extra)+'&operation=pdf_compress');
  assert.equal(listing.status,200,listing.raw.toString());
  assert(listing.body.entries.some(entry=>entry.name==='granted.pdf'));
  assert.equal(listing.body.root,realExtra);
  const file=path.join(stateDir,'granted-roots.json');
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),[realExtra]);
  assert.equal((await fs.stat(file)).mode&0o777,0o600);
  // 幂等：重复授权不会重复写入
  assert.equal((await call('/api/nas/grant',{method:'POST',data:{path:extra}})).status,200);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),[realExtra]);
  // 重启后仍在
  const second=await createApplication({roots:[],share:shareDir,stateDir});
  await new Promise(resolve=>second.server.listen(sockB,resolve));
  try{
   const restarted=await caller(sockB)('/api/settings');
   assert(restarted.body.roots.some(item=>item.path===realExtra));
   assert.deepEqual(restarted.body.missingRoots,[]);
  }finally{await second.close();}
  // 目录消失后重启：丢弃并计入 missingRoots
  await fs.rename(extra,extra+'-moved');
  const third=await createApplication({roots:[],share:shareDir,stateDir});
  await new Promise(resolve=>third.server.listen(sockC,resolve));
  try{
   const degraded=await caller(sockC)('/api/settings');
   assert(!degraded.body.roots.some(item=>item.path===realExtra));
   assert(degraded.body.missingRoots.includes(realExtra));
   assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),[]);
  }finally{await third.close();}
 }finally{await first.close();}
});

test('grant rejects unusable paths without widening the grant',async()=>{
 const home=path.join(root,'grant-deny'),shareDir=path.join(home,'share'),stateDir=path.join(home,'state'),sock=path.join(home,'deny.sock');
 await fs.mkdir(shareDir,{recursive:true});
 const locked=path.join(home,'locked');await fs.mkdir(locked);await fs.chmod(locked,0o000);
 const plain=path.join(shareDir,'plain.pdf');await fs.writeFile(plain,'%PDF-1.4');
 const denied=await createApplication({roots:[],share:shareDir,stateDir});
 await new Promise(resolve=>denied.server.listen(sock,resolve));
 const call=caller(sock);
 try{
  const before=(await call('/api/settings')).body.roots.map(item=>item.path);
  for(const bad of [path.join(home,'missing'),plain,project,locked,'relative/path']){
   const response=await call('/api/nas/grant',{method:'POST',data:{path:bad}});
   assert.equal(response.status,403,`${bad} 未被拒绝：${response.raw}`);
   assert.equal(response.body.code,'GRANT_DENIED');
   assert.equal(response.body.hints.length,4,JSON.stringify(response.body.hints));
   assert.match(response.body.hints[1],/重新授权此文件夹/);
   assert.match(response.body.hints[2],/ACL/);
  }
  assert.deepEqual((await call('/api/settings')).body.roots.map(item=>item.path),before);
  await assert.rejects(fs.stat(path.join(stateDir,'granted-roots.json')),{code:'ENOENT'});
 }finally{await denied.close();await fs.chmod(locked,0o755);}
});

test('file-level permissions are reported apart from folder permissions',async()=>{
 // (a) 列表：0755 目录里的 0600 文件不再笼统显示“没有读取权限”
 const listing=await listOf(musicDir,'audio_convert');
 assert.equal(listing.status,200,listing.raw.toString());
 assert.deepEqual(listing.body.permissions,{read:true,write:true});
 const blocked=listing.body.entries.find(entry=>entry.name==='光.mp3');
 assert(blocked,'无权限文件被丢弃');
 assert.equal(blocked.disabled,true);
 assert.equal(blocked.disabledReason,'没有读取权限（文件权限未包含轻页账号）');
 assert.equal(blocked.mode,acl.mode);
 assert.match(blocked.owner,/^\d+:\d+$/);
 assert.equal(blocked.readable,false);
 assert.equal(blocked.matches,true);
 const playable=listing.body.entries.find(entry=>entry.name==='歌.mp3');
 assert(playable,'可读文件缺失');
 assert.equal(playable.disabled,false);
 assert.equal(playable.mode,'0644');
 assert.match(playable.owner,/^\d+:\d+$/);
 assert.equal(playable.readable,true);
 assert.equal(listing.body.counts.blocked,1);
 assert.match(listing.body.warnings.join('\n'),/1 个项目不可用/);
 // 目录本身不可读仍标注“文件夹”，两种问题分开表达
 const shareListing=await listOf(share);
 const lockedFolder=shareListing.body.entries.find(entry=>entry.name==='locked');
 assert(lockedFolder,'无权限文件夹缺失');
 assert.equal(lockedFolder.disabled,true);
 assert.equal(lockedFolder.disabledReason,'没有读取权限（文件夹）');
 assert.equal(lockedFolder.mode,'0000');

 // (b) 权限诊断：目录可读 → children 权限分布 + 文件级 hints
 const diag=await req('/api/nas/permission',{method:'POST',data:{path:musicDir,mode:'r'}});
 assert.equal(diag.status,200,diag.raw.toString());
 assert.equal(diag.body.kind,'directory');
 assert.equal(diag.body.readable,true);
 assert.equal(diag.body.mode,'0755');
 const children=diag.body.children;
 assert(children,'可读目录缺少 children 摘要');
 assert.equal(children.scanned,2);
 assert.equal(children.readable,1);
 assert.equal(children.blocked,1);
 assert.equal(children.truncated,false);
 assert(children.modes.some(item=>item.mode===acl.mode&&item.count===1),JSON.stringify(children.modes));
 assert(children.modes.some(item=>item.mode==='0644'&&item.count===1),JSON.stringify(children.modes));
 assert.equal(children.owners.reduce((sum,item)=>sum+item.count,0),2);
 assert(children.owners.every(item=>/^\d+:\d+$/.test(item.owner)));
 assert(children.samples.some(sample=>sample.name==='光.mp3'&&sample.readable===false&&sample.mode===acl.mode&&/^\d+:\d+$/.test(sample.owner)),JSON.stringify(children.samples));
 assert.equal(diag.body.hints.length,4,JSON.stringify(diag.body.hints));
 assert.match(diag.body.hints[0],/文件夹本身可读/);
 assert.match(diag.body.hints[1],/重置子级权限/);
 assert.match(diag.body.hints[2],/qingye\/files/);
 assert.match(diag.body.hints[3],/不会重写子文件的显式权限/);
 assert(!diag.body.hints.join('\n').includes('重新授权就能修好'));

 // (c) 目标本身是不可读文件时不得抛错，且给文件级指引
 const fileDiag=await req('/api/nas/permission',{method:'POST',data:{path:blockedTrack}});
 assert.equal(fileDiag.status,200,fileDiag.raw.toString());
 assert.equal(fileDiag.body.exists,true);
 assert.equal(fileDiag.body.kind,'file');
 assert.equal(fileDiag.body.readable,false);
 assert.equal(fileDiag.body.mode,acl.mode);
 assert.match(fileDiag.body.owner,/^\d+:\d+$/);
 assert(fileDiag.body.hints.length>=3,JSON.stringify(fileDiag.body.hints));
 assert.match(fileDiag.body.hints.join('\n'),/不会重写子文件的显式权限/);
 assert.equal(fileDiag.body.children,undefined);
});

test('chunked upload confirms every block before saving to the shared directory',async()=>{
 const id='chunked-upload-abcdefgh',bytes=Buffer.concat([Buffer.from(fixture()),Buffer.alloc(1024*1024)]);
 const start=await req('/api/upload-start',{method:'POST',data:{id,operation:'pdf_compress',name:'large.pdf',size:bytes.length}});
 assert.equal(start.status,200,start.raw.toString());
 assert.equal(start.body.chunkSize,512*1024);
 for(let offset=0;offset<bytes.length;offset+=start.body.chunkSize){
  const chunk=bytes.subarray(offset,Math.min(offset+start.body.chunkSize,bytes.length));
  const result=await req('/api/upload-chunk?id='+id,{method:'POST',data:chunk});
  assert.equal(result.status,200,result.raw.toString());
 }
 const finish=await req('/api/upload-finish',{method:'POST',data:{id}});
 assert.equal(finish.status,200,finish.raw.toString());
 assert.equal((await fs.stat(finish.body.added[0].path)).size,bytes.length);
 const status=await req('/api/upload-status?id='+id);
 assert.equal(status.body.status,'completed');
 const started=await req('/api/upload-start',{method:'POST',data:{id:'cancel-upload-abcdefgh',operation:'pdf_compress',name:'drop.pdf',size:10}});
 assert.equal(started.status,200);
 assert.equal((await req('/api/upload-cancel',{method:'POST',data:{id:'cancel-upload-abcdefgh'}})).body.ok,true);
 assert.equal((await req('/api/upload-start',{method:'POST',data:{id:'bad-id',operation:'pdf_compress',name:'x.pdf',size:10}})).status,400);
});

test('single-request upload stays collision safe and rejects traversal',async()=>{
 for(let n=0;n<2;n++){
  const uploadId='test-upload-'+n+'-abcdefgh';
  const response=await req('/api/upload?operation=pdf_compress&name=upload.pdf&id='+uploadId,{method:'POST',data:fixture()});
  assert.equal(response.status,200,response.raw.toString());
  assert(response.body.added[0].path.endsWith(n?'upload (1).pdf':'upload.pdf'),response.body.added[0].path);
  const status=await req('/api/upload-status?id='+uploadId);
  assert.equal(status.body.status,'completed');
  assert.equal(status.body.path,response.body.added[0].path);
 }
 assert.equal((await req('/api/upload?operation=pdf_compress&name=../bad.pdf',{method:'POST',data:fixture()})).status,400);
 assert.equal((await req('/api/upload?operation=pdf_compress&name=bad.txt',{method:'POST',data:fixture()})).body.code,'UNSUPPORTED_UPLOAD');
});

test('unreadable input is rejected with actionable permission text',async()=>{
 const selected=await req('/api/nas/select',{method:'POST',data:{paths:[lockedFile],operation:'pdf_compress'}});
 assert.equal(selected.status,200);
 assert.equal(selected.body.added.length,0);
 assert.match(selected.body.errors.join('\n'),/没有读取权限/);
 const job=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[lockedFile],outputDir:share}});
 assert.equal(job.status,403);
 assert.equal(job.body.code,'NO_READ');
 assert.match(job.body.error,/没有读取此文件的权限/);
 assert(job.body.hints.some(hint=>hint.includes('目录授权')));
});

test('jobs, history, retry, cancel and downloads stay scoped to the owner',async()=>{
 const started=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[input],outputDir:share}});
 assert.equal(started.status,200,started.raw.toString());
 const id=started.body.jobId;
 assert.equal((await req('/api/job?id='+id,{headers:{'X-Trim-Userid':'1001'}})).status,404);
 assert.equal((await req('/api/cancel',{method:'POST',data:{id},headers:{'X-Trim-Userid':'1001'}})).status,404);
 const job=await wait(id);
 assert.equal(job.status,'completed',JSON.stringify(job));
 const file=job.results[0].outputs[0];
 assert.equal((await req('/api/download?id='+id+'&path='+encodeURIComponent(file))).raw.subarray(0,5).toString(),'%PDF-');
 const notOutput=await req('/api/download?id='+id+'&path='+encodeURIComponent(input));
 assert.equal(notOutput.status,403);assert.equal(notOutput.body.code,'NOT_TASK_OUTPUT');
 assert.equal((await req('/api/download?id='+id+'&path='+encodeURIComponent(file),{headers:{'X-Trim-Userid':'1001'}})).status,404);
 assert.equal((await req('/api/nas/select',{method:'POST',data:{paths:[path.join(share,'../../etc/passwd')],operation:'pdf_compress'}})).body.added.length,0);
 const history=await req('/api/history');
 assert(history.body.some(item=>item.id===id));
 assert.equal((await req('/api/history',{headers:{'X-Trim-Userid':'1001'}})).body.length,0);
 const retried=await req('/api/retry',{method:'POST',data:{id}});
 assert.equal(retried.status,200,retried.raw?.toString());
 assert.notEqual(retried.body.jobId,id);
 await wait(retried.body.jobId);
 assert.equal((await req('/api/retry',{method:'POST',data:{id},headers:{'X-Trim-Userid':'1001'}})).status,404);
 const targeted=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[input],outputDir:share,options:{preset:'small',targetMB:0.1}}});
 assert.equal(targeted.status,200,targeted.raw?.toString());
 const result=await wait(targeted.body.jobId);
 assert.equal(result.status,'completed');
 assert(result.results[0].after<=0.1*1024*1024);
});

test('upload directory symlink cannot create folders outside the grant',async()=>{
 const base=path.join(share,'上传文件'),saved=path.join(share,'saved-uploads'),external=path.join(root,'external');
 await fs.mkdir(external);await fs.rename(base,saved);await fs.symlink(external,base);
 try{
  const blocked=await req('/api/upload?operation=pdf_compress&name=blocked.pdf',{method:'POST',data:fixture()});
  assert.equal(blocked.status,403);
  assert.deepEqual(await fs.readdir(external),[]);
 }finally{await fs.unlink(base);await fs.rename(saved,base);}
});

test('job validation failures are 400 JOB_REJECTED, not 500', async()=>{
 // 并发提交：第二个必须是 400（客户端问题），而不是 500 内部错误。
 const first=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[input],outputDir:share}});
 assert.equal(first.status,200,first.raw?.toString());
 const second=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[input],outputDir:share}});
 assert.equal(second.status,400,second.raw?.toString());
 assert.equal(second.body.code,'JOB_REJECTED');
 assert.match(second.body.error,/已有任务|正在执行/);
 await wait(first.body.jobId);
 const badOutput=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[input],outputDir:'relative/dir'}});
 assert.equal(badOutput.status,400);
 assert.equal(badOutput.body.code,'JOB_REJECTED');
});

test('shutdown cancels active conversions and leaves no worker temp folders',async()=>{
 const response=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:Array(50).fill(input),outputDir:share}});
 assert.equal(response.status,200);
 await app.close();
 assert.equal(app.jobs.snapshot(response.body.jobId).status,'cancelled');
 assert(!(await fs.readdir(share)).some(name=>name.startsWith('.qingye-')));
});

test.after(async()=>{
 await fs.chmod(lockedDir,0o755).catch(()=>{});
 await fs.chmod(lockedFile,0o644).catch(()=>{});
 if(app.server.listening)await app.close();
 await fs.rm(root,{recursive:true,force:true});
});

test('loopback web entry is on by default and validates its owner uid', async()=>{
 const {resolveWebEntryOptions}=await import('../web-entry.mjs');
 // 默认开启（QINGYE_WEB=0 关闭），只绑回环；身份必须是数字，给错值就停用。
 assert.equal(resolveWebEntryOptions({}).host,'127.0.0.1');
 assert.equal(resolveWebEntryOptions({}).uid,'1000');
 assert.equal(resolveWebEntryOptions({}).port,32181);
 assert.equal(resolveWebEntryOptions({QINGYE_WEB:'0'}),null);
 assert.equal(resolveWebEntryOptions({QINGYE_WEB_UID:'abc'}),null,'非数字身份不得启用');
 const on=resolveWebEntryOptions({QINGYE_WEB_UID:'1001',QINGYE_WEB_USERNAME:'alice'});
 assert.equal(on.uid,'1001');assert.equal(on.username,'alice');
 assert.equal(resolveWebEntryOptions({QINGYE_WEB_PORT:'40000'}).port,40000);
 assert.equal(resolveWebEntryOptions({QINGYE_WEB_PORT:'99999'}).port,32181);
});
