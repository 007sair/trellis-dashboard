import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import type { JsonObject } from '../src/shared/types.js';

export async function writeFile(root: string, relative: string, content: string) {
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

export async function writeTask(root: string, directory: string, metadata: JsonObject, files: Record<string, string> = {}) {
  await writeFile(root, `.trellis/${directory}/task.json`, JSON.stringify(metadata, null, 2));
  for (const [file, content] of Object.entries(files)) await writeFile(root, `.trellis/${directory}/${file}`, content);
}

export async function createFixture() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'trellis-dashboard-test-'));
  const root = path.join(temporary, '示例 workspace');
  await writeFile(root, '.trellis/.version', '0.6.15\n');
  await writeFile(root, '.trellis/config.yaml', 'hooks:\n  after_create:\n    - "touch SHOULD_NOT_EXIST"\n');
  await writeFile(root, '.trellis/scripts/task.py', 'raise Exception("MUST NOT EXECUTE")\n');
  await writeFile(root, '.trellis/.developer', 'private-identity');
  await writeFile(root, '.env', 'SECRET=must-not-be-readable');
  await writeTask(root, 'tasks/09-01-command-launch', {
    id: 'cli-launch', name: 'command-launch', title: '命令行启动体验', description: '在任意项目启动面板，提供清晰、可靠的本地体验。',
    status: 'in_progress', priority: 'P1', assignee: 'Alex', creator: 'Lin', createdAt: '2026-09-01', completedAt: null,
    parent: null, children: ['docs-guide'], subtasks: [], branch: 'feature/dashboard', base_branch: 'main', notes: '仅本地阅读。', meta: { custom: true },
  }, {
    'prd.md': '# 命令行启动体验\n\n## 验收要求\n\n从任意项目打开面板。\n\n[编码规范](.trellis/spec/frontend/quality-guidelines.md)\n\n![不要联网](https://example.invalid/tracker.png)\n\n[危险链接](javascript:alert(1))\n\n<script>window.__trellisXss = true</script>\n\n| 项目 | 值 |\n| --- | --- |\n| 范围 | 只读 |\n',
    'design.md': '# 技术设计\n\n使用本地文件作为唯一数据源。\n',
    'implement.md': '# 执行计划\n\n- [x] 参数解析\n- [x] 本地服务\n- [ ] 浏览器验收\n\n```md\n- [x] 示例不是进度\n```\n',
    'research/notes.md': '# 研究记录\n\n只读接口。\n',
    'implement.jsonl': '{"_example":true,"file":"example.md"}\n{"file":".trellis/spec/frontend/index.md","reason":"项目规范"}\nnot-json\n{"file":"src/private.ts","reason":"仅显示引用，不读取源码"}\n',
    'check.jsonl': '{"file":".trellis/spec/frontend/quality-guidelines.md","reason":"验证边界"}\n',
  });
  await writeTask(root, 'tasks/09-02-docs', { id: 'docs-guide', title: '文档目录整理', status: 'planning', priority: 'P2', assignee: 'Mia', creator: 'Lin', createdAt: '2026-09-02', parent: 'cli-launch', children: [], meta: {} }, { 'prd.md': '# 文档目录整理\n\n轻量任务允许只有 PRD。\n' });
  await writeTask(root, 'tasks/09-03-complete', { id: 'safety', title: '读取边界校验', status: 'completed', priority: 'P2', assignee: 'Alex', createdAt: '2026-09-03', completedAt: '2026-09-04' }, { 'prd.md': '# 读取边界校验\n' });
  await writeTask(root, 'tasks/09-04-custom', { id: 'custom', title: '等待协作确认', status: 'blocked-by-team', priority: 'P3', assignee: null, createdAt: '2026-09-04' }, { 'prd.md': '# 等待协作确认\n' });
  await writeTask(root, 'tasks/archive/2026-08/08-20-initial', { id: 'archive', title: '初始化规范', status: 'completed', priority: 'P2', assignee: 'Alex', createdAt: '2026-08-20' }, { 'prd.md': '# 初始化规范\n\n已归档。\n' });
  await writeFile(root, '.trellis/spec/frontend/index.md', '# 前端规范\n\n[质量规范](./quality-guidelines.md)\n');
  await writeFile(root, '.trellis/spec/frontend/quality-guidelines.md', '# 质量规范\n\n## 安全边界\n\n所有输入都应验证。\n\n- 保持只读\n- 不执行用户文档\n');
  await writeFile(root, '.trellis/spec/packages/api/backend/index.md', '# 多包后端规范\n');
  await writeFile(root, '.trellis/workspace/index.md', '# 工作区索引\n\n[Alex](./Alex/index.md)\n');
  await writeFile(root, '.trellis/workspace/Alex/index.md', '# Alex 工作记录\n\n[journal-1](./journal-1.md)\n');
  await writeFile(root, '.trellis/workspace/Alex/journal-1.md', '# Journal 1\n\n## Session 1: 只读面板\n\n完成数据读取与异常检查。\n');
  await writeFile(root, '.trellis/workspace/Mia/index.md', '# Mia 工作记录\n');
  await fs.mkdir(path.join(root, 'packages/app/src'), { recursive: true });
  return { root, temporary, trellis: path.join(root, '.trellis'), cleanup: () => fs.rm(temporary, { recursive: true, force: true }) };
}

export async function digestTree(root: string): Promise<string> {
  const hash = createHash('sha256');
  const walk = async (directory: string) => {
    const entries = (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      hash.update(path.relative(root, file));
      if (entry.isDirectory()) await walk(file);
      else if (entry.isSymbolicLink()) hash.update(await fs.readlink(file));
      else hash.update(await fs.readFile(file));
    }
  };
  await walk(root);
  return hash.digest('hex');
}
