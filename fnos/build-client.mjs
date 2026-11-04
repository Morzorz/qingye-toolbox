import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * 打包飞牛版前端：fnos/web/entry.js → fnos/web/app.bundle.js
 *
 * 产物必须是经典脚本（iife），因为页面用 `<script defer src="app.js">` 加载，
 * CSP 为 `script-src 'self'`，不再使用内联脚本或 hash 白名单。
 * - 保留 try/catch 包裹：初始化异常时在页面上给出可读提示，而不是白屏。
 * - 输出中若出现 `</script` 一律转义，避免将来内联复用时截断文档。
 */
export async function buildClient() {
  const result = await build({
    entryPoints: [path.join(root, 'fnos/web/entry.js')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'inline',
    logLevel: 'warning',
  });
  const code = `try {\n${result.outputFiles[0].text}\nwindow.qingyeReady = true;\n} catch (error) {\nvar box = document.getElementById('message');\nif (box) box.textContent = '界面启动失败：' + error.message + '。请刷新页面；如仍失败，请反馈这段提示。';\nconsole.error(error);\n}\n`;
  await fs.writeFile(path.join(root, 'fnos/web/app.bundle.js'), code.replace(/<\/script/gi, '<\\/script'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildClient();
