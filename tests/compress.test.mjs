import test from 'node:test';
import assert from 'node:assert/strict';
import * as mupdf from 'mupdf';
import { compressPDF } from '../src/compress.mjs';
import { fixture } from './fixtures.mjs';
test('scan is reduced while searchable text, form, outline, geometry and colors survive',()=>{
  const original=fixture(), result=compressPDF(original);
  assert(result.after<result.before/10);assert.equal(result.pages,1);assert.equal(result.changedImages,1);
  const d=mupdf.Document.openDocument(result.bytes,'application/pdf');const p=d.loadPage(0);
  assert.deepEqual(p.getBounds(),[0,0,595,842]);assert.match(p.toStructuredText().asText(),/Qingye searchable text 123/);
  assert.equal(d.getTrailer().get('Root','AcroForm','Fields',0,'V').asString(),'preserved value');
  assert.equal(d.getTrailer().get('Root','Outlines','First','Title').asString(),'Chapter one');
  const pix=p.toPixmap(mupdf.Matrix.identity,mupdf.ColorSpace.DeviceRGB,false);const rgb=pix.getPixels();const idx=(300*pix.getWidth()+100)*3;assert(rgb[idx]>rgb[idx+1]);pix.destroy();p.destroy();d.destroy();
});
test('never returns a larger PDF and falls back to exact bytes',()=>{
  const original=compressPDF(fixture({image:false})).bytes;
  const result=compressPDF(original); assert(result.after<=original.length);
  if(!result.reduced)assert.deepEqual(result.bytes,original);
});
test('rejects invalid input and unsupported settings',()=>{
  assert.throws(()=>compressPDF(new Uint8Array()),/为空/);
  assert.throws(()=>compressPDF(new TextEncoder().encode('not a pdf')),/有效/);
  assert.throws(()=>compressPDF(fixture(),'invalid'),/档位/);
});
test('encrypted PDF and digital signature rejected before changes',()=>{
  assert.throws(()=>compressPDF(fixture({encrypted:true})),/加密/);
  assert.throws(()=>compressPDF(fixture({signed:true})),/数字签名/);
});
test('all presets return valid smaller documents',()=>{
  const sizes=['clear','balanced','small'].map(p=>compressPDF(fixture(),p).after);
  assert(sizes.every(size => size > 0 && size < fixture().length / 10));
});
