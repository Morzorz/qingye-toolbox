import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createApplication,PREFIX} from '../server.mjs';
import {fixture} from '../../tests/fixtures.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'qy-nas-')),share=path.join(root,'share'),state=path.join(root,'state'),socket=path.join(root,'test.sock');await fs.mkdir(share);const input=path.join(share,'中文.pdf'),outside=path.join(root,'secret.pdf');await fs.writeFile(input,fixture());await fs.writeFile(outside,fixture());await fs.symlink(outside,path.join(share,'escape.pdf'));
const staleDir=path.join(share,'上传文件','1000'),stale=path.join(staleDir,'.upload-11111111-1111-1111-1111-111111111111');await fs.mkdir(staleDir,{recursive:true});await fs.writeFile(stale,'partial');await fs.writeFile(path.join(staleDir,'keep.pdf'),fixture());
const app=await createApplication({roots:[share],share,stateDir:state});await new Promise(resolve=>app.server.listen(socket,resolve));
function req(route,{method='GET',data,headers={}}={}){return new Promise((resolve,reject)=>{const r=http.request({socketPath:socket,path:PREFIX+route,method,headers:{Host:'nas.local','X-Trim-Userid':'1000','X-Trim-Isadmin':'true','X-Qingye-Request':'1',...headers}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{const raw=Buffer.concat(chunks);let body;try{body=JSON.parse(raw);}catch{}resolve({status:res.statusCode,headers:res.headers,raw,body});});});r.on('error',reject);r.end(ArrayBuffer.isView(data)?Buffer.from(data.buffer,data.byteOffset,data.byteLength):data?JSON.stringify(data):undefined);});}
async function wait(id,headers){let r;for(let n=0;n<100;n++){r=await req('/api/job?id='+id,{headers});if(r.body.status!=='running')return r.body;await new Promise(r=>setTimeout(r,30));}throw Error('timeout');}
test('startup removes abandoned uploads and preserves completed files',async()=>{await assert.rejects(fs.stat(stale),{code:'ENOENT'});assert((await fs.stat(path.join(staleDir,'keep.pdf'))).size>0);});
test('gateway and admin authentication, origin and static boundaries',async()=>{
 assert.equal((await req('/',{headers:{'X-Trim-Userid':''}})).status,403);assert.equal((await req('/',{headers:{'X-Trim-Isadmin':'false'}})).status,403);
 assert.equal((await req('/api/jobs',{method:'POST',data:{},headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await req('/api/jobs',{method:'POST',data:{},headers:{'X-Qingye-Request':''}})).status,403);
 assert.equal((await req('/package.json')).status,404);assert.equal((await req('/')).status,200);
});
test('page carries a self-contained script authorized by its exact CSP hash',async()=>{
 const response=await req('/'),html=response.raw.toString(),script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert(script);assert(!html.includes('type="module"'));assert(!/<script[^>]+src=/.test(html));
 const hash=createHash('sha256').update(script).digest('base64');assert(response.headers['content-security-policy'].includes("'sha256-"+hash+"'"));assert(!response.headers['content-security-policy'].includes("'unsafe-inline'"));assert.equal(response.headers['cache-control'],'no-store');
 assert(html.includes('/app/qingye/styles.css?v=1.2.3'));
});
test('NAS picker rejects traversal and symlink escape',async()=>{
 const r=await req('/api/list?path='+encodeURIComponent(share));assert.equal(r.status,200);assert(!r.body.entries.some(e=>e.name==='escape.pdf'));
 assert.equal((await req('/api/list?path='+encodeURIComponent(root))).status,403);
 const s=await req('/api/select',{method:'POST',data:{paths:[input,path.join(share,'escape.pdf')],operation:'pdf_compress'}});assert.equal(s.body.added.length,1);assert.equal(s.body.errors.length,1);
});
test('upload collision-safe, conversion, user ownership and downloads',async()=>{
 for(let n=0;n<2;n++){const r=await req('/api/upload?operation=pdf_compress&name=upload.pdf',{method:'POST',data:fixture()});assert.equal(r.status,200);assert(r.body.added[0].path.endsWith(n?'upload (1).pdf':'upload.pdf'));}
 assert.equal((await req('/api/upload?operation=pdf_compress&name=../bad.pdf',{method:'POST',data:fixture()})).status,400);
 const r=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:[input],outputDir:share}});assert.equal(r.status,200);const id=r.body.jobId;
 assert.equal((await req('/api/job?id='+id,{headers:{'X-Trim-Userid':'1001'}})).status,404);assert.equal((await req('/api/cancel',{method:'POST',data:{id},headers:{'X-Trim-Userid':'1001'}})).status,404);
 const j=await wait(id);assert.equal(j.status,'completed');const file=j.results[0].outputs[0];assert.equal((await req('/api/download?id='+id+'&path='+encodeURIComponent(file))).raw.subarray(0,5).toString(),'%PDF-');
 assert.equal((await req('/api/download?id='+id+'&path='+encodeURIComponent(input))).status,403);
 assert.equal((await req('/api/download?id='+id+'&path='+encodeURIComponent(file),{headers:{'X-Trim-Userid':'1001'}})).status,404);
});
test('upload directory symlink cannot create folders outside the grant',async()=>{
 const base=path.join(share,'上传文件'),saved=path.join(share,'saved-uploads'),external=path.join(root,'external');
 await fs.mkdir(external);await fs.rename(base,saved);await fs.symlink(external,base);
 try{assert.equal((await req('/api/upload?operation=pdf_compress&name=blocked.pdf',{method:'POST',data:fixture()})).status,403);assert.deepEqual(await fs.readdir(external),[]);}
 finally{await fs.unlink(base);await fs.rename(saved,base);}
});
test('shutdown cancels active conversion and leaves no worker temp folders',async()=>{
 const r=await req('/api/jobs',{method:'POST',data:{operation:'pdf_compress',inputs:Array(50).fill(input),outputDir:share}});assert.equal(r.status,200);await app.close();assert.equal(app.jobs.snapshot(r.body.jobId).status,'cancelled');assert(!(await fs.readdir(share)).some(p=>p.startsWith('.qingye-')));
});
test.after(async()=>{if(app.server.listening)await app.close();await fs.rm(root,{recursive:true,force:true});});
