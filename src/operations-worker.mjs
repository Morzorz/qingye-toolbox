import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as mupdf from 'mupdf';
import sharp from 'sharp';
import { compressPDF } from './compress.mjs';
const { operation, inputs, options, temp } = workerData;
const quality = { clear: 88, balanced: 78, small: 62 }[options.preset];
const progress = (percent, stage) => parentPort.postMessage({ type:'progress', percent, stage });
const outputs = [];
async function save(name, bytes) { const file = path.join(temp,name); await fs.writeFile(file,bytes,{flag:'wx'});outputs.push(file); }
function openPDF(bytes) {
  const doc=mupdf.Document.openDocument(bytes,'application/pdf');
  if(!(doc instanceof mupdf.PDFDocument)) {doc.destroy();throw new Error('无效 PDF');}
  doc.disableJS();
  if(doc.needsPassword() || !doc.getTrailer().get('Encrypt').isNull()) {doc.destroy();throw new Error('暂不支持加密 PDF');}
  for(let i=1;i<doc.countObjects();i++) {const o=doc.newIndirect(i);try{if(o.isDictionary() && (!o.get('ByteRange').isNull() || o.get('Type').asName()==='Sig'))throw new Error('含数字签名的 PDF 暂不支持处理');}catch(e){doc.destroy();throw e;}finally{o.destroy();}}
  if(!doc.countPages()){doc.destroy();throw new Error('PDF 没有页面');}return doc;
}
async function imagePipeline(file) {
  const image=sharp(file,{limitInputPixels:80*1024*1024,animated:false});const meta=await image.metadata();
  if((meta.pages||1)>1)throw new Error('暂不支持动画或多帧图片');return image.rotate();
}
try {
  const base = path.basename(inputs[0],path.extname(inputs[0]));
  if(operation==='pdf_compress') {
    const r=compressPDF(await fs.readFile(inputs[0]),options.preset,p=>progress(p.percent,p.stage));
    await save(`${base}_压缩版.pdf`,r.bytes);parentPort.postMessage({type:'result',outputs,reduced:r.reduced});
  } else if(operation==='image_convert') {
    let p=await imagePipeline(inputs[0]);p=p.resize({width:options.maxDimension,height:options.maxDimension,fit:'inside',withoutEnlargement:true});
    p=options.format==='jpg'?p.flatten({background:'#ffffff'}).jpeg({quality}):options.format==='png'?p.png({compressionLevel:9}):p.webp({quality});
    await save(`${base}_转换.${options.format}`,await p.toBuffer());parentPort.postMessage({type:'result',outputs});
  } else if(operation==='images_to_pdf') {
    const doc=new mupdf.PDFDocument();try {
      for(let i=0;i<inputs.length;i++) {
        const png=await (await imagePipeline(inputs[i])).png().toBuffer();const img=new mupdf.Image(png);let ref;
        try {ref=doc.addImage(img);const scale=Math.min(1,842/Math.max(img.getWidth(),img.getHeight()));const w=img.getWidth()*scale,h=img.getHeight()*scale;const page=doc.addPage([0,0,w,h],0,{XObject:{Im:ref}},`q ${w} 0 0 ${h} 0 0 cm /Im Do Q`);doc.insertPage(-1,page);page.destroy();}finally{ref?.destroy();img.destroy();}
        progress(Math.round((i+1)/inputs.length*90),'正在合并图片…');
      }
      const b=doc.saveToBuffer('garbage=compact,compress=yes');try{await save(`${base}_图片合并.pdf`,b.asUint8Array());}finally{b.destroy();}
    }finally{doc.destroy();}parentPort.postMessage({type:'result',outputs});
  } else if(operation==='pdf_to_images') {
    const doc=openPDF(await fs.readFile(inputs[0]));try {
      if(doc.countPages()>500)throw new Error('一次最多导出 500 页，请先提取所需页面');
      for(let i=0;i<doc.countPages();i++) {const page=doc.loadPage(i);let pix;try{const b=page.getBounds();const scale=options.maxDimension/Math.max(b[2]-b[0],b[3]-b[1]);pix=page.toPixmap(mupdf.Matrix.scale(scale,scale),mupdf.ColorSpace.DeviceRGB,false,true);await save(`${base}_${String(i+1).padStart(3,'0')}.${options.format}`,options.format==='png'?pix.asPNG():pix.asJPEG(quality));}finally{pix?.destroy();page.destroy();}progress(Math.round((i+1)/doc.countPages()*95),'正在导出页面…');}
    }finally{doc.destroy();}parentPort.postMessage({type:'result',outputs});
  } else if(['pdf_merge','pdf_split'].includes(operation)) {
    const out=new mupdf.PDFDocument();try {
      for(let i=0;i<inputs.length;i++) {const doc=openPDF(await fs.readFile(inputs[i]));try {
        const selected=[];
        if(operation==='pdf_split') {for(const part of options.pages.split(',')){const [a,b=a]=part.split('-').map(Number);if(a<1||b<a||b>doc.countPages())throw new Error('页码超出 PDF 范围');for(let p=a;p<=b;p++){if(selected.length>=5000)throw new Error('一次最多提取 5000 页');selected.push(p-1);}}}
        else for(let p=0;p<doc.countPages();p++)selected.push(p);
        for(const p of selected)out.graftPage(-1,doc,p);
      }finally{doc.destroy();}progress(Math.round((i+1)/inputs.length*90),'正在整理页面…');}
      const b=out.saveToBuffer('garbage=compact,compress=yes');try{await save(`${base}_${operation==='pdf_merge'?'合并':'提取'}.pdf`,b.asUint8Array());}finally{b.destroy();}
    }finally{out.destroy();}parentPort.postMessage({type:'result',outputs});
  } else throw new Error('未知操作');
} catch(e) {parentPort.postMessage({type:'error',error:e.message||'文件处理失败'});}
