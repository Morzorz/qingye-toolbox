import fs from 'node:fs/promises';
import {runProcess} from './components.mjs';

/**
 * 视频硬件加速（契约 §2.8）。
 *
 * - `buildVideoArgs` 是纯函数：只拼参数，不碰文件系统，便于单测。
 * - `detectHw` / `hwStatus` 做真实试编码探测，结果按「binary + mtime + device」缓存在模块内；
 *   探测失败也缓存原因，避免每个任务重复探测。探测永远不抛错——容器 / CI 无 GPU 时返回 null。
 */

const CACHE=new Map();
const PROBE_TIMEOUT_MS=15000;
const PROBE_SECONDS=0.5;
const PROBE_SOURCE=`testsrc2=duration=${PROBE_SECONDS}:size=256x144:rate=12`;
// 三档画质：x264 用 CRF、VAAPI 用 QP、VideoToolbox 用码率（语义相同：清晰 / 均衡 / 体积）。
const LEVEL={clear:20,balanced:25,small:30};
const VIDEO_TOOLBOX_BITRATE={clear:'6000k',balanced:'3000k',small:'1200k'};

/** 当前平台默认尝试的后端顺序；其它平台没有可用的硬件编码后端。 */
export function defaultBackends(){
 if(process.platform==='linux')return ['vaapi'];
 if(process.platform==='darwin')return ['videotoolbox'];
 return [];
}

/** 清空探测缓存（测试与「重新检测」用）。 */
export function clearHwCache(){CACHE.clear();}

/** 按序返回第一个存在的 /dev/dri/renderD*（Linux）。 */
export async function findRenderDevice(){
 let names;
 try{names=await fs.readdir('/dev/dri');}
 catch{return null;}
 const candidates=names.filter(name=>/^renderD\d+$/.test(name)).sort((a,b)=>Number(a.slice(7))-Number(b.slice(7)));
 for(const name of candidates){
  const device=`/dev/dri/${name}`;
  const stat=await fs.stat(device).catch(()=>null);
  if(stat&&stat.isCharacterDevice())return device;
 }
 return null;
}

/**
 * 缩放表达式（等比、高度不小于原高、宽高取偶数）。
 * 注意 `\\,`：滤镜图里逗号是分隔符，表达式内的逗号必须转义成 `\,` 才能传给 scale。
 * 生产与探测必须共用这个函数，否则极易出现“探测参数写错、但生产参数是对的”这类偏差。
 */
const scaleExpression=height=>`scale=-2:trunc(min(ih\\,${height})/2)*2`;

/**
 * 纯函数：生成 video_convert 的 ffmpeg 参数。
 * backend: 'vaapi' | 'videotoolbox' | 'software'（默认）。
 */
export function buildVideoArgs({backend='software',device=null,options={},input,output}={}){
 if(typeof input!=='string'||!input)throw new Error('buildVideoArgs 需要 input');
 if(typeof output!=='string'||!output)throw new Error('buildVideoArgs 需要 output');
 const level=LEVEL[options.preset]??LEVEL.balanced;
 const height=Number.isFinite(options.maxHeight)?options.maxHeight:1080;
 const scale=scaleExpression(height);
 const head=['-hide_banner','-nostdin','-y','-protocol_whitelist','file,pipe'];
 const tail=['-progress','pipe:1','-nostats',output];
 const audio=['-c:a','aac','-b:a','128k','-movflags','+faststart'];
 if(backend==='vaapi'&&device){
  // format=nv12|vaapi,hwupload：硬解不可用时自动退回软解再上传，仍然硬编。
  // 只用 VAAPI 做编码：软件解码 + CPU 缩放后 hwupload，再 h264_vaapi 硬编。
  // 不用 scale_vaapi（走 VPP 管线），部分驱动/代际会报 “the requested VAProfile is not supported”，
  // 也不会因硬解失败而整条命令失败；CPU 只承担解码与缩放，编码在 GPU。
  return [...head,
   '-init_hw_device',`vaapi=va:${device}`,'-filter_hw_device','va',
   '-i',input,
   '-map','0:v:0','-map','0:a:0?',
   '-vf',`${scale},format=nv12,hwupload`,
   '-c:v','h264_vaapi','-qp',String(level),
   ...audio,...tail];
 }
 if(backend==='videotoolbox'){
  return [...head,'-i',input,
   '-map','0:v:0','-map','0:a:0?',
   '-c:v','h264_videotoolbox','-allow_sw','1','-b:v',VIDEO_TOOLBOX_BITRATE[options.preset]??VIDEO_TOOLBOX_BITRATE.balanced,
   '-vf',scale,'-pix_fmt','yuv420p',
   ...audio,...tail];
 }
 return [...head,'-i',input,
  '-map','0:v:0','-map','0:a:0?',
  '-c:v','libx264','-preset','medium','-crf',String(level),
  '-vf',scale,'-pix_fmt','yuv420p',
  ...audio,...tail];
}

function failureReason(label,error,stderr){
 const detail=String(stderr||'').replace(/\s+/g,' ').trim().slice(0,180);
 if(/ENOENT/.test(error.message))return `未找到可用的 ffmpeg：${error.message}`;
 return `${label} 试编码失败${detail?`：${detail}`:''}`;
}

async function probe(binary,args,label){
 let stderr='';
 try{
  await runProcess(binary,args,{timeoutMs:PROBE_TIMEOUT_MS,onStderr:chunk=>{stderr=(stderr+chunk).slice(-2000);}});
  return {result:null,reason:null};
 }catch(error){return {result:null,reason:failureReason(label,error,stderr)};}
}

/** 导出探测参数，便于单测断言「探测与生产同构」——尤其是滤镜里的逗号转义。 */
export function probeVaapiArgs(device){
 return ['-hide_banner','-nostdin','-v','error',
  '-init_hw_device',`vaapi=va:${device}`,'-filter_hw_device','va',
  '-f','lavfi','-i',PROBE_SOURCE,
  '-vf',`${scaleExpression(720)},format=nv12,hwupload`,
  '-c:v','h264_vaapi','-qp','25','-f','null','-'];
}

async function probeBackend(binary,backend,device){
 if(backend==='vaapi'){
  if(!device)return {result:null,reason:'没有可用的 VAAPI 设备：未找到 /dev/dri/renderD*（宿主未直通核显，或容器未映射设备）'};
  // 探测必须复刻生产管线（设备初始化、filter_hw_device、软件缩放 + hwupload + h264_vaapi），
  // 否则“显示可用但真实转换失败回退 CPU”的情况会被探测掩盖。
  const outcome=await probe(binary,probeVaapiArgs(device),'VAAPI');
  return outcome.reason?outcome:{result:{backend:'vaapi',device},reason:null};
 }
 if(backend==='videotoolbox'){
  const outcome=await probe(binary,['-hide_banner','-nostdin','-v','error','-f','lavfi','-i',PROBE_SOURCE,'-c:v','h264_videotoolbox','-f','null','-'],'VideoToolbox');
  return outcome.reason?outcome:{result:{backend:'videotoolbox',device:null},reason:null};
 }
 return {result:null,reason:`不支持的硬件编码后端：${backend}`};
}

async function resolve(binary,{backends,force=false}={}){
 const list=Array.isArray(backends)?backends:defaultBackends();
 const device=list.includes('vaapi')?await findRenderDevice():null;
 let fingerprint='missing';
 if(typeof binary==='string'&&binary){
  const stat=await fs.stat(binary).catch(()=>null);
  if(stat)fingerprint=`${Math.round(stat.mtimeMs)}-${stat.size}`;
 }
 const key=[process.platform,list.join('+'),binary||'',fingerprint,device||''].join('|');
 if(!force&&CACHE.has(key))return CACHE.get(key);
 let record;
 if(!list.length)record={result:null,reason:`当前系统不支持硬件编码（${process.platform}）`};
 else if(fingerprint==='missing')record={result:null,reason:'未找到可用的 ffmpeg，无法探测硬件编码'};
 else{
  record={result:null,reason:'未检测到可用的硬件编码器'};
  for(const backend of list){
   const outcome=await probeBackend(binary,backend,device);
   if(outcome.result){record=outcome;break;}
   record={result:null,reason:outcome.reason};
  }
 }
 CACHE.set(key,record);
 return record;
}

/** 探测硬件编码：成功返回 {backend,device?}，失败（含无 GPU / 驱动缺失）返回 null。永不抛错。 */
export async function detectHw(binary,options={}){
 try{const record=await resolve(binary,options);return record.result;}
 catch{return null;}
}

/** 给设置页用的探测摘要：{available,backend?,device?,reason?}。永不抛错。 */
export async function hwStatus(binary,options={}){
 let record;
 try{record=await resolve(binary,options);}
 catch(error){return {available:false,reason:`硬件探测失败：${error.message}`};}
 if(record.result)return {available:true,backend:record.result.backend,...(record.result.device?{device:record.result.device}:{})};
 return {available:false,reason:record.reason||'未检测到可用的硬件编码器'};
}
