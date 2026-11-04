import {_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import {fixture} from '../tests/fixtures.mjs';

/**
 * 桌面端 UI 冒烟（两端共用 src/ui/app.mjs）。
 *
 * 覆盖：
 *  - 主卡片只有两个按钮，文案按 host=desktop 切换为「选择文件」「选择文件夹」（ID 不变）
 *  - 版本角标读 settings.version（= app.getVersion()）
 *  - 选择文件 → 队列来源「本机」→ 处理 → 冲突重名
 *  - 选择文件夹（pickFolderBatch）→「已加入 N 个文件」
 *  - 设置页：AI 授权目录可增删、MCP 配置可复制、视频硬件加速行、任务历史
 *  - NAS 专属入口在桌面端不出现
 *
 * 运行：node scripts/toolbox-smoke.mjs
 */
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qingye-ui-'));
const data = path.join(root, 'data');
await fs.mkdir(data);
const pdf = path.join(root, '示例合同.pdf');
const pic = path.join(root, '示例图片.png');
await fs.writeFile(pdf, fixture());
await sharp({create: {width: 300, height: 200, channels: 3, background: '#358568'}}).png().toFile(pic);
// 文件夹批量用的目录：两个 pdf + 一个不匹配文件
const batchDir = path.join(root, '批量输入');
await fs.mkdir(batchDir);
await fs.copyFile(pdf, path.join(batchDir, '甲.pdf'));
await fs.copyFile(pdf, path.join(batchDir, '乙.pdf'));
await fs.writeFile(path.join(batchDir, '说明.txt'), 'not a pdf');

const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
// ELECTRON_RUN_AS_NODE 会让 Electron 以 Node 身份启动、无法创建窗口；冒烟时剔除。
const {ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...cleanEnv} = process.env;
const app = await electron.launch({...(process.env.QINGYE_APP ? {executablePath: process.env.QINGYE_APP, args: []} : {args: ['.']}), env: {...cleanEnv, QINGYE_DATA_DIR: data}});

try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('#start');

  const stubDialog = async (paths) => {
    await app.evaluate(({dialog}, filePaths) => {
      dialog.showOpenDialog = async () => ({canceled: false, filePaths});
    }, paths);
  };

  /* 1. 两个按钮 + 桌面文案 + 版本角标 ---------------------------------- */
  assert.equal(await page.locator('#dropzone button').count(), 2, 'dropzone 内必须恰好 2 个按钮');
  assert.equal(await page.locator('#pick-nas').textContent(), '选择文件');
  assert.equal(await page.locator('#upload-pc').textContent(), '选择文件夹');
  const settings = await page.evaluate(() => window.qingye.settings());
  assert.equal(settings.version, pkg.version, `settings.version 应等于 package.version（${pkg.version}）`);
  await page.waitForFunction((version) => document.querySelector('#version-badge').textContent.includes(version), pkg.version);
  const badge = await page.locator('#version-badge').textContent();
  assert(badge.includes(pkg.version), `版本角标应读 settings.version：${badge}`);

  /* 2. 选择文件 → 队列来源「本机」→ 处理 ------------------------------- */
  await stubDialog([pdf]);
  await page.locator('#pick-nas').click();
  await page.waitForFunction(() => document.querySelector('#count').textContent === '1 个文件');
  assert((await page.locator('#files').innerText()).includes('本机 ·'), '队列来源应显示「本机」');
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary').textContent.includes('1 个成功'), null, {timeout: 60000});
  assert((await fs.stat(path.join(root, '示例合同_压缩版.pdf'))).size > 0);
  // 重名冲突：同参数再跑一次
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary').textContent.includes('1 个成功'), null, {timeout: 60000});
  assert((await fs.stat(path.join(root, '示例合同_压缩版 (1).pdf'))).size > 0);

  /* 3. 选择文件夹（pickFolderBatch）------------------------------------ */
  await page.locator('#clear').click();
  await stubDialog([batchDir]);
  await page.locator('#upload-pc').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('已加入'), null, {timeout: 30000});
  const batchMessage = await page.locator('#message').textContent();
  assert(/已加入 \d+ 个文件/.test(batchMessage), `批量加入提示不符：${batchMessage}`);
  assert(!batchMessage.includes('上传') && !batchMessage.includes('NAS'), `桌面端不应出现上传/NAS 文案：${batchMessage}`);
  await page.waitForFunction(() => document.querySelector('#count').textContent === '2 个文件');
  assert((await page.locator('#files').innerText()).includes('甲.pdf'));

  /* 4. 图片转换（验证共用 UI 的 options 仍能驱动引擎）------------------ */
  await page.locator('[data-group=image]').click();
  await stubDialog([pic]);
  await page.locator('#pick-nas').click();
  await page.waitForFunction(() => document.querySelector('#count').textContent === '1 个文件');
  await page.selectOption('#format', 'webp');
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary').textContent.includes('1 个成功'), null, {timeout: 60000});
  assert.equal((await sharp(path.join(root, '示例图片_转换.webp')).metadata()).format, 'webp');

  /* 5. 设置页：AI 目录 / MCP / 硬件 / 历史 ----------------------------- */
  await page.locator('[data-group=settings]').click();
  await page.waitForFunction(() => document.querySelector('#mcp-config')?.value.includes('--mcp'), null, {timeout: 10000});
  // 桌面专属入口存在，NAS 专属入口不存在
  assert.equal(await page.locator('#add-root').count(), 1, '桌面端应有「添加授权文件夹」');
  assert.equal(await page.locator('#open-settings').isVisible(), false, '桌面端不应出现「打开应用设置」');
  assert.equal(await page.locator('[data-install]').count(), 2, '桌面端应提供组件安装入口');
  // 硬件加速行（读 settings.hardware）
  await page.waitForFunction(() => document.querySelector('#components')?.textContent.includes('视频硬件加速'), null, {timeout: 10000});
  const hardwareLine = (await page.locator('#components').innerText()).split('\n').find((line) => line.includes('视频硬件加速')) || '';
  assert(/视频硬件加速：(可用（.+）|不可用（.+）)/.test(hardwareLine), `硬件行格式不符：${hardwareLine}`);
  // AI 授权目录：添加 → 落盘 → 撤销
  await stubDialog([root]);
  await page.locator('#add-root').click();
  await page.waitForFunction(() => document.querySelectorAll('.root-row').length === 1, null, {timeout: 10000});
  const saved = JSON.parse(await fs.readFile(path.join(data, 'settings.json'), 'utf8'));
  assert.deepEqual(saved.roots, [await fs.realpath(root)]);
  // 复制 MCP 配置
  await page.locator('#copy-json').click();
  const clip = await app.evaluate(({clipboard}) => clipboard.readText());
  assert.equal(JSON.parse(clip).mcpServers.qingye.args.at(-1), '--mcp');
  await fs.mkdir('artifacts', {recursive: true});
  await page.screenshot({path: 'artifacts/toolbox-ai.png'});
  await page.locator('.root-row button').click();
  await page.waitForFunction(() => document.querySelectorAll('.root-row').length === 0, null, {timeout: 10000});
  // 任务历史：有记录、可重试，但历史条目不提供「打开位置」（reveal 只放行本次运行输出）
  await page.waitForFunction(() => document.querySelector('#history')?.textContent.includes('PDF 压缩'), null, {timeout: 10000});
  assert((await page.getByRole('button', {name: '按原参数重试'}).count()) > 0);
  assert.equal(await page.locator('#history').getByRole('button', {name: '打开位置'}).count(), 0, '历史条目不应有「打开位置」');

  /* 6. 合并 PDF + 截图 -------------------------------------------------- */
  await page.locator('[data-group=pdf]').click();
  await page.selectOption('#operation', 'pdf_merge');
  await stubDialog([pdf, path.join(root, '示例合同_压缩版.pdf')]);
  await page.locator('#pick-nas').click();
  await page.waitForFunction(() => document.querySelector('#count').textContent === '2 个文件');
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary').textContent.includes('1 个成功'), null, {timeout: 60000});
  assert((await fs.stat(path.join(root, '示例合同_合并.pdf'))).size > 0);
  await page.screenshot({path: 'artifacts/toolbox-preview.png'});

  assert.deepEqual(errors, []);
  console.log('PASS: desktop shared UI — 两个按钮（选择文件/选择文件夹）、版本角标、本机来源、冲突重名、文件夹批量、图片/合并转换、AI 目录增删、MCP 复制、硬件加速行、任务历史');
} finally {
  await app.close();
}
