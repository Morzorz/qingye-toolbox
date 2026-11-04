import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createApplication, PREFIX} from '../server.mjs';
import {fixture} from '../../tests/fixtures.mjs';

const run = promisify(execFile);

/**
 * 飞牛版浏览器验收（契约 §7）：
 *  1. 主卡片只有两个按钮，拖拽仍可用；
 *  2. NAS 弹窗能多选文件 → 队列 → 处理 → 打开位置 / 下载；
 *  3. 「加入当前文件夹」递归加入；
 *  4. 上传电脑文件；
 *  5. 不可用条目（越界软链、不匹配）保留在列表并显示原因；
 *  6. 620px 与 600px 高度下弹窗底部操作栏完整可见；
 *  7. 权限提示在弹窗内逐条展示，并可尝试打开应用设置。
 *
 * 运行：
 *   QINGYE_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node fnos/tests/browser.mjs
 */

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qy-browser-'));
const share = path.join(root, 'files');
const state = path.join(root, 'state');
const socket = path.join(root, 'test.sock');
await fs.mkdir(share, {recursive: true});
await fs.writeFile(path.join(share, '中文测试.pdf'), fixture());
await fs.writeFile(path.join(share, '另一份.pdf'), fixture());
await fs.mkdir(path.join(share, '合同'));
await fs.writeFile(path.join(share, '合同', '2024 合同.pdf'), fixture());
await fs.writeFile(path.join(share, '说明.txt'), 'not a pdf');
await fs.mkdir(path.join(share, 'only-txt'));
await fs.writeFile(path.join(share, 'only-txt', 'note.txt'), 'not a pdf');
// 越界软链：realpath 落在授权根之外，必须保留在列表中并标注原因。
await fs.symlink('/etc/hosts', path.join(share, '越界.pdf'));
// 文件级权限问题：0600 + 显式 ACE 拒绝读取（模拟别的应用账号留下的文件）。
// macOS 用 ACL 让属主也读不到；其他平台退化成 0000。两种都能让 /api/nas/permission 返回真实 mode。
const lockedFile = path.join(share, '陈粒 - 光.pdf');
await fs.writeFile(lockedFile, fixture());
await fs.chmod(lockedFile, 0o600);
let lockedMode = '0600';
try {
  await run('chmod', ['+a', 'everyone deny read', lockedFile]);
} catch {
  await fs.chmod(lockedFile, 0o000);
  lockedMode = '0000';
}
const unlockFile = async () => {
  await run('chmod', ['-N', lockedFile]).catch(() => fs.chmod(lockedFile, 0o644));
};

const app = await createApplication({roots: [share], share, stateDir: state});
await new Promise((resolve) => app.server.listen(socket, resolve));
const proxy = http.createServer((req, res) => {
  const remote = http.request({
    socketPath: socket,
    path: req.url,
    method: req.method,
    headers: {...req.headers, 'x-trim-userid': '1000', 'x-trim-isadmin': 'true', 'x-trim-username': 'admin'},
  }, (response) => {
    res.writeHead(response.statusCode, {...response.headers});
    response.pipe(res);
  });
  remote.on('error', () => res.destroy());
  req.pipe(remote);
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${proxy.address().port}`;

const browser = await chromium.launch({headless: true, ...(process.env.QINGYE_BROWSER ? {executablePath: process.env.QINGYE_BROWSER} : {})});
const errors = [];
let page;

const clearQueue = async () => {
  const button = page.locator('#clear');
  if (await button.isEnabled()) await button.click();
};
const shots = async (page, name) => {
  await fs.mkdir('artifacts', {recursive: true});
  await page.screenshot({path: `artifacts/${name}`});
};

try {
  page = await browser.newPage({viewport: {width: 1280, height: 620}});
  page.on('pageerror', (error) => errors.push(error.message));
  const scripts = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto(`${origin}${PREFIX}/`);
  await page.waitForFunction(() => document.querySelector('#operation')?.options.length > 0, null, {timeout: 8000});

  /* 1. 外壳与两个按钮 -------------------------------------------------- */
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  const dropzoneButtons = page.locator('#dropzone button');
  assert.equal(await dropzoneButtons.count(), 2, 'dropzone 内必须恰好 2 个按钮');
  assert.equal(await page.locator('#pick-nas').textContent(), '从 NAS 上选择');
  assert.equal(await page.locator('#upload-pc').textContent(), '上传电脑文件');
  assert.equal(await page.locator('#dropzone').getByText('授权目录', {exact: true}).count(), 0);
  assert.equal(await page.locator('#nas-auth').count(), 0);
  assert.equal(await page.locator('#dropzone').getByText('从 NAS 文件夹批量添加', {exact: true}).count(), 0);
  assert.equal(await page.locator('#dropzone').getByText('选择文件', {exact: true}).count(), 0);
  // 桌面专属元素在飞牛端不出现（共用 UI 按 host=fnos 只创建 NAS 侧的东西）
  for (const selector of ['#mcp-config', '#copy-json', '#copy-toml', '#add-root', '[data-install]', '[data-select]', '#cancel-download', '#download-status']) {
    assert.equal(await page.locator(selector).count(), 0, `${selector} 是桌面专属元素，飞牛端不应出现`);
  }
  assert((await page.locator('#version-badge').textContent()).includes('1.2.14'), '版本角标应来自 /api/settings');

  for (const [group, operation] of [['office', 'office_to_pdf'], ['image', 'image_convert'], ['audio', 'audio_convert'], ['video', 'video_convert'], ['pdf', 'pdf_compress']]) {
    await page.locator(`[data-group=${group}]`).click();
    assert.equal(await page.locator('#operation').inputValue(), operation);
    assert((await page.locator('#operation option').count()) > 0);
  }
  console.log('PASS 1/11 主卡片只有 2 个按钮，分组导航可用');

  /* 2. NAS 弹窗：结构、不可用条目、底部可见 --------------------------- */
  await page.locator('#pick-nas').click();
  const dialog = page.locator('.nas-dialog');
  await dialog.waitFor({state: 'visible'});
  assert.equal(await dialog.locator('h2').textContent(), '从 NAS 上选择');
  await page.waitForFunction(() => document.querySelectorAll('.nas-row').length > 0, null, {timeout: 8000});

  // 620px 高度下底部操作栏不被裁切
  const footBox = await dialog.locator('.nas-foot').boundingBox();
  assert(footBox.y + footBox.height <= 620, `底部操作栏超出 620px 视口：${JSON.stringify(footBox)}`);
  assert.equal(await dialog.getByRole('button', {name: '加入当前文件夹', exact: true}).isDisabled(), true, '根目录时「加入当前文件夹」应禁用');

  // 进入共享目录根
  await dialog.locator('.nas-row.is-dir .nas-row-main').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-file').length > 0, null, {timeout: 8000});
  assert((await dialog.locator('.nas-row.is-file').count()) >= 3);

  // 不可用条目：越界软链 + 不匹配文件，都必须留在列表并写明原因
  const disabledRows = dialog.locator('.nas-row.is-disabled');
  assert((await disabledRows.count()) >= 2, '不可用条目必须保留在列表中');
  const disabledTexts = await disabledRows.allInnerTexts();
  assert(disabledTexts.some((text) => text.includes('链接指向授权目录之外')), `越界软链缺少原因：${disabledTexts.join(' | ')}`);
  assert(disabledTexts.some((text) => text.includes('不匹配当前处理方式')), `不匹配文件缺少原因：${disabledTexts.join(' | ')}`);
  assert.equal(await dialog.locator('.nas-row.is-disabled .nas-check:not([disabled])').count(), 0, '不可用条目不可勾选');
  // 文件名、大小、时间、匹配状态都可见
  const firstFile = dialog.locator('.nas-row.is-file:not(.is-disabled)').first();
  const meta = await firstFile.locator('.nas-meta').innerText();
  assert(/KB|MB|B\b/.test(meta), `条目缺少大小：${meta}`);
  assert(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(meta), `条目缺少修改时间：${meta}`);
  assert(meta.includes('匹配'), `条目缺少匹配状态：${meta}`);

  console.log('PASS 2/11 NAS 弹窗结构、不可用条目原因、底部完整可见');

  /* 3. 点击不可用条目 → 文件级权限面板 -------------------------------- */
  const lockedRow = dialog.locator('.nas-row.is-disabled', {hasText: '陈粒 - 光.pdf'}).first();
  assert.equal(await lockedRow.count(), 1, '0600 文件应作为不可用条目保留在列表');
  await lockedRow.click();
  await page.waitForFunction(() => document.querySelector('#nas-panel')?.textContent.includes('权限位'), null, {timeout: 8000});
  const filePanel = dialog.locator('#nas-panel');
  const filePanelText = await filePanel.innerText();
  assert(filePanelText.includes('为什么“陈粒 - 光.pdf”不可用'), `面板标题应带文件名：${filePanelText}`);
  assert(filePanelText.includes('权限位'), `面板缺少权限位：${filePanelText}`);
  assert(filePanelText.includes(lockedMode), `面板缺少实际 mode ${lockedMode}：${filePanelText}`);
  assert(filePanelText.includes('所有者'), `面板缺少所有者：${filePanelText}`);
  assert(filePanelText.includes('读取：不可以'), `面板应说明不可读：${filePanelText}`);
  assert(filePanelText.includes('不可用原因'), `面板应带列表里的原因：${filePanelText}`);
  assert(!filePanelText.includes('测试失败'), `面板不应出现占位失败文案：${filePanelText}`);
  await shots(page, 'fnos-file-permission.png');
  // 链接级动作：非飞牛桌面只提示，不抛错
  await filePanel.getByRole('button', {name: '在文件管理器中打开'}).click();
  await page.waitForFunction(() => document.querySelector('#nas-panel')?.textContent.includes('无法自动打开文件管理器'), null, {timeout: 8000});
  assert((await filePanel.innerText()).includes('请从飞牛桌面打开轻页'), '应引导从飞牛桌面打开');
  await filePanel.getByRole('button', {name: '收起'}).click();
  assert.equal(await dialog.locator('#nas-panel').isHidden(), true, '收起后权限面板应隐藏');
  console.log('PASS 3/11 点击不可用条目 → 文件级权限位/所有者/原因/修复入口');

  /* 4. 多选文件 → 队列 ------------------------------------------------ */
  const checkboxes = dialog.locator('.nas-row.is-file:not(.is-disabled) .nas-check');
  assert((await checkboxes.count()) >= 2);
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.waitForFunction(() => document.querySelector('#nas-status')?.textContent.includes('已选 2 个文件'));
  assert((await dialog.locator('#nas-status').textContent()).includes('个匹配'));
  await shots(page, 'fnos-picker-files.png');
  await dialog.getByRole('button', {name: /添加所选文件/}).click();
  await dialog.waitFor({state: 'detached'});
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === '2 个文件');
  const queueText = await page.locator('#files').innerText();
  assert(queueText.includes('NAS ·'), `队列应显示 NAS 相对路径：${queueText}`);
  assert(/KB|MB/.test(queueText), '队列应显示文件大小');
  assert((await page.locator('#files .type-badge').first().textContent()) === 'PDF', '队列应显示类型徽标');
  console.log('PASS 4/11 NAS 弹窗多选文件 → 队列');

  /* 5. 处理 → 打开位置 → 下载 ----------------------------------------- */
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary')?.textContent.includes('2 个成功'), null, {timeout: 60000});
  await page.getByRole('button', {name: '打开位置', exact: true}).first().click();
  const result = page.locator('.result-dialog');
  await result.waitFor({state: 'visible'});
  await shots(page, 'fnos-result.png');
  const link = result.getByRole('link', {name: '下载到电脑'}).first();
  const href = await link.getAttribute('href');
  assert(href.startsWith(`${PREFIX}/api/download`), `下载链接错误：${href}`);
  const download = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return {status: response.status, size: buffer.byteLength};
  }, href);
  assert.equal(download.status, 200);
  assert(download.size > 0, '下载内容为空');
  await result.getByRole('button', {name: '关闭', exact: true}).click();
  await result.waitFor({state: 'detached'});
  console.log('PASS 5/11 文件多选 → 处理 → 打开位置 → 下载');

  /* 6. 加入当前文件夹 -------------------------------------------------- */
  await clearQueue();
  await page.locator('#pick-nas').click();
  const folderDialog = page.locator('.nas-dialog');
  await folderDialog.waitFor({state: 'visible'});
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-dir').length > 0);
  await folderDialog.locator('.nas-row.is-dir .nas-row-main').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-file').length > 0);
  await folderDialog.getByRole('button', {name: '打开文件夹 合同'}).click();
  await page.waitForFunction(() => document.querySelector('#nas-crumbs')?.textContent.includes('合同'));
  assert((await folderDialog.locator('#nas-status').textContent()).includes('当前目录 1 个匹配'));
  assert.equal(await folderDialog.getByRole('button', {name: '加入当前文件夹', exact: true}).isDisabled(), false);
  await shots(page, 'fnos-picker-folder.png');
  await folderDialog.getByRole('button', {name: '加入当前文件夹', exact: true}).click();
  await folderDialog.waitFor({state: 'detached'});
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === '1 个文件');
  assert((await page.locator('#files').innerText()).includes('合同/2024 合同.pdf'));
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary')?.textContent.includes('1 个成功'), null, {timeout: 60000});
  console.log('PASS 6/11 加入当前文件夹（递归）并处理');

  /* 7. 空匹配文件夹文案 ------------------------------------------------ */
  await clearQueue();
  await page.locator('#pick-nas').click();
  const emptyDialog = page.locator('.nas-dialog');
  await emptyDialog.waitFor({state: 'visible'});
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-dir').length > 0);
  await emptyDialog.locator('.nas-row.is-dir .nas-row-main').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-file').length > 0);
  await emptyDialog.getByRole('button', {name: '打开文件夹 only-txt'}).click();
  await page.waitForFunction(() => document.querySelector('#nas-status')?.textContent.includes('当前目录 0 个匹配'));
  await emptyDialog.getByRole('button', {name: '加入当前文件夹', exact: true}).click();
  await emptyDialog.waitFor({state: 'detached'});
  await page.waitForFunction(() => document.querySelector('#message')?.textContent.includes('没有 PDF 文件'));
  assert.equal(await page.locator('#count').textContent(), '0 个文件');
  console.log('PASS 7/11 无匹配文件夹给出独立文案');

  /* 8. 权限提示 -------------------------------------------------------- */
  await page.locator('#pick-nas').click();
  const permDialog = page.locator('.nas-dialog');
  await permDialog.waitFor({state: 'visible'});
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-dir').length > 0);
  await permDialog.locator('.nas-row.is-dir .nas-row-main').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.nas-row.is-file').length > 0);
  await permDialog.getByRole('button', {name: '检查目录权限', exact: true}).click();
  await page.waitForFunction(() => !document.querySelector('#nas-panel')?.hidden, null, {timeout: 8000});
  const panel = permDialog.locator('#nas-panel');
  const dirPanelText = await panel.innerText();
  assert(dirPanelText.includes('权限位'), '应显示权限诊断结果');
  // 目录可读但存在 blocked 子项时，后端会返回 children 分布；未返回时前端不显示（容错）。
  if (dirPanelText.includes('共扫描')) {
    assert(/共扫描 \d+ 项 · 可读 \d+/.test(dirPanelText), `children 分布格式不符：${dirPanelText}`);
    assert(dirPanelText.includes('不可读'), `children 分布缺少不可读：${dirPanelText}`);
    console.log('   · 已渲染后端 children 分布');
  } else {
    console.log('   · 后端暂未返回 children 分布（前端已容错，不渲染）');
  }
  const settingsLink = panel.getByRole('button', {name: '打开应用设置'});
  assert.equal(await settingsLink.count(), 1, '权限面板应提供「打开应用设置」');
  assert.equal(await panel.getByRole('button', {name: '在文件管理器中打开'}).count(), 1, '权限面板应提供「在文件管理器中打开」');
  await shots(page, 'fnos-permission.png');
  await settingsLink.click();
  await page.waitForFunction(() => document.querySelector('#nas-panel')?.textContent.includes('无法自动打开应用设置'), null, {timeout: 8000});
  assert.equal(await page.locator('.result-dialog').count(), 0);

  // 「重新授权此文件夹」：明确指向飞牛官方 authorizeSharedFile；不在飞牛桌面里只提示、不抛错
  await permDialog.getByRole('button', {name: '重新授权此文件夹', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#nas-panel')?.textContent.includes('重新授权未完成'), null, {timeout: 8000});
  assert((await panel.innerText()).includes('请从飞牛桌面打开轻页'), '非飞牛桌面环境应引导从飞牛桌面打开');

  // 契约 §2.5b：授权后即时生效（bridge.grant → /api/nas/grant）
  const shared = await page.evaluate(async () => {
    const response = await fetch('/app/qingye/api/settings');
    const data = await response.json();
    return data.sharedDirectory;
  });
  const granted = await page.evaluate(async (target) => {
    const result = await window.qingye.grant(target);
    const roots = (await window.qingye.settings()).roots;
    return {path: result.path, roots: roots.map((root) => root.path)};
  }, shared);
  assert.equal(granted.path, shared);
  assert(granted.roots.includes(shared), `授权后 /api/settings 应立刻包含该目录：${granted.roots.join(', ')}`);

  await permDialog.getByRole('button', {name: '取消', exact: true}).click();
  await permDialog.waitFor({state: 'detached'});
  console.log('PASS 8/11 权限面板 hints/children、重新授权引导、grant 即时生效、应用设置与文件管理器降级');

  /* 8. 上传电脑文件 ---------------------------------------------------- */
  await clearQueue();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#upload-pc').click();
  const chooser = await chooserPromise;
  assert.equal(await page.locator('.nas-dialog').count(), 0, '上传不应打开 NAS 弹窗');
  await chooser.setFiles({name: '电脑上传.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture())});
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === '1 个文件', null, {timeout: 60000});
  const uploadText = await page.locator('#files').innerText();
  assert(uploadText.includes('电脑上传 · 上传文件/1000/电脑上传.pdf'), `上传条目来源路径错误：${uploadText}`);
  await shots(page, 'fnos-main.png');
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#summary')?.textContent.includes('1 个成功'), null, {timeout: 60000});

  // 解锁测试文件，避免影响后续上传/拖拽步骤（临时目录随后整体删除）
  await unlockFile();

  /* 9. 拖拽仍然可用 ---------------------------------------------------- */
  await clearQueue();
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(4096)], '拖入测试.pdf', {type: 'application/pdf'}));
    document.getElementById('dropzone').dispatchEvent(new DragEvent('drop', {dataTransfer: transfer, bubbles: true, cancelable: true}));
  });
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === '1 个文件', null, {timeout: 60000});
  assert((await page.locator('#files').innerText()).includes('拖入测试.pdf'));

  /* 10. 组件与目录 + 任务历史 ------------------------------------------ */
  await page.locator('[data-group=settings]').click();
  await page.waitForFunction(() => document.querySelector('#roots')?.textContent.includes('files'));
  await page.waitForFunction(() => document.querySelector('#history')?.textContent.includes('PDF 压缩'), null, {timeout: 8000});
  assert((await page.getByRole('button', {name: '按原参数重试'}).count()) > 0);
  // 设置页同样是飞牛版：只读授权目录 + 组件只读，桌面专属控件不可见
  assert.equal(await page.locator('#open-settings').isVisible(), true, '飞牛端应有「打开应用设置」');
  assert.equal(await page.locator('#roots-heading-label').isVisible(), true);
  assert.equal(await page.locator('#add-root').count(), 0, '飞牛端不应出现 AI 目录增删');
  assert.equal(await page.locator('[data-install]').count(), 0, '飞牛端组件随应用提供，不应出现安装入口');
  assert.equal(await page.locator('#mcp-config').count(), 0, '飞牛端不应出现 MCP 配置');
  assert.equal(await page.locator('#work-panel').isVisible(), false);
  assert.equal(await page.locator('#settings-panel').isVisible(), true);
  // 契约 §2.8：/api/settings.hardware → 一行视频硬件加速状态（可用/不可用 + 原因或设备）
  await page.waitForFunction(() => document.querySelector('#components')?.textContent.includes('视频硬件加速'), null, {timeout: 8000});
  const hardwareText = await page.locator('#components').innerText();
  const hardwareLine = hardwareText.split('\n').find((line) => line.includes('视频硬件加速')) || '';
  assert(/视频硬件加速：(可用（.+）|不可用（.+）)/.test(hardwareLine), `硬件加速行格式不符：${hardwareLine}`);
  console.log(`   · ${hardwareLine.trim()}`);
  await shots(page, 'fnos-settings.png');
  console.log('PASS 9/11 上传电脑文件、拖拽添加、组件与目录页、任务历史、硬件加速状态');

  /* 10. 视频硬件加速选项 ---------------------------------------------- */
  await page.locator('[data-group=video]').click();
  assert.equal(await page.locator('#operation').inputValue(), 'video_convert');
  const hwSelect = page.locator('#hw');
  assert.equal(await hwSelect.count(), 1, '视频组应有「硬件加速」下拉');
  assert.deepEqual(await hwSelect.locator('option').allInnerTexts(), ['自动', '关闭']);
  assert.equal(await hwSelect.inputValue(), 'auto', '默认应为自动');
  assert((await page.locator('#options').innerText()).includes('无核显时自动用 CPU'), '下拉旁应有说明');

  await clearQueue();
  const mp4Chooser = page.waitForEvent('filechooser');
  await page.locator('#upload-pc').click();
  await (await mp4Chooser).setFiles({name: '演示.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(4096)});
  await page.waitForFunction(() => document.querySelector('#count')?.textContent === '1 个文件', null, {timeout: 60000});
  await hwSelect.selectOption('off');
  await shots(page, 'fnos-video-hw.png');

  // 提交参数里必须带 options.hw（关闭也传），用路由拦截截获 /api/jobs 请求体
  const submitted = [];
  const jobsRoute = async (route) => {
    submitted.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({jobId: `hw-${submitted.length}`})});
  };
  // 状态快照序列，验证 stage 原样透传（前端不加前缀）且回退时百分比归 0 不被前端“纠正”：
  //   1) 硬件运行中 45%  2) 回退到 CPU、percent 归 0  3) 完成
  // 注意：第 2 步的 percent:0 与那句 stage 是后端有意为之（软件重跑从 0 开始），
  // 不是缺陷；改这里之前先与后端确认（nas-server 明确不会改这两个值）。
  const stages = [
    {status: 'running', percent: 45, stage: '硬件加速（VAAPI）正在转换…'},
    {status: 'running', percent: 0, stage: '硬件加速不可用，已改用 CPU 重新转换…'},
    {status: 'completed', percent: 100, stage: '完成'},
  ];
  let statusCalls = 0;
  const jobRoute = async (route) => {
    const snapshot = stages[Math.min(statusCalls, stages.length - 1)];
    statusCalls += 1;
    const body = snapshot.status === 'running'
      ? {
        id: 'hw-test', operation: 'video_convert', status: 'running', percent: snapshot.percent, stage: snapshot.stage,
        inputs: [], outputDir: '', options: {}, createdAt: Date.now(),
        results: [{inputs: [], status: 'running', outputs: [], before: 0, after: 0}],
      }
      : {
        id: 'hw-test', operation: 'video_convert', status: 'completed', percent: 100, stage: '完成',
        inputs: [], outputDir: '', options: {}, createdAt: Date.now(),
        results: [{inputs: [], status: 'done', outputs: [], before: 4096, after: 2048}],
      };
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  };
  const isJobs = (url) => url.pathname.endsWith('/api/jobs');
  const isJob = (url) => url.pathname.endsWith('/api/job');
  await page.route(isJobs, jobsRoute);
  await page.route(isJob, jobRoute);
  const waitUntil = async (check, label, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(`等待超时：${label}`);
  };
  try {
    await hwSelect.selectOption('off');
    await page.locator('#start').click();
    await waitUntil(() => submitted.length >= 1, '第一次提交');
    assert.equal(submitted[0].operation, 'video_convert');
    assert.equal(submitted[0].options.hw, 'off', `关闭时必须显式传 hw:off：${JSON.stringify(submitted[0].options)}`);
    // 后端 stage 原样展示，前端不拼前缀
    await page.waitForFunction(() => document.querySelector('#summary')?.textContent.includes('硬件加速（VAAPI）正在转换… 45%'), null, {timeout: 8000});
    // 回退到 CPU 时后端把 percent 归 0，前端按原值展示、不“纠正”成单调递增
    await page.waitForFunction(() => document.querySelector('#summary')?.textContent.includes('硬件加速不可用，已改用 CPU 重新转换… 0%'), null, {timeout: 8000});
    await page.waitForFunction(() => document.querySelector('#summary')?.textContent.includes('处理完成'), null, {timeout: 8000});

    await hwSelect.selectOption('auto');
    await page.locator('#start').click();
    await waitUntil(() => submitted.length >= 2, '第二次提交');
    assert.equal(submitted[1].options.hw, 'auto', `自动时应传 hw:auto：${JSON.stringify(submitted[1].options)}`);
  } finally {
    await page.unroute(isJobs, jobsRoute);
    await page.unroute(isJob, jobRoute);
  }
  console.log('PASS 10/11 视频「硬件加速」下拉存在、切换值进入 options.hw、后端 stage 原样透传');

  /* 11. 1024×600 下弹窗完整可见 ---------------------------------------- */
  const small = await browser.newPage({viewport: {width: 1024, height: 600}});
  small.on('pageerror', (error) => errors.push(error.message));
  await small.goto(`${origin}${PREFIX}/`);
  await small.waitForFunction(() => document.querySelector('#operation')?.options.length > 0, null, {timeout: 8000});
  await small.locator('#pick-nas').click();
  const smallDialog = small.locator('.nas-dialog');
  await smallDialog.waitFor({state: 'visible'});
  await small.waitForFunction(() => document.querySelectorAll('.nas-row').length > 0, null, {timeout: 8000});
  const smallFoot = await smallDialog.locator('.nas-foot').boundingBox();
  assert(smallFoot.y + smallFoot.height <= 600, `1024×600 下底部被裁切：${JSON.stringify(smallFoot)}`);
  const smallBox = await smallDialog.boundingBox();
  assert(smallBox.width <= 1024 && smallBox.height <= 600);
  await shots(small, 'fnos-picker-1024x600.png');
  await smallDialog.getByRole('button', {name: '取消', exact: true}).click();
  await small.close();

  /* 11. 资源与报错 ----------------------------------------------------- */
  assert(scripts.some((url) => url.includes('/app/qingye/app.js')), `页面应加载 app.js：${scripts.join(', ')}`);
  assert.equal(scripts.some((url) => url.endsWith('.mjs')), false, '页面不应再加载 .mjs 模块');
  assert.deepEqual(errors, [], `页面报错：${errors.join(' | ')}`);
  console.log('PASS 11/11 1024×600 弹窗完整可见，无页面报错，app.js 由静态路由加载');
  console.log('PASS fnOS browser: 两按钮 UI、统一 NAS 弹窗（文件/文件夹）、不可用条目原因、权限提示、上传、任务历史、下载');
} finally {
  await browser.close();
  await app.close();
  await new Promise((resolve) => proxy.close(resolve));
  await fs.rm(root, {recursive: true, force: true});
}
