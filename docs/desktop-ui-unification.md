# 桌面端与飞牛端 UI 统一（分支 feat/unified-desktop-ui）

目标：把 1.2.13 起在飞牛端重做的界面与交互迁移到 macOS / Windows 桌面端，两端共用一份 UI 源码；版本号统一为 `1.2.14`。

## 1. 目录与加载

| 角色 | 路径 | 说明 |
|---|---|---|
| 共用 UI | `src/ui/app.mjs` + `src/ui/app.css` | 唯一实现；从 `fnos/web/app.mjs`、`fnos/web/app.css` 迁移而来 |
| 飞牛入口 | `fnos/web/entry.js` | `import './bridge.js'; import '../../src/ui/app.mjs';` |
| 飞牛页面 | `fnos/web/index.html` | 引 `app.css`（服务端从 `src/ui/app.css` 提供） |
| 桌面入口 | `src/toolbox.html` | 引 `ui/app.css`，`<script type="module" src="ui/app.mjs">` |
| 桌面适配层 | `src/preload-toolbox.cjs` | 暴露与飞牛 `bridge.js` 同名的 `window.qingye` |

ID 与类名保持不变（`#pick-nas`、`#upload-pc`、`#dropzone`、`#start`、`#summary` 等），以便两端测试与样式复用。

## 2. 宿主差异

`window.qingye.host`：`'fnos' | 'desktop'`。

| 能力 | fnos | desktop |
|---|---|---|
| `pickFiles(operation)` | 打开 NAS 选择弹窗（文件/文件夹同一入口） | 原生多选文件对话框（按扩展名过滤） |
| `pickFolderBatch(operation)` | 同上（弹窗内「加入当前文件夹」） | 选择文件夹后按扩展名扫描加入（≤100，≤10000 项） |
| `upload(files, op, opts)` | 分片上传到共享目录 | 不适用（按钮显示「选择文件夹」） |
| `list/select/folder/permission/grant/authorizeFolder/openAppSetting/openFileManager` | 有 | 无（`null`） |
| `settings()` | 飞牛版（roots 只读、组件只读、hardware、web） | 桌面版（AI roots 可编辑、MCP 配置、组件可安装、hardware、version） |
| `addRoot/removeRoot/copyConfig/installComponent/selectComponent/cancelDownload/onComponent` | `null` | 有 |
| `reveal(path)` | 结果弹窗内下载 | `shell.showItemInFolder` |

UI 行为：
- 主卡片两个按钮：飞牛端「从 NAS 上选择」「上传电脑文件」；桌面端「选择文件」「选择文件夹」。ID 不变。
- 桌面端隐藏所有 NAS 专属入口（重新授权、检查目录权限、打开应用设置、文件管理器、上传进度文案）。
- 「组件与目录」页：飞牛端显示授权目录（只读）+ 组件（只读）+ 硬件 + Web 入口 + 历史；桌面端显示 AI 授权目录（可增删）+ MCP 配置 + 组件（可安装）+ 硬件 + 历史。
- 桌面端标题/副标题沿用飞牛版文案风格（「文件处理，一处完成」）。

## 3. 桌面 IPC（src/desktop.cjs）

新增/调整：

| 频道 | 入参 | 返回 |
|---|---|---|
| `files:pick` | `operation` | `{added, errors}`（保持） |
| `folder:batch` | `operation` | `{added, errors}`：选目录后按扩展名递归扫描 |
| `files:drop` | `paths, operation` | `{added, errors}`（保持） |
| `job:start/status/cancel` | 保持 | 保持 |
| `job:history` | — | 最近 100 条（用 `JobService({historyFile})`） |
| `job:retry` | `id` | `{jobId}` |
| `file:reveal` | path | 保持 |
| `settings:get` | — | `{...settings, components, hardware, version}` |
| `settings:add-root/remove-root/copy` | 保持 | 保持 |
| `component:install/select/cancel` | 保持 | 保持 |

历史持久化：`app.getPath('userData')/jobs.json`。

## 4. 版本统一

- `package.json` → `1.2.14`；`fnos/package/manifest` → `1.2.14`；`fnos/server.mjs` VERSION；`fnos/local-mcp.mjs`；`fnos/web/index.html` 的 `?v=`；`src/ui/app.mjs` 兜底文案；README 标题与飞牛 README。
- 产物名：`Qingye-Toolbox-1.2.14-mac-arm64.dmg` / `-win-x64-setup.exe` / `-fnos-x86.fpk`。

## 5. 测试

- `fnos/tests/browser.mjs`：选择器不变，应继续通过；额外断言桌面专属元素在 fnOS 下不出现。
- `scripts/toolbox-smoke.mjs`（桌面 UI 冒烟）：改为断言两个按钮、队列来源、设置页硬件行，并验证版本角标读取 `settings.version`。
- `tests/*.test.mjs` 与 `fnos/tests/server.test.mjs` 保持全绿。
