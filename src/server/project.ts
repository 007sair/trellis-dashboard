import * as fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './errors.js';

export interface Project {
  root: string;
  trellis: string;
  name: string;
}

export function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

export async function findProject(start = process.cwd()): Promise<Project> {
  let directory: string;
  try {
    directory = await fs.realpath(path.resolve(start));
    if (!(await fs.stat(directory)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new AppError('INVALID_DIRECTORY', `项目路径不是可读取的目录：${start}`);
  }
  while (true) {
    const candidate = path.join(directory, '.trellis');
    try {
      await fs.lstat(candidate);
      const stat = await fs.stat(candidate).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AppError('INVALID_TRELLIS', '最近的 .trellis 是失效链接，请修复后重试；不会改为读取上层项目。');
        throw error;
      });
      if (!stat.isDirectory()) throw new AppError('INVALID_TRELLIS', '.trellis 存在但不是目录。请检查所选项目。');
      const real = await fs.realpath(candidate);
      if (!isWithin(directory, real)) throw new AppError('UNSAFE_PATH', '.trellis 符号链接指向项目外部，出于安全考虑不读取。', 403);
      return { root: directory, trellis: real, name: path.basename(directory) || directory };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new AppError('NO_TRELLIS', '当前目录及其父目录中没有 .trellis。请进入已有 Trellis 项目，或使用 --dir <项目路径>。');
}
