import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function buildClient(){
 const result=await build({entryPoints:[path.join(root,'fnos/web/entry.js')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',charset:'utf8',legalComments:'inline'});
 const code=`try {\n${result.outputFiles[0].text}\nwindow.qingyeReady=true;\ndocument.getElementById('message').textContent='';\n} catch (error) {\ndocument.getElementById('message').textContent='界面启动失败：'+error.message+'。请刷新页面；如仍失败，请反馈这段提示。';\nconsole.error(error);\n}\n`;
 await fs.writeFile(path.join(root,'fnos/web/app.bundle.js'),code.replace(/<\/script/gi,'<\\/script'));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildClient();
