import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildVideoArgs,detectHw,hwStatus,clearHwCache,findRenderDevice,defaultBackends} from '../src/hwaccel.mjs';
import {validateOptions} from '../src/catalog.mjs';
import {findEngine,runProcess} from '../src/components.mjs';
import {convertExternal} from '../src/media-office.mjs';

const pair=(args,name)=>{const index=args.indexOf(name);return index<0?null:args[index+1];};

test('buildVideoArgs emits the VAAPI template from the contract',()=>{
 const args=buildVideoArgs({backend:'vaapi',device:'/dev/dri/renderD128',options:{preset:'balanced',maxHeight:1080},input:'/in/a.mp4',output:'/out/a.mp4'});
 // 只用 VAAPI 编码：软解 + CPU 缩放 → hwupload → h264_vaapi。
 // 不用 scale_vaapi（VPP 管线在部分驱动上报 “VAProfile is not supported”），也不用 -hwaccel 硬解。
 assert.equal(pair(args,'-init_hw_device'),'vaapi=va:/dev/dri/renderD128');
 assert.equal(pair(args,'-filter_hw_device'),'va');
 assert.equal(args.includes('-hwaccel'),false,'不做硬解，避免 VPP/解码兼容问题');
 assert(!args.some(a=>a.startsWith('-hwaccel-')),'不得出现 ffmpeg 不认识的短横线选项');
 assert(!args.some(a=>a.includes('scale_vaapi')),'不得使用 scale_vaapi（VPP 兼容性差）');
 assert.equal(pair(args,'-vf'),'scale=-2:trunc(min(ih\\,1080)/2)*2,format=nv12,hwupload');
 assert(args.indexOf('-i')>args.indexOf('-filter_hw_device'),'-i 必须在设备参数之后');
 assert.equal(pair(args,'-c:v'),'h264_vaapi');
 assert.equal(pair(args,'-qp'),'25');
 assert.equal(pair(args,'-c:a'),'aac');
 assert.equal(pair(args,'-b:a'),'128k');
 assert.equal(pair(args,'-movflags'),'+faststart');
 assert.equal(pair(args,'-progress'),'pipe:1');
 assert.equal(args.at(-1),'/out/a.mp4');
 assert(args.includes('/in/a.mp4'));
 assert(!args.includes('libx264'));
 // 没有 device 时退回软件模板，绝不拼出无效的 VAAPI 命令
 assert.equal(pair(buildVideoArgs({backend:'vaapi',options:{},input:'a',output:'b'}),'-c:v'),'libx264');
});

test('buildVideoArgs keeps the libx264 software template and maps the three presets',()=>{
 const soft=buildVideoArgs({options:{preset:'clear',maxHeight:720},input:'/in.mp4',output:'/out.mp4'});
 assert.equal(pair(soft,'-c:v'),'libx264');
 assert.equal(pair(soft,'-preset'),'medium');
 assert.equal(pair(soft,'-crf'),'20');
 assert.equal(pair(soft,'-vf'),'scale=-2:trunc(min(ih\\,720)/2)*2');
 assert.equal(pair(soft,'-pix_fmt'),'yuv420p');
 assert.equal(soft.at(-1),'/out.mp4');
 for(const [preset,level] of [['clear','20'],['balanced','25'],['small','30']]){
  assert.equal(pair(buildVideoArgs({backend:'vaapi',device:'/dev/dri/renderD128',options:{preset},input:'a',output:'b'}),'-qp'),level);
  assert.equal(pair(buildVideoArgs({options:{preset},input:'a',output:'b'}),'-crf'),level);
 }
 assert.equal(pair(buildVideoArgs({options:{},input:'a',output:'b'}),'-crf'),'25');
 assert.equal(pair(buildVideoArgs({backend:'videotoolbox',options:{},input:'a',output:'b'}),'-c:v'),'h264_videotoolbox');
 assert.throws(()=>buildVideoArgs({input:'a'}),/output/);
});

test('validateOptions accepts hw auto/off and rejects anything else',()=>{
 assert.equal(validateOptions('video_convert',{}).hw,'auto');
 assert.equal(validateOptions('video_convert',{hw:'off'}).hw,'off');
 assert.equal(validateOptions('video_convert',{hw:'auto',maxHeight:720}).maxHeight,720);
 assert.throws(()=>validateOptions('video_convert',{hw:'gpu'}),/硬件加速/);
 assert.throws(()=>validateOptions('video_convert',{hw:'ON'}),/硬件加速/);
 assert.throws(()=>validateOptions('video_convert',{hw:true}),/硬件加速/);
 assert.equal('hw' in validateOptions('audio_convert',{}),false);
});

test('detectHw fails soft and caches the negative probe',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'qy-hw-'));
 const calls=path.join(dir,'calls');
 const fake=path.join(dir,'ffmpeg');
 await fs.writeFile(fake,`#!/bin/sh\necho run >> ${JSON.stringify(calls)}\nexit 1\n`,{mode:0o755});
 try{
  clearHwCache();
  assert.equal(await detectHw('/nonexistent/ffmpeg'),null);
  const missing=await hwStatus('/nonexistent/ffmpeg');
  assert.equal(missing.available,false);
  // 各平台默认后端不同（win32 没有默认后端），这里只要求给出可读原因；
  // 「缺少 ffmpeg」的稳定断言放在下面显式指定后端的用例里。
  assert(missing.reason.length>0);
  const missingEngine=await hwStatus('/nonexistent/ffmpeg',{backends:['videotoolbox']});
  assert.equal(missingEngine.available,false);
  assert.match(missingEngine.reason,/ffmpeg/);
  assert.equal(await detectHw(null),null);
  const unsupported=await hwStatus(fake,{backends:[]});
  assert.equal(unsupported.available,false);
  assert.match(unsupported.reason,/硬件编码/);

  // 显式指定后端，保证任意平台都会真的跑一次试编码
  clearHwCache();
  assert.equal(await detectHw(fake,{backends:['videotoolbox']}),null);
  const status=await hwStatus(fake,{backends:['videotoolbox']});
  assert.equal(status.available,false);
  assert.match(status.reason,/试编码失败/);
  assert.equal((await fs.readFile(calls,'utf8')).trim().split('\n').length,1,'失败结果必须缓存，避免每个任务重复探测');
  assert.equal(await detectHw(fake,{backends:['videotoolbox']}),null);
  assert.equal((await fs.readFile(calls,'utf8')).trim().split('\n').length,1,'命中缓存时不应再次启动进程');
  clearHwCache();
  assert.equal(await detectHw(fake,{backends:['videotoolbox']}),null);
  assert.equal((await fs.readFile(calls,'utf8')).trim().split('\n').length,2);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('detectHw against the real engine never throws and reports a coherent status',async()=>{
 const binary=await findEngine('media').catch(()=>null);
 const device=await findRenderDevice();
 assert(device===null||typeof device==='string');
 assert(Array.isArray(defaultBackends()));
 if(!binary)return;
 clearHwCache();
 const result=await detectHw(binary);
 assert(result===null||typeof result.backend==='string',JSON.stringify(result));
 const status=await hwStatus(binary);
 assert.equal(typeof status.available,'boolean');
 if(status.available)assert(typeof status.backend==='string');
 else assert(typeof status.reason==='string'&&status.reason.length>0,JSON.stringify(status));
});

test('hardware failure falls back to exactly one CPU re-run',async()=>{
 const real=await findEngine('media').catch(()=>null);
 if(!real)return;                                    // 没装组件时天然跳过
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'qy-hwfallback-'));
 const mark=path.join(dir,'hw-attempts');
 const fake=path.join(dir,'ffmpeg');
 // 探测（-f null -）交给真实 ffmpeg；真正的硬件编码故意失败；其余（软件编码）走真实 ffmpeg。
 await fs.writeFile(fake,`#!/bin/sh\ncase " $* " in\n  *" -f null - "*) exec "${real}" "$@";;\n  *h264_vaapi*|*h264_videotoolbox*|*h264_nvenc*) echo run >> "${mark}"; exit 1;;\n  *) exec "${real}" "$@";;\nesac\n`,{mode:0o755});
 const previous=process.env.QINGYE_FFMPEG;
 try{
  await runProcess(real,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=160x120:r=10:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-c:a','aac','-shortest',path.join(dir,'in.mp4')]);
  process.env.QINGYE_FFMPEG=fake;clearHwCache();
  const selected=await findEngine('media');
  if(selected!==fake)return;                        // 组件设置覆盖了环境变量时不测（避免误判）
  const hardware=await detectHw(fake);
  const stages=[];
  const result=await convertExternal({operation:'video_convert',inputs:[path.join(dir,'in.mp4')],options:{preset:'balanced',maxHeight:480,hw:'auto'},temp:dir},null,progress=>stages.push(progress.stage));
  assert((await fs.stat(result.outputs[0])).size>0);
  await runProcess(real,['-v','error','-i',result.outputs[0],'-f','null','-']);
  const attempted=await fs.stat(mark).then(()=>true,()=>false);
  if(hardware){
   assert(attempted,'探测到后端时应先尝试硬件编码');
   assert(stages.some(stage=>String(stage).includes('硬件加速不可用，已改用 CPU 重新转换…')),JSON.stringify(stages));
  }else{
   assert(!attempted,'探测失败时不应尝试硬件编码');
   assert(!stages.some(stage=>String(stage).includes('硬件加速（')),JSON.stringify(stages));
  }
  // hw:'off' 绝不触碰硬件
  await fs.rm(mark,{force:true});
  clearHwCache();
  const soft=await convertExternal({operation:'video_convert',inputs:[path.join(dir,'in.mp4')],options:{preset:'small',maxHeight:480,hw:'off'},temp:dir},null,()=>{});
  assert((await fs.stat(soft.outputs[0])).size>0);
  assert.equal(await fs.stat(mark).then(()=>true,()=>false),false,'hw:off 不应尝试硬件编码');
 }finally{
  if(previous===undefined)delete process.env.QINGYE_FFMPEG;else process.env.QINGYE_FFMPEG=previous;
  clearHwCache();
  await fs.rm(dir,{recursive:true,force:true});
 }
});

test('VAAPI args are understood by the real ffmpeg parser',async()=>{
 const ffmpeg=await findEngine('media');
 if(!ffmpeg)return; // 无音视频组件时跳过；容器/CI 由 hwaccel 单测覆盖参数形状
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hw-args-'));
 try{
  const input=path.join(dir,'in.mp4');
  await runProcess(ffmpeg,['-hide_banner','-v','error','-f','lavfi','-i','testsrc2=duration=0.4:size=64x64:rate=12','-c:v','mpeg4','-y',input],{timeoutMs:30000});
  const args=buildVideoArgs({backend:'vaapi',device:'/dev/dri/renderD128',options:{preset:'balanced',maxHeight:720},input,output:path.join(dir,'out.mp4')});
  let stderr='';
  try{await runProcess(ffmpeg,args,{timeoutMs:30000,onStderr:chunk=>{stderr+=chunk;}});}
  catch{/* 无 GPU 的机器必然失败；这里只关心是不是“参数不认识” */}
  // 历史 bug：写成 -hwaccel-output-format 时 ffmpeg 直接 Unrecognized option，
  // 被当成硬件失败静默回退 CPU。这条断言保证参数名永远被 ffmpeg 解析器接受。
  assert(!/Unrecognized option|Option not found|Error splitting the argument list/i.test(stderr),'ffmpeg 无法解析硬件参数：'+stderr.slice(0,400));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('probe args mirror production and keep the filter comma escaped',async()=>{
 const {probeVaapiArgs}=await import('../src/hwaccel.mjs');
 const probeArgs=probeVaapiArgs('/dev/dri/renderD128');
 const probeVf=pair(probeArgs,'-vf');
 const productionVf=pair(buildVideoArgs({backend:'vaapi',device:'/dev/dri/renderD128',options:{maxHeight:720},input:'a',output:'b'}),'-vf');
 // 运行时字符串里必须是 \,（反斜杠+逗号），否则滤镜图会把逗号当过滤器分隔符：
 // 历史 bug：写成 \, 的源码字面量在运行时变成裸逗号，报 “Missing ')' or too many args in 'min(ih'”。
 assert(probeVf.includes('min(ih\\,720)'),'探测参数缺少逗号转义：'+probeVf);
 assert(productionVf.includes('min(ih\\,720)'),'生产参数缺少逗号转义：'+productionVf);
 assert.equal(probeVf,productionVf,'探测与生产的缩放表达式必须一致');
 assert(probeVf.endsWith(',format=nv12,hwupload'));
 assert.equal(pair(probeArgs,'-filter_hw_device'),'va');
 assert(!probeArgs.some(a=>a.includes('scale_vaapi')));
});
