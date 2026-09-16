#!/usr/bin/env node

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 18 || (major === 18 && minor < 18)) {
  console.error('Trellis Dashboard 需要 Node.js 18.18 或更新版本。');
  process.exitCode = 1;
} else {
  try {
    const { run } = await import('../dist/server/cli.js');
    await run();
  } catch (error) {
    console.error(error?.code === 'ERR_MODULE_NOT_FOUND'
      ? '缺少构建产物。请在 Dashboard 源码目录运行 npm install && npm run build，或重新安装已打包的版本。'
      : `启动失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
