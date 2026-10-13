import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export const dataDir = process.env.QINGYE_DATA_DIR || path.join(process.platform === 'win32' ? (process.env.APPDATA || os.homedir()) : process.platform === 'darwin' ? path.join(os.homedir(),'Library','Application Support') : path.join(os.homedir(),'.config'), 'QingyeToolbox');
export async function settings() {
  try { const s = JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8')); return { roots: [], engines: {}, ...s }; }
  catch (e) { if (e.code === 'ENOENT') return { roots: [], engines: {} }; throw new Error('设置文件无法读取，请在应用中重新设置'); }
}
export async function updateSettings(patch) {
  const s = { ...await settings(), ...patch }; await fs.mkdir(dataDir,{recursive:true});
  const temp=path.join(dataDir,`settings-${process.pid}.tmp`);await fs.writeFile(temp,JSON.stringify(s,null,2),{mode:0o600});await fs.rename(temp,path.join(dataDir,'settings.json'));return s;
}
export async function authorize(inputs, directory) {
  const { roots } = await settings();
  if (!roots.length) throw new Error('AI 尚未获得文件夹授权，请在轻页工具箱 → AI 连接中添加文件夹');
  const canonicalRoots = await Promise.all(roots.map(p=>fs.realpath(p).catch(()=>null)));
  for (const file of [...inputs, directory]) {
    if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('AI 调用必须使用绝对路径');
    const real = await fs.realpath(file);
    if (!canonicalRoots.some(root=> { if(!root)return false;const rel=path.relative(root,real);return rel==='' || (!rel.startsWith(`..${path.sep}`) && rel!=='..' && !path.isAbsolute(rel)); })) throw new Error('文件或输出目录不在 AI 授权文件夹内');
  }
}
