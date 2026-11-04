import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const target='/payload';await fs.mkdir(target,{recursive:true});
for(const name of ['src','assets','node_modules','LICENSE','THIRD-PARTY-NOTICES.md','package.json'])await fs.cp('/work/'+name,target+'/'+name,{recursive:true,verbatimSymlinks:true});
for(const name of ['sharp-libvips-linuxmusl-x64','sharp-linuxmusl-x64','sharp-wasm32'])await fs.rm(target+'/node_modules/@img/'+name,{recursive:true,force:true});
await fs.mkdir(target+'/fnos/web',{recursive:true});for(const name of ['server.mjs','local-mcp.mjs'])await fs.copyFile('/work/fnos/'+name,target+'/fnos/'+name);await fs.cp('/work/fnos/web',target+'/fnos/web',{recursive:true});
const rt=target+'/runtime';await fs.mkdir(rt+'/lib',{recursive:true});await fs.mkdir(rt+'/native');await fs.mkdir(rt+'/bin');
// Debian includes dangling links to optional example configuration; omit only missing link targets.
const existingTarget=async source=>{try{await fs.stat(source);return true;}catch(e){if(e.code==='ENOENT'&&(await fs.lstat(source)).isSymbolicLink()){console.log('Omit optional dangling link: '+source);return false;}throw e;}};
await fs.cp('/usr/lib/libreoffice',rt+'/libreoffice',{recursive:true,dereference:true,filter:existingTarget});
await fs.copyFile('/usr/local/bin/node',rt+'/native/node');await fs.copyFile('/usr/bin/ffmpeg',rt+'/native/ffmpeg');
for(const entry of await fs.readdir('/usr/lib/x86_64-linux-gnu',{withFileTypes:true})){
 if(/\.so(?:\.|$)/.test(entry.name)||entry.name==='gconv'){
  const source='/usr/lib/x86_64-linux-gnu/'+entry.name,dest=rt+'/lib/'+entry.name;
  if(entry.isSymbolicLink()){const real=await fs.realpath(source),base=path.basename(real);await fs.copyFile(real,rt+'/lib/'+base);if(base!==entry.name)await fs.symlink(base,dest).catch(e=>{if(e.code!=='EEXIST')throw e;});}
  else await fs.cp(source,dest,{recursive:true,dereference:true});
 }
}
// Include indirect libraries stored in private subdirectories (for example PulseAudio).
// VA-API user-space GPU drivers live in dri/; copy them so runtime can set LIBVA_DRIVERS_PATH.
if(await fs.access('/usr/lib/x86_64-linux-gnu/dri').then(()=>true,()=>false)){
 await fs.mkdir(rt+'/lib/dri',{recursive:true});
 for(const entry of await fs.readdir('/usr/lib/x86_64-linux-gnu/dri')){
  if(!/\.so(?:\.|$)/.test(entry))continue;
  const source='/usr/lib/x86_64-linux-gnu/dri/'+entry;
  await fs.copyFile(await fs.realpath(source),rt+'/lib/dri/'+path.basename(await fs.realpath(source)));
 }
}
const vaapiRuntime=await fs.access(rt+'/lib/dri').then(()=>true,()=>false);
for(const binary of ['/usr/local/bin/node','/usr/bin/ffmpeg','/usr/lib/libreoffice/program/soffice.bin']){
 const listing=execFileSync('ldd',[binary],{encoding:'utf8'});
 if(listing.includes('not found'))throw Error('Unresolved native dependency: '+listing);
 for(const match of listing.matchAll(/(?:=>\s+|^\s*)(\/[^\s]+)\s+\(/gm)){
  const source=match[1];if(source.startsWith('/usr/lib/libreoffice/'))continue;
  const dest=rt+'/lib/'+path.basename(source);try{await fs.access(dest);}catch{await fs.copyFile(await fs.realpath(source),dest);}
 }
}
// Debian hardcodes system locations; use LibreOffice's own relocatable bootstrap variables.
const fundamental=rt+'/libreoffice/program/fundamentalrc';
await fs.writeFile(fundamental,(await fs.readFile(fundamental,'utf8')).replaceAll('file:///usr/lib/libreoffice','${ORIGIN}/..').replaceAll('file:///etc/libreoffice/registry','${BRAND_BASE_DIR}/share/registry'));
await fs.copyFile('/etc/libreoffice/sofficerc',rt+'/libreoffice/program/sofficerc');
await fs.mkdir(rt+'/fonts',{recursive:true});await fs.cp('/usr/share/fonts/truetype/dejavu',rt+'/fonts/dejavu',{recursive:true});await fs.copyFile('/work/assets/fonts/NotoSansSC-Regular.otf',rt+'/fonts/NotoSansSC-Regular.otf');
for(const [name,exe] of [['node','native/node'],['ffmpeg','native/ffmpeg'],['soffice','libreoffice/program/soffice.bin']]){
 const prelude=name==='soffice'?'export FONTCONFIG_FILE="$rt/fonts.conf"\nexport URE_BOOTSTRAP="vnd.sun.star.pathname:$rt/libreoffice/program/fundamentalrc"\n':name==='ffmpeg'&&vaapiRuntime?'export LIBVA_DRIVERS_PATH="$rt/lib/dri"\n':'';
const wrapper=`#!/bin/sh\nset -eu\nrt=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)\n${prelude}exec "$rt/lib/ld-linux-x86-64.so.2" --library-path "$rt/libreoffice/program:$rt/lib" "$rt/${exe}" "$@"\n`;
 const command='\"$rt/lib/ld-linux-x86-64.so.2\" --library-path \"$rt/libreoffice/program:$rt/lib\" \"$rt/'+exe+'\" \"$@\"';
 const script=name==='soffice'?wrapper.replace('exec '+command+'\n','for attempt in 1 2 3; do\n if '+command+'; then exit 0; else status=$?; fi\n [ \"$status\" = 81 ] || exit \"$status\"\ndone\nexit 81\n'):wrapper;
 await fs.writeFile(rt+'/bin/'+name,script,{mode:0o755});
}
await fs.writeFile(rt+'/fonts.conf','<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir prefix="relative">fonts</dir><dir>/usr/share/fonts</dir><dir>/usr/local/share/fonts</dir><dir>~/.local/share/fonts</dir><cachedir prefix="xdg">fontconfig</cachedir><alias><family>sans-serif</family><prefer><family>DejaVu Sans</family><family>Noto Sans SC</family></prefer></alias></fontconfig>');
// Retain component notices and exact package versions for reproducible maintenance.
await fs.cp('/usr/share/doc',rt+'/licenses',{recursive:true,dereference:true,filter:existingTarget});
await fs.writeFile(rt+'/debian-packages.txt',execFileSync('dpkg-query',['-W','-f=${Package}\t${Version}\t${Architecture}\n']));
await fs.writeFile(rt+'/node-version.txt',process.version+'\n');
await fs.copyFile('/usr/local/LICENSE',rt+'/NODE-LICENSE').catch(async()=>{const r=await fetch('https://raw.githubusercontent.com/nodejs/node/'+process.version+'/LICENSE');if(!r.ok)throw Error('Node license unavailable');await fs.writeFile(rt+'/NODE-LICENSE',await r.text());});
console.log('Native runtime assembled');
