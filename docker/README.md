# 轻页文件工具箱 · Docker 版

同一套 PDF / 图片 / 办公文档 / 音视频转换引擎，跑在 Docker 里。文件通过 volume 挂载进出，不经过飞牛应用权限体系，因此不会再出现“应用中心已授权、转换时 Permission denied”的问题。

## 快速开始

```sh
cd docker
docker compose up -d --build
```

打开 `http://NAS_IP:8080/app/qingye/`。默认目录：

| 容器路径 | 用途 | 宿主机默认位置 |
|---|---|---|
| `/input` | 待处理文件（只读） | `docker/input` |
| `/output` | 输出文件 | `docker/output` |
| `/data/files` | 上传文件和共享目录 | `docker/data/files` |
| `/data/state` | 任务历史、运行状态 | `docker/data/state` |

把要处理的文件放进 `docker/input`，在页面里选择文件后直接开始处理；Docker 版默认把结果保存到 `/output`（对应宿主机 `docker/output`），也可以在“保存到 → 更改”中改到其他授权目录。

也可以直接挂载 NAS 上已有的目录。例如处理 `/vol1/1000/音乐`：

```yaml
volumes:
  - /vol1/1000/音乐:/input:ro
  - /vol1/1000/轻页输出:/output
  - ./data:/data
```

修改 `docker-compose.yml` 后执行 `docker compose up -d` 重建容器。

## 访问密码

默认不设密码。建议在 `docker/.env` 中设置：

```sh
QINGYE_PASSWORD=换成一个强密码
```

然后重启容器。浏览器会弹出 HTTP Basic Auth 登录框，用户名默认 `admin`，可用 `QINGYE_USERNAME` 修改。不要把 8080 端口直接暴露到公网；需要外网访问时放在带 TLS 的反向代理后面。

## 目录和权限

容器默认以 root 运行，因此能读取宿主机上属主为其他用户的挂载文件，这正是 Docker 版绕开 fnOS ACL 的原因。

如果希望输出文件在宿主机上不是 root 属主，可以取消 compose 中 `user: "1000:1000"` 的注释，并确保 `/input`、`/output`、`/data` 对该 UID/GID 可读写。此时权限问题会重新出现，需要按普通 Linux 权限处理。

## 与飞牛版的区别

- 不需要飞牛应用中心授权，不需要 `setfacl`；目录由 compose 的 `volumes` 决定。
- 不调用飞牛应用设置；可访问目录完全由 compose 的 `volumes` 决定。
- 不包含飞牛统一网关登录；用 HTTP Basic Auth 或反向代理保护。
- 不暴露本地 MCP 端口；如需给本机 AI 使用，可后续单独增加 MCP 服务。

## 构建与验证

```sh
# 本机架构
docker build -t qingye-toolbox:1.2.13.0 -f docker/Dockerfile .

# 多架构（需要 buildx）
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-registry/qingye-toolbox:1.2.13.0 --push \
  -f docker/Dockerfile .
```

健康检查：`GET /healthz`。日志：`docker compose logs -f qingye`。

镜像内含 Node.js 22、FFmpeg、LibreOffice Writer/Calc/Impress、中文字体和项目运行依赖；首次构建需要下载 Debian 包和 npm 依赖。
