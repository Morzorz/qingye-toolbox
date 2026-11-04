import {buildClient} from './build-client.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import sharp from 'sharp';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),build=path.join(root,'fnos/build/package'),payload=path.join(root,'fnos/build/payload'),pkg=path.join(root,'fnos/package');
// 版本以 manifest 为唯一来源，避免包名、页面角标、测试基线各处硬编码漂移。
const manifest=await fs.readFile(path.join(pkg,'manifest'),'utf8'),version=manifest.match(/^version=(.+)$/m)?.[1]?.trim();
if(!version)throw Error('manifest 缺少 version');
// fnpack 会检查这些目录；提前失败比打包到一半更省时间。
for(const dir of ['wizard','app/ui','config'])await fs.access(path.join(pkg,dir)).catch(()=>{throw Error('缺少打包必需目录 fnos/package/'+dir)});
await buildClient();
await fs.access(payload+'/runtime/bin/node');await fs.rm(build,{recursive:true,force:true});await fs.cp(pkg,build,{recursive:true,verbatimSymlinks:true});await fs.cp(payload,build+'/app',{recursive:true,verbatimSymlinks:true});
// payload 里保留着上次构建的 fnos/ 与 src/；先删掉再复制当前源码，避免已删除的文件（例如旧的 nas.css）残留进安装包。
for(const name of ['fnos','src'])await fs.rm(path.join(build,'app',name),{recursive:true,force:true});
// Copy current application code after the cached dependency build.
for(const name of ['src','fnos/web'])await fs.cp(path.join(root,name),build+'/app/'+name,{recursive:true});for(const name of ['server.mjs','local-mcp.mjs','web-entry.mjs'])await fs.copyFile(path.join(root,'fnos',name),build+'/app/fnos/'+name);
await fs.mkdir(build+'/app/ui/images',{recursive:true});
for(const size of [64,256]){const bytes=await sharp(path.join(root,'assets/icon.png')).resize(size,size).png().toBuffer();await fs.writeFile(build+(size===64?'/ICON.PNG':'/ICON_256.PNG'),bytes);await fs.writeFile(build+'/app/ui/images/icon_'+size+'.png',bytes);}
for(const name of await fs.readdir(build+'/cmd'))await fs.chmod(build+'/cmd/'+name,0o755);
const tool=process.env.FNPACK||'fnpack';const r=spawnSync(tool,['build','--directory',build],{cwd:build,stdio:'inherit'});if(r.status!==0)throw Error('fnpack failed');const result=(await fs.readdir(build)).find(n=>n.endsWith('.fpk'));if(!result)throw Error('fnpack did not produce an FPK');
await fs.mkdir(path.join(root,'release'),{recursive:true});
const dest=path.join(root,`release/Qingye-Toolbox-${version}-fnos-x86.fpk`);await fs.copyFile(path.join(build,result),dest);console.log(dest);
