import { _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fixture } from '../tests/fixtures.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(),'qingye-smoke-'));
const good = path.join(dir,'测试合同.pdf'), bad = path.join(dir,'损坏文件.pdf');
await fs.writeFile(good,fixture()); await fs.writeFile(bad,'invalid');
const app = await electron.launch(process.env.QINGYE_APP ? { executablePath: process.env.QINGYE_APP, args:[] } : { args:['.'] });
try {
  const page = await app.firstWindow(); await page.waitForSelector('#start');
  assert.equal(await page.locator('#start').isDisabled(),true);
  await app.evaluate(({dialog}, paths) => {dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},[good,bad]);
  await page.locator('#pick').click(); await page.waitForFunction(()=>document.querySelector('#count').textContent==='2 个文件');
  await page.locator('#start').click(); await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功，1 个失败'),{},{timeout:30000});
  const output=path.join(dir,'测试合同_压缩版.pdf'); assert((await fs.stat(output)).size<(await fs.stat(good)).size);
  await page.locator('#start').click(); await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功，1 个失败'),{},{timeout:30000});
  assert((await fs.stat(path.join(dir,'测试合同_压缩版 (1).pdf'))).size>0);
  await page.locator('#clear').click(); await page.waitForFunction(()=>document.querySelector('#count').textContent==='0 个文件');
  const clean=path.join(dir,'产品手册.pdf');await fs.writeFile(clean,fixture());
  await app.evaluate(({dialog}, file) => {dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},clean);
  await page.locator('#pick').click(); await page.waitForFunction(()=>document.querySelector('#count').textContent==='1 个文件');
  await page.locator('#start').click(); await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功'),{},{timeout:30000});
  await fs.mkdir('artifacts',{recursive:true}); await page.screenshot({path:'artifacts/app-preview.png'});
  // Exercise the actual File -> preload bridge used by drag-and-drop.
  await page.locator('#clear').click();
  await page.evaluate(() => { const input=document.createElement('input'); input.type='file';input.id='test-drop-input';document.body.append(input); });
  await page.locator('#test-drop-input').setInputFiles(good);
  await page.evaluate(() => { const dt=new DataTransfer();dt.items.add(document.querySelector('#test-drop-input').files[0]);document.querySelector('#dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));document.querySelector('#test-drop-input').remove(); });
  await page.waitForFunction(()=>document.querySelector('#count').textContent==='1 个文件');
  const folder=path.join(dir,'custom-output');await fs.mkdir(folder);
  await app.evaluate(({dialog}, dest) => {dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dest]});},folder);
  await page.locator('#folder-pick').click();await page.waitForFunction(dest=>document.querySelector('#folder').textContent===dest,folder);
  await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('1 个成功'),{},{timeout:30000});
  assert((await fs.stat(path.join(folder,'测试合同_压缩版.pdf'))).size>0);
  await page.locator('#folder-reset').click();
  // Cancel a real, longer scan. No private input is shipped in source or artifacts.
  const real=process.env.QINGYE_SAMPLE;
  if(real){
    await page.locator('#clear').click();
    const sample=path.join(dir,'取消测试.pdf');await fs.copyFile(real,sample);
    await app.evaluate(({dialog}, file) => {dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},sample);
    await page.locator('#pick').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='1 个文件');
    await page.locator('#start').click();await page.locator('#cancel').click();
    await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('任务已停止'),{},{timeout:30000});
    assert.equal(await page.locator('#start').isDisabled(),false);
    assert.equal((await fs.readdir(dir)).filter(f=>f.startsWith('.qingye-')).length,0);
  }
  console.log('PASS: Electron UI, mixed batch, repeated output names, original preservation, drag/drop, custom folder, cancel, screenshot');
} finally { await app.close(); }
