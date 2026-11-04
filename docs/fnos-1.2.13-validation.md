# 飞牛独立版 1.2.13.5 验证记录

验证时间：2026-11-03。目标机 fnOS 未参与本机验证，以下为可复现的本机与容器结果。

## 1. 后端接口（25 项）

```sh
node --test fnos/tests/server.test.mjs
# tests 25 / pass 25 / fail 0
```

覆盖：失效授权根不阻断启动（`missingRoots` + `app.log`）、共享目录四段探测、根列表与子目录列表、条目 disabled/原因、排序与 hidden 计数、控制字符替换、**目录与文件级权限区分（0755 目录 + 0600 文件、`mode`/`owner`、`children` 分布与文件级 hints）**、文件选择、文件夹递归批量（100 上限 / 截断 / 无匹配文案）、权限诊断 hints、即时授权 `grant`（持久化、重启保留、失效丢弃）、上传四端点与单请求兼容、任务 owner 隔离、历史与重试、下载范围、停止时取消任务、页面 CSP 与静态资源。

## 2. 界面（真实服务 + Chrome）

```sh
QINGYE_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node fnos/tests/browser.mjs
# PASS 1/10 … 10/10
```

覆盖：dropzone 内按钮数恰为 2（`#pick-nas`、`#upload-pc`）、分组导航、NAS 弹窗文件多选与不可用条目原因、**点击不可用条目查看该文件的权限位/所有者/原因/修复入口**、620px 与 1024×600 下弹窗底部完整可见、处理→打开位置→下载、加入当前文件夹（递归）、无匹配文案、目录权限分布 `children`、`grant` 即时生效、上传电脑文件与拖拽、任务历史与重试、仅加载 `app.js`（无 .mjs）、无页面报错。

截图：`artifacts/fnos-main.png`、`fnos-picker-files.png`、`fnos-picker-folder.png`、`fnos-file-permission.png`、`fnos-permission.png`、`fnos-picker-1024x600.png`、`fnos-settings.png`、`fnos-result.png`。

### 本机 Web 入口（与另一会话并行开发的功能合并）

- 入口 `fnos/web-entry.mjs` 只绑 `127.0.0.1:32181`，默认开启，`QINGYE_WEB=0` 关闭；`QINGYE_WEB_UID` 必须是数字（默认 1000），给错值整套停用。
- 代理丢弃客户端 `X-Trim-*` 并注入唯一身份；`/api/settings.web` 提供该行给「组件与目录」页显示。
- 已交叉验证：网关入口与 Web 入口可同时使用，MCP 仍只听 32180；无端口冲突时启动日志会写入口地址。

### 硬件加速管线（1.2.13.5）

- 生产与探测统一为「CPU 解码/缩放 + GPU 编码」：`-init_hw_device vaapi=va:<dev> -filter_hw_device va -vf 'scale=…,format=nv12,hwupload' -c:v h264_vaapi -qp N`。
- 不再使用 `scale_vaapi`（VAAPI VPP 管线）：实测部分 Intel 驱动报 `Failed to create processing pipeline config: 12（the requested VAProfile is not supported）`，整条命令失败后回退 CPU，表现为“显示可用却只跑 CPU”或“不可用”。
- 容器验证：内置 ffmpeg 5.1 解析新参数无 `Unrecognized option`，无 GPU 时仅报设备缺失；本机 ffmpeg 7.1 解析器回归测试常驻。

### 接口文档

- `docs/fnos-api.md`：HTTP API（`/api/settings`、`/api/nas/*`、上传、任务）、错误码、限额、数据模型、本机 MCP 与本机 Web 入口。
- 文档中的错误码与实现一致：任务校验失败统一 `400 JOB_REJECTED`（`fnos/tests/server.test.mjs` 新增用例覆盖并发提交与非法输出目录）。

## 3. Linux 运行时（打包内 Node）

在 `node:22-bookworm-slim`（linux/amd64，`--network none`，UID 1000）中，用 `fnos/build/payload` 的 `runtime/bin/node` 与 `node_modules` 运行：

```sh
node --test fnos/tests/server.test.mjs   # tests 25 / pass 25
QINGYE_LIFECYCLE_DIR=… bash lifecycle.sh # PASS fnOS lifecycle: start, ready socket, idempotent start, stop, stopped status, restart
```

说明：Office/FFmpeg 的完整 linux-smoke 需要 `QINGYE_FIXTURES` 指向合成样本目录，本机未生成，故未运行该项；该路径与 1.2.12 相同，未改动。

## 4. 安装包

```sh
FNPACK=/path/to/fnpack-1.2.3-darwin-arm64 node fnos/build-fpk.mjs
```

产物：`release/Qingye-Toolbox-1.2.13.5-fnos-x86.fpk`（381 MiB，2026-11-04 10:25 重打包）。
包内额外含：`runtime/lib/dri/{i965,iHD}_drv_video.so`（Intel VA 驱动）、`runtime/lib/libigdgmm.so.12`、`config/privilege` 的 `join-groups:["video","render"]`、ffmpeg 包装脚本导出 `LIBVA_DRIVERS_PATH`、`src/hwaccel.mjs` 与 `/api/settings.hardware`。
VAAPI 真实硬编只能在目标 NAS（如 i5-6500 核显）上验证；容器验证确认：无 GPU 时探测返回干净的「设备不存在」失败并自动走 CPU（linux-smoke / toolbox 回归覆盖）。
校验：`sha256 d02da40fc8e9b1e1890cdd770a509d3edbe0829a32d0815a00992f3cbc9d69f4`。
包内 manifest 版本 `1.2.13.5`、`os_min_version=1.2.0401`、`micro_app=true`、`disable_authorization_path=false`；`wizard/{install,config}` 存在；`app/fnos/web` 只含 `index.html`、`app.bundle.js`、`app.css`、`app.mjs`、`bridge.js`、`entry.js`（旧的 `nas.css` 不再打进包）。

## 5. 未覆盖 / 仍需真机确认

- 飞牛 Windows ACL 的实际授予与撤销、`TRIM_DATA_ACCESSIBLE_PATHS` 是否在进程运行中更新（本实现用 `grant` 接口即时登记，不依赖它）。
- 统一网关 iframe 下 `frame-ancestors 'self'` 是否被拦截。
- `os_min_version=1.2.0401` 的四段写法在应用中心的接受度（官方 Native 案例用过 `1.1.3100`）。
- 实机安装、桌面入口、`/app/qingye` 打开、飞牛授权弹窗（`pickSharedFile` / `authorizeSharedFile`）与管理员限制。
