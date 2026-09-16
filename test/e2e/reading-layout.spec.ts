import type { Locator, Page } from '@playwright/test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './harness.js';
import { writeFile, writeTask } from '../fixtures.js';

const longMarkdown = '# 阅读空间验证\n\n[跳到尾部](#尾部目标)\n\n' + Array.from({ length: 100 }, (_, i) => `第 ${i + 1} 段：这是用于验证独立滚动的长文档。正文滚动时标题和目录保持原位。\n\n`).join('') + '## 尾部目标\n\n这里应在正文内部定位，不带动页面框架。\n';

async function addLibrary(root: string, directory: string) {
  await writeFile(root, `.trellis/${directory}/000-reading.md`, longMarkdown);
  for (let index = 1; index <= 80; index++) await writeFile(root, `.trellis/${directory}/${String(index).padStart(3, '0')}-guide.md`, `# 指南 ${index}\n`);
  return directory + '/000-reading.md';
}

async function wheel(page: Page, locator: Locator, amount: number) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Scroll container is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 180));
  await page.mouse.wheel(0, amount);
}

async function fixedPositions(page: Page, selectors: string[]) {
  return page.evaluate(selectors => ({
    window: window.scrollY,
    positions: selectors.map(selector => Math.round(document.querySelector(selector)!.getBoundingClientRect().top)),
  }), selectors);
}

async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('desktop dialog dedicates height to reading, retains task info and isolates both scroll areas', async ({ page, dashboard }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const taskDirectory = 'tasks/09-01-command-launch';
  const metadata = JSON.parse(await fs.readFile(path.join(dashboard.root, '.trellis', taskDirectory, 'task.json'), 'utf8'));
  metadata.description = '完整任务描述。\n'.repeat(40) + '任务说明末尾';
  metadata.notes = '详细备注。\n'.repeat(80) + '备注末尾';
  await writeTask(dashboard.root, taskDirectory, metadata);
  await writeFile(dashboard.root, `.trellis/${taskDirectory}/prd.md`, longMarkdown);
  for (let i = 0; i < 70; i++) await writeFile(dashboard.root, `.trellis/${taskDirectory}/research/note-${i}.md`, '# 研究记录');
  await page.goto(dashboard.url);
  await page.getByRole('button', { name: '查看任务：命令行启动体验', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const content = dialog.getByRole('region', { name: '文档正文', exact: true });
  const directory = dialog.getByLabel('任务产物目录', { exact: true });
  await expect(content.locator('.markdown-body')).toBeVisible();
  expect(await content.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(630);
  const fixed = await fixedPositions(page, ['.detail-header', '.detail-tabs', '.document-bar']);
  await page.screenshot({ path: testInfo.outputPath('reading-dialog-desktop.png') });
  await wheel(page, content, 500);
  await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const contentPosition = await content.evaluate(element => element.scrollTop);
  expect(await directory.evaluate(element => element.scrollTop)).toBe(0);
  await wheel(page, directory, 500);
  await expect.poll(() => directory.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await content.evaluate(element => element.scrollTop)).toBe(contentPosition);
  expect(await fixedPositions(page, ['.detail-header', '.detail-tabs', '.document-bar'])).toEqual(fixed);
  await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await wheel(page, content, 900);
  await paint(page);
  expect(await fixedPositions(page, ['.detail-header', '.detail-tabs', '.document-bar'])).toEqual(fixed);
  await directory.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const end = await content.evaluate(element => element.scrollTop);
  await wheel(page, directory, 900);
  await paint(page);
  expect(await content.evaluate(element => element.scrollTop)).toBe(end);
  expect(await fixedPositions(page, ['.detail-header', '.detail-tabs', '.document-bar'])).toEqual(fixed);
  await dialog.getByRole('button', { name: '任务信息', exact: true }).click();
  await expect(dialog.getByRole('region', { name: '任务信息内容' })).toContainText('任务说明末尾');
  await expect(dialog.getByRole('region', { name: '任务信息内容' })).toContainText('备注末尾');
  await expect(dialog.getByRole('button', { name: '文档目录整理', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '原始元数据' }).click();
  await expect(dialog.getByRole('region', { name: '原始元数据内容' })).toContainText('"custom": true');
});

for (const module of [{ page: 'specs', directory: 'spec/layout', label: '规范库' }, { page: 'workspace', directory: 'workspace/LayoutUser', label: '工作记录' }]) {
  test(`${module.page} has a compact toolbar, independent panes and stable refresh/anchor positions`, async ({ page, dashboard }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const file = await addLibrary(dashboard.root, module.directory);
    await page.goto(dashboard.url + '/#' + module.page + '?file=' + encodeURIComponent(file));
    const content = page.getByRole('region', { name: '文档正文', exact: true });
    const directory = page.getByRole('region', { name: module.label + '文件列表' });
    await expect(content.locator('.markdown-body')).toBeVisible();
    expect(await content.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(630);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    const heading = await page.locator('.library-title').boundingBox();
    const search = await page.getByRole('textbox', { name: '搜索' + module.label + '文件' }).boundingBox();
    expect(search!.x).toBeGreaterThan(heading!.x + heading!.width);
    expect(Math.abs(search!.y + search!.height / 2 - heading!.y - heading!.height / 2)).toBeLessThan(20);
    const selectors = ['.topbar', '.library-heading', '.document-bar'];
    const fixed = await fixedPositions(page, selectors);
    await page.screenshot({ path: testInfo.outputPath(`reading-${module.page}-desktop.png`) });
    await wheel(page, directory, 450);
    await expect.poll(() => directory.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const directoryPosition = await directory.evaluate(element => element.scrollTop);
    expect(await content.evaluate(element => element.scrollTop)).toBe(0);
    await wheel(page, content, 650);
    await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await directory.evaluate(element => element.scrollTop)).toBe(directoryPosition);
    expect(await fixedPositions(page, selectors)).toEqual(fixed);
    await content.evaluate(element => { element.scrollTop = 0; });
    await content.getByRole('link', { name: '跳到尾部', exact: true }).click();
    await expect(content.getByRole('heading', { name: '尾部目标', exact: true })).toBeInViewport();
    const anchorPosition = await content.evaluate(element => element.scrollTop);
    expect(anchorPosition).toBeGreaterThan(1000);
    expect(await fixedPositions(page, selectors)).toEqual(fixed);
    expect(await directory.evaluate(element => element.scrollTop)).toBe(directoryPosition);
    await page.waitForResponse(response => response.url().includes('/api/document?') && new URL(response.url()).searchParams.get('path') === file && response.status() === 200);
    await paint(page);
    expect(await content.evaluate(element => element.scrollTop)).toBe(anchorPosition);
    await content.evaluate(element => { element.scrollTop = 280; });
    await page.waitForResponse(response => response.url().includes('/api/document?') && new URL(response.url()).searchParams.get('path') === file && response.status() === 200);
    await paint(page);
    expect(await content.evaluate(element => element.scrollTop)).toBe(280);
    await directory.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await wheel(page, directory, 1000);
    await paint(page);
    expect(await content.evaluate(element => element.scrollTop)).toBe(280);
    expect(await fixedPositions(page, selectors)).toEqual(fixed);
    await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const directoryEnd = await directory.evaluate(element => element.scrollTop);
    await wheel(page, content, 1000);
    await paint(page);
    expect(await directory.evaluate(element => element.scrollTop)).toBe(directoryEnd);
    expect(await fixedPositions(page, selectors)).toEqual(fixed);
  });
}

test('mobile reading keeps height and document directory opens without pushing the page', async ({ page, dashboard }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await writeFile(dashboard.root, '.trellis/tasks/09-01-command-launch/prd.md', longMarkdown);
  await page.goto(dashboard.url);
  await page.getByRole('button', { name: '查看任务：命令行启动体验', exact: true }).click();
  const dialogContent = page.getByRole('dialog').getByRole('region', { name: '文档正文', exact: true });
  await expect(dialogContent.locator('.markdown-body')).toBeVisible();
  expect(await dialogContent.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(422);
  await page.screenshot({ path: testInfo.outputPath('reading-dialog-mobile.png') });
  await page.getByRole('button', { name: '关闭任务详情' }).click();
  for (const module of [{ page: 'specs', directory: 'spec/layout', label: '规范库', target: 'quality-guidelines.md', heading: '质量规范' }, { page: 'workspace', directory: 'workspace/LayoutUser', label: '工作记录', target: 'journal-1.md', heading: 'Journal 1' }]) {
    const file = await addLibrary(dashboard.root, module.directory);
    await page.goto(dashboard.url + '/#' + module.page + '?file=' + encodeURIComponent(file));
    const content = page.getByRole('region', { name: '文档正文', exact: true });
    const directory = page.getByLabel(module.label + '文档目录', { exact: true });
    await expect(content.locator('.markdown-body')).toBeVisible();
    expect(await content.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(422);
    await expect(directory).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`reading-${module.page}-mobile.png`) });
    await page.getByRole('button', { name: '打开文档目录' }).click();
    await expect(directory).toBeVisible();
    const height = await content.evaluate(element => element.clientHeight);
    expect(height).toBeGreaterThanOrEqual(422);
    await directory.getByRole('button', { name: module.target, exact: true }).click();
    await expect(directory).toBeHidden();
    await expect(content.getByRole('heading', { name: module.heading, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '打开文档目录' }).click();
    await directory.getByRole('region', { name: module.label + '文件列表' }).focus();
    await page.keyboard.press('Escape');
    await expect(directory).toBeHidden();
    await expect(page.getByRole('button', { name: '打开文档目录' })).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});
