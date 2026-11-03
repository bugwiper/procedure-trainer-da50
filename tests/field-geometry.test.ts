import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIELD_PALETTE, fieldGeometry } from '../src/ui/panel/windscreen/field';
import type { FieldGeometry } from '../src/ui/panel/windscreen/field';

// The one growth law of the landing field (Phase 9, D-06, P-01): a pure function of the cue level
// that the windscreen and the synthetic vision both project with their own perspective helpers.

const LEVELS = Array.from({ length: 41 }, (_, i) => i / 40);
const NUMERIC_KEYS = ['nearRow', 'farRow', 'nearHalf', 'farHalf'] as const;

describe('fieldGeometry', () => {
  it('is finite for every level from far below 0 to far above 1 (clamped)', () => {
    for (const level of [-1e9, -3, -0.001, ...LEVELS, 1.001, 7, 1e9, Number.NaN]) {
      const g = fieldGeometry(level);
      for (const [key, value] of Object.entries(g)) {
        expect(Number.isFinite(value), `${String(level)} ${key}`).toBe(true);
      }
    }
    expect(fieldGeometry(-4)).toEqual(fieldGeometry(0));
    expect(fieldGeometry(9)).toEqual(fieldGeometry(1));
    expect(fieldGeometry(Number.NaN)).toEqual(fieldGeometry(0));
  });

  it('never lets the near edge, the far edge or a width decrease as the level rises', () => {
    let previous: FieldGeometry | null = null;
    for (const level of LEVELS) {
      const g = fieldGeometry(level);
      if (previous !== null) {
        for (const key of NUMERIC_KEYS) {
          expect(g[key], `${key} at ${String(level)}`).toBeGreaterThanOrEqual(previous[key]);
        }
      }
      previous = g;
    }
  });

  it('grows strictly between level 0 and level 1, in every measure', () => {
    const a = fieldGeometry(0);
    const b = fieldGeometry(0.5);
    const c = fieldGeometry(1);
    for (const key of NUMERIC_KEYS) {
      expect(b[key], key).toBeGreaterThan(a[key]);
      expect(c[key], key).toBeGreaterThan(b[key]);
    }
  });

  it('keeps the far edge above the near edge at every level', () => {
    for (const level of LEVELS) {
      const g = fieldGeometry(level);
      expect(g.farRow, String(level)).toBeGreaterThan(0);
      expect(g.farRow, String(level)).toBeLessThan(g.nearRow);
      expect(g.farHalf, String(level)).toBeLessThan(g.nearHalf);
    }
  });

  it('is a speck at level 0: a few hundredths of the picture in width and height', () => {
    const g = fieldGeometry(0);
    expect(g.nearRow - g.farRow).toBeLessThan(0.03);
    // Fractions of the half picture width: the field is under 4 percent of the picture wide.
    expect(g.nearHalf).toBeLessThan(0.04);
    expect(g.nearRow).toBeLessThan(0.1);
  });

  it('puts the near edge below the bottom of the picture at level 1', () => {
    expect(fieldGeometry(1).nearRow).toBeGreaterThan(1);
  });

  it('keeps the whole field right of the vanishing line of the strut at every level', () => {
    for (const level of LEVELS) {
      const g = fieldGeometry(level);
      expect(g.nearCentre - g.nearHalf, String(level)).toBeGreaterThan(0);
      expect(g.farCentre - g.farHalf, String(level)).toBeGreaterThan(0);
    }
  });

  it('uses + - * / and clamping only: no Math call but the clamping helpers and no exponent operator', () => {
    const text = readFileSync(
      fileURLToPath(new URL('../src/ui/panel/windscreen/field.ts', import.meta.url)),
      'utf8',
    );
    const code = text
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n');
    expect(code).not.toContain('**');
    const calls = [...code.matchAll(/Math\.(\w+)/g)].map((m) => m[1]);
    for (const call of calls) expect(['min', 'max']).toContain(call);
  });
});

describe('FIELD_PALETTE', () => {
  it('holds hex colours only', () => {
    for (const [key, value] of Object.entries(FIELD_PALETTE)) {
      expect(value, key).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
