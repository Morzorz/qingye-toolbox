import {_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {fixture} from '../tests/fixtures.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'qingye-ui-')),data=path.join(root,'data');await fs.mkdir(data);
const pdf=path.join(root,'示例合同.pdf'),pic=path.join(root,'示例图片.png');await fs.writeFile(pdf,fixture());await sharp({create:{width:300,height:200,channels:3,background:'#358568'}}).png().toFile(pic);
const app=await electron.launch({...(process.env.QINGYE_APP?{executablePath:process.env.QINGYE_APP,args:[]}:{args:['.']}),env:{...process.env,QINGYE_DATA_DIR:data}});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#start');
 const pick=async files=>{await app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},files);await page.locator('#pick').click();};
 await pick([pdf]);await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功'));assert((await fs.stat(path.join(root,'示例合同_压缩版.pdf'))).size>0);
 await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功'));assert((await fs.stat(path.join(root,'示例合同_压缩版 (1).pdf'))).size>0);
 await page.locator('[data-group=image]').click();await pick([pic]);await page.selectOption('#format','webp');await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功'));assert.equal((await sharp(path.join(root,'示例图片_转换.webp')).metadata()).format,'webp');
 await page.locator('[data-group=settings]').click();await page.waitForFunction(()=>document.querySelector('#mcp-config').value.includes('--mcp'));
 await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},root);await page.locator('#add-root').click();await page.waitForFunction(()=>document.querySelectorAll('.root-row').length===1);const saved=JSON.parse(await fs.readFile(path.join(data,'settings.json'),'utf8'));assert.deepEqual(saved.roots,[await fs.realpath(root)]);
 await page.locator('#copy-json').click();const clip=await app.evaluate(({clipboard})=>clipboard.readText());assert.equal(JSON.parse(clip).mcpServers.qingye.args.at(-1),'--mcp');
 await fs.mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/toolbox-ai.png'});await page.locator('.root-row button').click();await page.waitForFunction(()=>document.querySelectorAll('.root-row').length===0);
 await page.locator('[data-group=pdf]').click();await page.selectOption('#operation','pdf_merge');await pick([pdf,path.join(root,'示例合同_压缩版.pdf')]);await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功'));assert((await fs.stat(path.join(root,'示例合同_合并.pdf'))).size>0);
 await page.screenshot({path:'artifacts/toolbox-preview.png'});assert.deepEqual(errors,[]);console.log('PASS: desktop PDF/image conversion, collision handling, merged output, AI configuration and permission controls');
}finally{await app.close();}
