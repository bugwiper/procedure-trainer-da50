import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { SESSION_LAYOUT, sessionFootprints } from '../src/ui/panel/session-area';
import type { LocalRect } from '../src/ui/panel/session-area';

// The run view of the session area (Phase 7, plan 07-01, D-05, H-03): the buttons that are drawn
// while a run is live, as region-local rectangles. The table below is typed in by hand and is
// independent of the module; the module is compared with it.
const REGION = { w: 440, h: 480 };
const MIN_HEIGHT = 64;

/** Name, then x, y, w, h in region units: rows of 80 at y 20, 116, 212 and 308; 370 and 177 wide. */
const RUN_REFERENCE: readonly (readonly [string, number, number, number, number])[] = [
  ['further', 35, 20, 370, 80],
  ['checklist', 35, 116, 177, 80],
  ['hint', 228, 116, 177, 80],
  ['new', 35, 212, 177, 80],
  ['choose', 228, 212, 177, 80],
  ['reset', 35, 308, 370, 80],
];

const named = (): readonly (readonly [string, LocalRect])[] => Object.entries(SESSION_LAYOUT.run);

describe('the run view of the session area (07-01, H-03)', () => {
  it('equals the hand-written reference table', () => {
    expect(named().map(([name, r]) => [name, r.x, r.y, r.w, r.h])).toEqual(RUN_REFERENCE);
  });

  it('keeps every rectangle inside the region of 440 x 480', () => {
    expect(SESSION_LAYOUT.region).toEqual(REGION);
    for (const [name, r] of named()) {
      expect(r.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, `${name} right`).toBeLessThanOrEqual(REGION.w);
      expect(r.y + r.h, `${name} bottom`).toBeLessThanOrEqual(REGION.h);
    }
  });

  it('lets no two rectangles overlap', () => {
    const all = named();
    all.forEach(([a, ra], i) => {
      for (const [b, rb] of all.slice(i + 1)) {
        const apart =
          ra.x + ra.w <= rb.x || rb.x + rb.w <= ra.x || ra.y + ra.h <= rb.y || rb.y + rb.h <= ra.y;
        expect(apart, `${a} and ${b} are apart`).toBe(true);
      }
    });
  });

  it('gives every button a height of at least 64 units', () => {
    for (const [name, r] of named()) {
      expect(r.h, name).toBeGreaterThanOrEqual(MIN_HEIGHT);
    }
  });

  it('puts every rectangle into sessionFootprints, moved by the origin of the region', () => {
    const region = DA50RG.regions.find((r) => r.id === 'scenario_area');
    if (region === undefined) throw new Error('no scenario_area region');
    const footprints = sessionFootprints(region.bounds);
    for (const [name, r] of named()) {
      expect(footprints, name).toContainEqual({
        x: region.bounds.x + r.x,
        y: region.bounds.y + r.y,
        w: r.w,
        h: r.h,
      });
    }
  });
});
