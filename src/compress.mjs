import * as mupdf from 'mupdf';
export const PRESETS = Object.freeze({ clear: { edge: 3600, quality: 88 }, balanced: { edge: 2600, quality: 78 }, small: { edge: 1600, quality: 62 } });
const MAX_BYTES = 500 * 1024 * 1024;
const MAX_PIXELS = 80 * 1024 * 1024;
function name(obj, key) { const v = obj.get(key); try { return v.isName() ? v.asName() : ''; } finally { v.destroy(); } }
function number(obj, key) { const v = obj.get(key); try { return v.isNumber() ? v.asNumber() : 0; } finally { v.destroy(); } }
function present(obj, key) { const v = obj.get(key); try { return !v.isNull(); } finally { v.destroy(); } }
function pageBounds(doc) { return Array.from({ length: doc.countPages() }, (_, i) => { const page = doc.loadPage(i); try { return page.getBounds(); } finally { page.destroy(); } }); }
export function compressPDF(input, preset = 'balanced', onProgress = () => {}) {
  const config = PRESETS[preset];
  if (!config) throw new Error('无效压缩档位');
  if (!input?.length || input.length > MAX_BYTES) throw new Error('文件为空或超过 500 MB');
  if (!new TextDecoder('latin1').decode(input.subarray(0, 1024)).includes('%PDF-')) throw new Error('文件不是有效的 PDF');
  let doc, saved, check;
  try {
    try { doc = mupdf.Document.openDocument(input, 'application/pdf'); } catch { throw new Error('无法读取 PDF，文件可能已损坏'); }
    if (!(doc instanceof mupdf.PDFDocument)) throw new Error('文件不是有效的 PDF');
    doc.disableJS();
    const trailer = doc.getTrailer();
    const encrypted = present(trailer, 'Encrypt'); trailer.destroy();
    if (doc.needsPassword() || encrypted) throw new Error('暂不支持加密 PDF，请先导出未加密副本');
    if (!doc.countPages()) throw new Error('PDF 没有可处理的页面');
    const bounds = pageBounds(doc), count = doc.countObjects(), masks = new Set();
    if (count > 500000) throw new Error('PDF 结构过于复杂，请拆分后重试');
    for (let i = 1; i < count; i++) {
      const obj = doc.newIndirect(i);
      try {
        if (!obj.isDictionary()) continue;
        if (name(obj, 'Type') === 'Sig' || (name(obj, 'FT') === 'Sig' && present(obj, 'V')) || present(obj, 'ByteRange')) throw new Error('此 PDF 含数字签名，压缩会使签名失效，已跳过');
        for (const key of ['SMask', 'Mask']) { const mask = obj.get(key); if (mask.isIndirect()) masks.add(mask.asIndirect()); mask.destroy(); }
      } finally { obj.destroy(); }
    }
    let changedImages = 0, skippedImages = 0;
    for (let i = 1; i < count; i++) {
      const obj = doc.newIndirect(i);
      let image, pixels, resized, converted, raw;
      try {
        if (!obj.isStream() || name(obj, 'Subtype') !== 'Image') continue;
        const width = number(obj, 'Width'), height = number(obj, 'Height');
        if (masks.has(i) || present(obj, 'ImageMask') || present(obj, 'SMask') || present(obj, 'Mask') || number(obj, 'BitsPerComponent') !== 8 || width * height > MAX_PIXELS || width < 1 || height < 1) { skippedImages++; continue; }
        const colorspace = obj.get('ColorSpace');
        const simpleColor = colorspace.isName() && ['DeviceRGB','DeviceGray'].includes(colorspace.asName());
        const icc = colorspace.isArray() && colorspace.get(0).asName() === 'ICCBased';
        colorspace.destroy();
        if (!simpleColor && !icc) { skippedImages++; continue; }
        onProgress({ percent: Math.round(5 + i / count * 80), stage: '正在优化扫描图片…' });
        image = doc.loadImage(obj);
        if (![1,3].includes(image.getNumberOfComponents()) || image.getWidth() * image.getHeight() > MAX_PIXELS) { skippedImages++; continue; }
        pixels = image.toPixmap();
        if (pixels.getAlpha()) { skippedImages++; continue; }
        const ratio = Math.min(1, config.edge / Math.max(width, height));
        let pix = pixels;
        if (ratio < 1) { resized = pixels.warp([[0,0],[width,0],[width,height],[0,height]], Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))); pix = resized; }
        converted = pix.convertToColorSpace(image.getNumberOfComponents() === 1 ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB, false);
        const jpeg = converted.asJPEG(config.quality);
        raw = obj.readRawStream();
        if (jpeg.length >= raw.length) continue;
        obj.put('Width', converted.getWidth()); obj.put('Height', converted.getHeight());
        obj.put('ColorSpace', image.getNumberOfComponents() === 1 ? 'DeviceGray' : 'DeviceRGB');
        obj.put('BitsPerComponent', 8); obj.put('Filter', 'DCTDecode');
        for (const key of ['Decode', 'DecodeParms', 'SMaskInData', 'F', 'FFilter', 'FDecodeParms']) obj.delete(key);
        obj.writeRawStream(jpeg); changedImages++;
      } finally { raw?.destroy(); converted?.destroy(); resized?.destroy(); pixels?.destroy(); image?.destroy(); obj.destroy(); }
    }
    onProgress({ percent: 90, stage: '正在整理并验证 PDF…' });
    saved = doc.saveToBuffer('garbage=compact,compress=yes,compress-fonts=yes');
    const compressed = saved.asUint8Array();
    check = mupdf.Document.openDocument(compressed, 'application/pdf');
    if (JSON.stringify(pageBounds(check)) !== JSON.stringify(bounds)) throw new Error('压缩后页面验证未通过，未保存结果');
    const reduced = compressed.length < input.length;
    const bytes = Uint8Array.from(reduced ? compressed : input);
    onProgress({ percent: 100, stage: '正在保存…' });
    return { bytes, before: input.length, after: bytes.length, pages: bounds.length, reduced, changedImages, skippedImages };
  } finally { check?.destroy(); saved?.destroy(); doc?.destroy(); }
}
