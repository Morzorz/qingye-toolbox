import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedDownload} from '../src/downloads.mjs';
test('component downloads verify bytes and clean up failed or cancelled transfers',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-download-')),file=path.join(dir,'component'),bytes=Buffer.from('synthetic component'),sha=createHash('sha256').update(bytes).digest('hex');
 const fetchImpl=async()=>new Response(bytes,{headers:{'content-length':String(bytes.length)}});
 try{
  await verifiedDownload('https://example.invalid/component',sha,file,{fetchImpl});assert.deepEqual(await fs.readFile(file),bytes);
  await assert.rejects(verifiedDownload('https://example.invalid/component','0'.repeat(64),file,{fetchImpl}),/校验失败/);assert.deepEqual(await fs.readFile(file),bytes);
  const controller=new AbortController();controller.abort();await assert.rejects(verifiedDownload('https://example.invalid/component',sha,file,{fetchImpl,signal:controller.signal}),/取消/);
  await assert.rejects(verifiedDownload('http://example.invalid/component',sha,file,{fetchImpl}),/HTTPS/);
  assert.deepEqual(await fs.readdir(dir),['component']);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
