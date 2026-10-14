# 轻页文件工具箱 · 飞牛独立版

目标：fnOS 1.2.0800、Intel i5-6500 / x86-64。安装 FPK 后从飞牛桌面直接打开；不依赖 Windows/Mac 客户端，不需要 Docker。Docker 只用于开发时构建 Linux 运行文件。

## 安装使用

1. 飞牛应用中心 → 手动安装，选择 `Qingye-Toolbox-1.2.4-fnos-x86.fpk`，选择存储空间。
2. 安装后启动应用，使用飞牛管理员账号点击桌面“轻页文件工具箱”。
3. 默认使用应用创建的 `qingye/files` 共享目录。需要处理其他位置时，在飞牛的应用设置中给轻页授权相应目录，然后停止并重新启动轻页。
4. 点击“选择 NAS 文件”，进入授权目录并勾选文件。也可以拖入电脑文件或点击“上传电脑文件”；上传文件保存在共享目录下“上传文件/用户ID”。
5. 选择操作和质量。默认结果保存在第一个输入文件旁，点击“更改”可以选择其他授权目录。
6. 处理后点击“打开位置”查看 NAS 结果路径或下载到电脑。文件重名会自动编号；原文件不覆盖。

首版限管理员使用。应用使用自己的低权限账号，仅在飞牛授权的目录内访问文件。修改授权后需要重启应用以刷新目录列表；系统撤销的文件权限即时由操作系统执行。前端复用飞牛统一网关登录，无独立公开 TCP 端口。

## 从 1.2.0 更新

在应用中心手动安装 1.2.4 FPK，更新已有的轻页应用，无需先卸载。更新完成后关闭原来的轻页窗口，再从飞牛桌面打开；必要时刷新浏览器页面。左下角应显示“飞牛独立版 1.2.4”。本次修复菜单和下拉选项初始化的脚本加载兼容性，并修复“上传电脑文件”会同时打开 NAS 选择窗的问题。NAS 选择窗现在将内容滚动区和底部操作按钮分开，短屏幕下按钮保持可见。上传电脑文件改为显示实时进度，并在连接中断或超时后显示可重试的错误，不会无限停留在上传状态。如果仍未加载，页面会保留加载提示或显示具体启动错误。

## 功能和限制

PDF 压缩、合并、页码提取、转图片；图片转换和多图合并 PDF；Word/Excel/PPT 转 PDF；音频转换、提取音轨；视频转 MP4、压缩和调整分辨率。内置中文回退字体，缺少原字体时排版可能不同。文档和图片单文件 500 MiB；音视频 20 GiB；每批 100 个文件，合并总输入 500 MiB。默认一次运行一个转换任务，视频使用 CPU 软件编码。

NAS 文件不需要上传到电脑或云端。电脑文件的“上传”仅进入你的 NAS。组件随包提供，正常转换不访问外部服务。安装包包含办公组件，因此比桌面基础包大。

当前不包含远程 MCP、硬件转码、OCR、广告和多普通用户权限管理。刷新页面或重启后不自动重试任务；已导出文件保留。停止应用会取消未完成任务。卸载脚本不会主动删除输入文件或已导出结果；卸载时请留意飞牛自身的数据清理选项。

## 故障排查

- 看不到目录：检查飞牛应用目录授权并重启轻页。
- 提示没有权限：确认输入目录可读、输出目录可写；不要把整个系统根目录授权给应用。
- 应用启动失败：查看应用数据目录中的 `app.log`；上次启动日志为 `app.previous.log`。
- 页面打不开：确认使用管理员账号，应用状态为运行，并且系统支持统一网关。测试目标是 fnOS 1.2.0800。
- 转换慢：i5-6500 使用软件编码时，视频耗时明显高于图片/PDF；不要同时运行大量其他 NAS 转码任务。
- Office 排版差异：缺少原字体时使用内置中文字体，无法保证与微软 Office 像素级一致。

## 构建

构建机需要 Docker、Node.js、npm 依赖及官方 fnpack 1.2.4。构建镜像固定摘要，Linux 用户态依赖取自 Debian 12 官方仓库；确切版本记录在包内 runtime/debian-packages.txt。不安装任何依赖到 NAS 系统目录。

```
npm ci
node fnos/build-client.mjs
docker build --platform linux/amd64 -f fnos/Dockerfile --target payload --output type=local,dest=fnos/build/payload .
QINGYE_FIXTURES=/path/to/office-fixtures sh fnos/tests/validate-linux.sh
FNPACK=/path/to/fnpack node fnos/build-fpk.mjs
```

测试夹具由项目内 `scripts/create-office-fixtures.py` 生成。Linux 验证在断网容器内以 UID 1000 运行，不预装 Office 或 FFmpeg；测试结果截图保存至 `artifacts/fnos-linux`。构建目录为临时产物，重新构建时应使用空的 `fnos/build/payload` 目录，避免旧文件残留。

飞牛规范来源：
- https://developer.fnnas.com/docs/core-concepts/gateway-registration/
- https://developer.fnnas.com/docs/core-concepts/privilege/
- https://developer.fnnas.com/docs/core-concepts/resource/
- https://developer.fnnas.com/docs/cli/fnpack/

## 许可与源码

应用源码使用 AGPL-3.0-or-later。MuPDF、Sharp、Noto 字体等许可见主项目声明。原生依赖的版权声明和许可证随包放在 runtime/licenses；Node 的 LICENSE 随 runtime 保留。FFmpeg、LibreOffice 及 Debian 库的对应源包可按 runtime/debian-packages.txt 记录的版本从 Debian 官方源档案 https://snapshot.debian.org/ 获取。源码交付附带构建脚本和固定基础镜像摘要。

实机安装与飞牛网关、ACL 的最终兼容性，需要在目标设备上验证。本地 Linux 测试不能代替这一项。
