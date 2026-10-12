import { parentPort, workerData } from 'node:worker_threads';
import { readFile, stat } from 'node:fs/promises';
import { compressPDF } from './compress.mjs';
try {
  const info = await stat(workerData.input);
  if (!info.isFile() || info.size > 500 * 1024 * 1024) throw new Error('文件超过 500 MB 或不是普通文件');
  const bytes = await readFile(workerData.input);
  const result = compressPDF(bytes, workerData.preset, progress => parentPort.postMessage({ type: 'progress', ...progress }));
  parentPort.postMessage({ type: 'result', result }, [result.bytes.buffer]);
} catch (e) { parentPort.postMessage({ type: 'error', error: e.message || '压缩失败，请检查文件后重试' }); }
