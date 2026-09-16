import { test, expect } from './harness.js';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { writeFile, writeTask } from '../fixtures.js';

test('board, compound filters, list, archive and clear controls stay consistent', async ({ page, dashboard }, testInfo) => {
  await page.goto(dashboard.url);
  await expect(page.getByRole('heading', { name: '任务面板', exact: true })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(4);
  await expect(page.locator('.stat-number').first()).toHaveText('04');
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true });
  await page.getByRole('textbox', { name: '搜索任务', exact: true }).fill('命令');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await expect(page.locator('.stat-number').first()).toHaveText('01');
  await page.getByRole('combobox', { name: '按负责人筛选' }).selectOption('Mia');
  await expect(page.getByText('没有匹配的任务', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.task-card')).toHaveCount(4);
  await page.getByRole('combobox', { name: '按状态筛选' }).selectOption('in_progress');
  await page.getByRole('combobox', { name: '按优先级筛选' }).selectOption('P1');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.getByRole('button', { name: '列表视图', exact: true }).click();
  await expect(page.locator('.task-table tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: /归档任务/ }).click();
  await expect(page.locator('.task-table tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '初始化规范', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /全部任务/ }).click();
  await expect(page.locator('.task-table tbody tr')).toHaveCount(5);
});

test('task detail reads artifacts and metadata safely without external network requests', async ({ page, dashboard }, testInfo) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith(dashboard.url)) external.push(request.url()); });
  await page.goto(dashboard.url);
  await page.getByRole('button', { name: '查看任务：命令行启动体验', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '验收要求', exact: true })).toBeVisible();
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '2');
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('max', '3');
  expect(await page.evaluate(() => Reflect.get(window, '__trellisXss'))).toBeUndefined();
  await expect(dialog.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(dialog.getByText(/本地阅读模式不自动加载图片/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('task-detail.png') });
  await dialog.getByRole('button', { name: /implement.jsonl/ }).click();
  await expect(dialog.getByText(/第 3 行/)).toBeVisible();
  await expect(dialog.getByText(/2 条有效记录/)).toBeVisible();
  await dialog.getByRole('button', { name: '原始元数据' }).click();
  await expect(dialog.locator('.raw-metadata')).toContainText('"custom": true');
  await dialog.getByRole('button', { name: /任务产物/ }).click();
  await dialog.getByRole('button', { name: /prd.md/ }).click();
  await dialog.getByRole('link', { name: '编码规范' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '质量规范', exact: true })).toBeVisible();
  expect(external).toEqual([]);
});

test('specs preserve real folders and workspace developer journals support internal navigation', async ({ page, dashboard }) => {
  await page.goto(dashboard.url + '/#specs');
  await expect(page.getByRole('heading', { name: '前端规范', exact: true })).toBeVisible();
  await expect(page.getByText('packages/api/backend', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '质量规范', exact: true }).click();
  await expect(page.getByRole('heading', { name: '安全边界', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: /工作记录/ }).click();
  await expect(page.getByRole('heading', { name: '工作区索引', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Alex', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alex 工作记录', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'journal-1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session 1: 只读面板', exact: true })).toBeVisible();
});

test('external task/document updates and deletion synchronize within five seconds', async ({ page, dashboard }) => {
  await page.goto(dashboard.url);
  await expect(page.locator('.task-card')).toHaveCount(4);
  await writeTask(dashboard.root, 'tasks/live', { title: '外部新增的任务', status: 'planning', priority: 'P2' });
  await expect(page.getByRole('button', { name: '查看任务：外部新增的任务', exact: true })).toBeVisible();
  await writeTask(dashboard.root, 'tasks/live', { title: '外部已修改的任务', status: 'constructor' });
  await expect(page.getByRole('button', { name: '查看任务：外部已修改的任务', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看任务：外部新增的任务', exact: true })).toHaveCount(0);
  await fs.rm(path.join(dashboard.root, '.trellis/tasks/live'), { recursive: true });
  await expect(page.locator('.task-card')).toHaveCount(4);
  await page.getByRole('button', { name: '查看任务：命令行启动体验', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /prd.md/ }).click();
  await writeFile(dashboard.root, '.trellis/tasks/09-01-command-launch/prd.md', '# 已更新的需求\n\n外部文档修改已同步。');
  await expect(dialog.getByRole('heading', { name: '已更新的需求', exact: true })).toBeVisible();
  await fs.unlink(path.join(dashboard.root, '.trellis/tasks/09-01-command-launch/prd.md'));
  await expect(dialog.getByRole('alert')).toContainText('不存在');
  await expect(dialog.getByRole('heading', { name: '已更新的需求', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('root loss clears stale view and recovery resumes automatically', async ({ page, dashboard }) => {
  await page.goto(dashboard.url);
  await expect(page.locator('.task-card')).toHaveCount(4);
  await fs.rename(path.join(dashboard.root, '.trellis'), path.join(dashboard.root, '.trellis-moved'));
  await expect(page.getByRole('alert')).toContainText('.trellis 目录已移走');
  await expect(page.locator('.task-card')).toHaveCount(0);
  await fs.rename(path.join(dashboard.root, '.trellis-moved'), path.join(dashboard.root, '.trellis'));
  await expect(page.locator('.task-card')).toHaveCount(4);
});

test('empty content and broken metadata show distinct actionable states', async ({ page, dashboard }) => {
  for (const directory of ['tasks', 'spec', 'workspace']) await fs.rm(path.join(dashboard.root, '.trellis', directory), { recursive: true });
  await page.goto(dashboard.url);
  await expect(page.getByText('这里是下一个想法的起点', { exact: true })).toBeVisible();
  await writeFile(dashboard.root, '.trellis/tasks/broken/task.json', 'not json');
  await expect(page.locator('.diagnostics summary')).toContainText('读取提示');
  await page.locator('.diagnostics summary').click();
  await expect(page.getByText(/task.json 不是有效 JSON/)).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: /规范库/ }).click();
  await expect(page.getByText('暂无规范库', { exact: true })).toBeVisible();
});

test('mobile navigation and detail have no horizontal page overflow', async ({ page, dashboard }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(dashboard.url);
  await expect(page.locator('.task-card')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '查看任务：命令行启动体验', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '验收要求', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png') });
  await page.getByRole('button', { name: '关闭任务详情' }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: /规范库/ }).click();
  await expect(page.getByRole('heading', { name: '前端规范', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
