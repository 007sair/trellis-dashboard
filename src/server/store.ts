import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { AppError, appError } from './errors.js';
import { isWithin, type Project } from './project.js';
import { planProgress } from './progress.js';
import { isObject, text } from '../shared/utils.js';
import type { Diagnostic, DocumentContent, DocumentEntry, DocumentGroup, Snapshot, Task } from '../shared/types.js';

export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export const MAX_METADATA_BYTES = 256 * 1024;
const MAX_SCAN_ENTRIES = 10_000;
const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_TASKS = 1000;
const MAX_DEPTH = 32;
const MAX_DIAGNOSTICS = 200;
const contentExtensions = new Set(['.md', '.json', '.jsonl', '.txt', '.yaml', '.yml']);
const ignoredDirectories = new Set(['node_modules', '__pycache__']);

function validateRelative(relative: string, directory = false, version = false): void {
  if (version && relative === '.version') return;
  if (!relative || relative.length > 4096 || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative)) {
    throw new AppError('UNSAFE_PATH', '只允许读取 Trellis 内容目录中的相对路径。', 403);
  }
  const parts = relative.split('/');
  if (parts.some(part => !part || part.startsWith('.') || ignoredDirectories.has(part)) || !['tasks', 'spec', 'workspace'].includes(parts[0]!)) {
    throw new AppError('UNSAFE_PATH', '此路径不在允许读取的 Trellis 内容范围内。', 403);
  }
  if (!directory) {
    const extension = path.posix.extname(relative).toLowerCase();
    if (!contentExtensions.has(extension) || (parts[0] !== 'tasks' && extension !== '.md')) {
      throw new AppError('UNSUPPORTED_FILE', '暂不支持此文件类型；仅浏览任务文本产物、规范和工作记录。', 415);
    }
    if (parts.length < 2) throw new AppError('UNSAFE_PATH', '请选择一个文档文件。', 403);
  }
}

function groupFor(relative: string): DocumentGroup {
  return relative.startsWith('spec/') ? 'spec' : relative.startsWith('workspace/') ? 'workspace' : 'task';
}

export class TrellisStore {
  private inflight?: Promise<Snapshot>;

  constructor(readonly project: Project) {}

  private async ensureRoot(): Promise<void> {
    try {
      const current = await fs.realpath(path.join(this.project.root, '.trellis'));
      if (current !== this.project.trellis || !(await fs.stat(current)).isDirectory()) throw new Error('root changed');
    } catch {
      throw new AppError('PROJECT_UNAVAILABLE', '.trellis 目录已移走、变更或不可读取。请恢复目录后刷新，或重新指定项目启动。', 503);
    }
  }

  private async safePath(relative: string, directory = false, version = false): Promise<string> {
    validateRelative(relative, directory, version);
    await this.ensureRoot();
    const real = await fs.realpath(path.join(this.project.trellis, ...relative.split('/')));
    if (!isWithin(this.project.trellis, real)) throw new AppError('UNSAFE_PATH', '符号链接指向 Trellis 目录外部，已拒绝读取。', 403);
    const actual = path.relative(this.project.trellis, real).split(path.sep).join('/');
    validateRelative(actual, directory, version);
    return real;
  }

  private async readSafe(relative: string, limit = MAX_DOCUMENT_BYTES, version = false) {
    const real = await this.safePath(relative, false, version);
    const handle = await fs.open(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new AppError('NOT_A_FILE', '此路径不是普通文档文件。', 400);
      // Re-check containment and inode after opening; never read through a swapped link.
      const current = await this.safePath(relative, false, version);
      const currentStat = await fs.stat(current);
      if (current !== real || currentStat.ino !== stat.ino || currentStat.dev !== stat.dev) throw new AppError('FILE_CHANGED', '文件在读取时发生变化，请刷新重试。', 409);
      if (stat.size > limit) throw new AppError('FILE_TOO_LARGE', `文件大小 ${stat.size} 字节，超过本次读取上限 ${limit} 字节；未截断为完整内容。`, 413);
      // Fixed capacity also bounds files that grow after stat().
      const buffer = Buffer.alloc(Math.min(limit + 1, Math.max(stat.size + 1, 4096)));
      let bytes = 0;
      while (bytes < buffer.length) {
        const result = await handle.read(buffer, bytes, buffer.length - bytes, bytes);
        if (!result.bytesRead) break;
        bytes += result.bytesRead;
      }
      if (bytes > limit || bytes > stat.size) throw new AppError('FILE_CHANGED', '文件在读取时变大，请刷新重试。', 409);
      return { content: buffer.subarray(0, bytes).toString('utf8'), size: bytes, modifiedAt: stat.mtime.toISOString() };
    } finally { await handle.close(); }
  }

  async readDocument(relative: string): Promise<DocumentContent> {
    try {
      const file = await this.readSafe(relative);
      const extension = path.posix.extname(relative).toLowerCase();
      return { path: relative, kind: extension === '.md' ? 'markdown' : extension === '.json' ? 'json' : extension === '.jsonl' ? 'jsonl' : 'text', ...file };
    } catch (error) { throw appError(error); }
  }

  snapshot(): Promise<Snapshot> {
    if (!this.inflight) {
      this.inflight = this.scan().finally(() => { this.inflight = undefined; });
    }
    return this.inflight;
  }

  private async scan(): Promise<Snapshot> {
    await this.ensureRoot();
    const diagnostics: Diagnostic[] = [];
    let omittedDiagnostics = 0;
    const issue = (relative: string, error: unknown) => {
      const problem = appError(error);
      if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push({ path: relative, code: problem.code, message: problem.message });
      else omittedDiagnostics++;
    };
    const files: DocumentEntry[] = [];
    const visited = new Set<string>();
    let scanned = 0;
    let scanLimitReached = false;
    const walk = async (relative: string, depth: number): Promise<void> => {
      if (scanLimitReached) return;
      if (depth > MAX_DEPTH) {
        issue(relative, new AppError('SCAN_LIMIT', `目录深度超过 ${MAX_DEPTH} 层，该部分未加载。`));
        return;
      }
      try {
        const real = await this.safePath(relative, true);
        if (visited.has(real)) { issue(relative, new AppError('SYMLINK_CYCLE', '重复或循环目录链接，已跳过。')); return; }
        visited.add(real);
        const directory = await fs.opendir(real);
        for await (const entry of directory) {
          if (++scanned > MAX_SCAN_ENTRIES) {
            scanLimitReached = true;
            issue(relative, new AppError('SCAN_LIMIT', `超过 ${MAX_SCAN_ENTRIES} 个目录项，部分内容未加载。`));
            break;
          }
          if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue;
          const child = relative + '/' + entry.name;
          try {
            const resolved = await this.safePath(child, true);
            const stat = await fs.stat(resolved);
            if (stat.isDirectory()) { await walk(child, depth + 1); continue; }
            if (!stat.isFile()) { issue(child, new AppError('NOT_A_FILE', '不是普通文件，已跳过。')); continue; }
            validateRelative(child);
            validateRelative(path.relative(this.project.trellis, resolved).split(path.sep).join('/'));
            const tooLarge = stat.size > MAX_DOCUMENT_BYTES;
            files.push({
              path: child, name: entry.name, group: groupFor(child), size: stat.size,
              modifiedAt: stat.mtime.toISOString(), readable: !tooLarge,
              ...(tooLarge ? { problem: `超过 ${MAX_DOCUMENT_BYTES / 1024 / 1024} MiB 阅读上限` } : {}),
            });
            if (tooLarge) issue(child, new AppError('FILE_TOO_LARGE', '超过 1 MiB 阅读上限；显示文件信息但不加载正文。', 413));
          } catch (error) { issue(child, error); }
        }
      } catch (error) {
        // Optional missing top-level content folders are legitimate empty states.
        if (!(depth === 0 && (error as NodeJS.ErrnoException).code === 'ENOENT')) issue(relative, error);
      }
    };
    for (const group of ['tasks', 'spec', 'workspace']) await walk(group, 0);
    files.sort((a, b) => a.path.localeCompare(b.path));

    let remainingBytes = MAX_SCAN_BYTES;
    const budgetedRead = async (file: string, limit: number) => {
      if (remainingBytes <= 0) throw new AppError('SCAN_LIMIT', '单次读取预算 8 MiB 已用尽，部分任务或进度未加载。');
      const result = await this.readSafe(file, Math.min(limit, remainingBytes));
      remainingBytes -= result.size;
      return result;
    };
    const tasks: Task[] = [];
    const metadataFiles = files.filter(file => file.group === 'task' && file.name === 'task.json' && file.path.split('/').length >= 3);
    if (metadataFiles.length > MAX_TASKS) issue('tasks', new AppError('SCAN_LIMIT', `任务超过 ${MAX_TASKS} 项，超出部分未加载。`));
    for (const file of metadataFiles.slice(0, MAX_TASKS)) {
      const key = path.posix.dirname(file.path);
      try {
        const metadataText = await budgetedRead(file.path, MAX_METADATA_BYTES);
        let metadata: unknown;
        try { metadata = JSON.parse(metadataText.content); }
        catch { throw new AppError('INVALID_JSON', 'task.json 不是有效 JSON，此任务暂未加载。', 422); }
        if (!isObject(metadata)) throw new AppError('INVALID_METADATA', 'task.json 应为 JSON 对象，此任务暂未加载。', 422);
        const fallback = path.posix.basename(key);
        const titleSource = text(metadata.title) ? 'title' : text(metadata.name) ? 'name' : text(metadata.id) ? 'id' : 'directory';
        tasks.push({
          key, id: text(metadata.id) ?? fallback, name: text(metadata.name) ?? fallback,
          title: titleSource === 'directory' ? fallback : text(metadata[titleSource])!, titleSource,
          description: text(metadata.description) ?? '', status: text(metadata.status),
          priority: text(metadata.priority), assignee: text(metadata.assignee), creator: text(metadata.creator),
          createdAt: text(metadata.createdAt), completedAt: text(metadata.completedAt), modifiedAt: metadataText.modifiedAt,
          archived: key.startsWith('tasks/archive/'), metadata, files: [], progress: null,
        });
      } catch (error) { issue(file.path, error); }
    }
    // Assign artifacts to the nearest task, not to an enclosing parent task as well.
    const taskByDirectory = new Map(tasks.map(task => [task.key, task]));
    const allTaskDirectories = new Set(metadataFiles.map(file => path.posix.dirname(file.path)));
    for (const file of files.filter(file => file.group === 'task')) {
      let parent = path.posix.dirname(file.path);
      while (parent !== '.' && parent !== 'tasks') {
        if (allTaskDirectories.has(parent)) { taskByDirectory.get(parent)?.files.push(file); break; }
        parent = path.posix.dirname(parent);
      }
    }
    for (const task of tasks) {
      const plan = task.files.find(file => file.path === task.key + '/implement.md');
      if (plan?.readable) {
        try { task.progress = planProgress((await budgetedRead(plan.path, MAX_DOCUMENT_BYTES)).content, plan.path); }
        catch (error) { issue(plan.path, error); }
      }
    }
    let version: string | null = null;
    try { version = text((await this.readSafe('.version', 128, true)).content); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') issue('.version', error); }
    await this.ensureRoot();
    if (omittedDiagnostics) diagnostics.push({ path: '.trellis', code: 'DIAGNOSTIC_LIMIT', message: `另有 ${omittedDiagnostics} 条读取提示未逐项显示，请缩小异常文件范围。` });
    return {
      project: { name: this.project.name, root: this.project.root, version },
      readOnly: true, generatedAt: new Date().toISOString(), tasks,
      specs: files.filter(file => file.group === 'spec'), workspace: files.filter(file => file.group === 'workspace'), diagnostics,
    };
  }
}
