import type { Locator, Page } from '@playwright/test';
import { test, expect } from './harness.js';
import { writeTask } from '../fixtures.js';

async function addLongTaskLists(root: string) {
  for (const status of ['planning', 'in_progress', 'completed']) {
    for (let index = 0; index < 18; index++) {
      await writeTask(root, `tasks/layout-${status}-${index}`, {
        id: `layout-${status}-${index}`, title: `滚动任务-${status}-${index}`, description: '用于验证任务列独立滚动与固定工具栏。',
        status, priority: index % 2 ? 'P1' : 'P2', assignee: index % 2 ? 'Alex' : 'Mia', createdAt: `2026-09-${String(index + 1).padStart(2, '0')}`,
      });
    }
  }
}

async function wheelWithin(page: Page, locator: Locator, y: number, x = 0) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Scroll target is not visible');
  await page.mouse.move(box.x + Math.min(box.width / 2, 120), box.y + Math.min(box.height / 2, 160));
  await page.mouse.wheel(x, y);
}

async function frame(page: Page) {
  return page.evaluate(() => ({
    window: scrollY,
    rootHeight: document.documentElement.scrollHeight,
    rootWidth: document.documentElement.scrollWidth,
    fixed: ['.topbar', '.task-heading', '.stats-grid', '.task-controls', '.filter-bar'].map(selector => Math.round(document.querySelector(selector)!.getBoundingClientRect().top)),
    columns: Array.from(document.querySelectorAll('.lane-heading')).map(element => Math.round(element.getBoundingClientRect().top)),
  }));
}

async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function settledScrollLeft(locator: Locator) {
  // Wait for the CSS lane snap to finish before asserting refresh preserves it.
  return locator.evaluate(element => new Promise<number>(resolve => {
    let previous = element.scrollLeft;
    let stableFrames = 0;
    const sample = () => {
      const current = element.scrollLeft;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 6) resolve(current);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}

test('task board is compact and columns scroll independently without moving controls or neighbours', async ({ page, dashboard }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await addLongTaskLists(dashboard.root);
  await page.goto(dashboard.url);
  await expect(page.locator('.task-card')).toHaveCount(58);
  expect(await page.locator('.stats-grid').evaluate(element => element.clientHeight)).toBeLessThanOrEqual(76);
  expect(await page.locator('.task-heading').evaluate(element => element.clientHeight)).toBeLessThanOrEqual(54);
  const planning = page.getByRole('region', { name: '规划中卡片列表', exact: true });
  const doing = page.getByRole('region', { name: '进行中卡片列表', exact: true });
  expect(await planning.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(450);
  const fixed = await frame(page);
  expect(fixed.rootHeight).toBeLessThanOrEqual(901);
  expect(fixed.rootWidth).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: testInfo.outputPath('tasks-board-desktop.png') });
  await wheelWithin(page, planning, 550);
  await expect.poll(() => planning.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const planningPosition = await planning.evaluate(element => element.scrollTop);
  expect(await doing.evaluate(element => element.scrollTop)).toBe(0);
  await wheelWithin(page, doing, 420);
  await expect.poll(() => doing.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const doingPosition = await doing.evaluate(element => element.scrollTop);
  expect(await planning.evaluate(element => element.scrollTop)).toBe(planningPosition);
  expect(await frame(page)).toEqual(fixed);
  await page.waitForResponse(response => response.url().endsWith('/api/snapshot') && response.status() === 200);
  await paint(page);
  expect(await planning.evaluate(element => element.scrollTop)).toBe(planningPosition);
  expect(await doing.evaluate(element => element.scrollTop)).toBe(doingPosition);
  await planning.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await wheelWithin(page, planning, 1000);
  await paint(page);
  expect(await doing.evaluate(element => element.scrollTop)).toBe(doingPosition);
  expect(await frame(page)).toEqual(fixed);
  await page.screenshot({ path: testInfo.outputPath('tasks-board-scrolled.png') });
});

test('task table scrolls under sticky column headers while filters and archive/list controls remain usable', async ({ page, dashboard }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await addLongTaskLists(dashboard.root);
  await page.goto(dashboard.url);
  await page.getByRole('button', { name: '列表视图', exact: true }).click();
  const table = page.getByRole('region', { name: '任务列表数据', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(58);
  expect(await table.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(450);
  const header = table.getByRole('columnheader', { name: '任务', exact: true });
  const headerTop = (await header.boundingBox())!.y;
  const fixed = await frame(page);
  await wheelWithin(page, table, 850);
  await expect.poll(() => table.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs((await header.boundingBox())!.y - headerTop)).toBeLessThanOrEqual(1);
  expect(await frame(page)).toEqual(fixed);
  const position = await table.evaluate(element => element.scrollTop);
  await page.waitForResponse(response => response.url().endsWith('/api/snapshot') && response.status() === 200);
  await paint(page);
  expect(await table.evaluate(element => element.scrollTop)).toBe(position);
  await page.screenshot({ path: testInfo.outputPath('tasks-table-desktop.png') });
  await table.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await wheelWithin(page, table, 1000);
  await paint(page);
  expect(await frame(page)).toEqual(fixed);
  await page.getByRole('combobox', { name: '按状态筛选' }).selectOption('in_progress');
  await page.getByRole('combobox', { name: '按优先级筛选' }).selectOption('P1');
  await page.getByRole('combobox', { name: '按负责人筛选' }).selectOption('Alex');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('textbox', { name: '搜索任务', exact: true }).fill('滚动任务-in_progress-17');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('.stat-number').first()).toHaveText('01');
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(58);
  await page.getByRole('button', { name: /归档任务/ }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: /全部任务/ }).click();
  await expect(table.locator('tbody tr')).toHaveCount(59);
  await page.getByRole('combobox', { name: '任务排序' }).selectOption('priority');
  await expect(table.locator('tbody tr').first().locator('td').nth(2)).toHaveText('P1');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile task board supports horizontal lanes, contained scrolling and the complete filter panel', async ({ page, dashboard }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addLongTaskLists(dashboard.root);
  await page.goto(dashboard.url);
  await expect(page.locator('.task-card')).toHaveCount(58);
  const board = page.getByRole('region', { name: '任务看板', exact: true });
  const planning = page.getByRole('region', { name: '规划中卡片列表', exact: true });
  expect(await planning.evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(300);
  expect(await page.locator('.stats-grid').evaluate(element => element.clientHeight)).toBeLessThanOrEqual(76);
  const fixed = await frame(page);
  expect(fixed.rootHeight).toBeLessThanOrEqual(845);
  expect(fixed.rootWidth).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('tasks-board-mobile.png') });
  await wheelWithin(page, planning, 400);
  await expect.poll(() => planning.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await wheelWithin(page, planning, 0, 650);
  await expect.poll(() => board.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await paint(page);
  const horizontal = await settledScrollLeft(board);
  expect(await frame(page)).toEqual(fixed);
  await page.waitForResponse(response => response.url().endsWith('/api/snapshot') && response.status() === 200);
  await paint(page);
  expect(await board.evaluate(element => element.scrollLeft)).toBe(horizontal);
  await page.getByRole('button', { name: '打开任务筛选' }).click();
  const filters = page.getByRole('group', { name: '任务筛选条件' });
  await expect(filters).toBeVisible();
  await filters.getByRole('combobox', { name: '按状态筛选' }).selectOption('in_progress');
  await filters.getByRole('combobox', { name: '按优先级筛选' }).selectOption('P1');
  await filters.getByRole('combobox', { name: '按负责人筛选' }).selectOption('Alex');
  await page.screenshot({ path: testInfo.outputPath('tasks-filters-mobile.png') });
  await page.getByRole('button', { name: '收起任务筛选' }).click();
  await expect(filters).toBeHidden();
  await expect(page.locator('.task-card')).toHaveCount(10);
  await expect(page.getByRole('region', { name: '进行中卡片列表', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '打开任务筛选' }).click();
  await filters.getByRole('combobox', { name: '按状态筛选' }).focus();
  await page.keyboard.press('Escape');
  await expect(filters).toBeHidden();
  await expect(page.getByRole('button', { name: '打开任务筛选' })).toBeFocused();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.task-card')).toHaveCount(58);
  await page.getByRole('button', { name: '列表视图', exact: true }).click();
  const table = page.getByRole('region', { name: '任务列表数据', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(58);
  await wheelWithin(page, table, 500);
  await expect.poll(() => table.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('task panel fits intermediate and small viewports without losing controls', async ({ page, dashboard }) => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 760, height: 800 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await page.goto(dashboard.url);
    await expect(page.locator('.task-card')).toHaveCount(4);
    await expect(page.getByRole('textbox', { name: '搜索任务', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '列表视图', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '列表视图', exact: true }).click();
    await expect(page.getByRole('region', { name: '任务列表数据', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
