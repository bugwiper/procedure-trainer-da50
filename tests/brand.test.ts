import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PNL-10, D-05, D-06, T-01.1-04: source-level brand and raster gate. The rendered-text gate
// lives in e2e/brand.spec.ts; the paragraph that states the rule is checked here.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const rel = (file: string) => file.slice(root.length);

describe('brand gate', () => {
  it('no file under src/ui/panel or src/aircraft contains a real brand name', () => {
    const files = [...walk(join(root, 'src/ui/panel')), ...walk(join(root, 'src/aircraft'))];
    expect(files.length).toBeGreaterThan(10);
    const offenders = files
      .filter((file) => /garmin|diamond/i.test(readFileSync(file, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('no file under src contains an image element or a data: URL', () => {
    const offenders = walk(join(root, 'src'))
      .filter((file) => /\.(tsx?|css|html|svg)$/.test(file))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return /<image[\s>/]|<img[\s>/]|<feImage|url\(\s*['"]?data:|["'`]data:/i.test(text);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('tracks no raster or vector photo file under src', () => {
    const offenders = walk(join(root, 'src'))
      .filter((file) => /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('content policy section 7 (brand replacement rule)', () => {
  const text = read('docs/CONTENT-POLICY.md');
  const section7 = text.slice(text.indexOf('## 7. Panel artwork'), text.indexOf('## 8.'));

  it.each(['GO-AROUND', 'RUBIN', 'DA50RG'])('names %s', (name) => {
    expect(section7).toContain(name);
  });

  it('states that no logo, swoosh, bird, wordmark shape or registration is drawn', () => {
    for (const word of ['logo', 'swoosh', 'bird', 'wordmark', 'registration']) {
      expect(section7.toLowerCase()).toContain(word);
    }
  });
});
