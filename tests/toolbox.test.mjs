import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { fixture } from './fixtures.mjs';
import { JobService } from '../src/jobs.mjs';
import { runProcess,findEngine } from '../src/components.mjs';
async function run(request){const jobs=new JobService();const {jobId}=await jobs.submit(request);return new Promise(resolve=>jobs.on('update',j=>{if(j.id===jobId&&j.status!=='running')resolve(j);}));}
const root=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-engine-'));
await fs.writeFile(path.join(root,'first.pdf'),fixture());await fs.writeFile(path.join(root,'second.pdf'),fixture());
await sharp({create:{width:120,height:80,channels:3,background:'#aa2233'}}).png().toFile(path.join(root,'image.png'));
test('merge, extract and PDF image rendering preserve actual content',async()=>{
  const merged=await run({operation:'pdf_merge',inputs:[path.join(root,'first.pdf'),path.join(root,'second.pdf')],outputDir:root});assert.equal(merged.status,'completed',JSON.stringify(merged));
  const mergedPath=merged.results[0].outputs[0];const d=mupdf.Document.openDocument(await fs.readFile(mergedPath),'application/pdf');assert.equal(d.countPages(),2);d.destroy();
  const split=await run({operation:'pdf_split',inputs:[mergedPath],outputDir:root,options:{pages:'2'}});assert.equal(split.status,'completed');
  const out=mupdf.Document.openDocument(await fs.readFile(split.results[0].outputs[0]),'application/pdf');assert.equal(out.countPages(),1);assert.match(out.loadPage(0).toStructuredText().asText(),/Qingye/);out.destroy();
  const images=await run({operation:'pdf_to_images',inputs:[mergedPath],outputDir:root,options:{format:'png',maxDimension:500}});assert.equal(images.status,'completed');assert.equal(images.results[0].outputs.length,2);assert.equal((await sharp(images.results[0].outputs[0]).metadata()).height,500);
});
test('images convert and combine to PDF; collisions preserve original files',async()=>{
  const original=await fs.readFile(path.join(root,'image.png'));
  for(let i=0;i<2;i++){const j=await run({operation:'image_convert',inputs:[path.join(root,'image.png')],outputDir:root,options:{format:'webp',maxDimension:64}});assert.equal(j.status,'completed',JSON.stringify(j));assert.equal((await sharp(j.results[0].outputs[0]).metadata()).width,64);}
  assert.deepEqual(await fs.readFile(path.join(root,'image.png')),original);assert((await fs.stat(path.join(root,'image_转换 (1).webp'))).size>0);
  const j=await run({operation:'images_to_pdf',inputs:[path.join(root,'image.png')],outputDir:root});assert.equal(j.status,'completed',JSON.stringify(j));
  const d=mupdf.Document.openDocument(await fs.readFile(j.results[0].outputs[0]),'application/pdf');assert.equal(d.countPages(),1);d.destroy();
});
test('batch isolates invalid PDFs and cleans temporary files',async()=>{
  await fs.writeFile(path.join(root,'bad.pdf'),'invalid');
  const j=await run({operation:'pdf_compress',inputs:[path.join(root,'bad.pdf'),path.join(root,'first.pdf')],outputDir:root});assert.equal(j.status,'completed_with_errors');assert.equal(j.results[1].status,'done');assert(!(await fs.readdir(root)).some(p=>p.startsWith('.qingye-')));
});
test('simultaneous submissions cannot run two jobs and cancellation cleans up',async()=>{
  const jobs=new JobService();const request={operation:'pdf_compress',inputs:Array(30).fill(path.join(root,'first.pdf')),outputDir:root};
  const results=await Promise.allSettled([jobs.submit(request),jobs.submit(request)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const id=results.find(r=>r.status==='fulfilled').value.jobId;jobs.cancel(id);
  await new Promise(resolve=>jobs.on('update',j=>{if(j.status==='cancelled')resolve();}));assert(!(await fs.readdir(root)).some(p=>p.startsWith('.qingye-')));
});
test('actual audio and video conversion',{skip:!(await findEngine('media'))},async()=>{
  const binary=await findEngine('media');const source=path.join(root,'sample.mp4');
  await runProcess(binary,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=320x240:r=15:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-c:a','aac','-shortest',source]);
  const audio=await run({operation:'audio_convert',inputs:[source],outputDir:root,options:{format:'mp3'}});assert.equal(audio.status,'completed',JSON.stringify(audio));assert((await fs.stat(audio.results[0].outputs[0])).size>1000);
  const video=await run({operation:'video_convert',inputs:[source],outputDir:root,options:{maxHeight:480}});assert.equal(video.status,'completed',JSON.stringify(video));await runProcess(binary,['-v','error','-i',video.results[0].outputs[0],'-f','null','-']);
  // 契约 §2.8：hw:'off' 必须直接走软件路径（等价于“无 GPU”环境的行为）
  const software=await run({operation:'video_convert',inputs:[source],outputDir:root,options:{maxHeight:480,hw:'off'}});assert.equal(software.status,'completed',JSON.stringify(software));await runProcess(binary,['-v','error','-i',software.results[0].outputs[0],'-f','null','-']);
  assert.notEqual(software.results[0].outputs[0],video.results[0].outputs[0]);
});
