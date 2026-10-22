import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { checkScenario } from '../src/scenario/lint';
import { openScenario, OPEN_ACCESS } from '../src/scenario/packs';
import type { PackProvider } from '../src/scenario/packs';

// `npm run validate` (D-21, SCN-01, SCN-02): the real command, run as a child process against the
// shipped packs and against the deliberately broken fixture pack. Expected positions are derived
// from the fixture text, not typed in.
const root = fileURLToPath(new URL('../', import.meta.url));
const BROKEN = 'tests/fixtures/broken';

function validate(folder?: string): { code: number | null; lines: string[] } {
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-scenarios.mjs', ...(folder === undefined ? [] : [folder])],
    { cwd: root, encoding: 'utf8', timeout: 60_000 },
  );
  return { code: result.status, lines: result.stdout.split('\n').filter((l) => l !== '') };
}

/** Line and column of the first line containing `needle`, column of the `at` text inside it. */
function where(file: string, needle: string, at: string): string {
  const lines = readFileSync(`${root}${BROKEN}/demo/${file}`, 'utf8').split('\n');
  const index = lines.findIndex((l) => l.includes(needle));
  expect(index, `"${needle}" in ${file}`).toBeGreaterThanOrEqual(0);
  return `${file}:${String(index + 1)}:${String((lines[index] ?? '').indexOf(at) + 1)}`;
}

describe('npm run validate', () => {
  it('passes the shipped packs', () => {
    const { code, lines } = validate();
    expect(code).toBe(0);
    expect(lines.at(-1)).toMatch(/^\d+ scenario files checked, 0 problems$/);
  });

  it('exits 1 on the broken pack and names file, line and column of each problem', () => {
    const { code, lines } = validate(BROKEN);
    expect(code).toBe(1);
    const prefix = `${BROKEN}/demo/`;
    expect(lines).toContainEqual(
      expect.stringContaining(
        `${prefix}${where('bad-key.toon', 'ordred:', 'ordred')}: procedure.0.branches.1.nodes.0.ordred: unknown key "ordred"`,
      ),
    );
    expect(lines).toContainEqual(
      expect.stringContaining(
        `${prefix}${where('bad-control.toon', 'lv.no_such_control', 'control')}: procedure.0.branches.1.nodes.0.steps.1.done.control: unknown control "lv.no_such_control"`,
      ),
    );
    expect(lines).toContainEqual(
      expect.stringContaining(
        `${prefix}${where('pack.toon', 'file: no-such-file', 'file')}: file "no-such-file.toon" does not exist`,
      ),
    );
    expect(lines.at(-1)).toMatch(/^2 scenario files checked, \d+ problems$/);
  });

  it('exits 2 for a root folder that does not exist', () => {
    expect(validate('tests/fixtures/no-such-root').code).toBe(2);
  });
});

describe('the app and the command share one check', () => {
  const text = readFileSync(`${root}${BROKEN}/demo/bad-control.toon`, 'utf8');

  it('openScenario returns the issues checkScenario returns, with line and column', async () => {
    const checked = checkScenario(text, DA50RG_ENV);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    const provider: PackProvider = {
      listPacks: () =>
        Promise.resolve([
          {
            id: 'demo',
            title: 'Demo',
            free: true,
            scenarios: [{ id: 'bad-control', title: 'BAD CONTROL', file: 'bad-control' }],
          },
        ]),
      loadPack: () => Promise.resolve({ id: 'demo', files: [{ name: 'bad-control', text }] }),
    };
    const opened = await openScenario({ provider, policy: OPEN_ACCESS }, DA50RG_ENV, {
      pack: 'demo',
      scenario: 'bad-control',
    });
    expect(opened).toMatchObject({ ok: false, reason: 'invalid' });
    if (opened.ok) return;
    expect(opened.issues).toEqual(checked.issues);
    expect(opened.issues[0]?.line).toBeGreaterThan(1);
    expect(opened.issues[0]?.col).toBeGreaterThan(1);
  });
});
