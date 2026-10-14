import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { findEngine, runProcess } from './components.mjs';
export async function convertExternal({operation,inputs,options,temp},signal,progress) {
  const kind=operation==='office_to_pdf'?'office':'media';const binary=await findEngine(kind);
  if(!binary)throw new Error(`缺少${kind==='office'?'办公文档':'音视频'}组件，请先在「组件与 AI」中下载或选择已安装组件`);
  const base=path.basename(inputs[0],path.extname(inputs[0]));
  if(kind==='office') {
    const profile=path.join(temp,'office-profile');await fs.mkdir(path.join(profile,'user'),{recursive:true});
    // Headless Office can miss OS fonts. Register our CJK fallback in this
    // task's private profile; do not install fonts globally or edit documents.
    const fonts=path.join(profile,'user','fonts');await fs.mkdir(fonts,{recursive:true});
    await fs.writeFile(path.join(fonts,'NotoSansSC-Regular.otf'),await fs.readFile(fileURLToPath(new URL('../assets/fonts/NotoSansSC-Regular.otf',import.meta.url))));
    await fs.writeFile(path.join(profile,'user','registrymodifications.xcu'),'<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>');
    const started=Date.now();
    progress({percent:10,stage:'正在启动办公文档转换…'});
    const heartbeat=setInterval(()=>{
      const seconds=Math.floor((Date.now()-started)/1000);
      progress({percent:10,stage:`正在转换办公文档… 已等待 ${seconds} 秒`});
    },5000);
    try{
      await runProcess(binary,[`-env:UserInstallation=${pathToFileURL(profile).href}`,'--headless','--invisible','--nologo','--nodefault','--nofirststartwizard','--nolockcheck','--norestore','--convert-to','pdf','--outdir',temp,inputs[0]],{signal,timeoutMs:3*60*1000});
    }finally{clearInterval(heartbeat);}
    const output=path.join(temp,base+'.pdf');const head=await fs.open(output,'r').catch(()=>null);
    if(!head)throw new Error('办公组件未生成 PDF；请确认文件未加密且可正常打开');
    try{const b=Buffer.alloc(5);await head.read(b,0,5,0);if(b.toString()!=='%PDF-')throw new Error('生成的 PDF 验证未通过');}finally{await head.close();}
    const renamed=path.join(temp,base+'_转换.pdf');await fs.rename(output,renamed);return {outputs:[renamed]};
  }
  const format=operation==='audio_convert'?options.format:'mp4';const output=path.join(temp,`${base}_转换.${format}`);
  const args=['-hide_banner','-nostdin','-y','-protocol_whitelist','file,pipe','-i',inputs[0]];
  if(operation==='audio_convert') {
    args.push('-map','0:a:0','-vn');
    const bitrate={clear:'256k',balanced:'192k',small:'96k'}[options.preset];
    if(format==='mp3')args.push('-c:a','libmp3lame','-b:a',bitrate);
    if(format==='m4a')args.push('-c:a','aac','-b:a',bitrate);
    if(format==='wav')args.push('-c:a','pcm_s16le');
    if(format==='flac')args.push('-c:a','flac');
  }else args.push('-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','medium','-crf',String({clear:20,balanced:25,small:30}[options.preset]),'-vf',`scale=-2:trunc(min(ih\\,${options.maxHeight})/2)*2`,'-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart');
  args.push('-progress','pipe:1','-nostats',output);
  let duration=0,stderr='',stdout='';
  await runProcess(binary,args,{signal,onStderr:chunk=>{stderr=(stderr+chunk).slice(-5000);const m=stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);if(m)duration=Number(m[1])*3600+Number(m[2])*60+Number(m[3]);},onStdout:chunk=>{stdout+=chunk;let index;while((index=stdout.indexOf('\n'))>=0){const line=stdout.slice(0,index);stdout=stdout.slice(index+1);if(line.startsWith('out_time_us=')){const seconds=Number(line.slice(12))/1e6;progress({percent:duration?Math.min(98,Math.round(seconds/duration*100)):5,stage:duration?'正在转换音视频…':`已处理 ${Math.round(seconds)} 秒…`});}}}});
  if((await fs.stat(output)).size===0)throw new Error('转换输出为空');return {outputs:[output]};
}
