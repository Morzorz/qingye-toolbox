# 轻页文件工具箱 1.1.1

保留 Electron 桌面方案，文件在本机处理，原文件不覆盖。提供 Windows x64 EXE 和苹果芯片 Mac DMG。

## 飞牛独立版

飞牛 NAS 上另有独立 FPK 版本（1.2.13.5），从飞牛桌面直接打开，复用统一网关登录，不经过 Docker：

- 主界面只有两个入口：“从 NAS 上选择”（同一个窗口里选文件或加入整个文件夹）和“上传电脑文件”。
- 目录权限按飞牛官方机制处理：共享目录由系统授权，其他目录在应用内重新授权后即时生效，无需重启应用。
- 安装、权限排查与构建说明见 [fnos/README.md](fnos/README.md)。

## Docker 版

也可以直接用 Docker 运行同一套转换引擎：通过 `volumes` 挂载输入/输出目录，不经过飞牛应用授权和 ACL，适合在飞牛、群晖或普通 Linux 主机上使用。

```sh
cd docker
docker compose up -d --build
```

打开 `http://NAS_IP:8080/app/qingye/`。完整说明见 [docker/README.md](docker/README.md)。


## 1.1.1 中文显示修复

修复无界面办公组件未加载中文字体时，生成 PDF 显示空白或方框的问题。内置约 8 MiB 的 Noto Sans SC 字体，只放入临时转换配置中，不安装系统字体、不更改原文档。缺少原字体时使用回退字体，字形与排版可能与原字体略有差别。升级后请使用原始 Word、Excel 或 PPT 重新转换；已生成的错误 PDF 不会自动更新。

中文回归测试同时检查文本和实际绘制的不同字形，避免把“可复制中文但无法显示”误判为成功。

## 功能

| 分类 | 支持操作 |
|---|---|
| PDF | 三档压缩、按顺序合并、提取页码、转 PNG/JPG |
| 图片 | JPG/PNG/WebP 互转、缩放、多图转 PDF |
| 办公文档 | Word/Excel/PPT 转 PDF，需 LibreOffice |
| 音频 | 转 MP3/WAV/FLAC/M4A、从视频提取音频，需 FFmpeg |
| 视频 | 转 MP4、压缩、调整分辨率，需 FFmpeg；有 Intel 核显（VAAPI）时自动硬件加速，失败自动回退 CPU |
| AI 调用 | 本地 stdio MCP、命令行 JSON 任务 |

每批最多 100 个输入，支持进度、取消、结果定位和重名自动编号。合并按列表顺序，可上下调整。默认保存到第一个输入文件所在目录，也可另选目录。PDF 拆分目前是指定页码提取为一个 PDF（例如 `1-3,5`）。不支持 PDF 还原为可编辑 Office，也不包含 OCR。

## 安装与组件

Mac：将 DMG 中的应用拖到 Applications 后运行，仅适用于 Apple Silicon。Windows：运行 EXE，按向导安装。Mac 使用本地 ad-hoc 签名，尚未经过 Apple 公证；Windows 未配置商业代码签名。系统可能提示未知来源，请确认来源后使用系统提供的允许打开入口。

PDF 和图片功能内置。打开「组件与 AI」可下载或选择已有组件：

- 音视频组件：FFmpeg 第三方预编译版本，下载约 44–79 MiB。
- 办公组件：LibreOffice 官方安装包，下载约 285–358 MB；Windows 需完成弹出的安装向导后刷新状态。

组件安装后可离线处理。下载使用 HTTPS 和固定 SHA-256 校验，取消或失败不会将未验证的组件标记为已安装。网络仅用于用户主动下载组件；文件内容不上传。本版没有接入广告网络、账号、遥测或自动更新。

## 让 AI 调用

1. 安装后打开「组件与 AI」，添加允许 AI 读写的文件夹。
2. 点击「复制通用 MCP 配置」或「复制 Codex 配置」。配置使用当前已安装应用的可执行文件，不需要额外安装 Node。
3. 将配置添加到支持本地 stdio MCP 的 AI 客户端，重新加载连接。
4. 告诉 AI 输入文件、输出文件夹和处理方式；输入及输出都必须在授权目录内。

可用工具：`capabilities` 查看能力和组件，`submit_task` 提交任务，`task_status` 查询进度及结果，`cancel_task` 取消任务。提交返回任务 ID，必须查询最终结果后才能判断成功。撤销授权后，新任务和待导出结果会重新检查权限。文件内容及文件名均视为数据，不作为指令。

普通网页聊天不会自动发现本地应用。AI 客户端仍可能要求用户确认工具调用；本应用不修改客户端配置。参考 [Codex MCP 文档](https://developers.openai.com/codex/mcp)。

命令行接口：应用可执行文件后追加 `--cli` 和一个 JSON 参数。JSON 结构示例：

```json
{"operation":"pdf_compress","inputs":["/absolute/path/input.pdf"],"outputDir":"/absolute/path/output","options":{"preset":"balanced"}}
```

命令行使用相同授权目录，输出最终任务 JSON。Windows 路径需按 JSON 规则转义反斜杠。`--mcp` 启动无窗口的协议服务。

## 已知边界

压缩 PDF 主要优化扫描图片，保留文字层、表单、书签等结构；纯文字或已优化文件缩小有限，输出更大时保留原字节。三档为清晰、均衡、最小体积；最小档可能损失小字细节。不处理加密或带数字签名的 PDF。合并和页码提取保留页面内容，不承诺保留文档级目录、表单关系和附件。图片转换不支持动画。Office 排版受已安装字体及 LibreOffice 兼容性影响。

PDF、图片和办公文件单个上限 500 MiB，合并总输入上限 500 MiB；音视频单个上限 20 GiB。PDF 转图最多 500 页，页码提取最多 5000 页。每个应用或 MCP 进程同时执行一个任务。

## 开发与验证

需要 Node.js 22+：

```sh
npm ci
npm test
npm run test:ui
npm start
npm run build:mac
npm run build:win
```

音视频测试自动使用本机 FFmpeg；办公测试需 `scripts/create-office-fixtures.py` 生成合成样本，并将 `QINGYE_OFFICE_FIXTURES` 指向样本目录。该脚本需要 python-docx、openpyxl 和 python-pptx。`QINGYE_APP` 指定打包应用的可执行文件以运行界面测试；`QINGYE_PACKAGED_APP` 指定打包应用以运行 MCP 测试。无真实用户文档打包或入库。

入口 `src/entry.cjs`，桌面 `src/desktop.cjs`，共享任务 `src/jobs.mjs`，转换引擎 `src/operations-worker.mjs` 与 `src/media-office.mjs`，AI 接口 `src/mcp.mjs`。旧 1.0 界面文件保留用于参考，发布入口使用新版工具箱。

Windows 安装包在 Mac 交叉构建；本机不能验证 Windows 实际启动。仓库提供 Windows GitHub Actions 测试流程，但未声称已远程执行。

## 许可

项目使用 AGPL-3.0-or-later 并附源码，包含 MuPDF；其他组件见 THIRD-PARTY-NOTICES.md。可选组件分别遵循其原许可。
