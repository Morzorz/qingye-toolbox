import {listPackage,extractFile} from '@electron/asar';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const platforms=[['mac','release/mac-arm64/轻页文件工具箱.app/Contents/Resources/app.asar','sharp-darwin-arm64'],['win','release/win-unpacked/resources/app.asar','sharp-win32-x64']];
for(const [platform,archive,native] of platforms){
 const entries=listPackage(archive),roots=new Set(entries.map(p=>p.split('/')[1]));
 for(const root of roots)assert(['src','assets','node_modules','package.json','LICENSE','THIRD-PARTY-NOTICES.md'].includes(root),`Unexpected packaged directory: ${root}`);
 assert(entries.some(p=>p.includes(native)&&p.endsWith('.node')),'Missing native image engine');
 assert(entries.some(p=>p.endsWith('mupdf-wasm.wasm')),'Missing PDF engine');
 for(const name of ['NotoSansSC-Regular.otf','OFL.txt'])assert.deepEqual(extractFile(archive,'assets/fonts/'+name),await fs.readFile('assets/fonts/'+name),'Missing or changed Chinese fallback font/license');
 assert(!entries.some(p=>p.includes(platform==='mac'?'sharp-win32':'sharp-darwin')),'Unnecessary foreign native engine');
 for(const name of await fs.readdir('src')){if((await fs.stat('src/'+name)).isFile())assert.deepEqual(extractFile(archive,'src/'+name),await fs.readFile('src/'+name),`Outdated packaged source: ${name}`);}
 if(platform==='win')for(const name of ['libvips-42.dll','libvips-cpp-8.18.7.dll'])assert(entries.some(p=>p.endsWith(name)),`Missing ${name}`);
 console.log(`PASS ${platform}: package allowlist, platform engines, source parity`);
}
