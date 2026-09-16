import { createServer, type Server, type ServerResponse } from 'node:http';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TrellisStore } from './store.js';
import { AppError, appError } from './errors.js';
import { isWithin, type Project } from './project.js';

const headers = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store',
};

function json(response: ServerResponse, status: number, value: unknown, head: boolean): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(head ? undefined : JSON.stringify(value));
}

export interface DashboardServer {
  server: Server;
  url: string;
  store: TrellisStore;
  close(): Promise<void>;
}

export async function startServer(options: { project: Project; port?: number; clientDir?: string }): Promise<DashboardServer> {
  const store = new TrellisStore(options.project);
  const clientDir = await fs.realpath(options.clientDir ?? fileURLToPath(new URL('../client/', import.meta.url))).catch(() => {
    throw new AppError('BUILD_MISSING', '未找到面板构建产物，请在 Dashboard 源码目录运行 npm run build。');
  });
  await fs.access(path.join(clientDir, 'index.html')).catch(() => { throw new AppError('BUILD_MISSING', '面板缺少 index.html，请重新构建或安装。'); });
  const requestedPort = options.port ?? 4317;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new AppError('INVALID_PORT', '端口必须是 0–65535 的整数（0 为自动分配）。');

  const server = createServer((request, response) => {
    for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
    const head = request.method === 'HEAD';
    void (async () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : requestedPort;
      const host = request.headers.host;
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) throw new AppError('INVALID_HOST', '拒绝非本机 Host 请求。', 403);
      const origin = `http://${host}`;
      if (request.headers.origin && request.headers.origin !== origin) throw new AppError('INVALID_ORIGIN', '拒绝跨来源请求。', 403);
      if (request.method !== 'GET' && !head) {
        response.setHeader('Allow', 'GET, HEAD');
        response.setHeader('Connection', 'close');
        throw new AppError('READ_ONLY', '面板为只读模式，不提供写操作。', 405);
      }
      let url: URL;
      try { url = new URL(request.url ?? '/', origin); }
      catch { throw new AppError('INVALID_URL', '请求地址无效。'); }
      if (url.origin !== origin) throw new AppError('INVALID_ORIGIN', '请求地址不属于此面板。', 403);
      if (url.pathname.startsWith('/api/')) {
        if (request.headers['sec-fetch-site'] === 'cross-site') throw new AppError('INVALID_ORIGIN', '拒绝跨站点读取本地项目数据。', 403);
        if (url.pathname === '/api/snapshot') {
          json(response, 200, await store.snapshot(), head);
        } else if (url.pathname === '/api/document') {
          const file = url.searchParams.get('path');
          if (!file) throw new AppError('MISSING_PATH', '请提供文档相对路径。');
          json(response, 200, await store.readDocument(file), head);
        } else {
          throw new AppError('NOT_FOUND', '接口不存在。', 404);
        }
        return;
      }
      let relative: string;
      try { relative = decodeURIComponent(url.pathname).slice(1) || 'index.html'; }
      catch { throw new AppError('INVALID_URL', '地址编码无效。'); }
      if (relative !== 'index.html' && relative !== 'favicon.svg' && !/^assets\/[a-zA-Z0-9._-]+\.(js|css|woff2?)$/.test(relative)) {
        throw new AppError('NOT_FOUND', '页面或资源不存在。', 404);
      }
      const filename = await fs.realpath(path.join(clientDir, relative));
      if (!isWithin(clientDir, filename)) throw new AppError('UNSAFE_PATH', '拒绝读取面板资源目录外的文件。', 403);
      const content = await fs.readFile(filename);
      const contentType: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
      response.writeHead(200, { 'Content-Type': contentType[path.extname(filename)] ?? 'application/octet-stream' });
      response.end(head ? undefined : content);
    })().catch(error => {
      if (response.destroyed || response.writableEnded) return;
      const problem = appError(error);
      json(response, problem.status, { error: { code: problem.code, message: problem.message } }, head);
    });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 1000;
  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') reject(new AppError('PORT_IN_USE', `端口 ${requestedPort} 已被占用。请使用 --port <其他端口>，或 --port 0 自动分配。`));
      else reject(error);
    };
    server.once('error', onError);
    server.listen(requestedPort, '127.0.0.1', () => { server.off('error', onError); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new AppError('START_FAILED', '无法确定监听地址。', 500);
  return {
    server, store, url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => server.closeAllConnections(), 1500);
      timeout.unref();
      server.close(error => { clearTimeout(timeout); if (error) reject(error); else resolve(); });
      server.closeIdleConnections();
    }),
  };
}
