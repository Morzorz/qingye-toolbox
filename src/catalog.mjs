export const OPERATIONS = {
  pdf_compress: { label: 'PDF 压缩', group: 'pdf', extensions: ['pdf'] },
  pdf_merge: { label: '合并 PDF', group: 'pdf', extensions: ['pdf'], combined: true },
  pdf_split: { label: '提取 PDF 页面', group: 'pdf', extensions: ['pdf'] },
  pdf_to_images: { label: 'PDF 转图片', group: 'pdf', extensions: ['pdf'] },
  images_to_pdf: { label: '图片合并为 PDF', group: 'pdf', extensions: ['jpg','jpeg','png','webp'], combined: true },
  image_convert: { label: '图片转换 / 压缩', group: 'image', extensions: ['jpg','jpeg','png','webp'] },
  office_to_pdf: { label: 'Word / Excel / PPT 转 PDF', group: 'office', extensions: ['doc','docx','xls','xlsx','ppt','pptx'], component: 'office' },
  audio_convert: { label: '音频转换 / 提取音频', group: 'audio', extensions: ['mp3','wav','flac','m4a','aac','ogg','opus','mp4','mov','mkv','avi','webm'], component: 'media' },
  video_convert: { label: '视频转 MP4 / 压缩', group: 'video', extensions: ['mp4','mov','mkv','avi','webm','m4v'], component: 'media' },
};
export function validateOptions(operation, raw = {}) {
  if (!OPERATIONS[operation]) throw new Error('不支持的操作');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('参数格式错误');
  const preset = raw.preset ?? 'balanced';
  if (!['clear','balanced','small'].includes(preset)) throw new Error('无效的质量档位');
  const result = { preset };
  if(operation==='pdf_compress'&&raw.targetMB!==undefined){if(typeof raw.targetMB!=='number'||!Number.isFinite(raw.targetMB)||raw.targetMB<0.1||raw.targetMB>500)throw new Error('目标大小需为 0.1–500 MB');result.targetMB=raw.targetMB;}
  if (operation === 'image_convert') {
    result.format = raw.format ?? 'jpg';
    if (!['jpg','png','webp'].includes(result.format)) throw new Error('图片格式需为 jpg、png 或 webp');
  }
  if (operation === 'pdf_to_images') {
    result.format = raw.format ?? 'png';
    if (!['jpg','png'].includes(result.format)) throw new Error('PDF 导出图片格式需为 jpg 或 png');
  }
  if (['image_convert','pdf_to_images'].includes(operation)) {
    result.maxDimension = raw.maxDimension ?? 2600;
    if (!Number.isInteger(result.maxDimension) || result.maxDimension < 64 || result.maxDimension > 8000) throw new Error('图片最长边需为 64–8000 像素');
  }
  if (operation === 'pdf_split') {
    result.pages = raw.pages;
    if (typeof result.pages !== 'string' || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(result.pages) || result.pages.length > 1000) throw new Error('请输入页码，例如 1-3,5');
  }
  if (operation === 'audio_convert') {
    result.format = raw.format ?? 'mp3';
    if (!['mp3','wav','flac','m4a'].includes(result.format)) throw new Error('不支持的音频输出格式');
  }
  if (operation === 'video_convert') {
    result.maxHeight = raw.maxHeight ?? 1080;
    if (![480,720,1080,2160].includes(result.maxHeight)) throw new Error('视频高度需为 480、720、1080 或 2160');
    // 契约 §2.8：hardware acceleration 开关，'auto' 表示有可用后端就用、失败自动回退 CPU。
    result.hw = raw.hw ?? 'auto';
    if (!['auto','off'].includes(result.hw)) throw new Error('硬件加速选项需为 auto（自动）或 off（关闭）');
  }
  return result;
}
