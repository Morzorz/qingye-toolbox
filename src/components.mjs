import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { settings, dataDir } from './settings.mjs';
export async function findEngine(kind) {
  const s=await settings();const isWin=process.platform==='win32';
  const candidates=[s.engines?.[kind],process.env[kind==='media'?'QINGYE_FFMPEG':'QINGYE_SOFFICE']];
  if(kind==='media')candidates.push(path.join(dataDir,'components','ffmpeg'+(isWin?'.exe':'')),...((process.env.PATH||'').split(path.delimiter).filter(Boolean).map(p=>path.join(p,isWin?'ffmpeg.exe':'ffmpeg'))),'/opt/homebrew/bin/ffmpeg','/usr/local/bin/ffmpeg');
  else candidates.push(path.join(dataDir,'components','LibreOffice.app','Contents','MacOS','soffice'),'/Applications/LibreOffice.app/Contents/MacOS/soffice',...['PROGRAMFILES','PROGRAMFILES(X86)'].map(k=>process.env[k]&&path.join(process.env[k],'LibreOffice','program','soffice.exe')),...((process.env.PATH||'').split(path.delimiter).filter(Boolean).map(p=>path.join(p,isWin?'soffice.exe':'soffice'))));
  for(const candidate of candidates.filter(Boolean)){try{if((await fs.stat(candidate)).isFile())return candidate;}catch{}}
  return null;
}
export async function componentStatus() {return {media:await findEngine('media'),office:await findEngine('office')};}
export function runProcess(binary,args,{signal,onStdout=()=>{},onStderr=()=>{},timeoutMs=3*60*60*1000,successWhen=null,successPollMs=500}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new Error('已取消'));return;}
    const child=spawn(binary,args,{shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
    let stderr='',finished=false,timedOut=false,completedEarly=false,killTimer,successTimer;
    function terminate(){
      if(!child.pid)return;
      if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('error',()=>child.kill());
      else {try{process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},1500);}
    }
    const timer=setTimeout(()=>{timedOut=true;terminate();},timeoutMs);signal?.addEventListener('abort',terminate,{once:true});
    function finish(error){if(finished)return;finished=true;clearTimeout(timer);clearTimeout(killTimer);clearInterval(successTimer);signal?.removeEventListener('abort',terminate);error?reject(error):resolve({stderr});}
    child.stdout.on('data',d=>onStdout(d.toString()));child.stderr.on('data',d=>{stderr=(stderr+d).slice(-12000);onStderr(d.toString());});
    child.on('error',e=>finish(e));if(successWhen){const confirm=async()=>{try{if(!finished&&!signal?.aborted&&await successWhen()){completedEarly=true;terminate();}}catch{}};successTimer=setInterval(confirm,successPollMs);confirm();}child.on('close',code=>finish(signal?.aborted?new Error('已取消'):completedEarly?null:timedOut?new Error(`处理超时，办公组件未完成响应${stderr?`：${stderr.slice(-800)}`:''}`):code!==0?new Error(`转换失败 (${code})：${stderr.slice(-1200)}`):null));
  });
}
