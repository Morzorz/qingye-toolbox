import {buildClient} from './build-client.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import sharp from 'sharp';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),build=path.join(root,'fnos/build/package'),payload=path.join(root,'fnos/build/payload');
await buildClient();
await fs.access(payload+'/runtime/bin/node');await fs.rm(build,{recursive:true,force:true});await fs.cp(path.join(root,'fnos/package'),build,{recursive:true,verbatimSymlinks:true});await fs.cp(payload,build+'/app',{recursive:true,verbatimSymlinks:true});
// Copy current application code after the cached dependency build.
for(const name of ['src','fnos/web'])await fs.cp(path.join(root,name),build+'/app/'+name,{recursive:true});await fs.copyFile(path.join(root,'fnos/server.mjs'),build+'/app/fnos/server.mjs');
await fs.mkdir(build+'/app/ui/images',{recursive:true});
for(const size of [64,256]){const bytes=await sharp(path.join(root,'assets/icon.png')).resize(size,size).png().toBuffer();await fs.writeFile(build+(size===64?'/ICON.PNG':'/ICON_256.PNG'),bytes);await fs.writeFile(build+'/app/ui/images/icon_'+size+'.png',bytes);}
for(const name of await fs.readdir(build+'/cmd'))await fs.chmod(build+'/cmd/'+name,0o755);
const tool=process.env.FNPACK||'fnpack';const r=spawnSync(tool,['build','--directory',build],{cwd:build,stdio:'inherit'});if(r.status!==0)throw Error('fnpack failed');const result=(await fs.readdir(build)).find(n=>n.endsWith('.fpk'));if(!result)throw Error('fnpack did not produce an FPK');
await fs.mkdir(path.join(root,'release'),{recursive:true});
const dest=path.join(root,'release/Qingye-Toolbox-1.2.5-fnos-x86.fpk');await fs.copyFile(path.join(build,result),dest);console.log(dest);
