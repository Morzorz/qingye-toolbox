# 轻页飞牛版 1.2.13 重构契约（实现基线）

本文件是 1.2.13 飞牛独立版的唯一实现基线。后端（`fnos/server.mjs`）与前端（`fnos/web/*`）必须严格按此契约实现，双方并行开发。

## 0. 目标

1. 目录权限问题闭环：授权目录发现、失效路径容错、读/写权限诊断、可执行的中文修复指引。
2. 文件显示问题闭环：列表绝不静默丢条目；显示类型、大小、时间、是否匹配当前处理方式、不可用原因。
3. 主卡片只保留 2 个按钮：`从 NAS 上选择`、`上传电脑文件`。拖拽仍然可用。

## 1. 官方事实（2026-11 复核，developer.fnnas.com）

- `config/resource` 的 `data-share.shares[].name` 声明共享目录，安装时由系统创建，使用 **Windows ACL**，系统自动给应用运行用户授予 ACL。
- `TRIM_DATA_SHARE_PATHS`：共享目录路径，`:` 分隔；`TRIM_DATA_ACCESSIBLE_PATHS`：用户授权路径，`:` 分隔。
- 共享目录也可通过 `/var/apps/{appname}/share/{name 的最后一段}` 软链访问（与 `TRIM_DATA_SHARE_PATHS` 并列；`name=qingye/files` → `/var/apps/qingye/share/files`）。
- 统一网关：`app/ui/config` 的 `gatewayPrefix` + `gatewaySocket`，请求转发时带 `X-Trim-Userid`、`X-Trim-Isadmin`、`X-Trim-Username`。
- `manifest.disable_authorization_path=false` 才会在应用设置中显示“授权目录”。
- 应用默认没有用户文件广泛访问权限，必须由用户显式授权目录；应用仍需自行校验路径与权限。

## 2. 服务器 API（前缀 `/app/qingye`）

通用：
- 所有请求要求 `x-trim-userid` 为数字、`x-trim-isadmin` 为 `true`，否则 403。
- 所有 POST 要求 `x-qingye-request: 1`，否则 403。
- 若带 `Origin`，必须能解析为 http/https URL。
- 错误响应统一 `{error, code, hints?: string[]}`，`Content-Type: application/json; charset=utf-8`。
- 路径必须 `realpath` 后位于授权根内（`inside()` 语义），且不属于应用内部受保护目录（stateDir、项目目录、`TRIM_PKGETC`、`TRIM_PKGHOME`）。

### 2.1 `GET /api/settings`

```json
{
  "version": "1.2.13.0",
  "label": "飞牛独立版",
  "roots": [{"path": "/vol1/1000/qingye/files", "name": "qingye/files", "writable": true, "shared": true}],
  "sharedDirectory": "/vol1/1000/qingye/files",
  "defaultOutput": "/vol1/1000/qingye/files",
  "missingRoots": ["/vol2/gone"],
  "components": {"media": "...", "office": "..."},
  "config": {"json": "..."}
}
```

- `roots` 顺序：共享目录在前，其余授权目录按路径排序；去重。
- `missingRoots`：安装前授权过、现在不存在的路径（`realpath` 失败），只用于提示，不阻断启动。
- 启动容错：单个根不可解析时跳过并写入 `app.log`，绝不因一个失效根导致整个应用启动失败。

### 2.2 `GET /api/nas/list?path=<abs>&operation=<op>`

- `path` 省略或为空：返回根列表，`entries` 中每个根为 `kind:"dir"`、`root:true`。
- `path` 存在：必须是目录，否则 `400 {code:"NOT_DIRECTORY"}`。
- 无读权限：`403 {code:"NO_READ", hints:[...]}`，`hints` 为可执行的中文步骤。
- 目录项超限：`413 {code:"TOO_MANY"}`（>10000 个子项）。

响应：

```json
{
  "path": "/vol1/1000/qingye/files/sub",
  "name": "sub",
  "parent": "/vol1/1000/qingye/files",
  "root": "/vol1/1000/qingye/files",
  "operation": "pdf_compress",
  "extensions": ["pdf"],
  "permissions": {"read": true, "write": false},
  "counts": {"directories": 2, "files": 7, "matched": 3, "hidden": 1, "blocked": 1},
  "entries": [
    {"name": "合同", "path": "/vol1/1000/qingye/files/sub/合同", "kind": "dir",
     "size": 0, "mtime": "2025-01-02T04:05:06.000Z", "extension": "",
     "matches": false, "readable": true, "writable": false,
     "disabled": false, "disabledReason": null, "note": null},
    {"name": "a.pdf", "path": ".../a.pdf", "kind": "file", "size": 1048576,
     "mtime": "2025-01-02T04:05:06.000Z", "extension": "pdf", "matches": true,
     "readable": true, "writable": true, "mode": "0644", "owner": "1000:1000",
     "disabled": false, "disabledReason": null, "note": null},
    {"name": "b.pdf", "path": ".../b.pdf", "kind": "file", "size": 0, "mtime": null,
     "extension": "pdf", "matches": true, "readable": false, "writable": false,
     "mode": "0600", "owner": "1000:1000",
     "disabled": true, "disabledReason": "没有读取权限（文件权限未包含轻页账号）", "note": null}
  ],
  "warnings": ["1 个项目没有读取权限，已标注原因"]
}
```

规则：
- **绝不因为单个子项 `stat`/`realpath` 失败而丢弃它**：以 `disabled:true` + `disabledReason` 呈现。
- 点号开头的项目不进入 `entries`，计入 `counts.hidden`。
- 符号链接：解析后仍在授权根内才可正常使用；指向根外的条目保留但 `disabled:true, disabledReason:"链接指向授权目录之外"`。
- 排序：目录在前，然后按 `name.localeCompare(…, 'zh-CN')`；`entries` 上限 5000，超出时截断并给 `warnings`。
- 名称中的控制字符（`\u0000-\u001f`、`\u202e` 等双向控制符）在返回前替换为 `�`，避免显示错乱；`path` 保持原始值。

### 2.3 `POST /api/nas/select`

```json
{"paths": ["/abs/a.pdf"], "operation": "pdf_compress"}
```

响应 `{"added":[{"path","name","size"}], "errors":["a.txt：不支持此文件类型"], "skipped":[{"path","reason"}]}`。

- 每项独立失败，不整体失败；`paths` 最多 100 项。
- 非文件、扩展名不匹配、越界、不可读都转成中文原因。

### 2.4 `POST /api/nas/folder`

```json
{"folder": "/abs/dir", "operation": "pdf_compress"}
```

递归（默认），BFS，按名称排序，最多加入 100 个匹配文件、最多检查 10000 个目录项；跳过点号项与越界软链。

响应 `{"added":[...], "errors":[...], "summary":{"matched":12,"examined":40,"truncated":false,"folders":3}}`。

- 目录内没有匹配文件：`added:[]`，`errors:["所选文件夹及其子文件夹中没有 PDF 文件"]`（用处理方式的扩展名列表生成）。
- 截断时给出“一次最多 100 个文件”的说明。

### 2.5 `POST /api/nas/permission`

```json
{"path": "/abs/dir", "mode": "r"}
```

响应：

```json
{
  "path": "/abs/dir", "exists": true, "kind": "directory",
  "readable": false, "writable": false, "mode": "0755", "owner": "1000:1000",
  "hints": ["轻页以独立应用账号运行，只读取飞牛明确授权给轻页的目录。",
            "在轻页的 NAS 选择弹窗里点「重新授权此文件夹」，飞牛授权完成后立即可用，无需重启应用。",
            "仍失败时打开飞牛应用设置 → 目录授权，重新选择该目录；系统会自动为轻页账号授予 ACL。",
            "如果目录刚被移动、改名或所在存储空间已卸载，请选择新的路径。"]
}
```

- 不得抛错，`exists:false` 也返回 200。
- `mode` 由 `0o7777 & st.mode` 转 4 位八进制字符串；`owner` 为 `uid:gid`。
- 目录的可读判定必须用 `R_OK | X_OK`（遍历目录需要执行位）；文件用 `R_OK`。写判定统一 `W_OK`。
- **不要**在文案里要求用户勾选 POSIX/Windows 继承、也不要求重启应用：官方文档明确 ACL 由系统自动授予，授权结果由选择器/授权接口即时返回。

### 2.5b `POST /api/nas/grant`（授权后即时生效）

```json
{"path": "/vol1/1000/新目录"}
```

- 前端在 `authorizeSharedFile(path)` / `pickSharedFile()` 成功后调用。
- 服务端校验：绝对路径 → `realpath` → 必须为已存在目录 → 不属于受保护目录 → 以应用账号 `R_OK|X_OK` 可读。通过后加入进程内 `allowed` 集合并写入 `{stateDir}/granted-roots.json`（mode 0600，最多 100 条），随后启动时逐个 `realpath` 校验，失效的丢弃并计入 `missingRoots`。
- 响应 `{"path": "/real/path", "roots": [{"path","name","writable","shared"}]}`；校验失败 `403 {code:"GRANT_DENIED", hints:[...]}`（说明授权未真正落到应用账号，需要重新授权）。
- 目的：解决“授权后必须重启应用才能看到新目录”的体验问题，同时不放宽任何权限（仍以应用账号实际可读为准）。

### 2.5c 父目录可读、文件不可读（ACL 未覆盖子文件）

飞牛共享目录使用 Windows ACL 模型：用户授权的目录由系统给应用账号授予 ACE，但**子项上的显式 ACE 或关闭的继承不会被回填**，历史文件也可能本就属于别的应用账号。结果就是：

- 目录可遍历（`r-x` 或 ACE 允许），列表能读出来；
- 单个文件是 `0600/0640` 或带显式 ACE，应用账号没有读位 → 只有该文件不可读。

服务端必须把这两种情况区分开，不能笼统说“没有权限”：

1. `entries[].mode` / `entries[].owner`：返回 `mode`（4 位八进制）与 `owner`（`uid:gid`），供用户判断是不是「属主另有其人 / 0600」。
2. 文件不可读 → `disabledReason: "没有读取权限（文件权限未包含轻页账号）"`；目录不可读 → `"没有读取权限（文件夹）"`。
3. `/api/nas/permission` 在目标是**目录且可读**时，追加 `children` 摘要（最多扫描 200 项）：

```json
{
  "children": {
    "scanned": 12, "readable": 8, "blocked": 4, "truncated": false,
    "owners": [{"owner": "1000:1000", "count": 12}],
    "modes": [{"mode": "0600", "count": 4}, {"mode": "0644", "count": 8}],
    "samples": [{"name": "光.mp3", "mode": "0600", "owner": "1000:1000", "readable": false}]
  },
  "hints": [ … 文件级 hints，见下 … ]
}
```

4. 目录可读但存在 blocked 子文件时，`hints` 使用**文件级指引**（不是“重新授权整个目录”）：

```
- 文件夹本身可读，但这些文件的权限没有包含轻页账号（常见于 0600 或属主为其他应用账号的历史文件）。
- 飞牛的文件管理器 → 选中这些文件/上级文件夹 → 详细信息 → 权限 → 高级：把权限应用到此文件夹、子文件夹和文件（或对该文件夹执行“重置子级权限”），再回到轻页刷新。
- 也可以把它们复制/移动到 qingye/files 共享目录，共享目录由飞牛自动授权给轻页，复制后的新文件会继承目录权限。
- 如果确认上级目录已经授权仍然不行，请在弹窗内点「重新授权此文件夹」；授权只覆盖该目录的 ACE，不会重写子文件的显式权限。
```

5. 前端不得把这些步骤写成“重新授权就能修好”——重新授权只作用于目录 ACE。

### 2.6 上传

保持现有 4 个端点与校验语义不变：`/api/upload-start`、`/api/upload-chunk`、`/api/upload-finish`、`/api/upload-cancel`，以及兼容用的单请求 `/api/upload`。

- 上传目录：`{share}/上传文件/{uid}`；分片 512 KiB；冲突加 ` (n)` 后缀；临时文件 `.upload-<id>`，mode 0600。
- 上传目录本身若是越界软链：403 且不创建任何目录。

### 2.7 任务

`/api/jobs`、`/api/job`、`/api/history`、`/api/retry`、`/api/cancel`、`/api/download` 语义与现状一致：按 owner 隔离；下载只允许本次任务输出。

## 2.8 视频硬件加速（video_convert 专用）

目标：i5-6500（HD 530 / Skylake）等 Intel 核显走 VAAPI 硬解+硬编，无 GPU 或驱动缺失时**自动回退 CPU**，行为绝不劣化。

事实基础（已实测）：
- 内置 Debian 12 ffmpeg 5.1.9 自带 `h264_vaapi`/`hevc_vaapi` 编码器与 `libmfx`/`libva-drm` 运行库；
- 唯一缺的是 Intel VA 用户态驱动（`i965_drv_video.so` / `iHD_drv_video.so`），由打包补入；
- 应用账号需要 `join-groups: ["video","render"]` 才能访问 `/dev/dri/renderD128`（官方 privilege 文档模式）。

### 探测（src/hwaccel.mjs，带缓存）

- Linux：按序找第一个存在的 `/dev/dri/renderD*`，运行 0.5 秒 `testsrc2` 试编码：
  `ffmpeg -v error -vaapi_device <dev> -f lavfi -i testsrc2=duration=0.5:size=256x144:rate=12 -vf format=nv12,hwupload -c:v h264_vaapi -f null -`
  退出码 0 → `{backend:'vaapi', device}`。macOS：试 `h264_videotoolbox`。
- 结果按 `binary+mtime+device` 缓存在模块内；探测失败也缓存（带原因），避免每个任务重复探测。
- 探测是纯运行时行为，容器/CI 无 GPU 时必须优雅返回 null——这本身就是一条测试。

### 编码参数（纯函数 buildVideoArgs，可单测）

- 软件路径（现状不变）：`libx264 -preset medium -crf {20|25|30} -vf scale=-2:trunc(min(ih\,H)/2)*2`。
- VAAPI 路径（1.2.13.3 起：CPU 解码/缩放 + GPU 编码）：
  `-init_hw_device vaapi=va:<dev> -filter_hw_device va -i 输入 -vf 'scale=-2:trunc(min(ih\,H)/2)*2,format=nv12,hwupload' -c:v h264_vaapi -qp {20|25|30} -c:a aac -b:a 128k -movflags +faststart`
  只用 VAAPI 做**编码**：`hwupload` 把 CPU 帧上传给 `h264_vaapi`。原因与约束：
  - 不用 `scale_vaapi`（走 VPP 管线）：部分 Intel 驱动/代际会报 `the requested VAProfile is not supported`，整条命令失败；
  - 不用 `-hwaccel vaapi` 硬解：硬解输出的 vaapi 帧无法再做 CPU 缩放，且解码 profile 不受支持时同样整条失败；
  - 设备必须 `-init_hw_device` 命名并由 `-filter_hw_device` 交给滤镜图，否则 `hwupload` 无设备可用；
  - ffmpeg 只认下划线选项名（`-hwaccel_output_format`），写成短横线会直接 `Unrecognized option`（1.2.13.1 的真实缺陷）。
  探测命令必须与生产**完全同构**（同样 init/filter 设备 + 软件缩放 + hwupload + h264_vaapi），否则“显示可用”不代表真实转换可用。
  缩放表达式里的逗号必须转义：滤镜图用逗号分隔过滤器，`min(ih,720)` 在参数里要写成 `min(ih\,720)`（JS 源码里是 `\\,`）。
  生产与探测必须共用同一个表达式生成函数——1.2.13.3 的探测就是漏了这层转义，才会报 `Missing ')' or too many args in 'min(ih'`。
- 画质数值沿用三档（清晰 20 / 均衡 25 / 体积 30）；硬件 QP 与 x264 CRF 体积略有差异，属预期。
- 音频转换（audio_convert）不走硬件，保持现状。

### 选项

- `catalog.validateOptions` 的 `video_convert` 新增 `options.hw: 'auto'|'off'`，默认 `'auto'`；非法值报错。
- 桌面 `toolbox-ui.mjs` 与飞牛 `app.mjs` 的视频选项各加一个下拉「硬件加速：自动 / 关闭」，附注“无核显时自动用 CPU”。
- 执行顺序：`hw!=='off'` 且探测成功 → 先硬件；进程失败 → `console.log` 记录 + 进度提示「硬件加速不可用，已改用 CPU 重新转换…」→ 软件重跑一次；`hw==='off'` 或探测失败 → 直接软件。
- 硬件执行时进度 stage 前缀「硬件加速（VAAPI）」。

### 设置与界面

- `/api/settings` 增加 `hardware: {available:boolean, backend?:'vaapi', device?:'/dev/dri/renderD128', reason?:string}`（用内置 ffmpeg 探测，结果缓存）。
- 飞牛「组件与目录」页与桌面「组件与 AI」页显示一行：`视频硬件加速：可用（VAAPI · /dev/dri/renderD128）` 或 `不可用（原因）`。

### 打包

- Dockerfile 增装 `i965-va-driver`（Skylake–IceLake 一系）与 `intel-media-va-driver`（更新的核显）。
- `assemble-runtime.mjs` 把 `/usr/lib/x86_64-linux-gnu/dri/*.so` 复制进 `runtime/lib/dri/`，ffmpeg 包装脚本导出 `LIBVA_DRIVERS_PATH="$rt/lib/dri"`。
- `config/privilege` 增加 `"join-groups": ["video","render"]`。
- 真实 GPU 只能在目标 NAS 上验证；容器验证只覆盖“无 GPU 时回退软件”路径。

## 2.9 本机 Web 入口（仅回环）

飞牛桌面永远走统一网关；额外开一个只绑回环的入口，供 SSH 隧道或 NAS 上的 nginx 反代使用。

- `fnos/web-entry.mjs`：`startWebEntry({socketPath, host='127.0.0.1', port=32181, uid='1000', username='web', prefix='/app/qingye'})`
  - `host` 必须是 `127.0.0.1` / `::1` / `localhost`，否则抛错（不允许监听局域网）；
  - 客户端传入的所有 `x-trim-*` 头**一律删除**，身份由代理注入（`x-trim-userid`、`x-trim-isadmin: true`、`x-trim-username`），杜绝伪造管理员；
  - 其余鉴权（POST 的 `x-qingye-request: 1`、owner 隔离、路径/ACL 校验）全部沿用内部服务，代理不做额外放行。
- 启动：`cmd/main` 拉起服务后，`server.mjs` 在同一进程内 `startWebEntry`，默认 `127.0.0.1:32181`；`QINGYE_WEB=0` 关闭、`QINGYE_WEB_PORT` 改端口、`QINGYE_WEB_UID` 指定归属用户。
- `/api/settings` 增加 `web:{url, loopback:true}`（未启用为 `null`）；「组件与目录」页显示 `本机 Web 入口：http://127.0.0.1:32181/app/qingye/（仅本机回环，需 SSH 隧道或反向代理）`。
- 不声明 `manifest.service_port`（该监听不对外），也不改 `ui/config` 的网关入口。
- 访问方式：
  - SSH 隧道：`ssh -L 32181:127.0.0.1:32181 用户@NAS_IP`，本机开 `http://127.0.0.1:32181/app/qingye/`；
  - nginx 反代（在 NAS 上）：`location /qingye/ { proxy_pass http://127.0.0.1:32181/app/qingye/; proxy_set_header Host $host; }`，并由 nginx 侧做飞牛登录/密码保护。
- 测试：起真实 socket + `startWebEntry(port:0)`，断言页面 200、伪造头被忽略（`settings.user.uid` 为注入值）、无身份头直连 socket 仍 403、POST 仍需请求标记。

## 3. 页面与静态资源

- `GET /`：返回 `fnos/web/index.html`（`<html lang="zh-CN">`，`<link rel="stylesheet" href="app.css?v=1.2.13.0">`，`<script defer src="app.js?v=1.2.13.0"></script>`）。
- 资源：只暴露页面真正引用的三个：`/app/qingye/app.js`（构建产物 `fnos/web/app.bundle.js`，`text/javascript; charset=utf-8`）、`/app/qingye/app.css`（`fnos/web/app.css`）、`/app/qingye/styles.css`（`src/styles.css`）。`catalog.mjs`、`bridge.js`、`app.mjs` 等在构建期已打进 `app.js`，不再单独下发（请求返回 404）；旧的 `nas.css` 已删除。
- CSP：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'`（不再需要内联脚本 hash）。
- 响应头：`X-Content-Type-Options: nosniff`、`Referrer-Policy: same-origin`、`Cache-Control: no-store`。

## 4. 前端结构（`fnos/web/`）

- `index.html`：轻页飞牛版页面骨架，只引用 `styles.css`（跨端基础样式）、`app.css`（飞牛版样式）、`app.js`（构建产物）。
- `app.mjs`：**飞牛版专用 UI**，不修改 `src/toolbox-ui.mjs`（桌面端继续使用它）。
- `bridge.js`：飞牛版 API 适配层（`window.qingye`），只暴露 UI 需要的方法。
- `entry.js`：`import './bridge.js'; import './app.mjs';`
- `build-client.mjs`：esbuild 打包 `fnos/web/entry.js` → `fnos/web/app.bundle.js`（iife，es2020，utf8）。保留 `try/catch` 包裹与 `</script` 转义。

页面结构要求：

1. 顶栏：标题（当前分组）+ 版本角标 `飞牛独立版 1.2.13.0`（值来自 `/api/settings`）。
2. 分组导航：PDF 工具 / 办公文档 / 图片处理 / 音频转换 / 视频转换 / 组件与目录（保留现有分组语义）。
3. 主卡片 dropzone 内**只有两个按钮**：`#pick-nas`「从 NAS 上选择」、`#upload-pc`「上传电脑文件」。不得出现“授权目录”“从 NAS 文件夹批量添加”“选择文件”等其他按钮。
4. 文件队列：名称、来源（NAS 相对路径 / 电脑上传）、大小、类型徽标、处理状态、打开位置、上移/下移/移除。
5. 底部：保存位置、开始处理、取消。

## 5. NAS 选择弹窗（唯一入口，同时支持文件与文件夹）

标题：`从 NAS 上选择`。结构：

```
[路径面包屑：qingye/files / sub / ...]  [上一级]  [仅显示匹配项 ☑]
[搜索框：筛选文件名]
[条目列表]
  📁 合同        文件夹 · 3 个匹配
  📄 a.pdf       12.3 MB · 2025-01-02 12:00 · 匹配
  📄 b.txt       1.2 KB · 不匹配当前处理方式（置灰、不可选）
  ⚠ c.pdf       没有读取权限（置灰 + 原因）
[状态栏：已选 3 个文件 · 当前目录 12 个匹配]
[底部： 加入当前文件夹 | 检查目录权限 | 取消 | 添加所选文件]
```

- 单击文件夹进入；复选框多选文件；`加入当前文件夹` 调用 `/api/nas/folder`（在根目录时禁用）。
- 已选集合跨目录保留，状态栏显示总数；`添加所选文件` 调用 `/api/nas/select`。
- 条目必须显示类型（文件夹/扩展名）、大小、修改时间、是否匹配；不可用条目显示原因。
- 单击不可用条目（行本身，非复选框）→ 调 `/api/nas/permission` 显示该条目的 `mode`/`owner`/原因/hints，直接回答“为什么这个文件不行”。目录可读但存在 blocked 子文件时展示 `children` 分布（`0600` 几个、属主是谁）。
- 授权根为主页；面包屑可回根；`检查目录权限` 调用 `/api/nas/permission` 并把 `hints` 逐条展示，同时提供「打开应用设置」链接（`TrimApp.openAppSetting()`，失败时只提示）。
- 权限类 403/`NO_READ` 时，把 `hints` 直接展示在弹窗内，不弹 alert。
- 弹窗在 1280×620 与 1024×600 下必须完整可见，底部按钮不被裁切。

## 6. 文件显示要求

- 文件名完整显示（可换行，不省略到无法分辨）；超长路径用 `title` 且可横向滚动。
- 不隐藏不可用条目，只置灰并给原因。
- 空目录、无匹配、无权限、越界链接分别有独立文案。
- 队列中的 NAS 文件显示相对授权根的路径（如 `sub/a.pdf`），电脑上传显示 `上传文件/1000/a.pdf`。

## 7. 测试

`fnos/tests/server.test.mjs` 必须覆盖：
1. 失效授权根不阻断启动（`missingRoots`）。
2. 列表不丢弃无权限/越界软链条目，`disabled` 与 `disabledReason` 正确。
3. 目录排序、点号项隐藏、`counts` 正确。
4. 文件选择与文件夹批量（含无匹配文案、100 上限、截断标记）。
5. 权限诊断返回中文 hints。
6. 上传四端点、任务历史、重试、下载、owner 隔离、停止取消（沿用现有断言，按新路由名调整）。
7. 页面 CSP、静态资源、`app.js` 可访问。

`fnos/tests/browser.mjs` 必须覆盖：两个按钮存在且只有两个；NAS 弹窗文件多选 → 队列 → 处理 → 下载；文件夹加入；上传电脑文件；不可用条目显示原因；弹窗底部按钮在 620px 高度内完整可见。

运行：
```sh
node --test tests/*.test.mjs                # 桌面/引擎回归
node --test fnos/tests/server.test.mjs      # 飞牛后端
QINGYE_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node fnos/tests/browser.mjs
```
