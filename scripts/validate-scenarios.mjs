// `npm run validate` (D-21, SCN-01, SCN-02): checks every pack under a root folder (default
// `scenarios`; one pack per subfolder) against the schema and the control registry and prints
// each problem as file:line:col: message. Exit code 1 when there is any problem, 2 when the
// command itself cannot run. The TypeScript modules load through Vite (ssrLoadModule), because
// Node's type stripping cannot import the repo's extensionless modules (RESEARCH Pattern 6).
// This script is the only place that reads the files; src/scenario stays pure.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootArg = process.argv[2] ?? 'scenarios';
const root = resolve(process.cwd(), rootArg);

const out = (text) => process.stdout.write(`${text}\n`);

async function readPack(folder, id) {
  const names = (await readdir(folder)).filter((n) => n.endsWith('.toon')).sort();
  const dir = relative(process.cwd(), folder).split('\\').join('/');
  const manifestText = names.includes('pack.toon')
    ? await readFile(join(folder, 'pack.toon'), 'utf8')
    : null;
  const files = [];
  for (const name of names) {
    if (name === 'pack.toon') continue;
    files.push({
      name: name.slice(0, -'.toon'.length),
      text: await readFile(join(folder, name), 'utf8'),
    });
  }
  return { dir, id, manifestText, files };
}

async function main() {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    out(`cannot read ${rootArg}: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const packs = [];
  for (const entry of entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    packs.push(await readPack(join(root, entry.name), entry.name));
  }

  const server = await createServer({
    root: repo,
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const { validateAll, formatIssue } = await server.ssrLoadModule(
      '/src/scenario/validate-all.ts',
    );
    const issues = validateAll(packs);
    for (const issue of issues) out(formatIssue(issue));
    const checked = packs.reduce((sum, pack) => sum + pack.files.length, 0);
    out(`${String(checked)} scenario files checked, ${String(issues.length)} problems`);
    return issues.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

process.exitCode = await main();
