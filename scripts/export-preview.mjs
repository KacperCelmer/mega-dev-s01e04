import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] ?? '../preview/index.html');
if (!relative(repo, output).startsWith('..' + sep)) {
  throw new Error('Save the preview outside the repository (ADR 0003).');
}
const base = new URL(process.env.RIG_URL ?? 'http://127.0.0.1:8787');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Export from the local rig service.');
}
const response = await fetch(new URL('/digest/2026-10-28', base));
if (!response.ok) throw new Error('Digest export failed: HTTP ' + response.status);
const html = await response.text();
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html, 'utf8');
console.log('Saved self-contained digest HTML to ' + output);
