import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planProgress } from '../src/server/progress.js';
import { defaultFilters, filterTasks, parseJsonLines, resolveDocumentLink, statusLabel } from '../src/shared/utils.js';
import { parseOptions } from '../src/server/cli.js';
import type { Task } from '../src/shared/types.js';

const task = (overrides: Partial<Task>): Task => ({ key: 'tasks/a', id: 'a', name: 'a', title: '任务', titleSource: 'title', description: '', status: 'planning', priority: null, assignee: null, creator: null, createdAt: null, completedAt: null, modifiedAt: '2026-01-01', archived: false, metadata: {}, files: [], progress: null, ...overrides });

test('plan progress counts Markdown task items, never fenced or indented code', () => {
  const plan = '# Plan\n\n- [x] first\n- [ ] second\n  - [X] nested\n\n```md\n- [x] not real\n```\n\n~~~\n- [ ] not real\n~~~\n\nA paragraph.\n\n    - [x] indented code\n';
  assert.deepEqual(planProgress(plan, 'implement.md'), { done: 2, total: 3, source: 'implement.md' });
  assert.equal(planProgress('# Plan\nNo checklist', 'implement.md'), null);
  assert.equal(planProgress('```\n- [x] code\n```', 'implement.md'), null);
});

test('JSONL preserves valid lines, skips examples and reports exact invalid line numbers', () => {
  const result = parseJsonLines('{"_example":true}\n{"file":"a.md"}\nwrong\n[]\n\n{"file":"b.md"}');
  assert.equal(result.examples, 1);
  assert.deepEqual(result.entries.map(item => item.line), [2, 6]);
  assert.deepEqual(result.issues.map(item => item.line), [3, 4]);
  assert.ok(parseJsonLines('\n'.repeat(2200)).omitted > 0);
});

test('unknown status names cannot access Object.prototype', () => {
  for (const value of ['__proto__', 'constructor', 'toString', 'review-team']) assert.equal(statusLabel(value), value);
  assert.equal(statusLabel(null), '未提供状态');
  assert.equal(statusLabel('completed'), '已完成');
});

test('filters combine query, owner, priority, status and archive without changing inputs', () => {
  const tasks = [task({ key: 'tasks/a', title: 'Alpha', status: 'in_progress', priority: 'P1', assignee: 'Alex' }), task({ key: 'tasks/b', title: 'Beta', status: 'completed', assignee: 'Alex', archived: true }), task({ key: 'tasks/c', description: 'Alpha details', status: 'planning', priority: 'P2', assignee: 'Mia' })];
  const original = JSON.stringify(tasks);
  assert.equal(filterTasks(tasks, { ...defaultFilters }).length, 2);
  assert.deepEqual(filterTasks(tasks, { ...defaultFilters, query: ' ALPHA ', assignee: 'Alex', priority: 'P1', status: 'in_progress' }).map(item => item.key), ['tasks/a']);
  assert.equal(filterTasks(tasks, { ...defaultFilters, archive: 'archived' })[0]?.title, 'Beta');
  assert.equal(filterTasks(tasks, { ...defaultFilters, query: 'no match' }).length, 0);
  assert.equal(JSON.stringify(tasks), original);
});

test('document links allow contained documents and explicit HTTPS, block scripts and source files', () => {
  const current = 'tasks/09-01-example/prd.md';
  assert.deepEqual(resolveDocumentLink(current, '.trellis/spec/frontend/index.md'), { kind: 'document', path: 'spec/frontend/index.md', anchor: '' });
  assert.deepEqual(resolveDocumentLink('spec/frontend/index.md', './quality.md#errors'), { kind: 'document', path: 'spec/frontend/quality.md', anchor: 'errors' });
  assert.equal(resolveDocumentLink(current, 'https://github.com/mindfold-ai/Trellis').kind, 'external');
  for (const link of ['javascript:alert(1)', 'data:text/html,bad', 'file:///etc/passwd', '//evil.invalid/file', '../../../.env', '.trellis/scripts/task.py', 'src/private.ts', 'https://user:pass@example.org', '%ZZ']) assert.equal(resolveDocumentLink(current, link).kind, 'blocked', link);
});

test('CLI parses independent project, port, browser and help options', () => {
  assert.deepEqual(parseOptions(['--dir', '/tmp/中文 项目', '--port', '0', '--no-open']), { directory: '/tmp/中文 项目', port: 0, open: false, help: false, version: false });
  assert.equal(parseOptions(['../repo']).directory, '../repo');
  assert.equal(parseOptions(['--help']).help, true);
  assert.equal(parseOptions(['--version']).version, true);
  for (const args of [['--port', '4x'], ['--port', '-1'], ['--port', '65536'], ['--host', '0.0.0.0'], ['a', 'b'], ['a', '--dir', 'b']]) assert.throws(() => parseOptions(args));
});
