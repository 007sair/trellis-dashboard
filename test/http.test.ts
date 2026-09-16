import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { findProject } from '../src/server/project.js';
import { startServer } from '../src/server/http.js';
import { createFixture, digestTree } from './fixtures.js';
import type { Snapshot } from '../src/shared/types.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const clientDir = path.join(root, 'dist/client');
const bin = path.join(root, 'bin/trellis-dashboard.mjs');

async function ready(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('CLI startup timed out: ' + output)), 12_000);
    child.stdout?.on('data', chunk => { output += String(chunk); const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    child.stderr?.on('data', chunk => { output += String(chunk); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('CLI exited before ready: ' + code + ' ' + output)); });
  });
}

function rawRequest(url: string, headers: http.OutgoingHttpHeaders) {
  return new Promise<number | undefined>((resolve, reject) => {
    const request = http.get(url, { headers }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
}

test('HTTP serves bundled UI and read-only JSON, including HEAD', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const dashboard = await startServer({ project: await findProject(fixture.root), port: 0, clientDir });
  t.after(() => dashboard.close());
  assert.equal((dashboard.server.address() as { address: string }).address, '127.0.0.1');
  const before = await digestTree(fixture.root);
  const html = await fetch(dashboard.url);
  assert.match(await html.text(), /<div id="root">/);
  assert.match(html.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  const snapshot = await (await fetch(dashboard.url + '/api/snapshot')).json() as Snapshot;
  assert.equal(snapshot.tasks.length, 5);
  const document = await fetch(dashboard.url + '/api/document?path=' + encodeURIComponent('spec/frontend/index.md'));
  assert.equal(document.status, 200);
  const head = await fetch(dashboard.url + '/api/snapshot', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(await digestTree(fixture.root), before);
});

test('HTTP denies writes, DNS rebinding, cross-origin reads and traversal', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const dashboard = await startServer({ project: await findProject(fixture.root), port: 0, clientDir });
  t.after(() => dashboard.close());
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal((await fetch(dashboard.url + '/api/snapshot', { method })).status, 405);
  assert.equal(await rawRequest(dashboard.url + '/api/snapshot', { host: 'evil.invalid' }), 403);
  assert.equal((await fetch(dashboard.url + '/api/snapshot', { headers: { Origin: 'https://evil.invalid' } })).status, 403);
  assert.equal((await fetch(dashboard.url + '/api/snapshot', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  for (const target of ['../../.env', '/etc/passwd', 'spec/../.developer', 'scripts/task.py', 'spec\\..\\.env']) assert.equal((await fetch(dashboard.url + '/api/document?path=' + encodeURIComponent(target))).status, 403, target);
  assert.equal((await fetch(dashboard.url + '/api/document')).status, 400);
  assert.equal((await fetch(dashboard.url + '/api/unknown')).status, 404);
  assert.equal((await fetch(dashboard.url + '/package.json')).status, 404);
  assert.equal((await fetch(dashboard.url + '/assets/%ZZ.js')).status, 400);
});

test('HTTP reports root loss instead of stale data and reports occupied ports', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const project = await findProject(fixture.root);
  const dashboard = await startServer({ project, port: 0, clientDir });
  t.after(() => dashboard.close());
  const port = (dashboard.server.address() as { port: number }).port;
  await assert.rejects(startServer({ project, port, clientDir }), (error: unknown) => (error as { code: string }).code === 'PORT_IN_USE');
  await fs.rename(fixture.trellis, fixture.trellis + '-moved');
  assert.equal((await fetch(dashboard.url + '/api/snapshot')).status, 503);
  await fs.rename(fixture.trellis + '-moved', fixture.trellis);
  assert.equal((await fetch(dashboard.url + '/api/snapshot')).status, 200);
});

test('built CLI supports help/version/errors outside any Trellis project', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const invoke = (args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd: fixture.temporary, encoding: 'utf8', timeout: 10_000 });
  const help = invoke(['--help']); assert.equal(help.status, 0); assert.match(help.stdout, /--no-open/);
  const version = invoke(['--version']); assert.equal(version.status, 0); assert.match(version.stdout, /0\.1\.0/);
  const missing = invoke(['--no-open']); assert.notEqual(missing.status, 0); assert.match(missing.stderr, /NO_TRELLIS/);
  const invalid = invoke(['--port', 'abc']); assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /INVALID_PORT/);
});

test('built CLI starts from project subdirectory, serves assets and releases its port on SIGTERM', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const before = await digestTree(fixture.root);
  const child = spawn(process.execPath, [bin, '--port', '0', '--no-open'], { cwd: path.join(fixture.root, 'packages/app/src'), stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const url = await ready(child);
  const html = await (await fetch(url)).text();
  const asset = html.match(/src="([^\"]+\.js)"/)?.[1];
  assert.ok(asset); assert.equal((await fetch(url + asset)).status, 200);
  assert.equal(((await (await fetch(url + '/api/snapshot')).json()) as Snapshot).project.root, await fs.realpath(fixture.root));
  const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  assert.equal(await exited, 0);
  const replacement = await startServer({ project: await findProject(fixture.root), port: Number(new URL(url).port), clientDir });
  await replacement.close();
  assert.equal(await digestTree(fixture.root), before);
});
