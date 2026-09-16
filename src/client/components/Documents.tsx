import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { ArrowUpRight, Braces, ChevronDown, FileText, Folder, LoaderCircle, PanelLeft, Search, X } from 'lucide-react';
import type { DocumentContent, DocumentEntry } from '../../shared/types.js';
import { parseJsonLines, resolveDocumentLink, text } from '../../shared/utils.js';
import { fetchJson } from '../hooks.js';
import { EmptyState, ErrorNotice, fileSize } from './Common.js';

export type NavigateDocument = (path: string, anchor?: string) => void;

function SafeLink({ href, path, navigate, children }: { href?: string; path: string; navigate: NavigateDocument; children: ReactNode }) {
  const link = href ? resolveDocumentLink(path, href) : { kind: 'blocked' as const };
  if (link.kind === 'external') return <a href={link.href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={12} className="external-link" aria-hidden="true" /></a>;
  if (link.kind === 'document') return <a href={'#document-' + encodeURIComponent(link.path)} onClick={event => { event.preventDefault(); navigate(link.path, link.anchor); }}>{children}</a>;
  return <span className="blocked-link" title="此链接不在可安全浏览的文档范围内">{children}</span>;
}

function JsonContent({ content }: { content: string }) {
  try { return <pre className="code-view"><code>{JSON.stringify(JSON.parse(content), null, 2)}</code></pre>; }
  catch { return <><ErrorNotice>JSON 格式损坏，以下保留原文供检查。</ErrorNotice><pre className="code-view"><code>{content}</code></pre></>; }
}

function Manifest({ content, path, navigate }: { content: string; path: string; navigate: NavigateDocument }) {
  const parsed = useMemo(() => parseJsonLines(content), [content]);
  return <div className="manifest">
    <div className="manifest-caption"><Braces size={17} aria-hidden="true" /><span>上下文清单 · {parsed.entries.length} 条有效记录</span></div>
    {parsed.examples > 0 && <p className="muted">已忽略 {parsed.examples} 条 _example 模板，不将其视为有效上下文。</p>}
    {!!parsed.issues.length && <ErrorNotice>格式错误：{parsed.issues.map(issue => `第 ${issue.line} 行`).join('、')}；其余合法行仍可阅读。</ErrorNotice>}
    {!!parsed.omitted && <ErrorNotice>结构化视图仅处理前 2000 行，另有 {parsed.omitted} 行；可在下方展开完整原文。</ErrorNotice>}
    {parsed.entries.map(entry => <div className="manifest-entry" key={entry.line}>
      <span className="line-number">{String(entry.line).padStart(2, '0')}</span>
      <div><div className="manifest-file"><SafeLink href={text(entry.value.file) ?? undefined} path={path} navigate={navigate}>{text(entry.value.file) ?? '未提供 file'}</SafeLink></div><p>{text(entry.value.reason) ?? '未提供 reason'}</p><details><summary>查看记录</summary><pre>{JSON.stringify(entry.value, null, 2)}</pre></details></div>
    </div>)}
    {!parsed.entries.length && <EmptyState title="暂无有效上下文记录" icon="document">模板行或空文件不会被计为上下文。</EmptyState>}
    <details className="raw-manifest"><summary>查看完整原文</summary><pre className="code-view"><code>{content}</code></pre></details>
  </div>;
}

export function DocumentViewer({ path, revision, anchor = '', navigate }: { path: string; revision: string; anchor?: string; navigate: NavigateDocument }) {
  const [document, setDocument] = useState<DocumentContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchJson<DocumentContent>('/api/document?path=' + encodeURIComponent(path), controller.signal).then(value => {
      if (!controller.signal.aborted) { setDocument(value); setError(null); }
    }).catch(problem => {
      if (!controller.signal.aborted) { setDocument(null); setError(problem instanceof Error ? problem.message : '文档读取失败'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  useEffect(() => {
    if (document && anchor) scrollDocumentAnchor(content.current, anchor);
  }, [document?.path, anchor, !!document]);
  const navigateLink: NavigateDocument = (target, targetAnchor = '') => {
    if (target === path && targetAnchor) scrollDocumentAnchor(content.current, targetAnchor);
    navigate(target, targetAnchor);
  };
  const current = document?.path === path ? document : null;
  return <section className="document-viewer" aria-label="文档阅读器" data-testid="document-viewer">
    <div className="document-bar"><FileText size={15} aria-hidden="true" /><span title={'.trellis/' + path}>{path}</span>{current && <small>{fileSize(current.size)}</small>}{loading && <LoaderCircle size={14} className="spin" aria-label="读取文档中" />}</div>
    <div className="document-scroll" ref={content} tabIndex={0} role="region" aria-label="文档正文">
      {error ? <ErrorNotice>{error}</ErrorNotice> : !current ? <div className="document-loading"><LoaderCircle className="spin" size={20} />正在读取文档…</div> : <>
        {current.kind === 'markdown' ? <article className="markdown-body"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSlug, { prefix: 'doc-' }]]} skipHtml components={{
          a: ({ href, children }) => <SafeLink href={href} path={path} navigate={navigateLink}>{children}</SafeLink>,
          img: ({ alt }) => <span className="image-placeholder">[图片：{alt || '未提供说明'} · 本地阅读模式不自动加载图片]</span>,
        }}>{current.content}</Markdown></article>
          : current.kind === 'jsonl' ? <Manifest content={current.content} path={path} navigate={navigateLink} />
            : current.kind === 'json' ? <JsonContent content={current.content} />
              : <pre className="code-view"><code>{current.content}</code></pre>}
      </>}
    </div>
  </section>;
}

function scrollDocumentAnchor(container: HTMLDivElement | null, anchor: string) {
  window.requestAnimationFrame(() => {
    const target = window.document.getElementById('doc-' + anchor);
    if (!container?.isConnected || !target || !container.contains(target)) return;
    container.scrollTo({ top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 12, behavior: 'instant' });
  });
}

function fileLabel(file: DocumentEntry) {
  const names: Record<string, string> = { 'prd.md': '需求说明', 'design.md': '技术设计', 'implement.md': '执行计划', 'implement.jsonl': '实现上下文', 'check.jsonl': '检查上下文', 'task.json': '任务数据' };
  return names[file.name];
}

export function FileList({ files, selected, choose, base = '' }: { files: DocumentEntry[]; selected: string; choose: (file: string) => void; base?: string }) {
  return <div className="file-list">{files.map(file => <button className={'file-item ' + (selected === file.path ? 'selected' : '')} key={file.path} onClick={() => choose(file.path)} aria-current={selected === file.path ? 'page' : undefined} title={file.problem ?? file.path}>
    {file.name.endsWith('.jsonl') || file.name.endsWith('.json') ? <Braces size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
    <span><strong>{base && file.path.startsWith(base) ? file.path.slice(base.length) : file.name}</strong>{fileLabel(file) && <small>{fileLabel(file)}</small>}{!file.readable && <small className="warning-text">{file.problem}</small>}</span>
  </button>)}</div>;
}

export function DocumentLibrary({ type, files, selected, revision, anchor, navigate }: { type: 'specs' | 'workspace'; files: DocumentEntry[]; selected: string; revision: string; anchor: string; navigate: NavigateDocument }) {
  const [query, setQuery] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const directoryToggle = useRef<HTMLButtonElement>(null);
  const root = type === 'specs' ? 'spec/' : 'workspace/';
  const title = type === 'specs' ? '规范库' : '工作记录';
  const treeId = `library-tree-${type}`;
  const visible = files.filter(file => file.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const groups = new Map<string, DocumentEntry[]>();
  for (const file of visible) {
    const parts = file.path.slice(root.length).split('/');
    const group = type === 'workspace' ? (parts.length > 1 ? parts[0]! : '工作区索引') : parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录';
    const list = groups.get(group) ?? [];
    list.push(file);
    groups.set(group, list);
  }
  const current = selected || files.find(file => file.path === root + 'index.md')?.path || files.find(file => file.name === 'index.md')?.path || files[0]?.path || '';
  const closeDirectory = () => { setDirectoryOpen(false); directoryToggle.current?.focus({ preventScroll: true }); };
  const chooseFile = (file: string) => {
    setDirectoryOpen(false);
    navigate(file);
    if (window.matchMedia('(max-width: 760px)').matches) window.requestAnimationFrame(() => window.document.querySelector<HTMLElement>('.library-content .document-scroll')?.focus({ preventScroll: true }));
  };
  return <div className="library-page">
    <div className="page-heading library-heading"><div className="library-title"><h1>{title}<span className="heading-count">{files.length}</span></h1><p>{type === 'specs' ? '共享项目约定' : '开发者索引与工作日志'}<span> · .trellis/{root.slice(0, -1)}</span></p></div>
      <div className="library-header-actions"><label className="search-field library-search"><Search size={16} aria-hidden="true" /><input aria-label={'搜索' + title + '文件'} value={query} onChange={event => { setQuery(event.target.value); if (window.matchMedia('(max-width: 760px)').matches) setDirectoryOpen(true); }} placeholder="搜索文档…" />{query && <button type="button" aria-label="清空文档搜索" onClick={() => setQuery('')}><X size={13} /></button>}</label><button ref={directoryToggle} className="library-directory-toggle icon-button" aria-label={directoryOpen ? '关闭文档目录' : '打开文档目录'} aria-expanded={directoryOpen} aria-controls={treeId} onClick={() => setDirectoryOpen(value => !value)}><PanelLeft size={19} /></button></div>
    </div>
    <div className="library-layout">
      {directoryOpen && <button className="library-tree-backdrop" onClick={closeDirectory} aria-label="关闭目录遮罩" />}
      <aside id={treeId} className={'library-tree ' + (directoryOpen ? 'is-open' : '')} aria-label={title + '文档目录'} onKeyDown={event => { if (event.key === 'Escape' && directoryOpen) { event.preventDefault(); closeDirectory(); } }}>
        <div className="tree-heading"><Folder size={14} /><span>文件目录</span><small>{visible.length} 份</small><button className="icon-button tree-close" aria-label="收起文档目录" onClick={closeDirectory}><X size={16} /></button></div>
        <div className="library-group-list" tabIndex={0} role="region" aria-label={title + '文件列表'}>{[...groups].map(([group, entries]) => <details className="library-group" key={group} open><summary><ChevronDown size={13} /><Folder size={15} /><span>{group}</span><small>{entries.length}</small></summary><FileList files={entries} selected={current} choose={chooseFile} base={type === 'workspace' && group !== '工作区索引' ? root + group + '/' : ''} /></details>)}{!visible.length && <p className="tree-empty">没有匹配的文件</p>}</div>
        <div className="tree-footer"><span className="tiny-dot" />本地 Markdown · 只读</div>
      </aside>
      <div className="library-content">{current ? <DocumentViewer key={current} path={current} revision={revision} anchor={anchor} navigate={navigate} /> : <EmptyState title={'暂无' + title} icon="document">在 .trellis/{root} 中添加文档后，这里会自动更新。</EmptyState>}</div>
    </div>
  </div>;
}
