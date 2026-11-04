# 轻页文件工具箱 · 飞牛独立版 API 文档

- 版本：`1.2.13.5`
- 生成日期：2026-11-04
- 适用包：`Qingye-Toolbox-1.2.13.5-fnos-x86.fpk`（fnOS 1.2.0401+，x86-64）
- 对应实现：`fnos/server.mjs`、`fnos/web-entry.mjs`、`fnos/local-mcp.mjs`、`src/catalog.mjs`、`src/jobs.mjs`

本文件只描述**对外可调用的接口**：应用 HTTP API（网关 `/app/qingye`）、本机回环 Web 入口、本机 MCP。界面内部实现（DOM、对话框）不在范围内。

---

## 1. 访问方式

| 方式 | 地址 | 鉴权 | 用途 |
|---|---|---|---|
| 飞牛统一网关 | `https://<NAS>/app/qingye/` | 飞牛会话，网关转发 `X-Trim-*` 头 | 桌面/iframe 打开，浏览器正常使用 |
| 本机 Web 入口 | `http://127.0.0.1:32181/app/qingye/` | 仅回环；代理注入固定身份 | SSH 隧道 / nginx 反代后用普通浏览器访问 |
| 本机 MCP | `http://127.0.0.1:32180/mcp`（Streamable HTTP） | 仅回环，无额外鉴权 | NAS 上的智能体/脚本调用 |
| 应用 Socket | `<TRIM_APPDEST>/app.sock`（Unix Socket） | 必须自带 `X-Trim-*` 头 | 网关内部转发，不建议直接使用 |

> 三个入口共享同一份授权目录、同一任务队列（同一时刻只执行一个任务）。文件范围始终受飞牛授权目录 ACL 限制，任何入口都不会放宽。

### 1.1 认证（HTTP API）

所有 HTTP API 请求必须带：

```http
X-Trim-Userid: 1000        # 数字，飞牛用户 ID
X-Trim-Isadmin: true       # 仅管理员可用（首版限制）
```

- 缺少或非管理员：`403 AUTH_REQUIRED`。
- 所有 `POST` 还必须带 `X-Qingye-Request: 1`，否则 `403 BAD_REQUEST_MARKER`（防跨站简单请求）。
- 若带 `Origin`，必须是可解析的 `http(s)` URL，否则 `403 BAD_ORIGIN`。
- 不要信任客户端自报的身份：走网关时由飞牛注入；走本机 Web 入口时由代理丢弃客户端 `X-Trim-*` 后注入。

### 1.2 通用约定

- 前缀：`/app/qingye`；JSON 一律 UTF-8，响应 `Cache-Control: no-store`。
- 请求体上限 64 KiB（上传除外）；上传分块上限 512 KiB。
- 错误统一格式：

```json
{
  "error": "轻页无法读取此文件夹：陈粒",
  "code": "NO_READ",
  "hints": ["轻页以独立应用账号运行…", "在 NAS 选择弹窗里点「重新授权此文件夹」…"]
}
```

`hints` 是可执行的中文步骤，界面直接逐条展示；调用方可原样透传给用户。

---

## 2. 错误码

| code | HTTP | 含义 |
|---|---|---|
| `AUTH_REQUIRED` | 403 | 缺少飞牛身份头，或非管理员 |
| `BAD_ORIGIN` | 403 | `Origin` 不是合法 http(s) URL |
| `BAD_REQUEST_MARKER` | 403 | POST 缺少 `X-Qingye-Request: 1` |
| `INVALID_JSON` / `BODY_TOO_LARGE` | 400 / 413 | 请求体不是 JSON / 超过 64 KiB |
| `INVALID_PATH` | 400 | 缺少绝对路径 |
| `NOT_FOUND` | 404 | 文件/目录不存在（附处理建议） |
| `NO_READ` | 403 | 应用账号无读取权限（目录用 `R_OK\|X_OK`，文件用 `R_OK`） |
| `NO_WRITE` | 403 | 输出目录不可写 |
| `OUTSIDE_ROOT` | 403 | 路径不在授权目录内 |
| `PROTECTED_PATH` | 403 | 属于应用内部目录（数据/程序/配置） |
| `SYMLINK_LOOP` | 400 | 符号链接循环 |
| `PATH_ERROR` | 400 | 其它路径错误（stat/realpath 失败） |
| `NOT_DIRECTORY` / `NOT_FILE` | 400 | 类型不符 |
| `TOO_MANY` | 413 | 单目录子项超过 10000 |
| `INVALID_OPERATION` | 400 | 处理方式不存在 |
| `INVALID_SELECTION` | 400 | 选择项超过 100 或格式错误 |
| `UNSUPPORTED_TYPE` / `UNSUPPORTED_UPLOAD` | 400 | 扩展名与当前处理方式不符 |
| `GRANT_DENIED` | 403 | 授权后应用账号仍不可读（授权未真正落到 ACL） |
| `UPLOAD_SESSION` | 404 | 上传会话不存在/过期/不属于当前用户 |
| `INVALID_UPLOAD` / `INVALID_CHUNK` / `UPLOAD_INCOMPLETE` | 400 | 上传参数/分块/未传完 |
| `UPLOAD_TOO_LARGE` / `CHUNK_TOO_LARGE` | 413 | 超过单文件上限 / 分块过大 |
| `EMPTY_FILE` | 400 | 上传内容为空 |
| `JOB_REJECTED` | 400 | 任务校验失败（已有任务在执行、输入/输出参数不合法等） |
| `JOB_NOT_FOUND` | 404 | 任务不存在或不属于当前用户 |
| `NOT_TASK_OUTPUT` | 403 | 下载的不是本任务输出 |
| `CLOSING` | 503 | 应用正在停止 |
| `INTERNAL` | 500 | 未预期异常（详情写 `app.log`） |

---

## 3. 数据模型

### 3.1 Entry（目录条目）

```json
{
  "name": "合同",
  "path": "/vol1/1000/qingye/files/合同",
  "kind": "dir",
  "size": 0,
  "mtime": "2026-11-03T08:12:00.000Z",
  "extension": "",
  "mode": "0755",
  "owner": "1000:1000",
  "matches": false,
  "readable": true,
  "writable": false,
  "disabled": false,
  "disabledReason": null,
  "note": null,
  "root": true,
  "shared": true
}
```

- `kind`：`dir` / `file` / `other`。
- `matches`：扩展名是否属于当前 `operation`；目录恒为 `false`。
- `disabled` + `disabledReason`：不可选及原因（`没有读取权限（文件夹）`、`没有读取权限（文件权限未包含轻页账号）`、`链接指向授权目录之外`、`链接已失效（目标不存在）`、`符号链接循环，无法访问`、`不是普通文件或文件夹`）。
- `root` / `shared`：仅根列表条目出现。
- 名称中的控制字符与双向控制符会替换为 `�`；`path` 保留原始值。

### 3.2 Job（任务）

```json
{
  "id": "9b1f…uuid",
  "owner": "1000",
  "operation": "video_convert",
  "inputs": ["/abs/in.mp4"],
  "outputDir": "/abs/out",
  "options": {"preset": "balanced", "maxHeight": 1080, "hw": "auto"},
  "status": "running",
  "percent": 42,
  "stage": "硬件加速（VAAPI）已处理 12 秒…",
  "results": [
    {
      "inputs": ["/abs/in.mp4"],
      "status": "running",
      "outputs": [],
      "before": 0,
      "after": 0
    }
  ],
  "createdAt": 1762300000000,
  "finishedAt": 1762300060000
}
```

- `status`：`running` / `completed` / `completed_with_errors` / `cancelled` / `interrupted` / `failed`。
- `results[].status`：`running` / `done` / `failed` / `cancelled`；`done` 时带 `outputs[]`、`before`、`after`、`reduced`；失败时带 `error`。
- `percent` 由后端推进；硬件回退时可能回到 0（真实状态，不要做单调修正）。
- 历史保留最近 100 条；应用重启时未完成任务标记 `interrupted`。

### 3.3 处理方式（operation）

| operation | 扩展名 | 说明 |
|---|---|---|
| `pdf_compress` | pdf | 三档压缩，可选 `targetMB` |
| `pdf_merge` | pdf | 按顺序合并（≥2 个文件） |
| `pdf_split` | pdf | 提取页码，如 `1-3,5` |
| `pdf_to_images` | pdf | 转 PNG/JPG，`maxDimension` |
| `images_to_pdf` | jpg/jpeg/png/webp | 多图合并 |
| `image_convert` | jpg/jpeg/png/webp | 转换/缩放，`format`、`maxDimension` |
| `office_to_pdf` | doc/docx/xls/xlsx/ppt/pptx | 需办公组件 |
| `audio_convert` | mp3/wav/flac/m4a/aac/ogg/opus/mp4/mov/mkv/avi/webm | 转换或提取音轨 |
| `video_convert` | mp4/mov/mkv/avi/webm/m4v | 转 MP4/压缩，`maxHeight`、`hw` |

`options` 字段按操作校验（`src/catalog.mjs`）：`preset` ∈ `clear|balanced|small`；`targetMB` 0.1–500；`format` 见上；`maxDimension` 64–8000；`maxHeight` ∈ `480|720|1080|2160`；`pages` 形如 `1-3,5`；`hw` ∈ `auto|off`（默认 `auto`，`off` 绝不使用 GPU）。

---

## 4. HTTP API

所有路径省略前缀 `/app/qingye`。

### 4.1 `GET /api/settings`

返回应用状态与授权目录。

```json
{
  "version": "1.2.13.4",
  "label": "飞牛独立版",
  "user": {"uid": "1000"},
  "roots": [{"path": "/vol1/1000/qingye/files", "name": "qingye/files", "writable": true, "shared": true}],
  "sharedDirectory": "/vol1/1000/qingye/files",
  "defaultOutput": "/vol1/1000/qingye/files",
  "missingRoots": [],
  "components": {"media": "/path/to/ffmpeg", "office": "/path/to/soffice"},
  "hardware": {"available": true, "backend": "vaapi", "device": "/dev/dri/renderD128"},
  "web": {"url": "http://127.0.0.1:32181/app/qingye/", "loopback": true},
  "config": {"json": "{\"mcp\":{...}}"}
}
```

- `missingRoots`：启动时解析失败的授权目录（不阻断启动，仅供提示）。
- `hardware`：不可用时为 `{"available": false, "reason": "…"}`（不含 `backend`/`device`）。
- `web`：本机 Web 入口未启用时为 `null`。

```sh
curl -s http://127.0.0.1:32181/app/qingye/api/settings | jq
```

### 4.2 `GET /api/nas/list?path=<绝对路径>&operation=<op>`

- 不带 `path`：返回授权根列表（每个根为 `kind:"dir"`、`root:true`）。
- 带 `path`：返回该目录内容。目录本身不可读 → `403 NO_READ`；子项不可读**不丢弃**，以 `disabled` 呈现。

```json
{
  "path": "/vol1/1000/qingye/files/音乐",
  "name": "音乐",
  "parent": "/vol1/1000/qingye/files",
  "root": "/vol1/1000/qingye/files",
  "operation": "video_convert",
  "extensions": ["mp4","mov","mkv","avi","webm","m4v"],
  "permissions": {"read": true, "write": false},
  "counts": {"directories": 2, "files": 7, "matched": 3, "hidden": 1, "blocked": 1},
  "entries": [ /* Entry[] */ ],
  "warnings": ["1 个项目不可用（没有读取权限或链接越界），已在列表中标注原因"]
}
```

- 点号开头项目不返回，只计入 `counts.hidden`。
- `entries` 最多 5000 条（截断并给 `warnings`）；单目录超过 10000 子项 → `413 TOO_MANY`。
- 排序：目录在前，按 `localeCompare('zh-CN')`。

### 4.3 `POST /api/nas/select`

校验并确认文件可加入任务（不触发处理）。

```json
{"paths": ["/abs/a.mp4", "/abs/b.txt"], "operation": "video_convert"}
```

```json
{
  "added": [{"path": "/abs/a.mp4", "name": "a.mp4", "size": 1048576}],
  "errors": ["b.txt：不支持此文件类型（当前处理方式只接受 MP4、MOV、MKV、AVI、WEBM、M4V）"],
  "skipped": [{"path": "/abs/b.txt", "reason": "不支持此文件类型", "code": "UNSUPPORTED_TYPE"}]
}
```

- 每项独立失败，整体仍 200；`paths` 最多 100。

### 4.4 `POST /api/nas/folder`

递归加入一个文件夹中符合当前处理方式的文件。

```json
{"folder": "/abs/音乐", "operation": "audio_convert"}
```

```json
{
  "added": [{"path": "/abs/音乐/光.mp3", "name": "光.mp3", "size": 5662310}],
  "errors": [],
  "summary": {"matched": 12, "examined": 40, "truncated": false, "folders": 3}
}
```

- 最多加入 100 个、检查 10000 个目录项，超出置 `summary.truncated=true` 并追加说明。
- 无匹配文件时返回空 `added` 并给一条中文说明。
- 点号项与越界软链跳过。

### 4.5 `POST /api/nas/permission`

权限诊断，**永不返回错误状态**（`exists:false` 也是 200）。

```json
{"path": "/abs/音乐", "mode": "r"}
```

```json
{
  "path": "/abs/音乐",
  "exists": true,
  "kind": "directory",
  "readable": true,
  "writable": false,
  "mode": "0755",
  "owner": "1000:1000",
  "insideGrant": true,
  "children": {
    "scanned": 12, "readable": 8, "blocked": 4, "truncated": false,
    "owners": [{"owner": "1000:1000", "count": 12}],
    "modes": [{"mode": "0600", "count": 4}, {"mode": "0644", "count": 8}],
    "samples": [{"name": "光.mp3", "mode": "0600", "owner": "1000:1000", "readable": false}]
  },
  "hints": ["文件夹本身可读，但这些文件的权限没有包含轻页账号…"]
}
```

- `children` 仅在目标为**可读目录**时出现：扫描最多 200 项，`samples` 最多 10 个。
- `hints` 分四类：越界、目录不可读、文件不可读、可写但无写权限；目录可读但子文件不可读时给「文件级」指引。

### 4.6 `POST /api/nas/grant`

飞牛授权成功后登记目录，使其**立即**可用（无需重启）。

```json
{"path": "/vol1/1000/音乐"}
```

```json
{"path": "/vol1/1000/音乐", "roots": [{"path": "…", "name": "音乐", "writable": false, "shared": false}]}
```

- 服务端以应用账号实际校验 `R_OK|X_OK`，通过才并入授权集并持久化到 `{应用数据}/granted-roots.json`（0600，最多 100 条，启动时逐条复核）。
- 校验失败：`403 GRANT_DENIED` + `hints`。

### 4.7 上传（分片）

| 接口 | 说明 |
|---|---|
| `POST /api/upload-start` | `{id, operation, name, size}` → `{id, chunkSize: 524288}` |
| `POST /api/upload-chunk?id=<id>` | 请求体为二进制分块（≤512 KiB）→ `{received, size}` |
| `POST /api/upload-finish` | `{id}` → `{added:[{path,name,size}], errors:[]}` |
| `POST /api/upload-cancel` | `{id}` → `{ok:true}` |
| `GET /api/upload-status?id=<id>` | 上传记录（`status`: `receiving`/`saving`/`completed`/`failed`/`cancelled`） |
| `POST /api/upload?operation=<op>&name=<file>&id=<id>` | 兼容单请求上传（`Content-Length` 需准确） |

- 保存位置：`{共享目录}/上传文件/{uid}/`，重名自动加 ` (n)`；临时文件 `.upload-<id>`（0600）。
- 大小上限：音视频 20 GiB，其余 500 MiB；`id` 需匹配 `^[a-zA-Z0-9_-]{8,80}$`。

```sh
# 分片上传示例（id 由客户端生成）
curl -s -X POST http://127.0.0.1:32181/app/qingye/api/upload-start \
  -H 'X-Qingye-Request: 1' -H 'Content-Type: application/json' \
  -d '{"id":"demo-upload-0001","operation":"video_convert","name":"a.mp4","size":10485760}'
```

### 4.8 任务

| 接口 | 说明 |
|---|---|
| `POST /api/jobs` | 提交任务 → `{jobId}` |
| `GET /api/job?id=<id>` | 任务快照（按 owner 隔离，非本人 `404 JOB_NOT_FOUND`） |
| `GET /api/history` | 当前用户最近 100 条任务 |
| `POST /api/retry` | `{id}` 按原参数重试 → `{jobId}` |
| `POST /api/cancel` | `{id}` 取消 → 任务快照 |
| `GET /api/download?id=<id>&path=<输出文件>` | 下载本任务输出（`Content-Disposition: attachment`） |

`POST /api/jobs` 请求体：

```json
{
  "operation": "video_convert",
  "inputs": ["/abs/in.mp4"],
  "outputDir": "/abs/out",
  "options": {"preset": "balanced", "maxHeight": 1080, "hw": "auto"}
}
```

约束：

- `inputs` 1–100 个绝对路径；`pdf_merge` 至少 2 个；合并总输入 ≤500 MiB。
- `outputDir` 必须是已存在、位于授权目录内且可写的目录。
- 同一进程同时只执行 1 个任务；并发提交返回 `400 JOB_REJECTED`（文案「已有任务正在执行」）。
- 输入/输出参数不合法（相对路径、不存在的输出目录、空文件、超出大小等）同样返回 `400 JOB_REJECTED`，不会以 500 冒泡。
- 输出重名自动加 ` (n)`，原文件不覆盖。

```sh
JOB=$(curl -s -X POST http://127.0.0.1:32181/app/qingye/api/jobs \
  -H 'X-Qingye-Request: 1' -H 'Content-Type: application/json' \
  -d '{"operation":"pdf_compress","inputs":["/vol1/1000/qingye/files/a.pdf"],"outputDir":"/vol1/1000/qingye/files","options":{"preset":"balanced"}}' | jq -r .jobId)

curl -s "http://127.0.0.1:32181/app/qingye/api/job?id=$JOB" | jq '{status,percent,stage}'
```

### 4.9 静态资源

| 路径 | 内容 |
|---|---|
| `GET /app/qingye` | 302 → `/app/qingye/` |
| `GET /api` 之外仅 3 个资源：`/app.js`、`/app.css`、`/styles.css` | 前端构建产物与基础样式 |

其它路径一律 `404 NOT_FOUND`；`index.html` 缺失时 `503 PAGE_MISSING`。

CSP：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'`。

---

## 5. 本机 MCP（Streamable HTTP）

- 地址：`http://127.0.0.1:32180/mcp`，仅 `POST`，仅回环。
- 无额外鉴权（依赖回环 + 应用账号 ACL），不要映射到公网。
- 服务名 `qingye-toolbox`，版本随应用（当前 `1.2.13.5`）。

| 工具 | 入参 | 返回 |
|---|---|---|
| `capabilities` | — | `{operations, allowedDirectories, components}` |
| `submit_task` | `{operation, inputs[], outputDir, options?}` | `{jobId}` |
| `task_status` | `{jobId}` | Job 快照 |
| `cancel_task` | `{jobId}` | Job 快照 |

`submit_task.options` 与 HTTP 一致（含 `hw`）。提交后必须轮询 `task_status` 直到非 `running` 才能判断结果。

传输细节：无会话（每个 POST 独立处理），`initialize` 可选；响应为 **SSE 帧**，需要按
`data: ` 行取 JSON，而不是直接当裸 JSON 解析。

```sh
# 列出工具
curl -s -X POST http://127.0.0.1:32180/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 调用 submit_task（返回 jobId，需自行轮询 task_status）
curl -s -X POST http://127.0.0.1:32180/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"submit_task","arguments":{
        "operation":"pdf_compress",
        "inputs":["/vol1/1000/qingye/files/a.pdf"],
        "outputDir":"/vol1/1000/qingye/files",
        "options":{"preset":"balanced"}}}}'
```

---

## 6. 本机 Web 入口

- 默认开启，监听 `127.0.0.1:32181`，只做反向代理到应用 Socket。
- 环境变量：`QINGYE_WEB=0` 关闭；`QINGYE_WEB_PORT` 改端口；`QINGYE_WEB_UID` 指定注入的用户 ID（默认 `1000`，必须数字，否则入口停用）；`QINGYE_WEB_USERNAME` 注入用户名。
- 代理行为：丢弃客户端所有 `X-Trim-*`，注入 `X-Trim-Userid/Isadmin/Username`；因此它是「以应用身份访问」，不是「以当前浏览器用户身份访问」。
- 安全：回环端口对 NAS 上所有本地用户可见。只从飞牛桌面使用建议 `QINGYE_WEB=0`；用 nginx 反代时务必加登录/Basic 口令。

---

## 7. 限额一览

| 项 | 值 |
|---|---|
| 每批文件数 | 100 |
| 单文件上限 | 文档/图片 500 MiB；音视频 20 GiB |
| 合并任务总输入 | 500 MiB |
| 上传分块 | 512 KiB |
| 单目录子项上限 | 10000（列出最多 5000） |
| 文件夹批量 | 加入 100 个、扫描 10000 项 |
| 权限诊断子项扫描 | 200 项（样本 10） |
| 任务历史 | 100 条 |
| 即时授权目录 | 100 条 |
| 请求体 | 64 KiB |
| 并发任务 | 1（每进程） |

---

## 8. 变更记录

| 版本 | 接口变化 |
|---|---|
| 1.2.13.5 | 任务校验失败统一返回 `400 JOB_REJECTED`（此前会冒泡成 500） |
| 1.2.13.4 | 修复硬件探测滤镜转义；`hardware.reason` 更准确 |
| 1.2.13.3 | 硬件加速改为 CPU 解码/缩放 + GPU 编码（接口不变） |
| 1.2.13.2 | 修复 VAAPI 参数；新增本机回环 Web 入口（`settings.web`） |
| 1.2.13.1 | 视频选项新增 `hw`；`settings.hardware` |
| 1.2.13.0 | 新增 `/api/nas/*` 五个接口；上传与任务接口沿用；`/api/list`、`/api/select`、`/api/select-folder` 移除 |
