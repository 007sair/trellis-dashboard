import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDownWideNarrow, ArrowUpRight, CircleCheck, CircleDashed, CircleDot, FileText, GitBranch, LayoutGrid, Layers3, List, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Task } from '../../shared/types.js';
import { defaultFilters, filterTasks, statusLabel, type TaskFilters } from '../../shared/utils.js';
import { Avatar, compactDate, EmptyState, Priority, Progress, StatusBadge } from './Common.js';

function TaskCard({ task, open }: { task: Task; open: (task: Task) => void }) {
  const relations = Array.isArray(task.metadata.children) ? task.metadata.children.length : 0;
  return <button className="task-card" onClick={() => open(task)} aria-label={'查看任务：' + task.title}>
    <div className="task-card-top"><Priority value={task.priority} /><span className="task-date" title={task.createdAt ?? '没有创建日期'}>{compactDate(task.createdAt)}</span><ArrowUpRight size={15} className="card-arrow" aria-hidden="true" /></div>
    <h3>{task.title}</h3><p className={'task-description ' + (!task.description ? 'is-empty' : '')}>{task.description || '未提供任务描述'}</p>
    <div className="task-card-plan"><Progress value={task.progress} /></div>
    <div className="task-card-bottom"><span className="assignee"><Avatar name={task.assignee} /><span>{task.assignee ?? '未分配'}</span></span><span className="card-file-count" title="任务产物数量"><FileText size={13} />{task.files.length}</span>{relations > 0 && <span className="card-file-count" title="子任务数量"><GitBranch size={13} />{relations}</span>}{task.archived && <Archive size={13} aria-label="已归档" />}</div>
  </button>;
}

function TaskTable({ tasks, open }: { tasks: Task[]; open: (task: Task) => void }) {
  return <div className="task-table-wrap" tabIndex={0} role="region" aria-label="任务列表数据"><table className="task-table"><thead><tr><th>任务</th><th>状态</th><th>优先级</th><th>负责人</th><th>执行计划</th><th>创建日期</th></tr></thead><tbody>{tasks.map(task => <tr key={task.key}>
    <td><button className="table-task-title" onClick={() => open(task)}>{task.title}<ArrowUpRight size={14} /></button><small>{task.id}{task.archived ? ' · 已归档' : ''}</small></td>
    <td><StatusBadge status={task.status} /></td><td><Priority value={task.priority} /></td><td><span className="assignee"><Avatar name={task.assignee} />{task.assignee ?? '未分配'}</span></td><td>{task.progress ? <span title={task.progress.source}>{task.progress.done} / {task.progress.total}</span> : <span className="muted">未提供</span>}</td><td title={task.createdAt ?? undefined}>{compactDate(task.createdAt)}</td>
  </tr>)}</tbody></table></div>;
}

export function TasksPage({ tasks, open }: { tasks: Task[]; open: (task: Task) => void }) {
  const [filters, setFilters] = useState<TaskFilters>({ ...defaultFilters });
  const [view, setView] = useState<'board' | 'list'>('board');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterToggle = useRef<HTMLButtonElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const update = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => setFilters(previous => ({ ...previous, [key]: value }));
  const options = (key: 'status' | 'priority' | 'assignee') => [...new Set(tasks.map(task => task[key]).filter((value): value is string => value !== null))].sort();
  const closeFilters = () => { setFiltersOpen(false); filterToggle.current?.focus({ preventScroll: true }); };
  const lanes = [
    { key: 'planning', title: '规划中', hint: '从想法到清晰的需求', icon: CircleDashed, tasks: visible.filter(task => task.status === 'planning') },
    { key: 'in_progress', title: '进行中', hint: '实现、检查与收尾', icon: CircleDot, tasks: visible.filter(task => task.status === 'in_progress') },
    { key: 'completed', title: '已完成', hint: '已标记完成的工作', icon: CircleCheck, tasks: visible.filter(task => task.status === 'completed') },
  ];
  const other = visible.filter(task => !['planning', 'in_progress', 'completed'].includes(task.status ?? ''));
  if (other.length) lanes.push({ key: 'other', title: '其他状态', hint: '保留项目自定义状态', icon: CircleDashed, tasks: other });
  const hasFilters = !!(filters.query || filters.status || filters.priority || filters.assignee);
  const filterCount = [filters.status, filters.priority, filters.assignee].filter(Boolean).length;
  const scopeKey = JSON.stringify([filters.archive, filters.query, filters.status, filters.priority, filters.assignee]);
  const hasVisible = visible.length > 0;
  useEffect(() => {
    const container = board.current;
    if (view !== 'board' || !container || !window.matchMedia('(max-width: 760px)').matches) return;
    const first = container.querySelector<HTMLElement>('[data-populated="true"]');
    if (first) container.scrollTo({ left: container.scrollLeft + first.getBoundingClientRect().left - container.getBoundingClientRect().left, behavior: 'instant' });
  }, [view, scopeKey, hasVisible]);
  const stats = [
    { label: '当前任务', value: visible.length, icon: Layers3, tone: 'total', note: '当前视图与筛选结果' },
    { label: '规划中', value: lanes[0]!.tasks.length, icon: CircleDashed, tone: 'planning', note: 'planning' },
    { label: '进行中', value: lanes[1]!.tasks.length, icon: CircleDot, tone: 'progress', note: 'in_progress' },
    { label: '已完成', value: lanes[2]!.tasks.length, icon: CircleCheck, tone: 'done', note: 'completed' },
  ];
  return <div className="tasks-page">
    <div className="page-heading task-heading"><div className="task-heading-main"><h1>任务面板</h1><p>让工作进展清晰可见</p></div><div className="heading-note"><span className="tiny-dot" />来自 .trellis/tasks</div></div>
    <div className="stats-grid">{stats.map(stat => <div className={'stat-card ' + stat.tone} key={stat.label}><span className="stat-icon"><stat.icon size={17} strokeWidth={1.7} /></span><div className="stat-details"><span className="stat-label">{stat.label}</span><span className="stat-note" title={stat.note}>{stat.note}</span></div><strong className="stat-number">{stat.value.toString().padStart(2, '0')}</strong></div>)}</div>
    <div className="task-controls"><div className="task-tabs" aria-label="任务范围">{([{ value: 'active', label: '活动任务' }, { value: 'archived', label: '归档任务' }, { value: 'all', label: '全部任务' }] as const).map(tab => <button key={tab.value} className={filters.archive === tab.value ? 'active' : ''} aria-pressed={filters.archive === tab.value} onClick={() => update('archive', tab.value)}>{tab.value === 'archived' && <Archive size={14} aria-hidden="true" />}{tab.label}<span>{filterTasks(tasks, { ...filters, archive: tab.value }).length}</span></button>)}</div><div className="view-toggle" aria-label="任务展示方式"><button title="看板视图" aria-label="看板视图" aria-pressed={view === 'board'} onClick={() => setView('board')}><LayoutGrid size={16} /></button><button title="列表视图" aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></button></div></div>
    {filtersOpen && <button className="task-filter-backdrop" aria-label="关闭筛选遮罩" onClick={closeFilters} />}
    <div className={'filter-bar ' + (filtersOpen ? 'filters-open' : '')}>
      <label className="search-field"><Search size={17} aria-hidden="true" /><input value={filters.query} onChange={event => update('query', event.target.value)} placeholder="搜索任务标题、描述或 ID…" aria-label="搜索任务" />{filters.query && <button onClick={() => update('query', '')} aria-label="清空搜索" type="button"><X size={14} /></button>}</label>
      <div className={'filter-selects ' + (filtersOpen ? 'is-open' : '')} id="task-filter-panel" role="group" aria-label="任务筛选条件" onKeyDown={event => { if (event.key === 'Escape' && filtersOpen) { event.preventDefault(); closeFilters(); } }}>
        <div className="filter-panel-heading"><strong>筛选条件</strong><button className="icon-button" aria-label="收起任务筛选" onClick={closeFilters}><X size={16} /></button></div>
        <SlidersHorizontal size={15} className="filter-icon" aria-hidden="true" />
        <label className="filter-option"><span>状态</span><select aria-label="按状态筛选" value={filters.status} onChange={event => update('status', event.target.value)}><option value="">所有状态</option>{options('status').map(value => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label>
        <label className="filter-option"><span>优先级</span><select aria-label="按优先级筛选" value={filters.priority} onChange={event => update('priority', event.target.value)}><option value="">所有优先级</option>{options('priority').map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label className="filter-option"><span>负责人</span><select aria-label="按负责人筛选" value={filters.assignee} onChange={event => update('assignee', event.target.value)}><option value="">所有负责人</option>{options('assignee').map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      </div>
      <label className="sort-select"><ArrowDownWideNarrow size={15} aria-hidden="true" /><select aria-label="任务排序" value={filters.sort} onChange={event => update('sort', event.target.value as TaskFilters['sort'])}><option value="recent">最近更新</option><option value="priority">优先级</option><option value="created">创建日期</option></select></label>
      <button ref={filterToggle} className="icon-button mobile-filter-toggle" aria-label={filtersOpen ? '关闭任务筛选' : '打开任务筛选'} aria-expanded={filtersOpen} aria-controls="task-filter-panel" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17} />{!!filterCount && <span className="filter-count" aria-hidden="true">{filterCount}</span>}</button>
    </div>
    {hasFilters && <div className="filter-summary">找到 {visible.length} 项匹配任务<button onClick={() => setFilters({ ...defaultFilters, archive: filters.archive, sort: filters.sort })}>清除筛选<X size={12} /></button></div>}
    {!visible.length ? <EmptyState title={hasFilters ? '没有匹配的任务' : filters.archive === 'archived' ? '归档里还没有任务' : '这里是下一个想法的起点'}>{hasFilters ? '试试其他关键词，或清除筛选条件。' : '使用现有 Trellis 工具管理任务。文件更新后，这里会自动同步。'}</EmptyState>
      : view === 'list' ? <TaskTable tasks={visible} open={open} /> : <div ref={board} className={'board ' + (lanes.length === 4 ? 'four-lanes' : '')} tabIndex={0} role="region" aria-label="任务看板">{lanes.map(lane => <section className={'board-lane lane-' + lane.key} key={lane.key} data-populated={lane.tasks.length > 0} aria-label={lane.title + '任务'}><div className="lane-heading"><lane.icon size={16} /><h2>{lane.title}</h2><span>{lane.tasks.length}</span></div><p className="lane-hint">{lane.hint}</p><div className="lane-cards" tabIndex={0} role="region" aria-label={lane.title + '卡片列表'}>{lane.tasks.map(task => <div key={task.key}>{lane.key === 'other' && <div className="custom-status"><StatusBadge status={task.status} /></div>}<TaskCard task={task} open={open} /></div>)}{!lane.tasks.length && <div className="lane-empty"><lane.icon size={22} strokeWidth={1.4} /><span>暂无{lane.title}任务</span></div>}</div></section>)}</div>}
    <footer className="board-footer"><span title="状态来自 task.json，计划勾选不代表验收通过">状态来自 task.json · 计划勾选不代表验收通过</span><span>{visible.length} 项任务 · 只读视图</span></footer>
  </div>;
}
