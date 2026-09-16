import { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronRight, Copy, FolderGit2, LayoutDashboard, LoaderCircle, LockKeyhole, NotebookPen, RefreshCw, ShieldCheck, Sprout, Terminal, X } from 'lucide-react';
import { useRoute, useSnapshot, type Page } from './hooks.js';
import { TasksPage } from './components/Tasks.js';
import { DocumentLibrary } from './components/Documents.js';
import { TaskDetail } from './components/TaskDetail.js';
import { Diagnostics, ErrorNotice } from './components/Common.js';
import type { Task } from '../shared/types.js';

const pages: { key: Page; label: string; subtitle: string; icon: typeof LayoutDashboard }[] = [
  { key: 'tasks', label: '任务面板', subtitle: 'Tasks', icon: LayoutDashboard },
  { key: 'specs', label: '规范库', subtitle: 'Specs', icon: BookOpen },
  { key: 'workspace', label: '工作记录', subtitle: 'Workspace', icon: NotebookPen },
];

export function App() {
  const { data, error, loading, refresh } = useSnapshot();
  const { route, navigate } = useRoute();
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    window.document.title = `${data?.project.name ?? 'Trellis'} · Trellis Dashboard`;
  }, [data?.project.name]);
  useEffect(() => { if (!copied) return; const timeout = window.setTimeout(() => setCopied(false), 1800); return () => window.clearTimeout(timeout); }, [copied]);
  const openTask = (task: Task) => navigate({ page: 'tasks', task: task.key });
  const openDocument = (path: string, anchor = '') => {
    if (path.startsWith('spec/')) navigate({ page: 'specs', file: path, anchor });
    else if (path.startsWith('workspace/')) navigate({ page: 'workspace', file: path, anchor });
    else {
      const task = data?.tasks.filter(task => path.startsWith(task.key + '/')).sort((a, b) => b.key.length - a.key.length)[0];
      if (task) navigate({ page: 'tasks', task: task.key, file: path, anchor });
      else setNotice('此引用不属于已加载的有效任务，无法打开。请检查任务是否已移动或损坏。');
    }
  };
  const activePage = pages.find(page => page.key === route.page)!;
  return <div className={'app-shell viewport-mode ' + (route.page !== 'tasks' ? 'reader-mode' : 'tasks-mode')}>
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); window.document.getElementById('main-content')?.focus(); }}>跳至主要内容</a>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Sprout size={24} strokeWidth={1.8} /></span><div><strong>Trellis<span className="brand-dot">.</span></strong><span>DASHBOARD</span></div></div>
      <div className="project-card"><span className="project-card-label">当前工作区</span><div><span className="project-symbol"><FolderGit2 size={18} /></span><strong title={data?.project.root}>{data?.project.name ?? '本地项目'}</strong></div><span className="project-version">{data?.project.version ? `Trellis v${data.project.version}` : '本地 Trellis 项目'}</span></div>
      <div className="nav-caption">探索项目</div>
      <nav className="main-nav" aria-label="主导航">{pages.map(page => <a key={page.key} href={'#' + page.key} className={route.page === page.key ? 'active' : ''} aria-current={route.page === page.key ? 'page' : undefined}><page.icon size={18} strokeWidth={1.7} /><span>{page.label}</span>{data && <small>{page.key === 'tasks' ? data.tasks.length : page.key === 'specs' ? data.specs.length : data.workspace.length}</small>}</a>)}</nav>
      <div className="sidebar-bottom"><div className="local-note"><span><ShieldCheck size={18} /></span><div><strong>你的文件，只在本地</strong><p>只读访问 · 无云端上传</p></div></div><div className="sidebar-version"><Terminal size={13} /><span>trellis-dashboard</span><span>0.1</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs"><FolderGit2 size={15} /><span>{data?.project.name ?? '工作区'}</span><ChevronRight size={14} /><strong>{activePage.label}</strong></div><div className="topbar-actions"><span className={'sync-state ' + (error ? 'failed' : '')}><span className="tiny-dot" />{error ? '同步失败' : data ? '本地同步' : '正在连接'}</span><button className="refresh-button" onClick={() => void refresh()} aria-label="刷新项目" title="重新读取本地文件" disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /><span>刷新</span></button></div></header>
      <main id="main-content" tabIndex={-1}>
        {notice && <div className="notice-bar" role="status"><span>{notice}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {error ? <div className="project-error"><ErrorNotice>{error}</ErrorNotice><button className="primary-button" onClick={() => void refresh()}>重新读取项目</button><p>面板不会把旧快照显示为最新数据。恢复目录或权限后将自动重试。</p></div>
          : !data ? <div className="initial-loading"><LoaderCircle className="spin" size={26} /><h2>正在连接你的工作区</h2><p>读取本地任务、规范与工作记录…</p></div>
            : <><Diagnostics items={data.diagnostics} />{route.page === 'tasks' ? <TasksPage tasks={data.tasks} open={openTask} /> : <DocumentLibrary key={route.page} type={route.page} files={route.page === 'specs' ? data.specs : data.workspace} selected={route.file} revision={data.generatedAt} anchor={route.anchor} navigate={openDocument} />}
              <div className="project-footer"><span><LockKeyhole size={12} />只读 · 未修改任何项目文件</span><button title={data.project.root} className="copy-project" onClick={() => { void navigator.clipboard?.writeText(data.project.root).then(() => setCopied(true)).catch(() => setNotice('无法写入剪贴板。项目路径：' + data.project.root)); }}>{copied ? <Check size={12} /> : <Copy size={12} />}<span>{data.project.root}</span></button></div>
              {route.page === 'tasks' && route.task && <TaskDetail key={route.task} task={data.tasks.find(task => task.key === route.task)} tasks={data.tasks} taskKey={route.task} selectedFile={route.file} revision={data.generatedAt} anchor={route.anchor} navigate={openDocument} openTask={openTask} close={() => navigate({ page: 'tasks' })} />}
            </>}
      </main>
    </div>
  </div>;
}
