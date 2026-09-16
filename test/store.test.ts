import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { findProject } from '../src/server/project.js';
import { TrellisStore, MAX_DOCUMENT_BYTES, MAX_METADATA_BYTES } from '../src/server/store.js';
import { createFixture, digestTree, writeFile, writeTask } from './fixtures.js';

const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;

test('discovers nearest project from nested Unicode directory; reports invalid and missing projects', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const project = await findProject(path.join(fixture.root, 'packages/app/src'));
  assert.equal(project.root, await fs.realpath(fixture.root));
  await writeFile(fixture.root, 'packages/app/.trellis/.version', 'nested');
  assert.equal((await findProject(path.join(fixture.root, 'packages/app/src'))).root, await fs.realpath(path.join(fixture.root, 'packages/app')));
  await assert.rejects(findProject(path.join(fixture.root, 'missing')), code('INVALID_DIRECTORY'));
  await assert.rejects(findProject(fixture.temporary), code('NO_TRELLIS'));
});

test('invalid nearest .trellis and broken link never silently fall back to parent project', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const marker = path.join(fixture.root, 'packages/app/.trellis');
  await fs.writeFile(marker, 'not a directory');
  await assert.rejects(findProject(path.dirname(marker)), code('INVALID_TRELLIS'));
  await fs.unlink(marker);
  await fs.symlink(path.join(fixture.temporary, 'missing'), marker);
  await assert.rejects(findProject(path.dirname(marker)), code('INVALID_TRELLIS'));
});

test('reads active/archive tasks, true IDs, relationships, metadata, documents and plan progress', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const store = new TrellisStore(await findProject(fixture.root));
  const snapshot = await store.snapshot();
  assert.equal(snapshot.project.version, '0.6.15');
  assert.equal(snapshot.tasks.length, 5);
  assert.equal(snapshot.tasks.filter(task => task.archived).length, 1);
  assert.equal(snapshot.specs.length, 3);
  assert.equal(snapshot.workspace.length, 4);
  const main = snapshot.tasks.find(task => task.id === 'cli-launch')!;
  assert.notEqual(path.basename(main.key), main.id);
  assert.deepEqual(main.metadata.children, ['docs-guide']);
  assert.deepEqual(main.metadata.meta, { custom: true });
  assert.deepEqual(main.progress, { done: 2, total: 3, source: main.key + '/implement.md' });
  assert.ok(main.files.some(file => file.path.endsWith('/research/notes.md')));
  assert.equal(snapshot.tasks.find(task => task.id === 'docs-guide')!.progress, null);
  assert.equal(snapshot.tasks.find(task => task.id === 'safety')!.archived, false);
  assert.equal(snapshot.tasks.find(task => task.id === 'custom')!.status, 'blocked-by-team');
  assert.equal(snapshot.readOnly, true);
});

test('null and missing metadata is not invented, title fallback is explicit', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  await writeTask(fixture.root, 'tasks/minimal', { name: 'fallback', priority: null, status: 'constructor', assignee: null, meta: { extra: 1 } });
  const snapshot = await new TrellisStore(await findProject(fixture.root)).snapshot();
  const task = snapshot.tasks.find(task => task.key === 'tasks/minimal')!;
  assert.equal(task.title, 'fallback'); assert.equal(task.titleSource, 'name');
  assert.equal(task.priority, null); assert.equal(task.createdAt, null); assert.equal(task.status, 'constructor');
  await writeTask(fixture.root, 'tasks/empty', {});
  const empty = (await new TrellisStore(await findProject(fixture.root)).snapshot()).tasks.find(task => task.key === 'tasks/empty')!;
  assert.equal(empty.title, 'empty'); assert.equal(empty.titleSource, 'directory');
});

test('invalid metadata is isolated; empty optional folders remain valid', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  await writeFile(fixture.root, '.trellis/tasks/broken/task.json', '{');
  await writeFile(fixture.root, '.trellis/tasks/not-object/task.json', '[]');
  const store = new TrellisStore(await findProject(fixture.root));
  const snapshot = await store.snapshot();
  assert.equal(snapshot.tasks.length, 5);
  assert.ok(snapshot.diagnostics.some(item => item.code === 'INVALID_JSON'));
  assert.ok(snapshot.diagnostics.some(item => item.code === 'INVALID_METADATA'));
  for (const directory of ['tasks', 'spec', 'workspace']) await fs.rm(path.join(fixture.trellis, directory), { recursive: true });
  const empty = await store.snapshot();
  assert.equal(empty.tasks.length + empty.specs.length + empty.workspace.length, 0);
  assert.equal(empty.diagnostics.length, 0);
});

test('external updates, deletion and unavailable root do not return stale cached success', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const store = new TrellisStore(await findProject(fixture.root));
  assert.equal((await store.snapshot()).tasks.length, 5);
  await writeTask(fixture.root, 'tasks/new', { title: 'new', status: 'planning' });
  assert.equal((await store.snapshot()).tasks.length, 6);
  await fs.rm(path.join(fixture.trellis, 'tasks/new'), { recursive: true });
  assert.equal((await store.snapshot()).tasks.length, 5);
  await fs.rename(fixture.trellis, fixture.trellis + '-moved');
  await assert.rejects(store.snapshot(), code('PROJECT_UNAVAILABLE'));
  await fs.rename(fixture.trellis + '-moved', fixture.trellis);
  assert.equal((await store.snapshot()).tasks.length, 5);
});

test('blocks traversal, absolute paths, hidden files, source scripts and outside symlinks', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const store = new TrellisStore(await findProject(fixture.root));
  for (const file of ['../.env', '/etc/passwd', 'spec/../../.env', 'spec/../.developer', 'spec\\..\\.env', '.developer', '.version', 'scripts/task.py', 'tasks/a/.env', 'tasks/a/file\0.md']) {
    await assert.rejects(store.readDocument(file), code('UNSAFE_PATH'), file);
  }
  await assert.rejects(store.readDocument('spec/file.txt'), code('UNSUPPORTED_FILE'));
  await writeFile(fixture.temporary, 'outside/secret.md', 'private outside bytes');
  await fs.symlink(path.join(fixture.temporary, 'outside/secret.md'), path.join(fixture.trellis, 'spec/escape.md'));
  await fs.symlink(path.join(fixture.temporary, 'outside'), path.join(fixture.trellis, 'spec/outside'));
  await fs.symlink(path.join(fixture.trellis, '.developer'), path.join(fixture.trellis, 'spec/identity.md'));
  for (const file of ['spec/escape.md', 'spec/outside/secret.md', 'spec/identity.md']) await assert.rejects(store.readDocument(file), code('UNSAFE_PATH'));
  const snapshot = await store.snapshot();
  assert.ok(snapshot.diagnostics.some(item => item.code === 'UNSAFE_PATH'));
  assert.ok(!JSON.stringify(snapshot).includes('private outside bytes'));
  await fs.symlink(path.join(fixture.trellis, 'spec/frontend/index.md'), path.join(fixture.trellis, 'spec/safe-alias.md'));
  assert.ok((await store.readDocument('spec/safe-alias.md')).content.includes('前端规范'));
});

test('file size limits are visible and unsupported files never become document API reads', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  await writeFile(fixture.root, '.trellis/spec/large.md', 'x'.repeat(MAX_DOCUMENT_BYTES + 1));
  await writeFile(fixture.root, '.trellis/tasks/huge/task.json', JSON.stringify({ notes: 'x'.repeat(MAX_METADATA_BYTES) }));
  await writeFile(fixture.root, '.trellis/spec/unsupported.txt', 'text');
  const store = new TrellisStore(await findProject(fixture.root));
  const snapshot = await store.snapshot();
  assert.equal(snapshot.specs.find(file => file.path === 'spec/large.md')!.readable, false);
  assert.ok(snapshot.diagnostics.some(item => item.code === 'FILE_TOO_LARGE'));
  assert.ok(snapshot.diagnostics.some(item => item.code === 'UNSUPPORTED_FILE'));
  await assert.rejects(store.readDocument('spec/large.md'), code('FILE_TOO_LARGE'));
});

test('artifacts of nested child tasks are not attributed to their parent', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  await writeTask(fixture.root, 'tasks/parent', { title: 'parent' }, { 'prd.md': '# parent' });
  await writeTask(fixture.root, 'tasks/parent/child', { title: 'child' }, { 'prd.md': '# child' });
  const snapshot = await new TrellisStore(await findProject(fixture.root)).snapshot();
  assert.equal(snapshot.tasks.find(task => task.title === 'parent')!.files.length, 2);
  assert.equal(snapshot.tasks.find(task => task.title === 'child')!.files.length, 2);
});

test('snapshot and every supported document leave all project bytes unchanged', async t => {
  const fixture = await createFixture(); t.after(fixture.cleanup);
  const before = await digestTree(fixture.root);
  const store = new TrellisStore(await findProject(fixture.root));
  const snapshot = await store.snapshot();
  for (const file of [...snapshot.tasks.flatMap(task => task.files), ...snapshot.specs, ...snapshot.workspace]) await store.readDocument(file.path);
  assert.equal(await digestTree(fixture.root), before);
  await assert.rejects(fs.access(path.join(fixture.root, 'SHOULD_NOT_EXIST')));
});
