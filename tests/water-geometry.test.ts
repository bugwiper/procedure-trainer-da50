import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WATER_PALETTE,
  WATER_LATERAL,
  waterGeometry,
  waterPolygons,
} from '../src/ui/panel/windscreen/water';

// The wave bands of the ditching scene (Phase 9, plan 09-04, R-03): a pure function of the cue level
// that the windscreen and the synthetic vision both project with their own perspective helpers.

const LEVELS = Array.from({ length: 41 }, (_, i) => i / 40);

describe('waterGeometry', () => {
  it('has the same fixed number of bands at every level', () => {
    const count = waterGeometry(0).bands.length;
    expect(count).toBeGreaterThan(3);
    for (const level of LEVELS) expect(waterGeometry(level).bands.length).toBe(count);
  });

  it('is finite for every level from far below 0 to far above 1 (clamped)', () => {
    for (const level of [-1e9, -3, -0.001, ...LEVELS, 1.001, 7, 1e9, Number.NaN]) {
      for (const band of waterGeometry(level).bands) {
        for (const [key, value] of Object.entries(band)) {
          expect(Number.isFinite(value), `${String(level)} ${key}`).toBe(true);
        }
      }
    }
    expect(waterGeometry(-4)).toEqual(waterGeometry(0));
    expect(waterGeometry(9)).toEqual(waterGeometry(1));
    expect(waterGeometry(Number.NaN)).toEqual(waterGeometry(0));
  });

  it('never lets a band move away from the pilot or get thinner as the level rises', () => {
    let previous = waterGeometry(0).bands;
    for (const level of LEVELS) {
      const bands = waterGeometry(level).bands;
      bands.forEach((band, i) => {
        const before = previous[i];
        if (before === undefined) throw new Error('band count changed');
        expect(band.nearRow, `near ${String(i)} at ${String(level)}`).toBeGreaterThanOrEqual(
          before.nearRow,
        );
        expect(band.farRow, `far ${String(i)} at ${String(level)}`).toBeGreaterThanOrEqual(
          before.farRow,
        );
        expect(
          band.nearRow - band.farRow,
          `thickness ${String(i)} at ${String(level)}`,
        ).toBeGreaterThanOrEqual(before.nearRow - before.farRow);
      });
      previous = bands;
    }
  });

  it('grows strictly between level 0 and level 1: every band moves down and gets thicker', () => {
    const a = waterGeometry(0).bands;
    const b = waterGeometry(0.5).bands;
    const c = waterGeometry(1).bands;
    a.forEach((band, i) => {
      const mid = b[i];
      const end = c[i];
      if (mid === undefined || end === undefined) throw new Error('band count changed');
      expect(mid.nearRow).toBeGreaterThan(band.nearRow);
      expect(end.nearRow).toBeGreaterThan(mid.nearRow);
      expect(mid.nearRow - mid.farRow).toBeGreaterThan(band.nearRow - band.farRow);
      expect(end.nearRow - end.farRow).toBeGreaterThan(mid.nearRow - mid.farRow);
    });
  });

  it('keeps the bands in order and apart: far edge above near edge, the next band above this one, the crest inside', () => {
    for (const level of LEVELS) {
      const { bands } = waterGeometry(level);
      bands.forEach((band, i) => {
        expect(band.farRow, String(level)).toBeGreaterThan(0);
        expect(band.farRow, String(level)).toBeLessThan(band.nearRow);
        expect(band.crestRow, String(level)).toBeLessThan(band.nearRow);
        expect(band.crestRow, String(level)).toBeGreaterThan(band.farRow);
        const next = bands[i + 1];
        if (next !== undefined)
          expect(next.nearRow, `${String(i)} at ${String(level)}`).toBeLessThan(band.farRow);
      });
    }
  });

  it('is a few thin lines near the horizon at level 0', () => {
    for (const band of waterGeometry(0).bands) {
      expect(band.nearRow).toBeLessThanOrEqual(0.1);
      expect(band.nearRow - band.farRow).toBeLessThan(0.03);
    }
  });

  it('puts the nearest band below the bottom of the picture at level 1', () => {
    const [nearest] = waterGeometry(1).bands;
    expect(nearest?.nearRow).toBeGreaterThan(1);
    // Its far edge is still inside the picture, so the waves show right up to the end.
    expect(nearest?.farRow).toBeLessThan(1);
  });

  it('is already visible at the start of the ditching: the first band is a band at level 0.25', () => {
    const [nearest] = waterGeometry(0.25).bands;
    expect(nearest?.nearRow).toBeGreaterThan(0.08);
  });

  it('uses + - * / and clamping only: no Math call but min and max and no exponent operator', () => {
    const text = readFileSync(
      fileURLToPath(new URL('../src/ui/panel/windscreen/water.ts', import.meta.url)),
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

describe('waterPolygons', () => {
  it('gives one trough and one crest per band, with the rows of the geometry', () => {
    for (const level of [0, 0.3, 1]) {
      const { bands } = waterGeometry(level);
      const { troughs, crests } = waterPolygons(level);
      expect(troughs.length).toBe(bands.length);
      expect(crests.length).toBe(bands.length);
      bands.forEach((band, i) => {
        const trough = troughs[i];
        const crest = crests[i];
        if (trough === undefined || crest === undefined) throw new Error('missing polygon');
        // Corners: near left, near right, far right, far left.
        expect(trough[0][1]).toBe(band.nearRow);
        expect(trough[2][1]).toBe(band.farRow);
        expect(crest[0][1]).toBe(band.nearRow);
        expect(crest[2][1]).toBe(band.crestRow);
        // A band runs across the whole view and reaches past the picture on both sides at both rows.
        expect(WATER_LATERAL).toBeGreaterThan(1);
        expect(trough[0][0]).toBe(-WATER_LATERAL);
        expect(trough[1][0]).toBe(WATER_LATERAL);
        expect(trough[2][0]).toBe(WATER_LATERAL);
        expect(trough[3][0]).toBe(-WATER_LATERAL);
      });
    }
  });
});

describe('WATER_PALETTE', () => {
  it('holds hex colours only, none of them magenta', () => {
    for (const [key, value] of Object.entries(WATER_PALETTE)) {
      expect(value, key).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
