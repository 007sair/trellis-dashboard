import type { JsonObject, Task } from './types.js';

export const statusLabels: Record<string, string> = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
};

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function statusLabel(status: string | null): string {
  return status ? (Object.hasOwn(statusLabels, status) ? statusLabels[status]! : status) : '未提供状态';
}

export function statusTone(status: string | null): string {
  return status === 'planning' ? 'planning' : status === 'in_progress' ? 'progress' : status === 'completed' ? 'done' : 'unknown';
}

export interface TaskFilters {
  query: string;
  status: string;
  priority: string;
  assignee: string;
  archive: 'active' | 'archived' | 'all';
  sort: 'recent' | 'priority' | 'created';
}

export const defaultFilters: TaskFilters = {
  query: '', status: '', priority: '', assignee: '', archive: 'active', sort: 'recent',
};

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return tasks.filter(task =>
    (filters.archive === 'all' || task.archived === (filters.archive === 'archived')) &&
    (!filters.status || (task.status ?? '') === filters.status) &&
    (!filters.priority || (task.priority ?? '') === filters.priority) &&
    (!filters.assignee || (task.assignee ?? '') === filters.assignee) &&
    (!query || [task.title, task.name, task.id, task.description, task.key].some(value => value.toLocaleLowerCase().includes(query))),
  ).sort((a, b) => {
    if (filters.sort === 'priority') {
      const rank = (p: string | null) => p && /^P\d+$/i.test(p) ? Number(p.slice(1)) : Number.MAX_SAFE_INTEGER;
      const delta = rank(a.priority) - rank(b.priority);
      if (delta) return delta;
    }
    return (filters.sort === 'created' ? date(b.createdAt) - date(a.createdAt) : date(b.modifiedAt) - date(a.modifiedAt)) || a.key.localeCompare(b.key);
  });
}

export function parseJsonLines(content: string) {
  const entries: { line: number; value: JsonObject }[] = [];
  const issues: { line: number; message: string }[] = [];
  const lines = content.split(/\r?\n/);
  const maxLines = 2000;
  let examples = 0;
  lines.slice(0, maxLines).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const value: unknown = JSON.parse(line);
      if (!isObject(value)) throw new Error('每行应为 JSON 对象');
      if (Object.hasOwn(value, '_example')) { examples++; return; }
      entries.push({ line: index + 1, value });
    } catch {
      issues.push({ line: index + 1, message: '不是有效的 JSON 对象' });
    }
  });
  return { entries, issues, examples, omitted: Math.max(0, lines.length - maxLines) };
}

export type DocumentLink = { kind: 'document'; path: string; anchor: string } | { kind: 'external'; href: string } | { kind: 'blocked' };

export function resolveDocumentLink(currentPath: string, href: string): DocumentLink {
  try {
    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href);
      return url.username || url.password ? { kind: 'blocked' } : { kind: 'external', href: url.href };
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//') || href.includes('\\')) return { kind: 'blocked' };
    const relative = href.startsWith('.trellis/') ? '/' + href.slice(9) : href.startsWith('/.trellis/') ? href.slice(9) : href;
    const url = new URL(relative, `https://trellis.invalid/${currentPath}`);
    const path = decodeURIComponent(url.pathname).slice(1);
    if (url.origin !== 'https://trellis.invalid' || !/^(tasks|spec|workspace)\//.test(path) || path.split('/').some(part => !part || part.startsWith('.')) || !/\.(md|json|jsonl|txt|ya?ml)$/i.test(path)) return { kind: 'blocked' };
    return { kind: 'document', path, anchor: decodeURIComponent(url.hash.slice(1)) };
  } catch { return { kind: 'blocked' }; }
}
