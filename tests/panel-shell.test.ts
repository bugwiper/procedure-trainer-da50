import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DEF_IDS, Defs } from '../src/ui/panel/Defs';
import { PanelShell } from '../src/ui/panel/PanelShell';
import { countElements, expand, findElements, textOf } from './vnode-walk';

// PNL-10, D-01, D-02, D-06, T-01.1-05: the static shell is pure, handler-free flat vector art.

const shell = expand(PanelShell({ registry: DA50RG }));
const shellText = textOf(shell);

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('PanelShell purity (P1 D-09)', () => {
  it('is one shell layer with pointer-events none', () => {
    expect(shell.tag).toBe('g');
    expect(shell.props['data-layer']).toBe('shell');
    expect(shell.props['pointer-events']).toBe('none');
  });

  it('carries no handler, data-hit or data-detent anywhere', () => {
    const offenders = findElements(shell, (el) =>
      Object.keys(el.props).some(
        (key) => /^on[A-Z]/.test(key) || key === 'data-hit' || key === 'data-detent',
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('draws a real number of elements (not an empty shell)', () => {
    expect(countElements(shell)).toBeGreaterThan(60);
  });
});

describe('PanelShell flat-vector rules (UI-SPEC rendering)', () => {
  const FORBIDDEN_TAGS = [
    'image',
    'filter',
    'mask',
    'feGaussianBlur',
    'feDropShadow',
    'foreignObject',
  ];

  it.each(FORBIDDEN_TAGS)('uses no %s element', (tag) => {
    expect(findElements(shell, (el) => el.tag === tag)).toEqual([]);
  });

  it('has no href or xlinkHref that starts with data:', () => {
    const offenders = findElements(shell, (el) =>
      ['href', 'xlinkHref', 'xlink:href'].some((key) => {
        const value = el.props[key];
        return typeof value === 'string' && value.startsWith('data:');
      }),
    );
    expect(offenders).toEqual([]);
  });

  it('references only ids that Defs defines', () => {
    const used = new Set<string>();
    findElements(shell, () => true).forEach((el) => {
      for (const value of Object.values(el.props)) {
        if (typeof value !== 'string') continue;
        for (const match of value.matchAll(/url\(#([^)]+)\)/g)) {
          const id = match[1];
          if (id !== undefined) used.add(id);
        }
      }
    });
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(DEF_IDS as readonly string[]).toContain(id);
  });
});

describe('Defs', () => {
  const defs = expand(Defs());
  const idOf = (el: { props: Readonly<Record<string, unknown>> }) => el.props['id'];

  it('defines exactly the eleven DefId ids, once each', () => {
    const ids = findElements(defs, (el) => typeof idOf(el) === 'string').map(idOf);
    expect([...ids].sort()).toEqual([...DEF_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prefixes every id with g- or p-', () => {
    for (const id of DEF_IDS) expect(id).toMatch(/^[gp]-/);
  });

  it('gives every gradient at most three stops', () => {
    const gradients = findElements(
      defs,
      (el) => el.tag === 'linearGradient' || el.tag === 'radialGradient',
    );
    expect(gradients.length).toBe(9);
    for (const g of gradients) {
      const stops = g.children.filter((c) => typeof c !== 'string' && c.tag === 'stop');
      expect(stops.length).toBeGreaterThanOrEqual(2);
      expect(stops.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('PanelShell brand marks (D-05)', () => {
  it('reads GO-AROUND twice, RUBIN once and DA50RG once', () => {
    expect(occurrences(shellText, 'GO-AROUND')).toBe(2);
    expect(occurrences(shellText, 'RUBIN')).toBe(1);
    expect(occurrences(shellText, 'DA50RG')).toBe(1);
  });

  it('never names a real brand', () => {
    expect(shellText).not.toMatch(/garmin|diamond/i);
  });
});

describe('PanelShell layers (UI-SPEC Panel Surface)', () => {
  it.each([
    'knee-cavity',
    'face-plate',
    'console',
    'coaming',
    'lights-recess',
    'bezel',
    'centre-stack',
    'switch-strips',
    'bus-panel',
    'left-strip',
    'decor',
    'environmental-plate',
  ])('draws the %s layer', (layer) => {
    expect(findElements(shell, (el) => el.props['data-shell'] === layer).length).toBeGreaterThan(0);
  });

  it('draws two display bezels and three reserved centre-stack outlines', () => {
    expect(findElements(shell, (el) => el.props['data-shell'] === 'bezel')).toHaveLength(2);
    expect(findElements(shell, (el) => el.props['data-shell'] === 'reserved-outline')).toHaveLength(
      3,
    );
  });

  it.each([
    'LIGHTS',
    'ESSENTIAL BUS',
    'MAIN BUS',
    'AVIONICS BUS',
    'LANDING GEAR',
    'VLE / VLO = 162 KIAS',
    'ESS BUS NOT FOR NORMAL OPERATION',
    'NO SMOKING',
    'ENVIRONMENTAL CONTROL',
  ])('carries the placard text "%s"', (text) => {
    expect(shellText).toContain(text);
  });

  it('draws bus brackets with headings only, no circuit-breaker shapes (PNL-12 is 01.2)', () => {
    expect(findElements(shell, (el) => String(el.props['data-shell']).includes('breaker'))).toEqual(
      [],
    );
    expect(findElements(shell, (el) => el.props['data-shell'] === 'bus-bracket')).toHaveLength(3);
  });

  it('draws the static vent as concentric rings', () => {
    const rings = findElements(shell, (el) => el.props['data-shell'] === 'vent-ring');
    expect(rings.length).toBeGreaterThanOrEqual(3);
  });
});

// Typography contract (UI-SPEC "Typography"): panel text uses exactly four sizes.
describe('declared font-size scale 6, 8, 10, 14', () => {
  const SCALE = [6, 8, 10, 14];
  const root = fileURLToPath(new URL('../', import.meta.url));
  const frames = join(root, 'src/ui/panel/frames');
  const files = [
    ...readdirSync(frames)
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => join(frames, name)),
    join(root, 'src/ui/panel/PanelShell.tsx'),
    join(root, 'src/ui/panel/Defs.tsx'),
    join(root, 'src/ui/panel/Panel.tsx'),
  ];

  /** Every font-size value as written: JSX number, JSX string or quoted attribute. */
  function sizesIn(text: string): number[] {
    const out: number[] = [];
    for (const match of text.matchAll(
      /font-size\s*[=:]\s*(?:\{\s*([0-9.]+)\s*\}|["']?([0-9.]+)(?:px)?["']?)/g,
    )) {
      out.push(Number(match[1] ?? match[2]));
    }
    return out;
  }

  it('scans the four frame files and the shell files', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it.each(files.map((file) => [file.slice(root.length), file] as const))(
    '%s uses only declared sizes',
    (_name, file) => {
      const sizes = sizesIn(readFileSync(file, 'utf8'));
      expect(sizes.filter((size) => !SCALE.includes(size))).toEqual([]);
    },
  );

  it('actually finds font sizes in the frames (the scan is not vacuous)', () => {
    const total = files.reduce((n, file) => n + sizesIn(readFileSync(file, 'utf8')).length, 0);
    expect(total).toBeGreaterThan(20);
  });

  it('the scanner rejects an off-scale size in each written form', () => {
    expect(sizesIn('<text font-size={12} />')).toEqual([12]);
    expect(sizesIn('<text font-size="13" />')).toEqual([13]);
    expect(sizesIn('style="font-size: 9px"')).toEqual([9]);
  });
});
