import { OPERATIONS } from './catalog.mjs';
const $=id=>document.getElementById(id),api=window.qingye;
let files=[],folder=null,busy=false,job=null,downloading=false;
const size=n=>n<1024**2?`${(n/1024).toFixed(1)} KB`:`${(n/1024**2).toFixed(2)} MB`;
const op=()=>$('operation').value;
const safe=fn=>async()=>{try{await fn();}catch(e){$( $('settings-panel').hidden?'message':'settings-message').textContent=e.message;}};
function render(){
 $('files').replaceChildren();$('empty').hidden=files.length>0;$('count').textContent=`${files.length} 个文件`;
 for(const id of ['pick','clear','folder-pick','folder-reset','operation'])$(id).disabled=busy;
 $('clear').disabled=busy||!files.length;$('start').disabled=busy||!files.length||downloading;$('cancel').hidden=!busy;
 document.querySelectorAll('input[name=preset],#options input,#options select,nav button').forEach(e=>e.disabled=busy);
 for(let i=0;i<files.length;i++){
  const f=files[i],row=document.createElement('div');row.className='file';const icon=document.createElement('span');icon.className='pdf-icon';icon.textContent=f.name.split('.').pop().toUpperCase().slice(0,5);
  const info=document.createElement('div');info.className='file-info';const name=document.createElement('div');name.className='filename';name.textContent=f.name;name.title=f.path;const detail=document.createElement('div');detail.className='file-detail';
  const r=job?.results.find(r=>r.inputs.includes(f.path));
  detail.textContent=r?r.status==='done'?`${r.inputs.length>1?"合并任务合计：":""}${size(r.before)} → ${size(r.after)} · ${r.outputs.length} 个输出文件`:r.status==='failed'?r.error:r.status==='cancelled'?'已取消':job.stage:`${size(f.size)} · 等待处理`;
  if(r?.status==='failed')detail.classList.add('error');info.append(name,detail);
  if(r?.status==='running'){const progress=document.createElement('progress');progress.max=100;progress.value=job.percent;info.append(progress);}
  const actions=document.createElement('div');actions.className='actions';
  if(r?.outputs.length){const b=document.createElement('button');b.className='link';b.textContent='打开位置';b.onclick=safe(()=>api.reveal(r.outputs[0]));actions.append(b);}
  if(!busy){for(const [label,change] of [['↑',-1],['↓',1],['×',0]]){const b=document.createElement('button');b.className='link remove';b.textContent=label;b.setAttribute('aria-label',`${label==='×'?'移除':label==='↑'?'上移':'下移'} ${f.name}`);b.disabled=change===-1&&i===0||change===1&&i===files.length-1;b.onclick=()=>{if(change){[files[i],files[i+change]]=[files[i+change],files[i]];}else files.splice(i,1);job=null;render();};actions.append(b);}}
  row.append(icon,info,actions);$('files').append(row);
 }
}
function controls(){
 $('options').replaceChildren();const operation=op();$('formats').textContent=`${OPERATIONS[operation].extensions.join(' / ').toUpperCase()} · 每批最多 100 个文件`;
 $('operation-note').textContent=OPERATIONS[operation].combined?'按列表顺序合并，可用箭头调整顺序':'';
 function field(label,id,values,value,type='select'){const l=document.createElement('label');l.textContent=label;const e=document.createElement(type==='select'?'select':'input');e.id=id;if(type==='select'){for(const v of values){const o=document.createElement('option');o.value=v;o.textContent=String(v).toUpperCase();e.append(o);}}else e.type=type;e.value=value;l.append(e);$('options').append(l);}
 if(operation==='image_convert')field('输出格式','format',['jpg','png','webp'],'jpg');
 if(operation==='pdf_to_images')field('输出格式','format',['png','jpg'],'png');
 if(['image_convert','pdf_to_images'].includes(operation))field('最长边（像素）','dimension',[],2600,'number');
 if(operation==='pdf_split')field('提取页码','pages',[],'1-3','text');
 if(operation==='audio_convert')field('输出格式','format',['mp3','wav','flac','m4a'],'mp3');
 if(operation==='video_convert')field('最大高度','height',[480,720,1080,2160],1080);
 if(operation==='office_to_pdf'){const p=document.createElement('span');p.className='note';p.textContent='输出 PDF；排版可能受本机字体影响。首次使用需安装办公组件。';$('options').append(p);}
 document.querySelector('.presets').hidden=['pdf_merge','pdf_split','images_to_pdf','office_to_pdf'].includes(operation);
}
function switchGroup(group){const labels={pdf:'PDF 工具',office:'办公文档',image:'图片处理',audio:'音频转换',video:'视频转换',settings:'组件与 AI'};$('title').textContent=labels[group];document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.group===group));$('work-panel').hidden=group==='settings';$('settings-panel').hidden=group!=='settings';if(group==='settings'){safe(loadSettings)();return;}
 $('operation').replaceChildren();for(const [key,value]of Object.entries(OPERATIONS)){if(value.group===group){const e=document.createElement('option');e.value=key;e.textContent=value.label;$('operation').append(e);}}files=[];job=null;$('message').textContent='';$('summary').textContent='准备好，开始处理文件';controls();render();}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>switchGroup(b.dataset.group));$('operation').onchange=()=>{files=[];job=null;controls();render();};
function added(r){for(const f of r.added)if(!files.some(v=>v.path===f.path)&&files.length<100)files.push(f);job=null;$('message').textContent=r.errors.join('\n');render();}
$('pick').onclick=e=>{e.stopPropagation();safe(async()=>added(await api.pickFiles(op())))();};$('dropzone').onclick=()=>{if(!busy)safe(async()=>added(await api.pickFiles(op())))();};$('dropzone').onkeydown=e=>{if(e.target===$('dropzone')&&['Enter',' '].includes(e.key)){e.preventDefault();$('dropzone').click();}};
for(const event of ['dragover','drop'])document.addEventListener(event,e=>e.preventDefault());$('dropzone').ondragover=()=>{if(!busy)$('dropzone').classList.add('drag');};$('dropzone').ondragleave=()=>$('dropzone').classList.remove('drag');$('dropzone').ondrop=e=>{$('dropzone').classList.remove('drag');if(!busy)safe(async()=>added(await api.dropFiles(Array.from(e.dataTransfer.files),op())))();};
document.querySelectorAll('input[name=preset]').forEach(e=>e.onchange=()=>document.querySelectorAll('.preset').forEach(l=>l.classList.toggle('selected',l.querySelector('input').checked)));
$('clear').onclick=()=>{files=[];job=null;$('message').textContent='';render();};$('folder-pick').onclick=safe(async()=>{const p=await api.pickFolder();if(p){folder=p;$('folder').textContent=p;$('folder').title=p;$('folder-reset').hidden=false;}});$('folder-reset').onclick=()=>{folder=null;$('folder').textContent='第一个文件所在文件夹';$('folder-reset').hidden=true;};
$('start').onclick=safe(async()=>{
 busy=true;job=null;$('message').textContent='';$('summary').textContent='正在处理…';render();
 const options={preset:document.querySelector('input[name=preset]:checked').value};if($('format'))options.format=$('format').value;if($('dimension'))options.maxDimension=Number($('dimension').value);if($('height'))options.maxHeight=Number($('height').value);if($('pages'))options.pages=$('pages').value.replace(/\s/g,'');
 const first=files[0].path,outputDir=folder||first.slice(0,Math.max(first.lastIndexOf('/'),first.lastIndexOf('\\'))+1);
 try{const {jobId}=await api.start({operation:op(),inputs:files.map(f=>f.path),outputDir,options});job=await api.status(jobId);updateJob(job);}catch(e){busy=false;render();throw e;}
});
function updateJob(j){job=j;busy=j.status==='running';if(!busy){const done=j.results.filter(r=>r.status==='done'),failed=j.results.filter(r=>r.status==='failed');$('summary').textContent=`${j.status==='cancelled'?'任务已停止':'处理完成'} · ${done.length} 个成功${failed.length?`，${failed.length} 个失败`:''}`;$('hint').textContent=`已生成 ${j.results.reduce((n,r)=>n+r.outputs.length,0)} 个文件 · 原文件保留`;if(j.error)$('message').textContent=j.error;}else{$('summary').textContent=`${j.stage} ${j.percent}%`;}render();}
api.onEvent(updateJob);$('cancel').onclick=safe(async()=>{if(job)await api.cancel(job.id);});
async function loadSettings(){const s=await api.settings();for(const kind of ['media','office']){$(`${kind}-status`).textContent=s.components[kind]?'已就绪：'+s.components[kind]:'未安装';document.querySelector(`[data-install=${kind}]`).disabled=downloading||Boolean(s.components[kind]);}$('roots').replaceChildren();if(!s.roots.length)$('roots').textContent='尚未授权，AI 无法读写任何文件。';for(const root of s.roots){const row=document.createElement('div');row.className='root-row';const name=document.createElement('span');name.textContent=root;const b=document.createElement('button');b.className='link';b.textContent='撤销';b.onclick=safe(async()=>{await api.removeRoot(root);await loadSettings();});row.append(name,b);$('roots').append(row);}$('mcp-config').value=s.config.json;}
$('refresh').onclick=safe(loadSettings);$('add-root').onclick=safe(async()=>{await api.addRoot();await loadSettings();});for(const kind of ['json','toml'])$(`copy-${kind}`).onclick=safe(async()=>{await api.copyConfig(kind);$('settings-message').textContent='配置已复制，请在 AI 客户端添加本地 MCP 服务。';});
document.querySelectorAll('[data-select]').forEach(b=>b.onclick=safe(async()=>{await api.selectComponent(b.dataset.select);await loadSettings();}));
document.querySelectorAll('[data-install]').forEach(b=>b.onclick=safe(async()=>{downloading=true;document.querySelectorAll('[data-install],[data-select]').forEach(e=>e.disabled=true);$('cancel-download').hidden=false;try{const r=await api.installComponent(b.dataset.install);$('download-status').textContent=r.message;}finally{downloading=false;$('cancel-download').hidden=true;document.querySelectorAll('[data-select]').forEach(e=>e.disabled=false);await loadSettings();render();}}));
$('cancel-download').onclick=safe(()=>api.cancelDownload());api.onComponent(p=>$('download-status').textContent=p.stage);switchGroup('pdf');
