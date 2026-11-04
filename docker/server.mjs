import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {createApplication, PREFIX} from '../fnos/server.mjs';

const port = Number(process.env.QINGYE_PORT || 8080);
const bind = process.env.QINGYE_BIND || '0.0.0.0';
const socket = process.env.QINGYE_SOCKET || '/tmp/qingye.sock';
const stateDir = process.env.QINGYE_STATE || '/data/state';
const share = process.env.QINGYE_SHARE || '/data/files';
const roots = (process.env.QINGYE_ROOTS || `/input:/output:${share}`).split(':').filter(Boolean);
const uid = process.env.QINGYE_UID || '1000';
const username = process.env.QINGYE_USERNAME || 'admin';
const password = process.env.QINGYE_PASSWORD || '';
const label = process.env.QINGYE_LABEL || 'Docker 版';
const version = process.env.QINGYE_VERSION || '1.2.13.0';

for (const dir of [...roots, share, stateDir, path.dirname(socket)]) await fs.mkdir(dir, {recursive: true});

function authorized(req) {
  if (!password) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const expected = `${username}:${password}`;
  const left = Buffer.from(decoded), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function unauthorized(res) {
  res.writeHead(401, {'WWW-Authenticate': 'Basic realm="Qingye", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8'});
  res.end('需要登录');
}

const app = await createApplication({roots, share, stateDir, label, version, defaultOutput: process.env.QINGYE_DEFAULT_OUTPUT || '/output'});
await fs.unlink(socket).catch((error) => { if (error.code !== 'ENOENT') throw error; });
await new Promise((resolve, reject) => app.server.listen(socket, resolve).once('error', reject));
await fs.chmod(socket, 0o660).catch(() => {});

const proxy = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('ok');
    return;
  }
  if (req.url === '/' || req.url === '') {
    res.writeHead(302, {Location: `${PREFIX}/`});
    res.end();
    return;
  }
  if (!authorized(req)) return unauthorized(res);
  const headers = {...req.headers, 'x-trim-userid': uid, 'x-trim-isadmin': 'true', 'x-trim-username': username};
  const remote = http.request({socketPath: socket, path: req.url, method: req.method, headers}, (upstream) => {
    const responseHeaders = {...upstream.headers};
    delete responseHeaders.connection;
    delete responseHeaders['keep-alive'];
    if (String(responseHeaders['content-type'] || '').includes('text/html')) {
      const chunks = [];
      upstream.on('data', (chunk) => chunks.push(chunk));
      upstream.on('end', () => {
        const body = Buffer.from(Buffer.concat(chunks).toString('utf8').replaceAll('飞牛独立版', 'Docker 版'));
        delete responseHeaders['content-length'];
        delete responseHeaders['transfer-encoding'];
        responseHeaders['content-length'] = String(body.length);
        res.writeHead(upstream.statusCode || 502, responseHeaders);
        res.end(body);
      });
      upstream.on('error', () => res.destroy());
      return;
    }
    res.writeHead(upstream.statusCode || 502, responseHeaders);
    upstream.pipe(res);
  });
  remote.on('error', () => { if (!res.headersSent) { res.writeHead(502, {'Content-Type': 'text/plain; charset=utf-8'}); res.end('轻页服务暂时不可用'); } else res.destroy(); });
  req.pipe(remote);
});
proxy.on('clientError', (error, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });
await new Promise((resolve, reject) => proxy.listen(port, bind, resolve).once('error', reject));
console.log(`Qingye Docker ready: http://${bind}:${port}${PREFIX}/ (roots: ${roots.join(', ')})`);

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`Qingye Docker stopping (${signal})`);
  await new Promise((resolve) => proxy.close(resolve));
  await app.close().catch(() => {});
  await fs.unlink(socket).catch(() => {});
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => shutdown(signal).catch(() => process.exit(1)));
