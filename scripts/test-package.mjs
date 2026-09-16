import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'trellis-dashboard-package-'));
let child;
try {
  const raw = execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const packages = JSON.parse(raw.slice(raw.indexOf('[\n')));
  const packed = packages[0];
  const files = packed.files.map(file => file.path);
  for (const required of ['bin/trellis-dashboard.mjs', 'dist/server/cli.js', 'dist/client/index.html', 'README.md']) assert.ok(files.includes(required), required);
  assert.ok(files.every(file => /^(bin\/|dist\/|README\.md$|package\.json$)/.test(file)), 'Package contains only distributable assets');
  const prefix = path.join(temporary, 'installation');
  execFileSync('npm', ['install', '--global', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temporary, packed.filename)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const installedBin = process.platform === 'win32' ? path.join(prefix, 'node_modules/trellis-dashboard/bin/trellis-dashboard.mjs') : path.join(prefix, 'lib/node_modules/trellis-dashboard/bin/trellis-dashboard.mjs');
  const command = process.platform === 'win32' ? process.execPath : path.join(prefix, 'bin/trellis-dashboard');
  const commandPrefix = process.platform === 'win32' ? [installedBin] : [];
  assert.match(execFileSync(command, [...commandPrefix, '--version'], { cwd: temporary, encoding: 'utf8' }), /0\.1\.0/);
  const project = path.join(temporary, '中文 project');
  const taskFile = path.join(project, '.trellis/tasks/demo/task.json');
  await fs.mkdir(path.dirname(taskFile), { recursive: true });
  await fs.mkdir(path.join(project, 'nested/src'), { recursive: true });
  await fs.writeFile(taskFile, JSON.stringify({ id: 'package-check', title: '打包安装验证', status: 'planning' }));
  const digest = async () => createHash('sha256').update(await fs.readFile(taskFile)).digest('hex');
  const before = await digest();
  child = spawn(command, [...commandPrefix, '--no-open', '--port', '0'], { cwd: path.join(project, 'nested/src'), stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Installed CLI startup timed out: ' + output)), 12_000);
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('Installed CLI exited early: ' + code + ' ' + output)); });
  });
  const snapshot = await (await fetch(url + '/api/snapshot')).json();
  assert.equal(snapshot.tasks[0].title, '打包安装验证');
  assert.equal(snapshot.project.root, await fs.realpath(project));
  const html = await (await fetch(url)).text();
  const asset = html.match(/src="([^\"]+\.js)"/)?.[1];
  assert.ok(asset); assert.equal((await fetch(url + asset)).status, 200);
  assert.equal(await digest(), before);
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  assert.equal(await exited, 0);
  console.log(`PASS package: ${packed.filename}; ${files.length} allowed files; offline isolated global installation; executable from nested Unicode project; UI + API + unchanged source; clean shutdown.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (error?.stderr) console.error(String(error.stderr).slice(-4000));
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL');
    await exited;
  }
  await fs.rm(temporary, { recursive: true, force: true });
}
