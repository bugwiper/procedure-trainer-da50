import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { SESSION_LAYOUT, sessionFootprints } from '../src/ui/panel/session-area';
import type { LocalRect } from '../src/ui/panel/session-area';

// The run view of the session area (Phase 7, plan 07-04, R-06): the buttons that are drawn while a run
// is live, as region-local rectangles, and the narrower main view of the free panel. The tables below
// are typed in by hand and are independent of the module; the module is compared with them.
const REGION = { w: 440, h: 480 };
const MIN_HEIGHT = 64;

/** Name, then x, y, w, h in region units: rows of 80 at y 20 and 116 (370 wide), LEAVE 177 x 80 at 228, 392. */
const RUN_REFERENCE: readonly (readonly [string, number, number, number, number])[] = [
  ['checklist', 35, 20, 370, 80],
  ['hint', 35, 116, 370, 80],
  ['leave', 228, 392, 177, 80],
];

/** The free-panel buttons since 07-04: 280 wide at x 80, heights unchanged. */
const MAIN_REFERENCE: readonly (readonly [string, number, number, number, number])[] = [
  ['new', 80, 20, 280, 120],
  ['choose', 80, 160, 280, 120],
  ['reset', 80, 300, 280, 120],
];

/**
 * The choose view since plan 07-06 (R-18), region-local: CLOSE LIST and NEXT PAGE at y 20, the tab row
 * below them at y 110 (three tabs, 80 high, 10 apart, together 370 wide) and three situation rows at
 * y 200, 290 and 380.
 */
const TAB_W = (370 - 2 * 10) / 3;
const CHOOSE_REFERENCE = {
  close: [35, 20, 177, 80],
  next: [228, 20, 177, 80],
  tabs: [
    [35, 110, TAB_W, 80],
    [35 + TAB_W + 10, 110, TAB_W, 80],
    [35 + 2 * (TAB_W + 10), 110, TAB_W, 80],
  ],
  rows: [
    [35, 200, 370, 80],
    [35, 290, 370, 80],
    [35, 380, 370, 80],
  ],
} as const;

const named = (): readonly (readonly [string, LocalRect])[] => Object.entries(SESSION_LAYOUT.run);

describe('the run view of the session area (07-04, R-06)', () => {
  it('equals the hand-written reference table', () => {
    expect(named().map(([name, r]) => [name, r.x, r.y, r.w, r.h])).toEqual(RUN_REFERENCE);
  });

  it('has no NEW SITUATION, CHOOSE SITUATION or RESET rectangle: they are drawn on the free panel only', () => {
    expect(Object.keys(SESSION_LAYOUT.run)).not.toContain('new');
    expect(Object.keys(SESSION_LAYOUT.run)).not.toContain('choose');
    expect(Object.keys(SESSION_LAYOUT.run)).not.toContain('reset');
  });

  it('narrows the three free-panel buttons to 280 wide at x 80 and keeps their heights', () => {
    expect(
      Object.entries(SESSION_LAYOUT.main).map(([name, r]) => [name, r.x, r.y, r.w, r.h]),
    ).toEqual(MAIN_REFERENCE);
    for (const [name, r] of Object.entries(SESSION_LAYOUT.main)) {
      expect(r.x + r.w, name).toBeLessThanOrEqual(REGION.w);
      expect(r.x + r.w / 2, `${name} stays centred`).toBe(REGION.w / 2);
    }
  });

  it('has the choose view of the reference: two buttons on top, three tabs, three rows (07-06, R-18)', () => {
    const { close, next, tabs, rows, maxRows } = SESSION_LAYOUT.choose;
    const flat = (r: LocalRect): number[] => [r.x, r.y, r.w, r.h];
    expect(flat(close)).toEqual(CHOOSE_REFERENCE.close);
    expect(flat(next)).toEqual(CHOOSE_REFERENCE.next);
    expect(tabs.map(flat)).toEqual(CHOOSE_REFERENCE.tabs);
    expect(rows.map(flat)).toEqual(CHOOSE_REFERENCE.rows);
    expect(maxRows).toBe(CHOOSE_REFERENCE.rows.length);
  });

  it('keeps the choose view inside the region, apart and at least 64 units high', () => {
    const { close, next, tabs, rows } = SESSION_LAYOUT.choose;
    const all = [close, next, ...tabs, ...rows];
    all.forEach((ra, i) => {
      expect(ra.x).toBeGreaterThanOrEqual(0);
      expect(ra.x + ra.w).toBeLessThanOrEqual(REGION.w);
      expect(ra.y + ra.h).toBeLessThanOrEqual(REGION.h);
      expect(ra.h).toBeGreaterThanOrEqual(MIN_HEIGHT);
      for (const rb of all.slice(i + 1)) {
        const apart =
          ra.x + ra.w <= rb.x || rb.x + rb.w <= ra.x || ra.y + ra.h <= rb.y || rb.y + rb.h <= ra.y;
        expect(apart).toBe(true);
      }
    });
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
    const choose = SESSION_LAYOUT.choose;
    const chooseNamed: (readonly [string, LocalRect])[] = [
      ['close', choose.close],
      ['next', choose.next],
      ...choose.tabs.map((r, i): readonly [string, LocalRect] => [`tab ${String(i)}`, r]),
      ...choose.rows.map((r, i): readonly [string, LocalRect] => [`row ${String(i)}`, r]),
    ];
    for (const [name, r] of [...named(), ...Object.entries(SESSION_LAYOUT.main), ...chooseNamed]) {
      expect(footprints, name).toContainEqual({
        x: region.bounds.x + r.x,
        y: region.bounds.y + r.y,
        w: r.w,
        h: r.h,
      });
    }
  });
});
