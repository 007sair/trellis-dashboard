import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { PlanProgress } from '../shared/types.js';

const markdown = unified().use(remarkParse).use(remarkGfm);

export function planProgress(content: string, source: string): PlanProgress | null {
  const tree = markdown.parse(content);
  const pending: { type: string; checked?: boolean | null; children?: unknown[] }[] = [tree];
  let total = 0;
  let done = 0;
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === 'listItem' && typeof node.checked === 'boolean') {
      total++;
      if (node.checked) done++;
    }
    if (node.children) pending.push(...node.children as typeof pending);
  }
  return total ? { done, total, source } : null;
}
