export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export function appError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') return new AppError('NOT_FOUND', '文件或目录已不存在，请刷新后重试。', 404);
  if (code === 'EACCES' || code === 'EPERM') return new AppError('PERMISSION_DENIED', '没有读取权限，请检查文件和目录权限。', 403);
  if (code === 'ELOOP') return new AppError('UNSAFE_PATH', '符号链接无法安全解析，已拒绝读取。', 403);
  return new AppError('READ_FAILED', '读取失败，请检查目录是否可用后重试。', 500);
}
