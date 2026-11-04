# 飞牛 fnOS 现行官方规范复核 · 轻页文件工具箱（本仓 fnos/ 包）

- 抓取时间：2026-11-03（文档站更新日志最新条目为 2026-07-31，`/llms.txt`、`/llms-full.txt` 与页面一致）
- 抓取方式：逐页 `web_fetch` developer.fnnas.com + `curl /llms.txt`、`/llms-full.txt` 全文交叉检索 + npm registry 查询
- 复核对象：`fnos/package/**`、`fnos/build-fpk.mjs`、`fnos/Dockerfile`、`fnos/README.md`、`node_modules/@trimjs/web-app`（0.5.0）
- 本文件只做规范复核结论，不改动任何代码或配置。
- 判定口径：**必须改** = 与现行官方文档冲突或会导致功能不可用；**建议改** = 官方推荐做法、当前写法可用但不最优；**已符合** = 与官方文档一致。

---

## 1. 官方事实清单（含来源与原文片段）

### 1.1 Manifest —— https://developer.fnnas.com/docs/core-concepts/manifest/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| M1 | `manifest` 放在应用包根目录，无扩展名，用于识别应用/展示/兼容性检查/准备运行环境 | "`manifest` 文件用于描述应用包。它放在应用包根目录下，没有文件扩展名。" |
| M2 | 基础字段：`appname`（唯一标识）、`version`、`display_name`、`desc`、`source`（第三方用 `thirdparty`） | "**`source`**：应用来源。第三方应用使用 `thirdparty`。" |
| M3 | `platform` 三值：`x86` / `arm` / `all`；`all` 仅用于包内无架构相关二进制 | "`all`：同时支持 x86 和 ARM 设备。仅当应用包不包含特定架构二进制时使用。" |
| M4 | 开发者字段 `maintainer`、`maintainer_url`、`distributor`、`distributor_url` | "**`distributor`**：发布者名称。如果与开发者不同，可单独填写。" |
| M5 | 兼容范围 `os_min_version`、`os_max_version`，且不得夸大 | "请根据实际测试过的版本设置这些字段，不要声明超过应用真实支持能力的范围。" |
| M6 | `ctl_stop` 控制应用中心是否显示启动/停止/运行状态 | "`true`：显示启动、停止和运行状态。`false`：隐藏这些控制项。" |
| M7 | `install_type` 空值=用户选存储位置，`root`=系统分区；`install_dep_apps` 用 `:` 分隔、`>` 表最低版本 | "空值：安装时由用户选择存储位置。" / "使用 `>` 声明最低版本，例如 `database>2.2.2:cache`。" |
| M8 | `desktop_uidir` 默认 `ui`；`desktop_applaunchname` 必须与 `{desktop_uidir}/config` 中的入口 ID 一致 | "该 ID 应与 `{desktop_uidir}/config` 中定义的入口一致。" |
| M9 | 端口：`service_port`、`checkport`（默认 `true`）；不监听固定端口可省略 `service_port` | "不监听固定端口的应用可以省略 `service_port`，或在适合的情况下设置 `checkport=false`。" |
| M10 | `disable_authorization_path`：`false` 显示授权目录设置，`true` 隐藏；只有不需要用户选目录时才用 `true` | "仅当应用不需要用户选择文件或目录访问权限时，才使用 `true`。" |
| M11 | `changelog` 在更新界面展示，需面向用户、简洁 | "更新说明应保持简洁，并面向用户表达。" |
| M12 | 官方最小示例（注意：示例中 `os_min_version=1.2.0`，`ctl_stop=false`，`checkport=false`） | 示例 `manifest` 代码块见该页「示例」节 |

### 1.2 环境变量 —— https://developer.fnnas.com/docs/core-concepts/environment-variables/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| E1 | 应用信息：`TRIM_APPNAME`、`TRIM_APPVER`、`TRIM_OLD_APPVER`、`TRIM_APP_STATUS`（`INSTALL/START/UPGRADE/UNINSTALL/STOP/CONFIG`） | "**`TRIM_APP_STATUS`**：当前操作，例如 `INSTALL`、`START`…" |
| E2 | 路径：`TRIM_APPDEST`（target）、`TRIM_PKGETC`、`TRIM_PKGVAR`、`TRIM_PKGTMP`、`TRIM_PKGHOME`、`TRIM_PKGMETA`、`TRIM_APPDEST_VOL` | "尽量使用这些变量，而不是在脚本中硬编码路径。" |
| E3 | 用户上下文：`TRIM_USERNAME`、`TRIM_GROUPNAME`、`TRIM_UID`、`TRIM_GID`、`TRIM_RUN_USERNAME`、`TRIM_RUN_GROUPNAME`、`TRIM_RUN_UID`、`TRIM_RUN_GID` | "`TRIM_USERNAME` 表示应用用户。`TRIM_RUN_USERNAME` 表示当前脚本的执行用户，在特权操作中可能不同。" |
| E4 | 网络/资源：`TRIM_SERVICE_PORT`；`TRIM_DATA_SHARE_PATHS`（resource 声明的共享路径，`:` 分隔）；`TRIM_DATA_ACCESSIBLE_PATHS`（用户授权的可访问路径，`:` 分隔） | "**`TRIM_DATA_ACCESSIBLE_PATHS`**：用户授权的可访问路径，多个路径使用 `:` 分隔。" |
| E5 | 共享目录也可通过软链访问 | "共享数据目录也可以通过 `/var/apps/myapp/share/` 下的软链访问。" |
| E6 | 拿到路径也必须自行校验权限 | "使用这些路径读写文件前，应用仍应验证文件权限。" |
| E7 | `TRIM_API_TOKEN`：调用开放 API 的认证 token | "**`TRIM_API_TOKEN`**：应用调用开放 API 时使用的认证 token" |
| E8 | 脚本失败前把用户可见错误写入 `TRIM_TEMP_LOGFILE` | "生命周期脚本失败时，请在以非零状态退出前，将清晰的错误信息写入 `TRIM_TEMP_LOGFILE`。" |
| E9 | 向导变量不带 `TRIM_` 前缀 | "这些变量不使用 `TRIM_` 前缀。" |

### 1.3 应用权限 —— https://developer.fnnas.com/docs/core-concepts/privilege/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| P1 | `config/privilege` 结构：`defaults.run-as`、`username`、`groupname`、可选 `join-groups` | "`run-as`：运行身份。使用 `package` 表示专用应用用户。" |
| P2 | 省略 `username`/`groupname` 时系统按 `manifest.appname` 生成 | "省略时，飞牛 fnOS 会根据 `manifest.appname` 生成。" |
| P3 | 默认用 `run-as=package`；root 仅用于生命周期特权准备，长期服务应降权 | "长期运行并对外提供访问的进程，应尽可能以非 root 用户运行。" / 降权示例 `runuser -u "$TRIM_USERNAME" -- …` |
| P4 | 应用默认无用户文件广泛访问权，两种授权方式 | "目录访问通常有两种方式：用户在应用设置中授权目录。应用在 `config/resource` 中声明共享数据目录。" |
| P5 | 数据默认留在应用目录 | "除非用户授权共享位置，否则应用数据应保存在应用目录内。" |

### 1.4 应用资源 —— https://developer.fnnas.com/docs/core-concepts/resource/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| R1 | 共享目录声明：`data-share.shares[].name`，可选 `permission{rw,ro}` | "**`name`**：共享路径名称。" / "**`rw`**：拥有读写权限的用户。" |
| R2 | 共享目录用 **Windows ACL**，不是 POSIX ACL，系统自动为应用运行用户授予 ACL | "这些目录使用 Windows ACL 权限模型，而不是 POSIX ACL。系统会自动为应用运行用户授予所需的 ACL 访问权限。" |
| R3 | 安装时自动创建声明的共享目录 | "安装应用时，飞牛 fnOS 会自动创建声明的共享目录。" |
| R4 | 通过 `TRIM_DATA_SHARE_PATHS` 或软链访问，示例 `/var/apps/myapp/share/documents` | "也可以通过 `/var/apps/myapp/share/` 下的软链访问对应目录，例如 `/var/apps/myapp/share/documents`。" |
| R5 | 命名建议：统一顶级目录 + 用途子目录 | "建议使用应用名称作为统一的顶级目录，例如 `myapp`，再按用途定义子目录，例如 `myapp/documents`。" |
| R6 | 只有其他应用/系统用户需要访问时才写 `permission` | "只有在其他应用或系统用户需要访问该共享目录时，才需要配置 `permission`" |
| R7 | 另有 `usr-local-linker`（bin/lib/etc）与 `docker-project`（compose）两类资源 | "只应暴露其他命令或应用确实需要使用的稳定接口。" |
| R8 | 该页**未**列出 `api-scope` 字段（`api-scope` 只在开放 API 文档中定义，见 A1） | — |

### 1.5 应用入口 —— https://developer.fnnas.com/docs/core-concepts/app-entry/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| A1 | 入口文件 `app/ui/config`（`desktop_uidir=ui` 时），定义在 `.url` 下，入口 ID 用 appname 前缀且稳定 | "入口定义在 `.url` 字段下。入口 ID 应保持稳定，并使用 `appname` 作为前缀，例如 `myapp.main`。" |
| A2 | 字段：`title`、`icon`（`{0}` 表尺寸）、`type`（`iframe`/`url`）、`protocol`（`http`/`https`/空串自适应）、`port`、`url`、`allUsers`、`fileTypes`、`noDisplay`、`control.accessPerm`（`editable`/`readonly`/`hidden`） | "`protocol`：`http`、`https`，或使用空字符串交给系统自适应处理。" |
| A3 | 仅管理员可见的入口建议 `allUsers=false` + `control.accessPerm=readonly` | "仅限管理员使用的应用，建议同时使用 `allUsers=false` 和 `control.accessPerm=readonly`。" |
| A4 | 文件打开方式会在 URL 后追加 `path` 查询参数，路径视为用户输入 | "用户通过该入口打开文件时，飞牛 fnOS 会在 URL 后追加 `path` 查询参数。" |
| A5 | 三种访问模型：端口服务 / CGI / 统一网关 | "**端口服务**：入口打开应用自己的服务端口…**CGI**…**统一网关**…" |

### 1.6 index.cgi —— https://developer.fnnas.com/docs/core-concepts/index-cgi/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| C1 | CGI 入口路径 `/cgi/ThirdParty/{appname}/index.cgi/`；`protocol`/`port` 被忽略；调用前校验 NAS 登录态 | "对于 CGI 入口，`protocol` 和 `port` 会被忽略。" |
| C2 | 不支持 WebSocket；常驻服务应走端口服务或统一网关 | "CGI 只处理普通 HTTP 请求，不支持 WebSocket。" |

### 1.7 统一网关 —— https://developer.fnnas.com/docs/core-concepts/gateway-registration/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| G1 | 请求先由 fnOS 校验，再转发到应用本地 Unix Socket | "发送到网关路径的请求会先由飞牛 fnOS 校验，再转发到应用本地 Unix Socket。" |
| G2 | `gatewayPrefix` 规则：`/app/{appname}` 或 `/app/{appname}/{customPath}`，稳定、URL 安全、避免点号 | "使用 `/app/{appname}` 或 `/app/{appname}/{customPath}`。…公开路径中避免使用点号。" |
| G3 | `gatewaySocket` 只填文件名，文件应位于应用 `target` 目录（可用 `${TRIM_APPDEST}`） | "只填写 Socket 文件名，例如 `app.sock`。Socket 文件应放在已安装应用的 `target` 目录下。" |
| G4 | 网关入口的 `protocol` 与 `port` 被忽略 | "统一网关入口由 `gatewayPrefix` 和 `gatewaySocket` 决定。`protocol` 和 `port` 会被忽略，不参与统一网关路由。" |
| G5 | 转发时带用户 Header：`X-Trim-Userid`、`X-Trim-Isadmin`、`X-Trim-Username` | "`X-Trim-Userid` 当前用户 UID `1000`；`X-Trim-Isadmin` `true`/`false`；`X-Trim-Username` `admin`" |
| G6 | 服务端不得信任客户端传入的用户 ID | "不要信任客户端传入的用户 ID。请使用飞牛 fnOS 转发的网关鉴权 Header。" |
| G7 | 网关只校验登录态，不负责业务权限；文件访问需防穿越 | "网关确认用户已登录。应用仍然需要负责自己的业务鉴权规则。" / "拒绝 `..` 目录穿越。" |
| G8 | 官方入口示例：`"url": "/app/myapp"`、`"protocol": ""`（无尾斜杠） | 见该页「入口配置」代码块 |

### 1.8 用户向导 —— https://developer.fnnas.com/docs/core-concepts/wizard/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| W1 | 四种向导：`wizard/install`、`wizard/upgrade`、`wizard/uninstall`、`wizard/config`（设置页可改） | "**`wizard/config`**：安装后从应用设置中显示。" |
| W2 | 结构：`stepTitle` + `items[]`；`field` 值成为同名环境变量 | "**`field`**：字段名。收集到的值会成为同名环境变量。" |
| W3 | 类型：`text`/`password`/`radio`/`checkbox`/`select`/`switch`/`tips` | 表格见该页「字段类型」 |
| W4 | `tips` 只需 `helpText` | `{"type": "tips", "helpText": "Review the configuration before continuing."}` |
| W5 | 校验：`required`、`min`/`max`、`len`、`pattern` | "**`pattern`**：正则表达式。" |
| W6 | 自定义字段用 `wizard_` 前缀，禁用 `TRIM_` | "自定义向导字段不要使用 `TRIM_` 前缀。该前缀保留给系统变量。" |

### 1.9 运行时环境 —— https://developer.fnnas.com/docs/core-concepts/runtime/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| T1 | 打包运行时通过 `manifest` 的 `install_dep_apps` 声明 | "请在 `manifest` 中通过 `install_dep_apps` 声明所需的运行时包。" |
| T2 | Node.js 用 `install_dep_apps=nodejs_v22`，并把 `/var/apps/nodejs_v22/target/bin` 加入 `PATH` | "`export PATH=/var/apps/nodejs_v22/target/bin:$PATH`" |
| T3 | 应用自身依赖放应用目录或专用虚拟环境 | "将应用自身依赖保存在应用目录或专用虚拟环境中。" |

### 1.10 图标 —— https://developer.fnnas.com/docs/core-concepts/icon/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| I1 | 包根目录必须有 `ICON.PNG`（64×64）与 `ICON_256.PNG`（256×256） | "应用包根目录需要包含两个图标文件：`ICON.PNG`：64 x 64 px；`ICON_256.PNG`：256 x 256 px" |
| I2 | 设计约束：PNG/JPG、sRGB、≤1024 KB、正方形、圆角矩形主体 | "文件大小：不超过 1024 KB…图标视觉主体应使用圆角矩形风格。" |
| I3 | 入口图标放 `app/ui/images/`，用 `icon_{0}.png` 引用，需同时提供 64/256 | "如果入口配置了 `images/icon_{0}.png`，对应的 `icon_64.png` 和 `icon_256.png` 都已放入 UI 目录。" |

### 1.11 fnpack —— https://developer.fnnas.com/docs/cli/fnpack/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| F1 | 现行版本 1.2.3，五个平台；`fnpack build` / `build --directory <path>` | "`fnpack` 会在生成 `.fpk` 前检查必要文件和基础格式。" |
| F2 | 打包前检查项：`manifest`、`config/privilege`、`config/resource`、`ICON.PNG`、`ICON_256.PNG`、`app/`、`cmd/`、`wizard/`，以及声明 `desktop_uidir` 时的 `app/{desktop_uidir}/` | 检查表见该页「打包检查」 |
| F3 | 标准包结构含 `app/ui/{config,images}`、`cmd/`（9 个脚本）、`config/{privilege,resource}`、`wizard/`、两个 ICON | 见该页「项目结构」 |

### 1.12 开发工具目录（确认「Web SDK / TrimApp」没有独立页面）

https://developer.fnnas.com/docs/category/开发工具/ —— 只收录 **fnpack** 与 **appcenter-cli** 两项。
`@trimjs/web-app`（TrimApp）官方文档位于「开放 API」栏目，不在「开发工具」：
- 调用方式 https://developer.fnnas.com/api/calling/
- 授权与文件 https://developer.fnnas.com/api/authorization/overview/ 、`shared-access`、`user-access`、`file-acl`、`path-convert`
- 页面能力 https://developer.fnnas.com/api/page/routing/ 、https://developer.fnnas.com/api/page/ui/
- 平台配置 https://developer.fnnas.com/api/platform-config/ 、错误码 https://developer.fnnas.com/api/error-codes/

### 1.13 调用方式（API Scope / micro_app / JS SDK / 后端 API） —— https://developer.fnnas.com/api/calling/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| S1 | Scope 与能力对应：`trim.file.sharedAccess`（应用共享授权）、`trim.file.userAccess`（用户授权）、`trim.file.userAcl`（权限检查）、`trim.file.path`（路径转换）、`trim.system.getPlatformConfig`（平台配置） | 表格见该页「API Scope 定义」 |
| S2 | `api-scope` 在 `config/resource` 中声明 | "在应用包的 `config/resource` 中声明：" |
| S3 | 调用 JS SDK **必须**在 manifest 声明 `micro_app=true`，否则页面不按微应用环境加载 | "如果应用需要调用 JS SDK，必须在 `manifest` 中声明：`micro_app=true`。未声明 `micro_app=true` 时…JS SDK 相关能力可能无法初始化。" |
| S4 | SDK 包：`@trimjs/web-app`，`import { TrimApp } from '@trimjs/web-app'` | "SDK 包地址：https://www.npmjs.com/package/@trimjs/web-app" |
| S5 | 运行环境判定：`isWeb`、`isStandaloneWeb`；独立浏览器页走 `openAppAuth` + `redirectUri` | "`isStandaloneWeb` 为 `true`：页面运行在独立浏览器中，调用 `openAppAuth` 打开授权页面" |
| S6 | 回调处理：`parseAppAuthCallback` + 校验 `state` + `postMessage` 同源校验；建议网关同域 | "建议通过统一网关访问应用，并把 `redirectUri` 设置为同域路径，例如 `/app/your-app/callback.html`。" |
| S7 | 后端 API 统一 `POST /api/v1/trimapp`，经 Unix Socket `/var/run/trim_open_gateway_apiscope.socket`，`Authorization: Bearer $TRIM_API_TOKEN` | "后端 API 统一使用 `POST /api/v1/trimapp` 调用，并且需要应用服务端通过 Unix Socket `/var/run/trim_open_gateway_apiscope.socket` 访问" |
| S8 | token 不得持久化、不得进前端 | "`TRIM_API_TOKEN` 可能会在应用重新注册…后更新。应用每次调用时都应从当前进程环境变量读取，不要把它持久化…" |
| S9 | `$on` 仅 Web 宿主（`isWeb===true && isStandaloneWeb===false`） | "如果要监听主题或语言变化，`$on` 只支持 Web 宿主环境" |
| S10 | 系统版本要求 `1.2.0401` 及以上，App 版本 `1.34.0` 及以上（开放 API 全量） | "相关接口当前要求系统版本 `1.2.0401` 及以上，App 版本 `1.34.0` 及以上。" |

### 1.14 应用共享授权 —— https://developer.fnnas.com/api/authorization/shared-access/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| H1 | `pickSharedFile(params?: SharedFilePickerParams): Promise<AppBridgeResponse<string[]>\|undefined>`，Scope `trim.file.sharedAccess`，系统 `1.2.0401` / App `1.34.0` | 接口清单表 |
| H2 | `authorizeSharedFile(path: string)` 同样返回 `AppBridgeResponse<string[]>`（`data` 为授权目录路径数组） | "| `data` | string\[\] | 管理员授权给当前应用的目录路径 |" |
| H3 | 该能力**只支持目录授权**，不支持文件授权 | "该能力只支持目录授权。如果需要让当前用户选择或授权某个文件，请使用 用户个人授权路径。" |
| H4 | 非管理员调用会失败：宿主直调 `code:1` + `msg:"仅管理员可进行此操作"`；路由回调 `status:"error"` + `error:"access_denied"` | "普通用户调用 `pickSharedFile` 或 `authorizeSharedFile` 会失败" |
| H5 | 后端查询/删除：`trim.file.getSharedAccessibleFolders` / `trim.file.delSharedAccessibleFolder` | 请求示例 `{"req":"trim.file.getSharedAccessibleFolders",…}` |
| H6 | `SharedFilePickerParams`：`title`、`okText`、`sidebarGroup`、`creatable`、`disabledPaths` | 类型定义见该页末尾 |

### 1.15 用户个人授权 —— https://developer.fnnas.com/api/authorization/user-access/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| U1 | `pickUserFile(params?: FilePickerParams)`：`directory:true` 授权目录（单选），`directory:false` 授权文件（可直接用返回路径） | "目录授权只支持单选。即使传入 `multiple`，也会按单个目录选择处理。" |
| U2 | `authorizeUserFile(path)` 按已知路径重新申请；后端 `trim.file.getUserAccessibleFolders`（需 `uid`）/ `delUserAccessibleFolder` | "调用该接口前，应用应先通过统一网关确认当前使用用户，并使用该用户的 `uid` 作为查询条件。" |
| U3 | 文件授权不会进入可查询的目录列表 | "文件授权不会写入可通过 `trim.file.getUserAccessibleFolders` 查询的目录列表。" |
| U4 | Scope `trim.file.userAccess`，系统 `1.2.0401` / App `1.34.0` | 接口清单表 |

### 1.16 页面路由（含 openAppSetting） —— https://developer.fnnas.com/api/page/routing/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| O1 | `openAppSetting(): Promise<void \| null>`，**无 Scope**，系统 `1.2.0401` / App `1.34.0` | 接口清单表（`openAppSetting` 类型 前端 JS SDK，Scope 无） |
| O2 | 同类方法：`openFile(path)`、`showFileDetails(paths, options?)`、`openFileManager(path)`、`openURL(url, target?, features?)` | 各方法签名 |
| O3 | 页面路由不做授权/权限判断 | "页面路由只负责打开页面，不会替应用完成文件授权或权限判断。" |

### 1.17 文件权限检查 —— https://developer.fnnas.com/api/authorization/file-acl/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| L1 | `trim.file.checkUserACL`（Scope `trim.file.userAcl`），入参 `uid` + `path`（可为数组），返回 `readable`/`writable`/`deletable` | 请求/响应示例 |
| L2 | 路径不存在或无权读状态时三项均为 `false` | "该路径会返回默认权限结果：`readable`、`writable`、`deletable` 均为 `false`。" |
| L3 | 返回内容前建议按当前用户 uid 校验 | "只返回 `readable: true` 的内容" |

### 1.18 错误码 —— https://developer.fnnas.com/api/error-codes/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| X1 | JSSDK 码：`0` 成功、`1000000` 内部异常、`1000001` 登录失败、`1000002` 管理员权限或 Scope 不足、`1000030` 请求非法、`1000300` 未找到应用、`1000701` 路径不存在、`1003103` 应用权限校验失败、`1003201` 管理员已关闭普通用户授权 | 表格见该页 |
| X2 | 后端 API 码：`200001` Invalid Params、`200004` Unauthorized(401)、`200003` Forbidden(403)、`200005` Not Found(404)、`200006` Internal Error | 表格见该页 |
| X3 | 普通用户调共享授权还可能返回 `code:1` 或 `access_denied`（与 H4 一致） | "这两种情况都表示当前用户没有权限执行该授权操作。" |

### 1.19 官方 Native 案例（网关型应用的权威范式） —— https://developer.fnnas.com/docs/examples/native/

| # | 事实 | 关键原文 |
| --- | --- | --- |
| N1 | 网关型 manifest 范式：`install_dep_apps=nodejs_v22`、`os_min_version=1.1.3100`、`ctl_stop=true`、无 `service_port` | "`os_min_version=1.1.3100` 表示应用使用统一网关，国内版需要声明最低系统版本。" / "统一网关通过 Socket 转发请求，因此这里不需要声明 `service_port`。" |
| N2 | 共享目录声明 `{"data-share":{"shares":[{"name":"notepad/notes"}]}}`，软链为 `/var/apps/notepad/share/notes` | "也可以通过 `/var/apps/notepad/share/notes` 软链访问这个目录。" |
| N3 | `app/ui/config` 网关入口：`protocol:""`、`gatewayPrefix:"/app/notepad"`、`gatewaySocket:"app.sock"`、`url:"/app/notepad"`、`allUsers:true` | 该页 ui/config 代码块 |
| N4 | Socket 路径 `${TRIM_APPDEST}/app.sock`，与 `gatewaySocket:"app.sock"` 对应 | 该页 `cmd/main` 与说明 |
| N5 | 应用用 `x-trim-userid` 区分用户数据 | "示例使用该 Header 为不同用户保存不同的笔记文件。" |
| N6 | 统一网关应用的 `os_min_version` 需按国内版声明（示例 1.1.3100），不是随便写 `1.2.0` | 同 N1 |

### 1.20 npm registry 事实（`@trimjs/web-app`）

- `curl https://registry.npmjs.org/@trimjs%2fweb-app` → `dist-tags.latest = 0.5.0`，共 34 个版本，0.5.0 发布于 **2026-10-12T06:18:09Z**。
- 结论：**0.5.0 就是 npm 上的最新正式版本**，本仓 `node_modules/@trimjs/web-app` 与 `package-lock.json`（`web-app-0.5.0.tgz`）一致，无需升级。
- 注意：该包 README 末尾仍写着 "0.5.0 当前为本地候选版本，需在发布后再供下游正式安装"（历史文案），与 registry 已发布事实不一致；以 registry 为准。

### 1.21 文档自身的不一致（记录备用）

| 现象 | 出处 |
| --- | --- |
| `manifest` 更新日志写 `change_log`，现行字段为 `changelog` | https://developer.fnnas.com/docs/update-log/ （2025-12-16 条目）vs manifest 页 |
| 安装后目录图写 `shares/`（复数），资源页/环境变量页/案例页写软链 `/var/apps/{appname}/share/`（单数） | framework 页「安装后的目录」vs resource/env/native 页 |
| `config/resource` 页未列 `api-scope`，但 calling 页要求在 `config/resource` 声明 | resource 页 vs calling 页 |
| `create-application` 页示例给 manifest 值加引号（`appname="HelloFnos"`），manifest 页示例不加引号 | 两页对照 |

---

## 2. 逐项差异表（本项目现状 → 官方要求 → 建议改法）

### 2.1 `fnos/package/manifest`

| # | 本项目现状 | 官方要求（来源） | 建议改法（判定） |
| --- | --- | --- | --- |
| 1 | `version=1.2.12.2` | `version` 为应用版本，示例为 `1.0.0`/`2.1.3-beta`（M2） | 改为 `version=1.2.13.0`；同时 `build-fpk.mjs` 输出名与 README 全部同步 **（必须改）** |
| 2 | `os_min_version=1.2.0` | 开放 API（JS SDK + 后端 API）要求系统 `1.2.0401` 及以上（S10/H1/U4/O1/L1）；网关应用需按国内版声明最低版本（N1/N6）；不得夸大支持范围（M5） | 改为 `os_min_version=1.2.0401`（若暂不接开放 API，至少写 `1.1.3100`） **（必须改）** |
| 3 | `micro_app=true` | 调用 JS SDK 前必须在 manifest 声明（S3） | 保持 **（已符合）** |
| 4 | `platform=x86` | `x86`/`arm`/`all`，`all` 仅用于无架构二进制（M3） | 保持；包内含 x86-64 的 node/ffmpeg/soffice，不能写 `all` **（已符合）** |
| 5 | 无 `os_max_version` | 可填兼容上限（M5） | 可选补 `os_max_version`；不确定就留空 **（建议改）** |
| 6 | 无 `install_type` | 空值=安装时用户选存储位置（M7） | 保持（README 也是让用户选存储空间） **（已符合）** |
| 7 | 无 `install_dep_apps`，自带 `target/runtime/bin/{node,ffmpeg,soffice}` | 打包运行时建议经 `install_dep_apps` 声明（T1/T2）；官方 Node 用 `nodejs_v22`（T2/N1） | 二选一：①保留自带运行时（需自行承担体积与升级）②`install_dep_apps=nodejs_v22` 并改用 `/var/apps/nodejs_v22/target/bin`。**（建议改）** |
| 8 | `ctl_stop=true` + `cmd/main` 有 start/stop/status | `true` 显示启停；`status` 用 0/3 退出码（M6、framework 页） | 保持 **（已符合）** |
| 9 | 无 `service_port`，`checkport=false` | 不监听固定端口可省略 `service_port` 或 `checkport=false`（M9/N1） | 保持 **（已符合）** |
| 10 | `desktop_uidir=ui`、`desktop_applaunchname=qingye.main` | 二者需与 `app/ui/config` 入口 ID 一致（M8） | 保持（入口 ID 正是 `qingye.main`） **（已符合）** |
| 11 | `disable_authorization_path=false` | `false` 才在应用设置显示授权目录（M10） | 保持；不要改成 `true`，否则手动授权入口消失 **（已符合）** |
| 12 | `changelog=` 一整段长句（含 4 个功能点） | 简洁、面向用户（M11） | 压缩成 2–3 个短句，细节移到 README **（建议改）** |
| 13 | 无 `maintainer_url`/`distributor`/`distributor_url` | 开发者/发布者信息字段（M4）；上架需材料完整（publish-application 页） | 建议补 `maintainer_url`、`distributor` **（建议改）** |
| 14 | 值无引号 | 两页示例一处无引号、一处有引号（1.21） | 保持现状（无引号），与 manifest 页示例一致 **（已符合）** |
| 15 | `desc` 纯文本 | 必要时可用 HTML（M2） | 保持 **（已符合）** |

### 2.2 `fnos/package/config/privilege`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 16 | `{"defaults":{"run-as":"package"},"username":"qingye","groupname":"qingye"}` | `run-as=package` 为默认推荐；`username`/`groupname` 省略时按 appname 生成（P1/P2） | 保持（显式写出等价于 `helloFnos` 官方示例写法） **（已符合）** |
| 17 | 无 `join-groups` | 仅访问 video/render 等组资源时需要（P3） | 保持（不转码硬件） **（已符合）** |
| 18 | 未使用 root | 长期服务应降权（P3） | 保持 **（已符合）** |

### 2.3 `fnos/package/config/resource`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 19 | `{"data-share":{"shares":[{"name":"qingye/files"}]}}` | `data-share.shares[].name`，安装时自动创建，Windows ACL 自动授予（R1–R4）；命名建议 `myapp/子目录`（R5） | 保持（`qingye/files` 完全符合 R5 范式） **（已符合）** |
| 20 | 未写 `permission` | 仅其他应用/系统用户需访问时才写（R6） | 保持 **（已符合）** |
| 21 | `"api-scope":["trim.file.sharedAccess"]` | `api-scope` 在 `config/resource` 声明，只声明实际用到的（S1/S2） | 保持；若接入 `trim.file.checkUserACL` 再加 `trim.file.userAcl`，接入 `getPlatformConfig` 加 `trim.system.getPlatformConfig` **（已符合，按需扩展）** |
| 22 | 未声明 `usr-local-linker`/`docker-project` | 只声明实际需要（R7） | 保持 **（已符合）** |
| 23 | 依赖 32180 本机 MCP（127.0.0.1） | 无对应资源声明项 | 保持（不上 `/usr/local/bin`、不开公网端口即可） **（已符合）** |

### 2.4 `fnos/package/app/ui/config`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 24 | `gatewayPrefix:"/app/qingye"` | `/app/{appname}` 或 `/app/{appname}/{customPath}`，稳定无点号（G2） | 保持 **（已符合）** |
| 25 | `gatewaySocket:"app.sock"`；`cmd/main` 等待 `$TRIM_APPDEST/app.sock` | 只填文件名，文件在 target 下（G3/N4） | 保持 **（已符合）** |
| 26 | `protocol:""` | 网关入口忽略 protocol（A2/G4） | 保持 **（已符合）** |
| 27 | `type:"iframe"` | 桌面窗口内打开用 `iframe`（A2） | 保持 **（已符合）** |
| 28 | `allUsers:false` + `control.accessPerm:"readonly"` | 仅管理员入口的建议组合（A3） | 保持 **（已符合）** |
| 29 | `url:"/app/qingye/"`（带尾斜杠） | 官方示例为 `"/app/myapp"`、`"/app/notepad"`（G8/N3），无尾斜杠 | 改为 `url:"/app/qingye"`（尾斜杠兼容性未证实，跟随官方写法更稳） **（建议改）** |
| 30 | 未设 `port` | 网关入口忽略 `port`（G4） | 保持 **（已符合）** |
| 31 | 入口 ID `qingye.main` | 用 appname 作前缀且稳定（A1） | 保持 **（已符合）** |
| 32 | `icon:"images/icon_{0}.png"` + build 生成 64/256 | 需同时提供 `icon_64.png`/`icon_256.png`（I3） | 保持 **（已符合）** |

### 2.5 `fnos/package/wizard/install`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 33 | `stepTitle` + `items[{type:"tips",helpText:…}]` | tips 需 `helpText`（W2/W3/W4） | 结构保持 **（已符合）** |
| 34 | 文案含"修改授权后请重启应用" | 官方：选择器调用**直接返回**本次授权结果；后端查询用于刷新/重启后重新同步（1.4 节 / shared-access 页）；无任何"授权后必须重启"的要求 | 改成"授权完成后刷新页面即可，无需重启"（与 README/契约同步） **（必须改）** |
| 35 | 文案含"可使用 qingye/files 共享目录，或在应用设置中授权其他文件夹" | 两种方式并存且都官方（P4） | 保留，但把 in-app 授权（`pickSharedFile`/`authorizeSharedFile`）写成首选 **（建议改）** |
| 36 | 只有 `wizard/install` | 支持 `wizard/config`（设置页可改）（W1） | 如需在设置页展示说明/开关，加 `wizard/config`（可选） **（建议改）** |
| 37 | 无 `field`（纯提示） | 无字段即不产生环境变量（W2） | 保持 **（已符合）** |

### 2.6 `fnos/package/cmd/*`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 38 | `cmd/main` 用 `TRIM_APPDEST`/`TRIM_PKGVAR`/`TRIM_PKGTMP`/`TRIM_PKGHOME`，未硬编码路径 | 尽量用环境变量（E2） | 保持 **（已符合）** |
| 39 | `status` 返回 0/3，未知命令 `exit 1` | framework 页退出码约定 | 保持 **（已符合）** |
| 40 | 失败信息写 `TRIM_TEMP_LOGFILE` 并 stderr | E8 | 保持 **（已符合）** |
| 41 | 9 个生命周期脚本齐全（install/upgrade/uninstall/config 的 init+callback，均为 `exit 0`） | fnpack 要求 `cmd/`，官方列出 9 个脚本（F3/framework 页） | 保持 **（已符合）** |
| 42 | `[ -n "$TRIM_DATA_SHARE_PATHS" ] || fail '未创建共享目录…'` —— 共享路径为空时直接失败 | 官方给的是**两条并列**访问途径：`TRIM_DATA_SHARE_PATHS` 或 `/var/apps/{appname}/share/`（R4/E5/N2）；软链不是"空值兜底" | 增加软链回退：`${TRIM_APPDEST}/share/files`，再失败才报错 **（建议改）** |
| 43 | 直接 `"$TRIM_APPDEST/runtime/bin/node"` 启动，未读取 `TRIM_API_TOKEN`、未连接开放 API Socket | 若要"授权后立即生效"，后端需经 `/var/run/trim_open_gateway_apiscope.socket` 调 `trim.file.getSharedAccessibleFolders`（S7/H5）；token 从环境读取且不落盘（S8） | 新增后端查询能力（配合第 34 项） **（必须改，若要取消"重启才能刷新"）** |
| 44 | 未降权/未用 root | 本项目本身以 package 用户运行（P1） | 保持 **（已符合）** |

### 2.7 `fnos/build-fpk.mjs`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 45 | 输出名硬编码 `release/Qingye-Toolbox-1.2.12.2-fnos-x86.fpk` | 版本应与 manifest 一致 | 改为从 manifest 读 `version`，输出 `…-1.2.13.0-fnos-x86.fpk` **（必须改）** |
| 46 | 用 sharp 生成 `ICON.PNG`(64)/`ICON_256.PNG`(256) 与 `app/ui/images/icon_*.png` | I1/I3 | 保持（`assets/icon.png` 为 1024×1024 正方形，缩放合规） **（已符合）** |
| 47 | `chmod 755 cmd/*` 后 `fnpack build --directory` | F1/F2 | 保持 **（已符合）** |
| 48 | 未校验 `wizard/` 与 `app/ui/` 存在 | fnpack 会检查（F2） | 可选：构建前断言 `wizard/`、`app/ui/` 存在，提前失败 **（建议改）** |
| 49 | 未检查图标 ≤1024 KB / sRGB | I2 | 可选：加断言 **（建议改）** |

### 2.8 `fnos/Dockerfile`（仅构建期用途）

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 50 | `node:22-bookworm-slim` + `libreoffice-*` + `ffmpeg`，产出 `target/runtime` | 官方推荐 `install_dep_apps` 运行时（T1/T2），未禁止自带运行时（未见禁止性表述） | 保持（自带运行时是自主选择，需自行保证 glibc 与目标机兼容） **（建议改：文档中说明为何不用 install_dep_apps）** |
| 51 | 基础镜像用 `docker.m.daocloud.io` 镜像并固定 digest | 官方无相关要求 | 保持 **（已符合）** |

### 2.9 `fnos/README.md`

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 52 | "目录权限要选择'应用于：此文件夹、子文件夹和文件'" | **官方文档全文（含 llms-full.txt）零次出现**"应用于/子文件夹/继承"这类 ACL 传播说明；官方机制是"系统自动为应用运行用户授予所需的 ACL 访问权限"（R2） | 删除该操作步骤，改为"在应用内点『重新授权此文件夹』，或到应用设置授权目录，系统会自动为轻页账号授予 ACL" **（必须改）** |
| 53 | "修改授权后请停止并重新启动轻页""修改授权后需要重启应用以刷新目录列表" | 官方推荐：选择器直接返回结果；后端查询用于刷新/重启后重新同步（1.4 节）；无重启要求 | 改为"授权后刷新页面即可；应用会重新查询授权目录" **（必须改）** |
| 54 | 版本号 1.2.12.2 满篇（安装包名、更新说明、左下角角标） | 与 manifest 一致 | 统一 `1.2.13.0` **（必须改）** |
| 55 | "测试目标是 fnOS 1.2.0800" | 开放 API 需 `1.2.0401`+（S10）；网关应用需声明国内版最低版本（N1） | 写 `1.2.0401` 作为最低验证基线 **（必须改）** |
| 56 | "前端复用飞牛统一网关登录，无独立公开 TCP 端口" | 与 G1/G5 一致 | 保持 **（已符合）** |
| 57 | 未提 `micro_app=true` 与 `api-scope` | S3/S2 | 补一句"manifest 必须 `micro_app=true`，resource 必须声明 `trim.file.sharedAccess`，否则 JS SDK 不初始化 / 授权接口 403" **（建议改）** |
| 58 | "飞牛规范来源"只列 4 个链接 | — | 补 manifest、app-entry、wizard、icon、fnpack、/api/calling、shared-access、routing 页 **（建议改）** |
| 59 | "实机安装与飞牛网关、ACL 的最终兼容性，需要在目标设备上验证" | publish-application 页要求多版本/多架构实测 | 保持（诚实表述） **（已符合）** |
| 60 | 默认目录 `qingye/files` 说法 | R5 范式 | 保持 **（已符合）** |

### 2.10 `node_modules/@trimjs/web-app`（0.5.0）用法

| # | 本项目现状 | 官方要求 | 建议改法（判定） |
| --- | --- | --- | --- |
| 61 | 依赖固定 `0.5.0`，lock 指向 registry tarball | npm `latest=0.5.0`（2026-10-12 发布）（1.20） | 保持 **（已符合）** |
| 62 | `fnos/web/bridge.js`：`new TrimApp()`、`sdk.openAppSetting()`、`sdk.pickSharedFile({title,okText})`、`sdk.authorizeSharedFile(path)` | 四个方法的官方签名与返回（H1/H2/O1）完全对得上 | 保持 **（已符合）** |
| 63 | `pickSharedFolder()` 判 `r.code!==0` 后读 `r.data?.length` | `pickSharedFile` 的 `data` 是 `string[]`（H1） | 保持 **（已符合）** |
| 64 | `authorizeFolder()` 只判 `r.code`，未读 `r.data` | 官方文档写 `authorizeSharedFile` 的 `data` 为 `string[]`（H2）；本仓 0.5.0 `dist/index.d.ts` 写的是 `AppBridgeResponse<AuthorizeFileResult>`，而 `AuthorizeFileResult = boolean` | 不要把 `authorizeSharedFile` 的 `data` 当数组用；要读取路径请改用 `pickSharedFile` 或后端 `getSharedAccessibleFolders`。**（必须改：类型契约按官方文档，代码需兼容 boolean\|string[]）** |
| 65 | 未用 `pickUserFile`/`authorizeUserFile`/`openAppAuth`/`parseAppAuthCallback` | 用户级授权与独立浏览器授权路由（U1/U2/S5/S6） | 首版限管理员可不接；若将来支持普通用户，必须加 `trim.file.userAccess` scope + `openAppAuth` 回调页 **（建议改）** |
| 66 | `isStandaloneWeb` 分支文案写"Docker/独立版请挂载 volumes" | 独立浏览器页面的官方路径是 `openAppAuth` + `redirectUri`（S5/S6），不是挂载 | 保留现有降级提示可以，但飞牛独立版应改为引导"从飞牛桌面打开"；或在独立浏览器下走 `openAppAuth` **（建议改）** |
| 67 | 未声明 `micro_app` 相关逻辑 | S3 | 已由 manifest 满足，保持 **（已符合）** |

---

## 3. 可直接粘贴的配置片段（版本统一 `1.2.13.0`）

### 3.1 `fnos/package/manifest`（推荐全文）

```ini
appname=qingye
version=1.2.13.0
display_name=轻页文件工具箱
desc=独立运行的 PDF、图片、办公文档与音视频转换工具。文件在 NAS 本机处理，保留原文件。首版限管理员使用。
source=thirdparty
platform=x86
maintainer=Qingye contributors
maintainer_url=https://github.com/[OWNER]/[REPO]
distributor=Qingye contributors
distributor_url=https://github.com/[OWNER]/[REPO]
os_min_version=1.2.0401
micro_app=true
ctl_stop=true
checkport=false
desktop_uidir=ui
desktop_applaunchname=qingye.main
disable_authorization_path=false
changelog=新增任务历史与一键重试、从 NAS 文件夹批量添加、PDF 目标大小压缩。接入飞牛授权接口，应用内可直接授权目录，授权后无需重启。
```

说明：
- `os_min_version=1.2.0401` 来自开放 API 的系统版本要求（S10）；若决定不接开放 API，可退回 `1.1.3100`（N1）。
- 若改用官方运行时，在 `os_min_version` 上方加一行 `install_dep_apps=nodejs_v22`，并把 `cmd/main` 里的 node 路径改成 `/var/apps/nodejs_v22/target/bin/node`（T2/N1）。**二选一，不要既自带 runtime 又声明依赖。**
- `os_max_version` 未测上限时不要写（M5）。

### 3.2 `fnos/package/config/resource`

```json
{
  "data-share": {
    "shares": [
      {
        "name": "qingye/files"
      }
    ]
  },
  "api-scope": [
    "trim.file.sharedAccess"
  ]
}
```

若接入按用户 ACL 校验或平台配置读取，扩展为：

```json
  "api-scope": [
    "trim.file.sharedAccess",
    "trim.file.userAcl",
    "trim.system.getPlatformConfig"
  ]
```

> `api-scope` 只声明实际调用的能力；声明了不调用不会报错，但 403 排查会变难（X2）。

### 3.3 `fnos/package/app/ui/config`

```json
{
  ".url": {
    "qingye.main": {
      "title": "轻页文件工具箱",
      "icon": "images/icon_{0}.png",
      "type": "iframe",
      "protocol": "",
      "gatewayPrefix": "/app/qingye",
      "gatewaySocket": "app.sock",
      "url": "/app/qingye",
      "allUsers": false,
      "control": {
        "accessPerm": "readonly"
      }
    }
  }
}
```

> 与现状唯一差别：`url` 去掉尾斜杠（跟随 N3/G8 官方示例）。`protocol`/`port` 对网关入口无效，保留空串即可。

### 3.4 `fnos/package/wizard/install`

```json
[
  {
    "stepTitle": "安装轻页文件工具箱",
    "items": [
      {
        "type": "tips",
        "helpText": "应用在 NAS 本机处理文件，无需电脑客户端或 Docker。首版仅供管理员使用。安装后系统会自动创建 qingye/files 共享目录，并为轻页账号授予访问权限（Windows ACL）。如需处理其他位置，在应用内点“授权目录”完成授权；授权后刷新页面即可，无需重启。"
      }
    ]
  }
]
```

可选 `wizard/config`（设置页仍可看到同样说明）：

```json
[
  {
    "stepTitle": "目录授权",
    "items": [
      {
        "type": "tips",
        "helpText": "轻页只能访问 qingye/files 共享目录，以及在“授权目录”中明确授权的其它目录。撤销授权请到飞牛应用设置中操作。"
      }
    ]
  }
]
```

### 3.5 `authorizeSharedFile` 返回值兼容写法（前端，替换现有 `authorizeFolder`）

```js
// 官方文档：data 为 string[]（shared-access 页）；0.5.0 的 .d.ts 写 boolean。
// 不要假设类型，取到路径就刷新，取不到就依赖后端查询。
async function authorizeFolder(path) {
  const sdk = assertHost();
  const r = await sdk.authorizeSharedFile(path);
  if (!r) throw new Error('已取消授权');
  if (r.code !== 0) throw new Error(r.msg || '授权未完成');
  const paths = Array.isArray(r.data) ? r.data : [];
  if (paths.length) await refreshAccessiblePaths();
  return { code: r.code, msg: r.msg, paths };
}
```

---

## 4. 「目录权限」官方机制说明

### 4.1 官方给出的完整模型（按文档可查顺序）

1. **应用以独立应用用户运行。** `config/privilege` 的 `run-as=package` 决定应用进程身份（P1/P2/P3），与登录用户不同。
2. **应用默认没有任何用户文件权限。** "应用默认不会获得用户文件的广泛访问权限。需要读取或写入用户数据时，应由用户明确授权目录访问。"（P4）
3. **两条获得访问权的官方途径**（P4）：
   - 用户在应用设置中授权目录（`disable_authorization_path=false` 才会显示该 UI，M10）；
   - 应用在 `config/resource` 中声明共享数据目录（`data-share.shares[].name`）。
4. **ACL 由系统写入，且是 Windows ACL 而非 POSIX ACL。** "这些目录使用 Windows ACL 权限模型，而不是 POSIX ACL。系统会自动为应用运行用户授予所需的 ACL 访问权限。"（R2）
   → 授权动作会由系统把目标路径的 ACL 授予"应用用户"；因此**不需要**用户自己在权限面板里逐层勾选传播。
5. **授权后应用拿到的是路径清单**：
   - 共享目录：`TRIM_DATA_SHARE_PATHS`（`:` 分隔），或软链 `/var/apps/{appname}/share/{子目录}`（E4/E5/R4/N2）；
   - 用户授权目录：`TRIM_DATA_ACCESSIBLE_PATHS`（"用户授权的可访问路径"，`:` 分隔）（E4）。
6. **拿到路径 ≠ 绕过用户权限。** "应用仍然需要按当前用户的文件权限决定是否展示、读取、写入或删除内容。"（authorization overview）；具体手段是后端 `trim.file.checkUserACL`（uid + path → readable/writable/deletable）（L1/L2/L3）。
7. **`disable_authorization_path` 的语义只是 UI 开关**，不是权限开关：`false` 显示"授权目录"设置，`true` 隐藏；"仅当应用不需要用户选择文件或目录访问权限时，才使用 `true`"（M10）。把它设成 `true` 不会放宽任何权限，只会让用户失去手动授权入口。
8. **网关层不解决授权问题。** 网关只校验登录态并转发 `X-Trim-Userid` 等 Header（G1/G5/G7），文件授权是应用用户 ACL + 用户显式授权两件事。

### 4.2 `/var/apps/{appname}/share/` 软链的确切形态

- 资源页与环境变量页：`/var/apps/myapp/share/` + `documents` 这类子目录（R4/E5）。
- Native 案例给了可复算的例子：声明 `{"name":"notepad/notes"}` → 软链 `/var/apps/notepad/share/notes`（N2）。
- 推得本项目：声明 `{"name":"qingye/files"}` → **`/var/apps/qingye/share/files`**（不是 `/var/apps/qingye/share/qingye/files`）。
- 文档站自身不一致：安装后目录图写的是 `shares/`（复数）。以资源页/案例页的 `share/` 为准，实机二选一探测即可。

### 4.3 官方推荐的「授权后生效」路径（本项目最需要修正的一条）

| 场景 | 官方路径 | 原文 |
| --- | --- | --- |
| 用户在应用内授权 | 直接调用 `pickSharedFile` / `authorizeSharedFile`，**本次调用即返回授权结果** | "选择器调用会直接返回本次授权结果。"（authorization overview） |
| 页面刷新 / 服务重启后同步 | 后端查 `trim.file.getSharedAccessibleFolders` | "后端查询授权结果主要用于刷新、服务重启后同步，或后端业务读取已有授权路径。"（同上） |
| 授权被移除后重新确认 | `authorizeSharedFile(path)` | "如果应用已经知道要访问哪个目录，但该目录尚未授权，或授权被移除，可以调用 `authorizeSharedFile`"（H2 页） |
| 独立浏览器页面 | `openAppAuth('pickSharedFile', {appName, redirectUri, state})` + `parseAppAuthCallback` | S5/S6 |

因此：**"必须重启应用才能看到新授权"不是官方推荐路径**，它是本项目"只在启动时读一次 `TRIM_DATA_ACCESSIBLE_PATHS`"这一实现选择造成的现象。

### 4.4 README 中与官方不一致 / 已过时的说法（逐条）

| README 位置 | 原话 | 判定 | 依据 |
| --- | --- | --- | --- |
| 第 9 行 | "目录权限要选择'应用于：此文件夹、子文件夹和文件'；如果子文件夹禁用了继承，请…重置子级权限" | **过时/未证实**：官方文档（含 llms-full.txt 全文）没有这套操作说明；官方是"系统自动为应用运行用户授予所需的 ACL 访问权限" | R2；全文检索"应用于/子文件夹/继承"命中 0 |
| 第 9 行 | "修改授权后请停止并重新启动轻页" | **与官方不一致**：官方是选择器即时返回 + 后端查询刷新 | 4.3 表 |
| 第 14 行 | "修改授权后需要重启应用以刷新目录列表" | **与官方不一致**（同上）；可作为"当前实现限制"保留，但要标注为限制而非规范 | 4.3 表 |
| 第 14 行 | "系统撤销的文件权限即时由操作系统执行" | **不完整**：官方要求返回内容前按当前用户 `uid` 查 `checkUserACL` | L3 |
| 第 7/18 行 | 版本 1.2.12.2 | **过期**，统一 1.2.13.0 | 第 2.9 节 |
| 第 33 行 | "测试目标是 fnOS 1.2.0800" | **与 manifest 声明不一致且低于开放 API 要求** | S10/N1 |
| 全文 | 未提 `micro_app=true`、`api-scope` | **缺失**：两者是 JS SDK/授权接口的前置条件 | S2/S3 |
| 第 3 行 | "安装 FPK 后从飞牛桌面直接打开；不依赖客户端，不需要 Docker" | **符合**：网关 + iframe 就是官方桌面打开方式 | A2/G1 |
| 第 14 行 | "前端复用飞牛统一网关登录，无独立公开 TCP 端口" | **符合** | G1/G5 |

---

## 5. 未能在官方文档确认的点（标「未证实」，勿当结论使用）

1. **四段版本号 `1.2.13.0` 是否被应用中心接受** —— 官方示例只出现 `1.0.0`、`2.1.3-beta`、`0.0.1`、`1.1.3100` 这类三段式。本仓历史上已发布 1.2.12.1 / 1.2.12.2（`release/` 有实物），实践可用，但**文档层面未证实**。
2. **`os_min_version=1.2.0401` 这种四段写法** —— 系统版本号在开放 API 文档里写作 `1.2.0401`，而 manifest 示例写 `1.2.0`；两者拼接写法未见于任何官方 manifest 示例 → **未证实**（首个真机安装需验证，失败则退回 `1.2.0` 并在 README 说明）。
3. **"App 版本 1.34.0" 指哪个 App**（飞牛移动 App / 桌面宿主 / 应用中心） —— 表格只写 "App 版本要求"，无定义说明 → **未证实**。
4. **`url` 带尾斜杠 `/app/qingye/` 是否等价于 `/app/qingye`** —— 官方示例均无尾斜杠，但无"必须无尾斜杠"的明文 → **未证实**（建议按官方写法改）。
5. **`authorizeSharedFile` 返回 `data` 的真实类型** —— 官方文档写 `string[]`，本仓 0.5.0 `dist/types.d.ts` 写 `AuthorizeFileResult = boolean` → **两处冲突，未证实**；按"保守兼容两者"写代码（见 3.5）。
6. **"仅管理员可进行此操作" 的实际返回码** —— 一处写 `code: 1`，错误码表又给 `1003201`（管理员已关闭普通用户授权）与 `1000002`（管理员权限或 Scope 不足） → 具体码值 **未证实**；处理逻辑应按"非 0 即失败 + 展示 msg"。
7. **共享目录 ACL 是否需要用户在权限面板勾选"应用于子文件夹"** —— 官方零提及（文档全文 0 命中），且 R2 说系统自动授予 → README 的该步骤**未证实**，建议删除。
8. **`TRIM_DATA_ACCESSIBLE_PATHS` 是否在应用运行中动态更新** —— 文档只定义语义（用户授权的可访问路径），未说明刷新时机 → **未证实**；这决定了"是否必须重启"，需真机验证。官方给的稳定做法是不依赖该变量做实时来源，而是调 `getSharedAccessibleFolders`。
9. **自带 Node/FFmpeg/LibreOffice 运行时（`target/runtime`）是否被允许** —— 官方只说推荐 `install_dep_apps`，未禁止自带 → **未证实（无禁止性表述）**，风险在于 glibc 兼容与包体体积。
10. **`/var/apps/{appname}/share/` 与 `shares/`** —— 官方文档自身两处写法不同 → 以 `share/` 为准但**未最终证实**，实现时两者都探测最稳。
11. **`change_log` / `changelog`** —— 更新日志条目（2025-12-16）提到 `change_log`，现行 manifest 页只写 `changelog` → 视为历史命名，**以 `changelog` 为准**；`change_log` 是否仍兼容 **未证实**。
12. **网关 iframe 下 CSP `frame-ancestors 'self'`** —— 官方无 CSP 指引 → **未证实**（本项目契约里的 CSP 需真机自测；网关页面与桌面同源是官方模型推断）。

---

## 6. 对契约的修正建议（`docs/fnos-1.2.13-contract.md`）

| 契约位置 | 现写法 | 官方依据 | 修正建议 |
| --- | --- | --- | --- |
| §1 第 3 条 | "共享目录也可通过 `/var/apps/{appname}/share/{name}` 软链访问（`TRIM_DATA_SHARE_PATHS` 为空时的兜底）" | E5/R4/N2：软链是**并列**访问方式，不是空值兜底；且 `name=qingye/files` 时软链是 `…/share/files` | 改为："共享目录可通过 `/var/apps/qingye/share/files` 软链访问（与 `TRIM_DATA_SHARE_PATHS` 并列，可作为兜底）。name 形如 `qingye/files` 时软链只取最后一段子目录。" |
| §1 | 未提 `micro_app` / `api-scope` / 最低系统版本 | S2/S3/S10 | 增补三条官方事实：`micro_app=true` 必需；`config/resource` 必须声明 `trim.file.sharedAccess`；开放 API 需系统 `1.2.0401`+，据此 `os_min_version=1.2.0401`。 |
| §1 第 5 条 | "`disable_authorization_path=false` 才会在应用设置中显示'授权目录'" | M10 | 保留，并补一句"它只是 UI 开关，不影响 ACL"。 |
| §2.5 hints | 含"目录权限需选择'应用于：此文件夹、子文件夹和文件'"与"修改授权后停止并重新启动轻页" | 4.4 节：官方零依据 | 改为：①"在弹窗内点『重新授权此文件夹』（`authorizeSharedFile`）"②"仍失败则打开应用设置 → 目录授权，由系统重新授予 ACL"③"授权完成后刷新页面即可，应用会重新查询授权目录"。 |
| §2.5 权限判定 | 用 `fs.stat` 判 `readable/writable`，`mode` 转八进制 | L1–L3：官方推荐 `trim.file.checkUserACL(uid, path)` | 分两层：本地 `stat` 判应用用户是否可读写（保留）；若要按"当前登录用户"过滤，再加 `checkUserACL`，并在 `config/resource` 补 `trim.file.userAcl`。首版限管理员时可标注为可选。 |
| §2.1 `GET /api/settings` | `roots` 来自启动时读取的 `TRIM_DATA_SHARE_PATHS` + `TRIM_DATA_ACCESSIBLE_PATHS` | E4 只定义语义、未定义刷新；H5 提供 `getSharedAccessibleFolders` 作为权威来源 | 明确来源优先级：①`TRIM_DATA_SHARE_PATHS` ②`trim.file.getSharedAccessibleFolders`（每次请求或手动刷新时查询，需 `TRIM_API_TOKEN`）③`TRIM_DATA_ACCESSIBLE_PATHS` 作为兜底快照。这样"授权后无需重启"才成立。 |
| §2.1 | `roots[].shared` / `missingRoots` 等自定义字段 | 官方无此契约 | 保留（应用内契约自由），但要在文档里注明这些是自定义字段，不是飞牛字段，避免与 `data-share`/`TRIM_*` 混淆。 |
| §3 CSP | `frame-ancestors 'self'` | 官方无 CSP 指引（未证实） | 保留但加注"未证实，需在 1.2.0401 真机验证 iframe 是否被拦"。 |
| §3/§4 版本串 | `?v=1.2.13.0`、角标 `飞牛独立版 1.2.13.0` | 与 manifest `version` 一致 | 保持，并要求构建时从 manifest 读取，避免像现在这样在 4 处硬编码。 |
| §5 | 弹窗权限提示与"打开应用设置"链接 | O1（`openAppSetting` 无 scope） | 保留；补充分支说明：`isStandaloneWeb=true` 时该页应在独立浏览器中提示"请从飞牛桌面打开"，不依赖 `openAppSetting`（O1 在独立页面不可用）。 |
| 全文 | 未记录"官方文档版本/抓取日期" | — | 建议在 §1 顶部写 "官方文档抓取：2026-11-03，文档站更新日志最新 2026-07-31"，便于下次复核比对。 |

---

## 附：本次复核使用的全部官方 URL

- https://developer.fnnas.com/docs/core-concepts/manifest/
- https://developer.fnnas.com/docs/core-concepts/environment-variables/
- https://developer.fnnas.com/docs/core-concepts/privilege/
- https://developer.fnnas.com/docs/core-concepts/resource/
- https://developer.fnnas.com/docs/core-concepts/app-entry/
- https://developer.fnnas.com/docs/core-concepts/index-cgi/
- https://developer.fnnas.com/docs/core-concepts/gateway-registration/
- https://developer.fnnas.com/docs/core-concepts/wizard/
- https://developer.fnnas.com/docs/core-concepts/runtime/
- https://developer.fnnas.com/docs/core-concepts/icon/
- https://developer.fnnas.com/docs/core-concepts/framework/
- https://developer.fnnas.com/docs/core-concepts/dependency/
- https://developer.fnnas.com/docs/cli/fnpack/
- https://developer.fnnas.com/docs/category/开发工具/
- https://developer.fnnas.com/docs/category/快速开始/
- https://developer.fnnas.com/docs/quick-started/create-application/
- https://developer.fnnas.com/docs/quick-started/publish-application/
- https://developer.fnnas.com/docs/examples/native/
- https://developer.fnnas.com/docs/update-log/
- https://developer.fnnas.com/api/overview/
- https://developer.fnnas.com/api/calling/
- https://developer.fnnas.com/api/authorization/overview/
- https://developer.fnnas.com/api/authorization/shared-access/
- https://developer.fnnas.com/api/authorization/user-access/
- https://developer.fnnas.com/api/authorization/file-acl/
- https://developer.fnnas.com/api/page/routing/
- https://developer.fnnas.com/api/page/ui/
- https://developer.fnnas.com/api/error-codes/
- https://developer.fnnas.com/llms.txt
- https://developer.fnnas.com/llms-full.txt
- https://registry.npmjs.org/@trimjs%2fweb-app
