import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { GEAR_FLAPS_CONTROLS } from '../src/aircraft/da50rg/controls/gear-flaps';
import { PEDESTAL_CONTROLS } from '../src/aircraft/da50rg/controls/pedestal';
import { UNDER_PANEL_CONTROLS } from '../src/aircraft/da50rg/controls/under-panel';
import { detentOffset, projectToTrack, snapToDetent } from '../src/engine/detents';
import type { DetentDef, DetentLeverDef } from '../src/engine/registry';

const THREE: readonly DetentDef[] = [
  { id: 'a', label: 'A', pos: 0 },
  { id: 'b', label: 'B', pos: 0.5 },
  { id: 'c', label: 'C', pos: 1 },
];

const V: DetentLeverDef['track'] = { length: 100, axis: 'v' };
const H: DetentLeverDef['track'] = { length: 80, axis: 'h' };

describe('snapToDetent', () => {
  it('picks the nearest detent for positions inside each interval', () => {
    expect(snapToDetent(0.1, THREE)).toBe('a');
    expect(snapToDetent(0.24, THREE)).toBe('a');
    expect(snapToDetent(0.26, THREE)).toBe('b');
    expect(snapToDetent(0.74, THREE)).toBe('b');
    expect(snapToDetent(0.76, THREE)).toBe('c');
    expect(snapToDetent(0.95, THREE)).toBe('c');
  });

  it('returns the earlier detent at an exact midpoint', () => {
    expect(snapToDetent(0.25, THREE)).toBe('a');
    expect(snapToDetent(0.75, THREE)).toBe('b');
  });

  it('clamps positions outside the track to the end detents', () => {
    expect(snapToDetent(-3, THREE)).toBe('a');
    expect(snapToDetent(7, THREE)).toBe('c');
  });

  it('throws RangeError for a non-finite position', () => {
    expect(() => snapToDetent(NaN, THREE)).toThrow(RangeError);
    expect(() => snapToDetent(Infinity, THREE)).toThrow(RangeError);
    expect(() => snapToDetent(-Infinity, THREE)).toThrow(RangeError);
  });
});

describe('projectToTrack', () => {
  it('axis v: the top end is 1, the bottom end 0, the centre 0.5', () => {
    expect(projectToTrack({ x: 0, y: -50 }, V)).toBe(1);
    expect(projectToTrack({ x: 0, y: 50 }, V)).toBe(0);
    expect(projectToTrack({ x: 0, y: 0 }, V)).toBe(0.5);
  });

  it('axis v: clamps beyond the ends', () => {
    expect(projectToTrack({ x: 0, y: -500 }, V)).toBe(1);
    expect(projectToTrack({ x: 0, y: 500 }, V)).toBe(0);
  });

  it('axis h: the left end is 0 and the right end 1', () => {
    expect(projectToTrack({ x: -40, y: 0 }, H)).toBe(0);
    expect(projectToTrack({ x: 40, y: 0 }, H)).toBe(1);
    expect(projectToTrack({ x: -400, y: 0 }, H)).toBe(0);
    expect(projectToTrack({ x: 400, y: 0 }, H)).toBe(1);
  });

  it('round trip: projectToTrack(detentOffset(p)) equals p on both axes', () => {
    for (const track of [V, H]) {
      for (const p of [0, 0.25, 0.5, 1]) {
        const { dx, dy } = detentOffset(p, track);
        expect(projectToTrack({ x: dx, y: dy }, track)).toBeCloseTo(p, 10);
      }
    }
  });
});

describe('pedestal and front-panel lever inventory', () => {
  it('PEDESTAL_CONTROLS is exactly POWER, COWL FLAP, the environmental sliders and PARKING BRAKE', () => {
    expect(PEDESTAL_CONTROLS.map((c) => c.id)).toEqual([
      'lv.power',
      'lv.cowl_flap',
      'lv.env_direction',
      'lv.env_temp',
      'lv.env_circ',
      'lv.parking_brake',
    ]);
    for (const c of PEDESTAL_CONTROLS) expect(c.kind).toBe('detent-lever');
  });

  it('lv.env_circ is the only horizontal track in the console', () => {
    for (const c of PEDESTAL_CONTROLS) {
      if (c.kind !== 'detent-lever') continue;
      expect(c.track.axis, c.id).toBe(c.id === 'lv.env_circ' ? 'h' : 'v');
    }
  });

  it('console levers open in the in-flight configuration', () => {
    const defaults = Object.fromEntries(PEDESTAL_CONTROLS.map((c) => [c.id, c.default]));
    expect(defaults).toEqual({
      'lv.power': 'p70',
      'lv.cowl_flap': 'closed',
      'lv.env_direction': 'face',
      'lv.env_temp': 't50',
      'lv.env_circ': 'fresh',
      'lv.parking_brake': 'off',
    });
  });

  it('GEAR_FLAPS_CONTROLS is exactly GEAR and FLAPS; the de-ice mode is no lever any more', () => {
    expect(GEAR_FLAPS_CONTROLS.map((c) => c.id)).toEqual(['lv.gear', 'lv.flaps']);
    for (const c of GEAR_FLAPS_CONTROLS) expect(c.kind).toBe('detent-lever');
    expect(DA50RG.get('lv.deice_mode')).toBeUndefined();
  });
});

describe('under-panel lever inventory', () => {
  it('UNDER_PANEL_CONTROLS is exactly alternate static, emergency gear, alternate air', () => {
    expect(UNDER_PANEL_CONTROLS.map((c) => c.id)).toEqual([
      'lv.alt_static',
      'lv.emerg_gear',
      'lv.alt_air',
    ]);
  });

  it('all are two-detent levers; only EMERGENCY GEAR EXTENSION is dragOnly (PNL-06)', () => {
    for (const c of UNDER_PANEL_CONTROLS) {
      expect(c.kind).toBe('detent-lever');
      if (c.kind !== 'detent-lever') continue;
      expect(c.detents, c.id).toHaveLength(2);
      expect(c.dragOnly === true, c.id).toBe(c.id === 'lv.emerg_gear');
    }
  });

  it('defaults are closed, normal, closed', () => {
    expect(UNDER_PANEL_CONTROLS.map((c) => c.default)).toEqual(['closed', 'normal', 'closed']);
  });
});
