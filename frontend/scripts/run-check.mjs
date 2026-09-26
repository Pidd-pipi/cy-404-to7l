// 用 esbuild（随 vite 提供）把 TS/TSX 校验脚本打成 ESM 后在 Node 运行。
// 用法：node scripts/run-check.mjs scripts/verify-pagination.mts
import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { argv, exit } from 'node:process';
import { pathToFileURL } from 'node:url';

const entry = argv[2];
if (!entry) {
  console.error('用法: node scripts/run-check.mjs <校验脚本>');
  exit(2);
}

const out = entry.replace(/\.mts$/, '.bundle.mjs');
rmSync(out, { force: true });

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  jsx: 'automatic',
  outfile: out,
  logLevel: 'silent',
});

try {
  await import(pathToFileURL(out).href);
} finally {
  rmSync(out, { force: true });
}
