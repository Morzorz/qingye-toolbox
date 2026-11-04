# 轻页文件工具箱 · 飞牛独立版

版本 1.2.13.5。目标：fnOS 1.2.0401 及以上、Intel x86-64。安装 FPK 后从飞牛桌面直接打开；不依赖 Windows/Mac 客户端，不需要 Docker。Docker 只用于开发时构建 Linux 运行文件。

## 安装使用

1. 飞牛应用中心 → 手动安装，选择 `Qingye-Toolbox-1.2.13.5-fnos-x86.fpk`，选择存储空间。
2. 启动应用，用飞牛管理员账号从飞牛桌面打开“轻页文件工具箱”。
3. 页面主卡片只有两个入口：
   - **从 NAS 上选择**：打开 NAS 选择窗口。勾选具体文件后点“添加所选文件”；或单击进入某个文件夹后点“加入当前文件夹”，把该文件夹及子文件夹中符合当前处理方式的文件一次加入（最多 100 个）。窗口内可直接“重新授权此文件夹”“检查目录权限”。
   - **上传电脑文件**：文件上传到你的 NAS，保存在 `qingye/files/上传文件/<飞牛用户ID>`。
   也可以直接把电脑文件拖进卡片。
4. 选择处理方式与质量后开始处理。结果默认写在第一个文件所在文件夹，可点“保存到”旁的“更改”另选授权目录。处理完点“打开位置”查看 NAS 结果或下载到电脑。

默认共享目录 `qingye/files` 由飞牛在安装时创建，并自动为轻页账号授予访问权限。

## 目录权限

轻页以独立应用账号运行，只能访问飞牛明确授权给轻页的目录：

- **共享目录**：安装时由系统创建，系统自动写入 ACL；不需要手动勾选继承，也不需要在文件管理器里改权限。
- **其他目录**：在 NAS 选择窗口里点“重新授权此文件夹”，飞牛弹窗确认后即时生效，**无需重启应用**；回到窗口刷新即可看到。也可以到飞牛“应用中心 → 轻页 → 应用设置 → 目录授权”授权。
- 授权结果同时写入应用数据目录的 `granted-roots.json`（仅记录路径，启动时逐条重新校验，失效的自动丢弃）。
- 页面上的“检查目录权限”会显示该目录的权限位、所有者、可读/可写状态，并把处理步骤写在弹窗里；错误提示不会只给一句“没有权限”。
- 目录被移动、改名或所在存储空间被卸载时会明确提示，重新选择新路径即可。

## 从旧版本更新

在应用中心手动安装 1.2.13.5 FPK 覆盖更新，无需先卸载。更新后关闭原来的轻页窗口，再从飞牛桌面打开。左下角与右上角应显示“飞牛独立版 1.2.13.5”。

1.2.13.5 的变化：

- 修复硬件探测里缩放表达式的转义：`min(ih\,720)` 的逗号必须带反斜杠，否则会被当成滤镜分隔符，探测直接报 `Missing ')' or too many args`、设置页显示“不可用”。生产参数本来就是对的，这次把探测与生产统一到同一个表达式生成函数，并加了回归测试。

1.2.13.3 的变化：

- 硬件加速改为「CPU 解码/缩放 + GPU 编码」：部分 Intel 驱动不支持 VAAPI 的缩放（VPP）管线，会报 `the requested VAProfile is not supported`。现在只用 VAAPI 做编码，探测与真实转换走同一条管线。

1.2.13.2 的变化：

- 修复视频硬件加速参数拼写错误：1.2.13.1 里写成了 ffmpeg 不认识的 `-hwaccel-output-format`，导致设置页显示“可用”、真实转换却每次静默回退 CPU。现在改为 `-init_hw_device` + `-filter_hw_device`，并把硬件探测改成与真实转换同一条管线。
- 硬件失败时 `app.log` 记录 ffmpeg 的真实报错，便于定位。
- 新增**仅限本机回环的 Web 入口** `http://127.0.0.1:32181/app/qingye/`，可用 SSH 隧道或 NAS 上的 nginx 反代后用普通浏览器访问（详见下方“本机 Web 访问”）。

1.2.13.1 的变化：

- 主卡片精简为两个入口：“从 NAS 上选择”（文件与文件夹同一个窗口）、“上传电脑文件”；去掉“授权目录”“从 NAS 文件夹批量添加”“选择文件”三个按钮。
- 目录权限：失效授权目录不再阻断应用启动；授权后即时生效、无需重启；权限不足时给出可直接照做的处理步骤。
- 文件显示：列表不再静默丢条目；每个条目显示类型、大小、修改时间、是否匹配当前处理方式，不可用条目保留并写明原因（没有读取权限、链接越界、链接失效、不是普通文件）。

## 功能和限制

PDF 压缩、合并、页码提取、转图片；图片转换和多图合并 PDF；Word/Excel/PPT 转 PDF；音频转换、提取音轨；视频转 MP4、压缩和调整分辨率。内置中文回退字体，缺少原字体时排版可能不同。文档和图片单文件 500 MiB；音视频 20 GiB；每批 100 个文件，合并总输入 500 MiB。默认一次执行一个任务。视频转换默认启用硬件加速：检测到 Intel 核显（VAAPI，如 i5-6500 的 HD 530）时走 GPU 硬解+硬编，速度可比纯 CPU 快数倍；检测不到或硬件编码失败时自动回退 CPU（进度里会出现“硬件加速不可用，已改用 CPU 重新转换…”），视频选项里也可手动选“关闭”强制 CPU。硬件画质数值沿用三档，但 QP 与 x264 CRF 算法不同，输出体积可能略有差异。

NAS 文件不需要上传到电脑或云端；电脑文件的上传只进入你的 NAS。转换组件随包提供，正常转换不访问外部服务。

本机 MCP 仅供 NAS 上的原生智能体使用：`http://127.0.0.1:32180/mcp`，可提交任务、查询状态、取消任务，PDF 压缩可指定 `targetMB`，只能处理飞牛授权给轻页的目录，不提供上传、浏览、删除或修改授权目录。

不包含：远程 MCP、OCR、广告、多普通用户权限管理。任务历史保留最近 100 项；重启时未完成任务标记为中断，不自动重试；已导出文件保留。卸载不会主动删除输入文件或已导出结果。

## 本机 Web 访问

飞牛桌面打开的是网关入口（iframe）。如果想让普通浏览器访问，本版额外提供了一个**只监听本机回环**的入口：

```
http://127.0.0.1:32181/app/qingye/
```

它不监听局域网，所以外部访问需要自己加一层：

- **SSH 隧道**（推荐，最省事）：`ssh -L 32181:127.0.0.1:32181 你的用户@NAS_IP`，然后在本机浏览器打开上面的地址。
- **NAS 上的 nginx 反代**：把 `/qingye/` 反代到 `http://127.0.0.1:32181/app/qingye/`，并在 nginx 侧加飞牛登录或 Basic 口令。

说明：

- 入口由应用进程自己启动，日志里会写 `本机 Web 入口已启用：http://127.0.0.1:32181/app/qingye/`；「组件与目录」页也会显示这一行。
- 身份由应用注入（单一本机身份），可访问的文件仍由飞牛授权目录的 ACL 决定；伪造 `X-Trim-*` 请求头无效。
- 该入口默认开启，只绑 `127.0.0.1`；`QINGYE_WEB=0` 可关闭，`QINGYE_WEB_PORT` 改端口，`QINGYE_WEB_UID` 指定注入的飞牛用户 ID（默认 1000，必须是数字，否则入口自动停用）。
- **安全提示**：回环端口对 NAS 上的所有本地用户/应用可见，代理会把请求视作该注入身份。轻页本身限管理员使用、可访问范围仍受飞牛授权目录 ACL 限制，但如果你只从飞牛桌面使用，建议设置 `QINGYE_WEB=0` 关掉；通过 nginx 反代暴露时务必在 nginx 侧加登录或 Basic 口令，不要直接映射到公网。
- 网关入口与 Web 入口可以同时使用，互不影响；内置 MCP 仍然只听 `127.0.0.1:32180`。

## 故障排查

- **看不到某个目录**：确认该目录已授权给轻页（应用设置 → 目录授权，或在 NAS 选择窗口点“重新授权此文件夹”），然后在窗口里点“上一级 / 刷新”重新进入。
- **提示没有读取权限**：点“检查目录权限”按提示处理；不要把整个存储空间根目录授权给应用，选择实际需要的子文件夹即可。
- **文件夹能打开，但里面的文件都显示“没有读取权限”**：这通常不是路径问题，而是文件本身的权限。飞牛的共享目录用 Windows ACL：用户授权时系统只把 ACE 授到**被授权的那个目录**，子文件上的显式 ACE 或关闭的继承不会被回填；历史文件也常是别的应用账号的 `0600`。所以“目录可读、文件不可读”是正常现象。点该文件（行本身）可看到它的权限位与所有者，例如 `0600`、属主 `1000:1000`，而轻页是独立应用账号。修复方式任选其一：
  1. 飞牛文件管理器 → 选中这些文件或上级文件夹 → 详细信息 → 权限 → 高级 → 把权限应用到此文件夹、子文件夹和文件（或对该文件夹执行“重置子级权限”），回到轻页刷新；
  2. 把它们复制到 `qingye/files` 共享目录，复制出的新文件会继承共享目录权限；
  3. 用轻页“上传电脑文件”重新上传一份（新文件直接继承共享目录 ACL）。
  注意“重新授权此文件夹”只覆盖该目录的 ACE，不会重写子文件的显式权限。
- **提示没有写入权限**：换一个可写的保存文件夹（“保存到 → 更改”）。
- **应用启动失败**：查看应用数据目录中的 `app.log`，上一次启动日志为 `app.previous.log`。
- **页面打不开**：确认使用管理员账号、应用状态为运行，并且系统版本不低于 1.2.0401。
- **转换慢**：先看「组件与目录」页的“视频硬件加速”是否显示可用（VAAPI）。不可用时确认 NAS 有 Intel 核显且系统已加载（`/dev/dri/renderD128` 存在）；重启一次轻页让它加入 video/render 设备组。硬件可用时不要同时运行大量其他 NAS 转码任务，避免抢占 GPU。
- **Office 排版差异**：缺少原字体时使用内置中文字体，无法保证与微软 Office 像素级一致。

## 构建

构建机需要 Docker、Node.js 22+、npm 依赖和官方 fnpack 1.2.3。Linux 用户态依赖取自 Debian 12 官方仓库，版本记录在包内 `runtime/debian-packages.txt`；不向 NAS 系统目录安装任何依赖。

官方 fnpack 1.2.3 下载（按开发机系统选择）：<https://developer.fnnas.com/docs/cli/fnpack/>，例如 macOS Apple Silicon 用 `fnpack-1.2.3-darwin-arm64`。

```sh
npm ci
node fnos/build-client.mjs     # 打包 fnos/web/entry.js → fnos/web/app.bundle.js
docker build --platform linux/amd64 -f fnos/Dockerfile --target payload --output type=local,dest=fnos/build/payload .
QINGYE_FIXTURES=/path/to/office-fixtures sh fnos/tests/validate-linux.sh
FNPACK=/path/to/fnpack node fnos/build-fpk.mjs
```

`build-fpk.mjs` 从 `fnos/package/manifest` 读取版本号，输出 `release/Qingye-Toolbox-<version>-fnos-x86.fpk`，并校验 `wizard/`、`app/ui/`、`config/` 存在。

测试：

```sh
node --test tests/*.test.mjs                             # 桌面/转换引擎回归
node --test fnos/tests/server.test.mjs                   # 后端接口（22 项）
QINGYE_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node fnos/tests/browser.mjs
```

界面测试用真实 `createApplication` + Unix socket + 本地代理驱动 Chrome，覆盖两按钮布局、NAS 文件/文件夹选择、不可用条目原因、权限提示、上传、任务历史与下载；截图写入 `artifacts/`。

## 接口文档

应用 HTTP API、本机回环 Web 入口与本机 MCP 的完整说明见 [docs/fnos-api.md](../docs/fnos-api.md)（含错误码、限额、数据模型与 curl 示例）。

## 飞牛规范依据

- Manifest：<https://developer.fnnas.com/docs/core-concepts/manifest/>
- 环境变量：<https://developer.fnnas.com/docs/core-concepts/environment-variables/>
- 应用权限：<https://developer.fnnas.com/docs/core-concepts/privilege/>
- 应用资源（共享目录与 Windows ACL）：<https://developer.fnnas.com/docs/core-concepts/resource/>
- 统一网关：<https://developer.fnnas.com/docs/core-concepts/gateway-registration/>
- 应用入口：<https://developer.fnnas.com/docs/core-concepts/app-entry/>
- 用户向导：<https://developer.fnnas.com/docs/core-concepts/wizard/>
- JS SDK 与共享授权：<https://developer.fnnas.com/api/calling/>、<https://developer.fnnas.com/api/authorization/shared-access/>
- 打包工具：<https://developer.fnnas.com/docs/cli/fnpack/>

本包依赖的前置声明：`manifest` 的 `micro_app=true`（JS SDK 必需）、`config/resource` 的 `api-scope: ["trim.file.sharedAccess"]`（目录授权接口必需）、`disable_authorization_path=false`（应用设置里保留目录授权入口）。复核记录见 `docs/fnos-official-notes.md`，实现基线见 `docs/fnos-1.2.13-contract.md`。

## 许可与源码

应用源码使用 AGPL-3.0-or-later。MuPDF、Sharp、Noto 字体等许可见主项目声明；原生依赖的版权声明与许可证随包放在 `runtime/licenses`，Node 的 LICENSE 随 `runtime` 保留。FFmpeg、LibreOffice 和 Debian 库的对应源包可按 `runtime/debian-packages.txt` 记录的版本从 <https://snapshot.debian.org/> 获取。

实机安装与飞牛网关、ACL 的最终兼容性仍需在目标设备上验证；本地 Linux 测试不能代替这一项。
