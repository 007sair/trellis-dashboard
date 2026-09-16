import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiFailure, Snapshot } from '../shared/types.js';

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store', credentials: 'same-origin' });
  const body = await response.json() as T & Partial<ApiFailure>;
  if (!response.ok) throw new Error(body.error?.message ?? `请求失败（${response.status}）`);
  return body;
}

export function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const next = await fetchJson<Snapshot>('/api/snapshot', controller.signal);
      if (!controller.signal.aborted) { setData(next); setError(null); }
    } catch (problem) {
      if (!controller.signal.aborted) { setData(null); setError(problem instanceof Error ? problem.message : '无法读取项目'); }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (request.current === controller) request.current = null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => { window.clearInterval(interval); request.current?.abort(); request.current = null; };
  }, [refresh]);
  return { data, error, loading, refresh };
}

export type Page = 'tasks' | 'specs' | 'workspace';
export interface Route { page: Page; task: string; file: string; anchor: string }

export function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const [part, query = ''] = hash.replace(/^#/, '').split('?');
  const parameters = new URLSearchParams(query);
  const route: Route = {
    page: part === 'specs' || part === 'workspace' ? part : 'tasks',
    task: parameters.get('task') ?? '', file: parameters.get('file') ?? '', anchor: parameters.get('anchor') ?? '',
  };
  const navigate = useCallback((next: Partial<Route> & { page: Page }) => {
    const query = new URLSearchParams();
    for (const key of ['task', 'file', 'anchor'] as const) if (next[key]) query.set(key, next[key]!);
    window.location.hash = next.page + (query.size ? '?' + query.toString() : '');
  }, []);
  return { route, navigate };
}
