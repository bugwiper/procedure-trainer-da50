import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const text = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const lines = text.split('\n');

const PINS: Record<string, string> = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
  'actions/configure-pages': '45bfe0192ca1faeb007ade9deae92b16b8254a0d',
  'actions/upload-pages-artifact': 'fc324d3547104276b827a68afc52ff2a11cc49c9',
  'actions/deploy-pages': '368f82528645a54fb793d4d04e342629a3f51346',
};

/** Lines of a top-level block: from its key line to the next line with the same indent or less. */
function block(key: string, indent: number): string[] {
  const prefix = ' '.repeat(indent) + key + ':';
  const start = lines.findIndex((l) => l.startsWith(prefix));
  if (start < 0) throw new Error(`block ${key} not found`);
  const out = [lines[start] as string];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i] as string;
    if (l.trim() !== '' && l.length - l.trimStart().length <= indent) break;
    out.push(l);
  }
  return out;
}

const jobs = ['verify', 'e2e', 'deploy'];

describe('deploy workflow supply-chain gates', () => {
  it('pins every action to a 40-hex commit SHA', () => {
    const uses = lines.filter((l) => /\buses:/.test(l));
    expect(uses.length).toBeGreaterThan(0);
    for (const l of uses) {
      expect(l).toMatch(/uses:\s+[\w.-]+\/[\w./-]+@[0-9a-f]{40}(\s|$)/);
    }
  });

  it('uses exactly the reviewed SHA for each known action', () => {
    for (const [action, sha] of Object.entries(PINS)) {
      expect(text).toContain(`${action}@${sha}`);
    }
    for (const l of lines.filter((x) => /\buses:/.test(x))) {
      const m = /uses:\s+([^@\s]+)@([0-9a-f]{40})/.exec(l);
      expect(m).not.toBeNull();
      expect(PINS[(m as RegExpExecArray)[1] as string]).toBe((m as RegExpExecArray)[2]);
    }
  });

  it('keeps the top-level token read-only', () => {
    const perms = block('permissions', 0)
      .slice(1)
      .filter((l) => l.trim() !== '');
    expect(perms.map((l) => l.trim())).toEqual(['contents: read']);
  });

  it('grants pages and id-token write only inside the deploy job', () => {
    for (const perm of ['pages: write', 'id-token: write']) {
      expect(lines.filter((l) => l.includes(perm)).length).toBe(1);
      expect(block('deploy', 2).some((l) => l.includes(perm))).toBe(true);
      for (const job of jobs.filter((j) => j !== 'deploy')) {
        expect(block(job, 2).some((l) => l.includes(perm))).toBe(false);
      }
    }
  });

  it('never persists checkout credentials', () => {
    const checkouts = lines.map((l, i) => ({ l, i })).filter((x) => /actions\/checkout@/.test(x.l));
    expect(checkouts.length).toBe(2);
    for (const { i } of checkouts) {
      expect(lines.slice(i + 1, i + 4).some((l) => l.includes('persist-credentials: false'))).toBe(
        true,
      );
    }
  });

  it('uses Node 24 in both setup-node steps', () => {
    const setups = lines.map((l, i) => ({ l, i })).filter((x) => /actions\/setup-node@/.test(x.l));
    expect(setups.length).toBe(2);
    for (const { i } of setups) {
      expect(lines.slice(i + 1, i + 4).some((l) => /node-version:\s*24\b/.test(l))).toBe(true);
    }
  });

  it('derives BASE_PATH from the repository name on the build step', () => {
    expect(text).toContain('BASE_PATH: "/${{ github.event.repository.name }}/"');
  });

  it('deploys only from main and only after verify and e2e', () => {
    const deploy = block('deploy', 2).join('\n');
    expect(deploy).toContain("if: github.ref == 'refs/heads/main'");
    expect(deploy).toMatch(/needs:\s*\[verify,\s*e2e\]/);
  });

  it('runs npm run validate in the verify job after the tests and before the build', () => {
    const verify = block('verify', 2);
    const at = (needle: string): number => verify.findIndex((l) => l.includes(needle));
    expect(at('npm run validate')).toBeGreaterThan(-1);
    expect(at('npm run validate')).toBeGreaterThan(at('npm test'));
    expect(at('npm run validate')).toBeLessThan(at('npm run build'));
  });

  it('runs on push to main, pull_request and workflow_dispatch', () => {
    const on = block('on', 0).join('\n');
    expect(on).toMatch(/push:\s*\n\s+branches:\s*\[main\]/);
    expect(on).toContain('pull_request:');
    expect(on).toContain('workflow_dispatch:');
  });
});
