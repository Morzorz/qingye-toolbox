import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import { OPERATIONS, validateOptions } from './catalog.mjs';
import { convertExternal } from './media-office.mjs';
export class JobService extends EventEmitter {
  jobs=new Map(); active=null;
  constructor({historyFile=null}={}){super();this.historyFile=historyFile;}
  async loadHistory(){if(!this.historyFile)return;try{const items=JSON.parse(await fs.readFile(this.historyFile,'utf8'));for(const item of items.slice(-100)){if(item.status==='running'){item.status='interrupted';item.stage='应用重启，任务已中断';}this.jobs.set(item.id,item);}}catch(e){if(e.code!=='ENOENT')throw e;}}
  history(){return [...this.jobs.values()].map(j=>this.snapshot(j.id)).reverse();}
  async saveHistory(){if(!this.historyFile)return;const file=this.historyFile+'.tmp';await fs.writeFile(file,JSON.stringify(this.history()),{mode:0o600});await fs.rename(file,this.historyFile);}
  snapshot(id){const j=this.jobs.get(id);if(!j)throw new Error('任务不存在或已过期');const {controller,authorize,...publicJob}=j;return structuredClone(publicJob);}
  async submit(request,authorize=null,owner=null){
    if(this.active)throw new Error('已有任务正在执行，请等待完成或取消');
    const {operation,inputs,outputDir}=request;const options=validateOptions(operation,request.options);
    if(!Array.isArray(inputs)||!inputs.length||inputs.length>100)throw new Error('每批需要 1–100 个文件');
    if(operation==='pdf_merge'&&inputs.length<2)throw new Error('合并 PDF 至少需要两个文件');
    if(typeof outputDir!=='string'||!path.isAbsolute(outputDir))throw new Error('输出目录必须为已存在的绝对路径');
    if(!(await fs.stat(outputDir)).isDirectory())throw new Error('输出位置不是文件夹');
    await authorize?.(inputs,outputDir);
    const canonical=[];
    for(const input of inputs){
      if(typeof input!=='string'||!path.isAbsolute(input))throw new Error('文件路径必须为绝对路径');
      const real=await fs.realpath(input),stat=await fs.stat(real),ext=path.extname(real).slice(1).toLowerCase();
      if(!OPERATIONS[operation].extensions.includes(ext))throw new Error(`${path.basename(input)} 不支持此操作`);
      if(!stat.isFile()||stat.size===0)throw new Error('输入文件为空或不是普通文件');
      const max=['audio_convert','video_convert'].includes(operation)?20*1024**3:500*1024**2;
      if(stat.size>max)throw new Error(`文件超出限制：${max/1024**2} MB`);canonical.push(real);
    }
    const canonicalOutput=await fs.realpath(outputDir);
    if(OPERATIONS[operation].combined){let total=0;for(const p of canonical)total+=(await fs.stat(p)).size;if(total>500*1024**2)throw new Error('合并任务总输入不能超过 500 MB');}
    // Recheck after async validation so concurrent submit calls cannot both start.
    if(this.active)throw new Error('已有任务正在执行');
    const id=randomUUID();const job={id,owner,operation,inputs:canonical,outputDir:canonicalOutput,options,status:'running',percent:0,stage:'准备处理',results:[],createdAt:Date.now(),controller:new AbortController(),authorize};
    this.jobs.set(id,job);this.active=id;
    while(this.jobs.size>100){const oldest=this.jobs.keys().next().value;if(oldest===id)break;this.jobs.delete(oldest);}
    try{await this.saveHistory();}catch(e){this.jobs.delete(id);this.active=null;throw e;}setImmediate(()=>this.run(job));return {jobId:id};
  }
  cancel(id){const j=this.jobs.get(id);if(!j)throw new Error('任务不存在');if(j.status==='running'){j.controller.abort();j.stage='正在停止…';}return this.snapshot(id);}
  notify(j){this.emit('update',this.snapshot(j.id));}
  async run(j){
    const groups=OPERATIONS[j.operation].combined?[j.inputs]:j.inputs.map(p=>[p]);
    try{
      for(let i=0;i<groups.length;i++){
        if(j.controller.signal.aborted)break;
        const inputs=groups[i],result={inputs,status:'running',outputs:[],before:0,after:0};j.results.push(result);let temp;
        try{
          await j.authorize?.(inputs,j.outputDir);
          for(const p of inputs)result.before+=(await fs.stat(p)).size;
          temp=await fs.mkdtemp(path.join(j.outputDir,'.qingye-'));
          const params={operation:j.operation,inputs,options:j.options,temp};
          const progress=p=>{j.percent=Math.round((i+(p.percent||0)/100)/groups.length*100);j.stage=p.stage;this.notify(j);};
          const r=OPERATIONS[j.operation].component?await convertExternal(params,j.controller.signal,progress):await this.worker(params,j.controller.signal,progress);
          await j.authorize?.(inputs,j.outputDir);
          for(const source of r.outputs){
            if(j.controller.signal.aborted)throw new Error('已取消');
            const filename=path.basename(source);let target;
            for(let n=0;n<10000;n++){
              target=path.join(j.outputDir,n?`${path.basename(filename,path.extname(filename))} (${n})${path.extname(filename)}`:filename);
              try{await fs.copyFile(source,target,constants.COPYFILE_EXCL);break;}catch(e){if(e.code!=='EEXIST'||n===9999)throw e;}
            }
            result.outputs.push(target);result.after+=(await fs.stat(target)).size;
          }
          result.status='done';result.reduced=result.after<result.before;
        }catch(e){result.status=j.controller.signal.aborted?'cancelled':'failed';result.error=e.message;}
        finally{if(temp)await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});}
        this.notify(j);
      }
      j.status=j.controller.signal.aborted?'cancelled':j.results.some(r=>r.status==='failed')?'completed_with_errors':'completed';
    }catch(e){j.status='failed';j.error=e.message;}
    finally{j.percent=j.status.startsWith('completed')?100:j.percent;j.finishedAt=Date.now();this.active=null;this.notify(j);await this.saveHistory().catch(e=>console.error('Qingye history save failed:',e.message));}
  }
  worker(params,signal,progress){
    return new Promise((resolve,reject)=>{
      if(signal.aborted){reject(new Error('已取消'));return;}
      const worker=new Worker(new URL('./operations-worker.mjs',import.meta.url),{workerData:params,stdout:true});let done=false;
      // Keep library diagnostics away from the MCP protocol on stdout.
      worker.stdout.resume();
      const abort=()=>finish(new Error('已取消'));
      async function finish(error,result){if(done)return;done=true;signal.removeEventListener('abort',abort);await worker.terminate();error?reject(error):resolve(result);}
      signal.addEventListener('abort',abort,{once:true});
      worker.on('message',m=>{if(m.type==='progress')progress(m);if(m.type==='result')finish(null,m);if(m.type==='error')finish(new Error(m.error));});
      worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!done)finish(new Error(`处理进程意外结束 (${code})`));});
    });
  }
}
