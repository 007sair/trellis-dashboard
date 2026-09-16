import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Braces, FileText, GitBranch, Info, LockKeyhole, X } from 'lucide-react';
import type { Task } from '../../shared/types.js';
import { isObject, text } from '../../shared/utils.js';
import { Avatar, EmptyState, Priority, Progress, StatusBadge } from './Common.js';
import { DocumentViewer, FileList, type NavigateDocument } from './Documents.js';

const order = ['prd.md', 'design.md', 'implement.md', 'implement.jsonl', 'check.jsonl', 'task.json'];

function relationNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(item => text(item) ?? (isObject(item) ? text(item.id) ?? text(item.name) ?? text(item.title) : null)).filter((item): item is string => item !== null);
}

export function TaskDetail({ task, tasks, taskKey, selectedFile, revision, anchor, navigate, close, openTask }: { task?: Task; tasks: Task[]; taskKey: string; selectedFile: string; revision: string; anchor: string; navigate: NavigateDocument; close: () => void; openTask: (task: Task) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'documents' | 'info' | 'metadata'>('documents');
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.documentElement.style.overflow = previousOverflow; };
  }, []);
  const files = task ? [...task.files].sort((a, b) => {
    const rank = (name: string) => order.includes(name) ? order.indexOf(name) : 99;
    return rank(a.name) - rank(b.name) || a.path.localeCompare(b.path);
  }) : [];
  const selected = selectedFile || files[0]?.path || '';
  const showRelation = (name: string) => {
    const related = tasks.find(item => item.key === name || '.trellis/' + item.key === name || item.id === name || item.name === name || item.key.split('/').at(-1) === name);
    return related ? <button key={name} className="relation-link" onClick={() => openTask(related)}>{related.title}<ArrowUpRight size={12} /></button> : <span key={name} className="unresolved-relation" title="未在当前有效任务中找到此关联">{name}</span>;
  };
  return <dialog className="task-dialog" ref={dialog} aria-labelledby="task-detail-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
    <div className="detail-frame">
      <header className="detail-header">
        <div className="detail-heading">
          <div className="detail-breadcrumb"><GitBranch size={13} /><span>{task?.archived ? '归档任务' : '任务详情'}</span><span>/</span><code>{task?.id ?? taskKey}</code></div>
          <h2 id="task-detail-title" title={task?.title}>{task?.title ?? '任务已不可用'}</h2>
        </div>
        <div className="detail-header-actions"><span className="read-only-small"><LockKeyhole size={12} />只读</span><button className="icon-button" onClick={close} aria-label="关闭任务详情"><X size={20} /></button></div>
      </header>
      {!task ? <EmptyState title="任务可能已被删除、归档或元数据损坏">请关闭详情，刷新列表后重新选择。不会继续展示旧快照。</EmptyState> : <>
        <div className="detail-context-bar">
          <div className="detail-badges"><StatusBadge status={task.status} /><Priority value={task.priority} /><span className="assignee"><Avatar name={task.assignee} /><span>{task.assignee ?? '未分配负责人'}</span></span>{task.titleSource !== 'title' && <small className="title-source">标题来自 {task.titleSource}</small>}</div>
          <div className="detail-compact-progress"><Progress value={task.progress} /></div>
        </div>
        <div className="detail-tabs" aria-label="任务详情内容">
          <button className={tab === 'documents' ? 'active' : ''} aria-pressed={tab === 'documents'} onClick={() => setTab('documents')}><FileText size={15} />任务产物<span>{files.length}</span></button>
          <button className={tab === 'info' ? 'active' : ''} aria-pressed={tab === 'info'} onClick={() => setTab('info')}><Info size={15} />任务信息</button>
          <button className={tab === 'metadata' ? 'active' : ''} aria-pressed={tab === 'metadata'} onClick={() => setTab('metadata')}><Braces size={15} />原始元数据</button>
        </div>
        {tab === 'metadata' ? <div className="raw-metadata" tabIndex={0} role="region" aria-label="原始元数据内容"><p className="muted">task.json 中的原始字段，包含未识别的扩展数据。</p><pre className="code-view"><code>{JSON.stringify(task.metadata, null, 2)}</code></pre></div>
          : tab === 'info' ? <div className="task-info-panel" tabIndex={0} role="region" aria-label="任务信息内容">
            <h3>任务说明</h3>{task.titleSource !== 'title' && <p className="muted">未提供 title，标题回退自 {task.titleSource}。</p>}<p className="detail-description">{task.description || '未提供任务描述'}</p>
            <dl className="task-facts">{[
              ['创建人', task.creator], ['负责人', task.assignee], ['创建日期', task.createdAt], ['完成日期', task.completedAt], ['开发类型', text(task.metadata.dev_type)], ['Scope', text(task.metadata.scope)], ['Package', text(task.metadata.package)], ['分支', text(task.metadata.branch)], ['目标分支', text(task.metadata.base_branch)], ['Commit', text(task.metadata.commit)], ['Worktree', text(task.metadata.worktree_path)], ['PR', text(task.metadata.pr_url)],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '未提供'}</dd></div>)}</dl>
            <div className="task-relations"><GitBranch size={14} /><strong>任务关系</strong>{relationNames(task.metadata.parent).length > 0 && <span>父任务：{relationNames(task.metadata.parent).map(showRelation)}</span>}{relationNames(task.metadata.children).length > 0 && <span>子任务：{relationNames(task.metadata.children).map(showRelation)}</span>}{relationNames(task.metadata.subtasks).length > 0 && <span>子项：{relationNames(task.metadata.subtasks).map(showRelation)}</span>}{!relationNames(task.metadata.parent).length && !relationNames(task.metadata.children).length && !relationNames(task.metadata.subtasks).length && <span>未提供关系</span>}</div>
            {text(task.metadata.notes) && <div className="task-notes"><h3>备注</h3><p>{text(task.metadata.notes)}</p></div>}
            <p className="info-plan-note">执行计划仅统计 implement.md 的复选框，不代表代码完成率或验收通过。{task.progress ? ` 当前 ${task.progress.done}/${task.progress.total}；来源：${task.progress.source}` : ' 当前未提供可计算的计划。'}</p>
          </div>
            : <div className="detail-documents"><aside aria-label="任务产物目录" tabIndex={0}><FileList files={files} selected={selected} choose={path => navigate(path)} base={task.key + '/'} /><p className="artifact-hint">仅展示已有文件。<br />可选文档缺失不代表任务出错。</p></aside><div className="detail-document-content">{selected ? <DocumentViewer key={selected} path={selected} revision={revision} anchor={anchor} navigate={navigate} /> : <EmptyState title="没有可阅读的任务产物" icon="document" />}</div></div>}
      </>}
    </div>
  </dialog>;
}
