import http from 'node:http';

/**
 * 轻页的「本机 Web 入口」。
 *
 * 飞牛桌面通过统一网关（Unix Socket + X-Trim-* 身份头）打开轻页；这里额外在
 * 127.0.0.1 上开一个很小的反向代理，方便用户用 SSH 隧道或 NAS 上的 nginx
 * 反代后用普通浏览器访问。
 *
 * 安全约束：
 *  - 只允许绑定回环地址（127.0.0.1 / ::1），不监听局域网，避免把无鉴权的
 *    入口暴露给同网段设备；
 *  - 客户端发来的任何 X-Trim-* 头一律丢弃，身份由代理注入，防止伪造管理员；
 *  - 文件可访问范围仍由应用账号的飞牛 ACL 决定，Web 入口不会放宽授权边界。
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
/**
 * 解析本机 Web 入口的启用配置（纯函数，便于单测）。
 *
 * 默认**开启**（`QINGYE_WEB=0` 关闭）：只绑回环，供 SSH 隧道 / nginx 反代后使用。
 * 代理会把请求视作应用身份，所以 `QINGYE_WEB_UID` 必须是数字；给错值就整套停用，
 * 避免用错身份运行而不自知。
 */
export function resolveWebEntryOptions(env = {}) {
  if (env.QINGYE_WEB === '0') return null;
  const uid = env.QINGYE_WEB_UID === undefined || env.QINGYE_WEB_UID === '' ? '1000' : String(env.QINGYE_WEB_UID);
  if (!/^\d+$/.test(uid)) return null;
  const port = Number(env.QINGYE_WEB_PORT || 32181);
  return {
    host: '127.0.0.1',
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 32181,
    uid,
    username: env.QINGYE_WEB_USERNAME || 'web',
  };
}


export function startWebEntry({socketPath, host = '127.0.0.1', port = 32181, uid = '1000', username = 'web', prefix = '/app/qingye'} = {}) {
  if (!socketPath) throw Error('缺少应用的 Unix Socket 路径');
  if (!LOOPBACK.has(host)) throw Error('本机 Web 入口只允许绑定回环地址（127.0.0.1 或 ::1）');
  if (!/^\d+$/.test(String(uid))) throw Error('Web 入口的用户 ID 必须是数字');

  const proxy = http.createServer((req, res) => {
    const headers = {...req.headers};
    for (const name of Object.keys(headers)) if (name.startsWith('x-trim-')) delete headers[name];
    headers['x-trim-userid'] = String(uid);
    headers['x-trim-isadmin'] = 'true';
    headers['x-trim-username'] = String(username);
    const remote = http.request({socketPath, path: req.url, method: req.method, headers}, upstream => {
      const responseHeaders = {...upstream.headers};
      delete responseHeaders.connection;
      delete responseHeaders['keep-alive'];
      res.writeHead(upstream.statusCode || 502, responseHeaders);
      upstream.pipe(res);
    });
    remote.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'});
        res.end('轻页本机 Web 入口暂时不可用，请回到飞牛桌面打开应用。');
      } else res.destroy();
    });
    req.pipe(remote);
  });
  proxy.on('clientError', (error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(port, host, () => {
      const actual = proxy.address();
      const shown = typeof actual === 'object' && actual ? actual.port : port;
      resolve({
        server: proxy,
        url: `http://${host}:${shown}${prefix}/`,
        port: shown,
        close: () => new Promise(done => proxy.close(done)),
      });
    });
  });
}
