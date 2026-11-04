import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from '../../tests/fixtures.mjs';

const project = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  server.on('error', reject);
});

test('docker wrapper serves the UI and converts through mounted directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qingye-docker-'));
  const input = path.join(root, 'input'), output = path.join(root, 'output'), data = path.join(root, 'data');
  await fs.mkdir(input, {recursive: true}); await fs.mkdir(output, {recursive: true}); await fs.mkdir(path.join(data, 'files'), {recursive: true});
  await fs.writeFile(path.join(input, 'test.pdf'), fixture());
  const port = await freePort();
  const child = spawn(process.execPath, ['docker/server.mjs'], {
    cwd: project,
    env: {
      ...process.env,
      QINGYE_ROOTS: `${input}:${output}:${path.join(data, 'files')}`,
      QINGYE_SHARE: path.join(data, 'files'),
      QINGYE_STATE: path.join(data, 'state'),
      QINGYE_PORT: String(port),
      QINGYE_BIND: '127.0.0.1',
      QINGYE_DEFAULT_OUTPUT: output,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.match(await (await fetch(base + '/app/qingye/')).text(), /Docker 版/);
    const settings = await (await fetch(base + '/app/qingye/api/settings')).json();
    assert.equal(await fs.realpath(settings.defaultOutput), await fs.realpath(output));
    const selected = await (await fetch(base + '/app/qingye/api/nas/select', {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Qingye-Request': '1'},
      body: JSON.stringify({paths: [path.join(input, 'test.pdf')], operation: 'pdf_compress'}),
    })).json();
    assert.equal(selected.added.length, 1, JSON.stringify(selected));
    const started = await (await fetch(base + '/app/qingye/api/jobs', {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Qingye-Request': '1'},
      body: JSON.stringify({operation: 'pdf_compress', inputs: [path.join(input, 'test.pdf')], outputDir: output, options: {preset: 'small'}}),
    })).json();
    let job;
    for (let i = 0; i < 100; i++) {
      job = await (await fetch(base + '/app/qingye/api/job?id=' + started.jobId)).json();
      if (job.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(job.status, 'completed', JSON.stringify(job));
    assert((await fs.stat(path.join(output, 'test_压缩版.pdf'))).size > 0);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await fs.rm(root, {recursive: true, force: true});
  }
  assert.match(logs, /Qingye Docker ready/);
});
