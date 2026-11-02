import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { FURTHER_PAD } from '../src/aircraft/da50rg/further-pad';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { PLATES } from '../src/aircraft/da50rg/plates';
import { FURTHER_PAD_REFERENCE, FURTHER_PAD_REGION } from './further-pad-reference';

// The footwell cluster of the further actions (Phase 7, plan 07-05, R-07): the slots against the
// independent hand-written table, the options of the aircraft, the region and the plate.
const MIN_HEIGHT = 64;
const SET = DA50RG_ENV.further;

describe('the footwell cluster of the further actions', () => {
  it('equals the hand-written reference table', () => {
    expect(FURTHER_PAD.region).toEqual(FURTHER_PAD_REGION);
    expect(
      FURTHER_PAD.slots.map((slot) => [
        slot.id,
        SET.option(slot.id)?.label,
        slot.x,
        slot.y,
        slot.w,
        slot.h,
      ]),
    ).toEqual(FURTHER_PAD_REFERENCE.map((row) => [...row]));
  });

  it('gives every option id of the aircraft exactly one slot and one non-empty label', () => {
    const ids = FURTHER_PAD.slots.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(SET.options.map((option) => option.id).sort());
    for (const option of SET.options) {
      expect(option.label, option.id).toBeDefined();
      expect(option.label?.length, option.id).toBeGreaterThan(0);
      // A static caps label (G-0): the text of the debrief stays separate.
      expect(option.label, option.id).toBe(option.label?.toUpperCase());
    }
    const labels = SET.options.map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps every slot inside the region, no two overlapping, each at least 64 units high', () => {
    const { w, h } = FURTHER_PAD.region;
    FURTHER_PAD.slots.forEach((a, i) => {
      expect(a.x, a.id).toBeGreaterThanOrEqual(0);
      expect(a.y, a.id).toBeGreaterThanOrEqual(0);
      expect(a.x + a.w, a.id).toBeLessThanOrEqual(w);
      expect(a.y + a.h, a.id).toBeLessThanOrEqual(h);
      expect(a.h, a.id).toBeGreaterThanOrEqual(MIN_HEIGHT);
      for (const b of FURTHER_PAD.slots.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    });
  });

  it('puts the conduct options in the bottom row and the actions in the top row', () => {
    const topY = Math.min(...FURTHER_PAD.slots.map((s) => s.y));
    const rowOf = (id: string): number => FURTHER_PAD.slots.find((s) => s.id === id)?.y ?? -1;
    for (const option of SET.options) {
      expect(rowOf(option.id) === topY, option.id).toBe(option.kind === 'action');
    }
  });

  it('is as large as the registry region, centres the slots in it and puts the plate 20 units around the slots', () => {
    const region = DA50RG.regions.find((r) => r.id === 'further_area');
    expect(region).toBeDefined();
    if (region === undefined) return;
    expect(region.bounds.w).toBe(FURTHER_PAD.region.w);
    expect(region.bounds.h).toBe(FURTHER_PAD.region.h);
    const left = Math.min(...FURTHER_PAD.slots.map((s) => s.x));
    const right = Math.max(...FURTHER_PAD.slots.map((s) => s.x + s.w));
    const top = Math.min(...FURTHER_PAD.slots.map((s) => s.y));
    const bottom = Math.max(...FURTHER_PAD.slots.map((s) => s.y + s.h));
    expect(left).toBe(FURTHER_PAD.region.w - right);
    expect(top).toBe(FURTHER_PAD.region.h - bottom);
    const plate = PLATES.find((p) => p.id === 'further-pad');
    expect(plate).toBeDefined();
    if (plate === undefined) return;
    expect(region.bounds.x + left - plate.x).toBe(20);
    expect(region.bounds.y + top - plate.y).toBe(20);
    expect(plate.x + plate.w - (region.bounds.x + right)).toBe(20);
    expect(plate.y + plate.h - (region.bounds.y + bottom)).toBe(20);
  });
});
