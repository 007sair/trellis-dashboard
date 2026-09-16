import { CircleCheck, CircleDashed, CircleDot, FileText, Info, SearchX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Diagnostic, PlanProgress } from '../../shared/types.js';
import { statusLabel, statusTone } from '../../shared/utils.js';

export function StatusBadge({ status }: { status: string | null }) {
  const Icon = status === 'completed' ? CircleCheck : status === 'in_progress' ? CircleDot : CircleDashed;
  return <span className={`status-badge ${statusTone(status)}`} title={status ?? '未提供 status'}><Icon size={13} aria-hidden="true" />{statusLabel(status)}</span>;
}

export function Priority({ value }: { value: string | null }) {
  return <span className={`priority ${value === 'P0' || value === 'P1' ? 'high' : ''}`} title="优先级">{value ?? '无优先级'}</span>;
}

export function Avatar({ name }: { name: string | null }) {
  const initial = (name ?? '?').slice(0, 1).toLocaleUpperCase();
  return <span className="avatar" aria-hidden="true">{initial}</span>;
}

export function Progress({ value }: { value: PlanProgress | null }) {
  if (!value) return <div className="plan-empty">未提供可计算的执行计划</div>;
  return <div className="plan-progress" title={`${value.source} 中的复选框；不是代码完成率或验收结果`}>
    <div><span>执行计划</span><span>{value.done} / {value.total}</span></div>
    <progress aria-label="执行计划已勾选项" value={value.done} max={value.total} />
  </div>;
}

export function EmptyState({ title, children, icon = 'search' }: { title: string; children?: ReactNode; icon?: 'search' | 'document' }) {
  const Icon = icon === 'document' ? FileText : SearchX;
  return <div className="empty-state"><span className="empty-icon"><Icon size={28} strokeWidth={1.5} aria-hidden="true" /></span><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return <div className="error-notice" role="alert"><TriangleAlert size={18} aria-hidden="true" /><span>{children}</span></div>;
}

export function Diagnostics({ items }: { items: Diagnostic[] }) {
  if (!items.length) return null;
  return <details className="diagnostics"><summary><Info size={15} aria-hidden="true" />{items.length} 条读取提示<span>部分内容可能未加载</span></summary><ul>{items.map((item, index) => <li key={`${item.path}-${index}`}><code>{item.path}</code><span>{item.message}</span></li>)}</ul></details>;
}

export function compactDate(value: string | null): string {
  if (!value) return '未提供日期';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(5).replace('-', '.');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date).replace('/', '.');
}

export function fileSize(size: number): string {
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
