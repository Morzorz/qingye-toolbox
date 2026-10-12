import * as mupdf from 'mupdf';
export function fixture({ image = true, signed = false, encrypted = false } = {}) {
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font('Helvetica'));
  const resources = { Font: { F1: font } };
  let content = 'BT /F1 18 Tf 40 750 Td (Qingye searchable text 123) Tj ET\n';
  if (image) {
    const w = 900, h = 1200, rgb = new Uint8Array(w * h * 3);
    for (let y=0;y<h;y++) for(let x=0;x<w;x++) { const p=(y*w+x)*3; rgb[p]=x<w/2?200:240;rgb[p+1]=y<h/2?60:220;rgb[p+2]=120; }
    const ref=doc.addStream(rgb, { Type:'XObject', Subtype:'Image', Width:w, Height:h, BitsPerComponent:8, ColorSpace:'DeviceRGB' });
    resources.XObject = { I1:ref }; content += 'q 300 0 0 400 40 200 cm /I1 Do Q';
  }
  const page=doc.addPage([0,0,595,842],0,resources,content); doc.insertPage(-1,page);
  const field=doc.addObject({ Type:'Annot', Subtype:'Widget', FT:'Tx', T:doc.newString('note'), V:doc.newString('preserved value'), Rect:[40,100,200,130], P:page });
  page.put('Annots',[field]);
  doc.getTrailer().get('Root').put('AcroForm',{ Fields:[field], DA:doc.newString('/F1 12 Tf 0 g'), DR:{ Font:{ F1:font } } });
  const outline=doc.addObject({ Type:'Outlines', Count:1 });
  const item=doc.addObject({ Title:doc.newString('Chapter one'), Parent:outline, Dest:[page,'Fit'] });outline.put('First',item);outline.put('Last',item);doc.getTrailer().get('Root').put('Outlines',outline);
  if(signed) { const sig=doc.addObject({Type:'Sig',ByteRange:[0,1,2,3]});doc.getTrailer().get('Root').put('TestSig',sig); }
  const buf=doc.saveToBuffer(encrypted?'encrypt=aes-256,user-password=secret,owner-password=owner':'');
  const bytes=Uint8Array.from(buf.asUint8Array());buf.destroy();doc.destroy();return bytes;
}
