import { build as bundle } from 'esbuild';
import { build as vite } from 'vite';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await bundle({
  absWorkingDir: root,
  entryPoints: ['src/server/cli.ts'],
  outfile: 'dist/server/cli.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  logLevel: 'info',
});
await vite({
  configFile: false,
  root: path.join(root, 'src/client'),
  build: { outDir: path.join(root, 'dist/client'), emptyOutDir: true, target: 'es2022' },
});
