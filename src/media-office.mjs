import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { findEngine, runProcess } from './components.mjs';
import { buildVideoArgs, detectHw } from './hwaccel.mjs';
export async function convertExternal({operation,inputs,options,temp},signal,progress) {
  const kind=operation==='office_to_pdf'?'office':'media';const binary=await findEngine(kind);
  if(!binary)throw new Error(`缺少${kind==='office'?'办公文档':'音视频'}组件，请先在「组件与 AI」中下载或选择已安装组件`);
  const base=path.basename(inputs[0],path.extname(inputs[0]));
  if(kind==='office') {
    // fnOS app-share volumes can reject LibreOffice profile locks. Keep all
    // LibreOffice state and its first PDF write in the package-private temp dir,
    // then copy the validated result into the authorized output directory.
    const work=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-office-'));
    const profile=path.join(work,'profile');const output=path.join(work,base+'.pdf');
    try{
      await fs.mkdir(path.join(profile,'user','fonts'),{recursive:true});
      await fs.writeFile(path.join(profile,'user','fonts','NotoSansSC-Regular.otf'),await fs.readFile(fileURLToPath(new URL('../assets/fonts/NotoSansSC-Regular.otf',import.meta.url))));
      await fs.writeFile(path.join(profile,'user','registrymodifications.xcu'),'<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>');
      const started=Date.now();progress({percent:10,stage:'正在启动办公文档转换…'});
      const heartbeat=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);progress({percent:10,stage:`正在转换办公文档… 已等待 ${seconds} 秒`});},5000);
      const validPdf=async()=>{const file=await fs.open(output,'r').catch(()=>null);if(!file)return false;try{const b=Buffer.alloc(5);await file.read(b,0,5,0);return b.toString()==='%PDF-';}finally{await file.close();}};
      let diagnostics='';console.log('Qingye office conversion started:',JSON.stringify({input:inputs[0],output,work,engine:binary}));
      try{
        await runProcess(binary,[`-env:UserInstallation=${pathToFileURL(profile).href}`,'--headless','--invisible','--nologo','--nodefault','--nofirststartwizard','--nolockcheck','--norestore','--convert-to','pdf','--outdir',work,inputs[0]],{signal,timeoutMs:3*60*1000,successWhen:validPdf,onStdout:chunk=>{diagnostics=(diagnostics+chunk).slice(-2000);},onStderr:chunk=>{diagnostics=(diagnostics+chunk).slice(-2000);}});
        console.log('Qingye office conversion completed:',JSON.stringify({input:inputs[0],output}));
      }catch(error){console.error('Qingye office conversion failed:',JSON.stringify({input:inputs[0],output,work,error:error.message,diagnostics}));throw error;
      }finally{clearInterval(heartbeat);}
      if(!await validPdf())throw new Error('办公组件未生成 PDF；请确认文件未加密且可正常打开');
      const renamed=path.join(temp,base+'_转换.pdf');await fs.copyFile(output,renamed);return {outputs:[renamed]};
    }finally{await fs.rm(work,{recursive:true,force:true}).catch(()=>{});}
  }
  const format=operation==='audio_convert'?options.format:'mp4';const output=path.join(temp,`${base}_转换.${format}`);
  // 进度解析：ffmpeg -progress pipe:1 的 out_time_us 对比容器时长；硬件执行时给 stage 加前缀。
  const runMedia=async(args,{prefix='',running='正在转换音视频…'}={})=>{
    let duration=0,stderr='',stdout='';
    const stageFor=seconds=>{
      if(prefix)return seconds===null?`${prefix}正在转换…`:`${prefix}已处理 ${Math.round(seconds)} 秒…`;
      return seconds===null?running:`已处理 ${Math.round(seconds)} 秒…`;
    };
    try{
     await runProcess(binary,args,{signal,onStderr:chunk=>{stderr=(stderr+chunk).slice(-5000);const m=stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);if(m)duration=Number(m[1])*3600+Number(m[2])*60+Number(m[3]);},onStdout:chunk=>{stdout+=chunk;let index;while((index=stdout.indexOf('\n'))>=0){const line=stdout.slice(0,index);stdout=stdout.slice(index+1);if(line.startsWith('out_time_us=')){const seconds=Number(line.slice(12))/1e6;progress({percent:duration?Math.min(98,Math.round(seconds/duration*100)):5,stage:stageFor(duration?null:seconds)});}}}});
    }catch(error){error.stderrTail=stderr.replace(/\s+/g,' ').trim().slice(-400);throw error;}
  };
  if(operation==='audio_convert'){
    // 音频转换不走硬件（契约 §2.8）。
    const bitrate={clear:'256k',balanced:'192k',small:'96k'}[options.preset];
    const codec=format==='mp3'?['-c:a','libmp3lame','-b:a',bitrate]:format==='m4a'?['-c:a','aac','-b:a',bitrate]:format==='wav'?['-c:a','pcm_s16le']:['-c:a','flac'];
    await runMedia(['-hide_banner','-nostdin','-y','-protocol_whitelist','file,pipe','-i',inputs[0],'-map','0:a:0','-vn',...codec,'-progress','pipe:1','-nostats',output]);
    if((await fs.stat(output)).size===0)throw new Error('转换输出为空');
    return {outputs:[output]};
  }
  // 视频：硬件先行（契约 §2.8），进程失败则记录并回退 CPU 重跑一次。
  const hardware=options.hw==='off'?null:await detectHw(binary).catch(()=>null);
  if(hardware){
    try{
      await runMedia(buildVideoArgs({backend:hardware.backend,device:hardware.device,options,input:inputs[0],output}),{prefix:'硬件加速（'+hardwareLabel(hardware.backend)+'）'});
    }catch(error){
      if(signal?.aborted)throw error;
      console.log('Qingye hardware video conversion failed, retrying on CPU:',JSON.stringify({backend:hardware.backend,device:hardware.device??null,error:error.message,ffmpeg:error.stderrTail||null}));
      progress({percent:0,stage:'硬件加速不可用，已改用 CPU 重新转换…'});
      await fs.rm(output,{force:true}).catch(()=>{});
      await runMedia(buildVideoArgs({backend:'software',options,input:inputs[0],output}),{running:'正在转换视频…'});
    }
  }else await runMedia(buildVideoArgs({backend:'software',options,input:inputs[0],output}),{running:'正在转换视频…'});
  if((await fs.stat(output)).size===0)throw new Error('转换输出为空');return {outputs:[output]};
}
const hardwareLabel=backend=>backend==='vaapi'?'VAAPI':backend==='videotoolbox'?'VideoToolbox':'GPU';
