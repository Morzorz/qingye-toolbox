import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as mupdf from 'mupdf';
import {JobService} from '../src/jobs.mjs';
const fixtures=process.env.QINGYE_OFFICE_FIXTURES;
test('real DOCX, XLSX and PPTX conversion generates readable PDFs',{skip:!fixtures},async()=>{
 const out=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-office-output-'));
 for(const ext of ['docx','xlsx','pptx']){
  const jobs=new JobService(),{jobId}=await jobs.submit({operation:'office_to_pdf',inputs:[path.join(fixtures,'sample.'+ext)],outputDir:out});
  const result=await new Promise(resolve=>jobs.on('update',j=>{if(j.id===jobId&&j.status!=='running')resolve(j);}));assert.equal(result.status,'completed',JSON.stringify(result));
  const doc=mupdf.Document.openDocument(await fs.readFile(result.results[0].outputs[0]),'application/pdf');assert(doc.countPages()>0);let text='';const glyphs=new Set();let chinese=0;
  const device=new mupdf.Device({fillText(t){t.walk({showGlyph(font,trm,glyph,unicode){if(unicode>=0x4e00&&unicode<=0x9fff){chinese++;glyphs.add(font.getName()+':'+glyph);}}});}});
  for(let i=0;i<doc.countPages();i++){const p=doc.loadPage(i),s=p.toStructuredText();text+=s.asText();p.run(device,mupdf.Matrix.identity);s.destroy();p.destroy();}
  device.close();device.destroy();assert.match(text,/Qingye/);assert.match(text,/中文转换测试/);assert(chinese>=6);assert(glyphs.size>=6,'Chinese must render as distinct glyphs, not one repeated missing-glyph box');doc.destroy();
 }
});
