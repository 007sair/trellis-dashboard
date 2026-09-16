import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { findProject } from './project.js';
import { startServer } from './http.js';
import { AppError, appError } from './errors.js';

const help = `Trellis Dashboard — 本地只读项目面板

用法：trellis-dashboard [项目路径] [选项]

选项：
  -d, --dir <路径>    从指定目录向上寻找最近的 .trellis 项目
  -p, --port <端口>   本机端口，默认 4317；0 自动分配可用端口
      --no-open      不自动打开浏览器，只打印访问地址
  -h, --help         显示帮助
  -v, --version      显示版本

示例：
  trellis-dashboard
  trellis-dashboard --dir /path/to/project --port 4320
  trellis-dashboard "../项目目录" --no-open

仅监听 127.0.0.1；不修改项目、不执行 Trellis 脚本。
按 Ctrl+C 停止。`;

export function parseOptions(args: string[]) {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ args, allowPositionals: true, strict: true, options: {
      dir: { type: 'string', short: 'd' }, port: { type: 'string', short: 'p' },
      'no-open': { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    } });
  } catch (error) { throw new AppError('INVALID_ARGUMENT', `${(error as Error).message}\n运行 trellis-dashboard --help 查看用法。`); }
  if (parsed.positionals.length > 1 || (parsed.positionals.length && parsed.values.dir !== undefined)) throw new AppError('INVALID_ARGUMENT', '项目路径只能指定一次：使用位置参数或 --dir。');
  const rawPort = parsed.values.port;
  const port = rawPort === undefined ? 4317 : typeof rawPort === 'string' && /^\d+$/.test(rawPort) ? Number(rawPort) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new AppError('INVALID_PORT', '端口必须是 0–65535 的整数。');
  return {
    directory: typeof parsed.values.dir === 'string' ? parsed.values.dir : parsed.positionals[0] ?? process.cwd(),
    port, open: !parsed.values['no-open'], help: !!parsed.values.help, version: !!parsed.values.version,
  };
}

function openBrowser(url: string): void {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]] as const
    : process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] as const
    : ['xdg-open', [url]] as const;
  const child = spawn(command, [...args], { stdio: 'ignore', windowsHide: true });
  const warning = () => console.warn(`未能自动打开浏览器，请手动访问 ${url}`);
  child.once('error', warning);
  child.once('exit', code => { if (code !== null && code !== 0) warning(); });
  child.unref();
}

export async function run(args = process.argv.slice(2)): Promise<void> {
  try {
    const options = parseOptions(args);
    if (options.help) { console.log(help); return; }
    if (options.version) {
      const packageInfo = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
      console.log(packageInfo.version);
      return;
    }
    const project = await findProject(options.directory);
    const dashboard = await startServer({ project, port: options.port });
    console.log(`\n  Trellis Dashboard\n\n  项目  ${project.root}\n  面板  ${dashboard.url}\n  模式  本地只读 · 每 2 秒同步\n\n  按 Ctrl+C 停止。\n`);
    if (options.open) openBrowser(dashboard.url);
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      void dashboard.close().then(() => console.log('面板已停止。')).catch(() => { process.exitCode = 1; });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    const problem = appError(error);
    console.error(`${problem.code}: ${problem.message}`);
    process.exitCode = 1;
  }
}
