import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// CNT-03 hygiene gate: the content policy exists and is surfaced, no AFM material is
// tracked, and the policy is never rendered through a raw-HTML API.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('content policy document', () => {
  const lines = read('docs/CONTENT-POLICY.md').split('\n');

  it.each([
    '# Content Policy for AFM-Derived Material',
    '## 1. Status and purpose',
    '## 2. What may be committed',
    '## 3. What must never be committed',
    '## 4. Required source metadata for every scenario',
    '## 5. Repository visibility',
    '## 6. Responsibility and legal status',
    '## 7. Panel artwork',
    '## 8. Corrections and error reports',
    '### Verbatim checklist step lines: limit',
  ])('has the heading line "%s"', (heading) => {
    expect(lines).toContain(heading);
  });

  it('is linked from the README', () => {
    expect(read('README.md')).toContain('](docs/CONTENT-POLICY.md)');
  });
});

describe('repository hygiene', () => {
  it('tracks no PDF and nothing under .input/', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((line) => line !== '');
    expect(tracked.filter((p) => /\.pdf$/i.test(p))).toEqual([]);
    expect(tracked.filter((p) => p.startsWith('.input/'))).toEqual([]);
  });

  it('git-ignores the private .input/ folder', () => {
    expect(read('.gitignore').split('\n')).toContain('.input/');
  });
});

describe('in-app surfacing', () => {
  it('About imports the policy as a raw string', () => {
    expect(read('src/ui/about/About.tsx')).toContain('CONTENT-POLICY.md?raw');
  });

  it('the footer carries the training-aid notice and the About link', () => {
    const app = read('src/ui/App.tsx');
    expect(app).toContain('Training aid only, not the AFM');
    expect(app).toContain('About and content policy');
  });

  it('no source file uses a raw-HTML injection API', () => {
    const offenders = walk(join(root, 'src')).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return text.includes('dangerouslySetInnerHTML') || text.includes('innerHTML');
    });
    expect(offenders).toEqual([]);
  });
});
