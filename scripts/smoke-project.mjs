import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  dir: { type: 'string' }, 'expect-tasks': { type: 'string' }, 'expect-specs': { type: 'string' }, 'expect-workspace': { type: 'string' }, screenshot: { type: 'string' },
} });
if (!values.dir) throw new Error('Use --dir <existing project root>; this script never creates target data.');
const project = await fs.realpath(path.resolve(values.dir));
const trellis = path.join(project, '.trellis');
const digest = async () => {
  const hash = createHash('sha256');
  let count = 0;
  const walk = async directory => {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      hash.update(path.relative(trellis, file));
      if (entry.isDirectory()) await walk(file);
      else if (entry.isSymbolicLink()) { hash.update(await fs.readlink(file)); count++; }
      else { hash.update(await fs.readFile(file)); count++; }
    }
  };
  await walk(trellis);
  return { sha256: hash.digest('hex'), files: count };
};
const before = await digest();
let child;
let browser;
try {
  child = spawn(process.execPath, [fileURLToPath(new URL('../bin/trellis-dashboard.mjs', import.meta.url)), '--dir', project, '--port', '0', '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('CLI did not become ready: ' + output)), 12_000);
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('CLI exited: ' + code + ' ' + output)); });
  });
  const response = await fetch(url + '/api/snapshot');
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  for (const [option, actual] of [['expect-tasks', snapshot.tasks.length], ['expect-specs', snapshot.specs.length], ['expect-workspace', snapshot.workspace.length]]) {
    if (values[option] !== undefined) assert.equal(actual, Number(values[option]), option);
  }
  assert.equal(snapshot.diagnostics.length, 0, 'Real source should have no ignored/invalid content');
  const documents = [...snapshot.tasks.flatMap(task => task.files), ...snapshot.specs, ...snapshot.workspace];
  for (const document of documents) {
    const result = await fetch(url + '/api/document?path=' + encodeURIComponent(document.path));
    assert.equal(result.status, 200, document.path);
    const body = await result.json();
    assert.equal(body.path, document.path);
    assert.equal(typeof body.content, 'string');
  }
  let readingLayout = null;
  if (values.screenshot) {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(url)) external.push(request.url()); });
    await fs.mkdir(path.dirname(path.resolve(values.screenshot)), { recursive: true });
    const image = path.parse(values.screenshot);
    readingLayout = {};
    for (const viewport of [{ width: 1440, height: 900, label: 'desktop', minimum: 630 }, { width: 390, height: 844, label: 'mobile', minimum: 422 }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(url);
      await page.getByRole('heading', { name: '任务面板', exact: true }).waitFor();
      const cards = page.locator('.task-card');
      assert.equal(await cards.count(), snapshot.tasks.filter(task => !task.archived).length);
      if (viewport.label === 'desktop') await page.screenshot({ path: values.screenshot, fullPage: true });
      const measurements = {};
      measurements.tasks = await page.evaluate(() => {
        const first = document.querySelector('.task-card');
        return { pageHeight: document.documentElement.scrollHeight, statsHeight: document.querySelector('.stats-grid').clientHeight, firstCardTop: first ? Math.round(first.getBoundingClientRect().top) : null, cardViewport: first?.closest('.lane-cards')?.clientHeight ?? null };
      });
      assert.ok(measurements.tasks.pageHeight <= viewport.height + 1, 'Task panel must fit viewport');
      assert.ok(measurements.tasks.statsHeight <= 76, 'Task statistics must be compact');
      if (measurements.tasks.cardViewport !== null) assert.ok(measurements.tasks.cardViewport >= (viewport.label === 'desktop' ? 450 : 300), 'Task cards need usable remaining height');
      await page.screenshot({ path: path.join(image.dir, `${image.name}-${viewport.label}-tasks.png`) });
      await page.getByRole('button', { name: '列表视图', exact: true }).click();
      if (snapshot.tasks.some(task => !task.archived)) {
        await page.locator('.task-table-wrap').waitFor();
        measurements.tasks.tableViewport = await page.locator('.task-table-wrap').evaluate(element => element.clientHeight);
        assert.ok(measurements.tasks.tableViewport >= (viewport.label === 'desktop' ? 450 : 300), 'Task table needs usable remaining height');
        await page.screenshot({ path: path.join(image.dir, `${image.name}-${viewport.label}-tasks-list.png`) });
      }
      await page.getByRole('button', { name: '看板视图', exact: true }).click();
      if (snapshot.tasks.some(task => !task.archived)) {
        await cards.first().waitFor();
        await cards.first().click();
        await page.locator('.document-scroll').waitFor();
        await page.locator('.document-loading').waitFor({ state: 'hidden' });
        measurements.dialog = await page.locator('.document-scroll').evaluate(element => element.clientHeight);
        assert.ok(measurements.dialog >= viewport.minimum, `${viewport.label} task reading height ${measurements.dialog}`);
        await page.screenshot({ path: path.join(image.dir, `${image.name}-${viewport.label}-dialog.png`) });
        await page.getByRole('button', { name: '关闭任务详情' }).click();
      }
      for (const [label, key] of [['规范库', 'specs'], ['工作记录', 'workspace']]) {
        await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: new RegExp(label) }).click();
        await page.locator('.markdown-body').waitFor();
        measurements[key] = await page.locator('.document-scroll').evaluate(element => element.clientHeight);
        assert.ok(measurements[key] >= viewport.minimum, `${viewport.label} ${key} reading height ${measurements[key]}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth), 'Reader frame must fit viewport');
        await page.screenshot({ path: path.join(image.dir, `${image.name}-${viewport.label}-${key}.png`) });
      }
      readingLayout[viewport.label] = measurements;
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await browser.close(); browser = undefined;
  }
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  assert.equal(await exited, 0);
  const after = await digest();
  assert.deepEqual(after, before, 'Target .trellis bytes changed during read-only smoke test (possibly an external writer).');
  console.log(JSON.stringify({ result: 'passed', version: snapshot.project.version, tasks: snapshot.tasks.length, specs: snapshot.specs.length, workspace: snapshot.workspace.length, documentsRead: documents.length, diagnostics: snapshot.diagnostics.length, sourceFilesHashed: before.files, sourceUnchanged: true, browser: values.screenshot ? 'passed' : 'not-run', readingLayout, screenshot: values.screenshot ?? null }, null, 2));
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL');
    await exited;
  }
}
