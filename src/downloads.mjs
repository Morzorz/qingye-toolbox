import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dataDir } from './settings.mjs';
import { runProcess } from './components.mjs';
const base='https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/';
export const DOWNLOADS={
  'darwin-arm64':{media:{url:base+'ffmpeg-darwin-arm64',sha:'a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584',name:'ffmpeg',license:base+'darwin-arm64.LICENSE',licenseSha:'cb48bf09a11f5fb576cddb0431c8f5ed0a60157a9ec942adffc13907cbe083f2'},office:{url:'https://download.documentfoundation.org/libreoffice/stable/26.8.1/mac/aarch64/LibreOffice_26.8.1_MacOS_aarch64.dmg',sha:'ca074e0b13571efb30a31fc531c5f95e997030637325e5d5de92d67aefdf0dfc',name:'LibreOffice-26.8.1.dmg'}},
  'win32-x64':{media:{url:base+'ffmpeg-win32-x64',sha:'04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00',name:'ffmpeg.exe',license:base+'win32-x64.LICENSE',licenseSha:'8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903'},office:{url:'https://download.documentfoundation.org/libreoffice/stable/26.8.1/win/x86_64/LibreOffice_26.8.1_Win_x86-64.msi',sha:'c6298b10cfa1748bcbedad94c62ce771e240e5021bfd6d7a967cd571b04b5312',name:'LibreOffice-26.8.1.msi'}}
};
export async function verifiedDownload(url,sha,destination,{fetchImpl=fetch,signal,progress=()=>{}}={}){
  if(!url.startsWith('https://'))throw new Error('组件下载必须使用 HTTPS');
  signal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15*60*1000)]);
  const temp=destination+'.part';let r;
  try{r=await fetchImpl(url,{signal});}catch{throw new Error(signal.aborted?'下载已取消或超时':'无法连接组件下载服务器，请检查网络或选择已有组件');}
  if(!r.ok||!r.body)throw new Error(`下载失败：HTTP ${r.status}`);if(r.url&&!r.url.startsWith('https://'))throw new Error('下载跳转不是 HTTPS');
  const total=Number(r.headers.get('content-length'))||0;if(total>1024**3)throw new Error('下载文件异常过大');const hash=createHash('sha256');let count=0,last=0;const h=await fs.open(temp,'w');
  try{for await(const chunk of r.body){if(signal?.aborted)throw new Error('下载已取消');count+=chunk.length;if(count>1024**3)throw new Error('下载超过大小限制');hash.update(chunk);await h.writeFile(chunk);if(Date.now()-last>150){progress({percent:total?Math.round(count/total*100):0,stage:`正在下载组件：${(count/1024**2).toFixed(1)} MB`});last=Date.now();}}if(hash.digest('hex')!==sha)throw new Error('组件校验失败，请重试');await h.close();await fs.rename(temp,destination);}catch(e){await h.close().catch(()=>{});await fs.unlink(temp).catch(()=>{});throw e;}
}
export async function installComponent(kind,{fetchImpl,signal,progress,openInstaller}){
  const spec=DOWNLOADS[`${process.platform}-${process.arch}`]?.[kind];if(!spec)throw new Error('此系统请手动选择已安装组件');const dir=path.join(dataDir,'components');await fs.mkdir(dir,{recursive:true});
  if(kind==='media'){
    const staging=await fs.mkdtemp(path.join(dir,'.media-')),binary=path.join(staging,spec.name);
    try{await verifiedDownload(spec.url,spec.sha,binary,{fetchImpl,signal,progress});await verifiedDownload(spec.license,spec.licenseSha,path.join(dir,'ffmpeg-LICENSE.txt'),{fetchImpl,signal});await fs.chmod(binary,0o755);await runProcess(binary,['-version'],{signal,timeoutMs:30000});if(signal?.aborted)throw new Error('下载已取消');await fs.rename(binary,path.join(dir,spec.name));return {message:'音视频组件已就绪'};}
    finally{await fs.rm(staging,{recursive:true,force:true});}
  }
  const file=path.join(dir,spec.name);await verifiedDownload(spec.url,spec.sha,file,{fetchImpl,signal,progress});
  if(process.platform==='win32'){const error=await openInstaller(file);if(error)throw new Error(error);return {message:'已打开官方安装程序，完成安装后点击刷新状态'};}
  const mount=await fs.mkdtemp(path.join(dir,'.mount-')),staging=await fs.mkdtemp(path.join(dir,'.office-'));let attached=false;
  try{progress({percent:100,stage:'正在安装办公组件…'});await runProcess('/usr/bin/hdiutil',['attach','-nobrowse','-readonly','-mountpoint',mount,file],{signal,timeoutMs:120000});attached=true;const apps=(await fs.readdir(mount)).filter(n=>n.endsWith('.app'));if(apps.length!==1)throw new Error('安装包内容异常');const candidate=path.join(staging,'LibreOffice.app');await runProcess('/usr/bin/ditto',[path.join(mount,apps[0]),candidate],{signal,timeoutMs:180000});await runProcess(path.join(candidate,'Contents','MacOS','soffice'),['--version'],{signal,timeoutMs:30000});if(signal?.aborted)throw new Error('安装已取消');await fs.rename(candidate,path.join(dir,'LibreOffice.app'));return {message:'办公组件已就绪'};}
  finally{if(attached)await runProcess('/usr/bin/hdiutil',['detach',mount],{timeoutMs:60000}).catch(()=>{});await fs.rmdir(mount).catch(()=>{});await fs.rm(staging,{recursive:true,force:true});}
}
