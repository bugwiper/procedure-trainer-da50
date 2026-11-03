import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  DA50RG_CUES,
  ENGINE_RPM_STOPPED,
  FIELD_SIGHT_FT,
  WATER_SIGHT_FT,
} from '../src/aircraft/da50rg/cues';
import {
  DA50RG_QUANTITIES,
  TERRAIN_HEIGHT_FT,
  WATER_LEVEL_FT,
} from '../src/aircraft/da50rg/quantities';
import { CUE_VISIBLE_LEVEL, CueError, cueLevel, cueVisible, defineCues } from '../src/engine/cues';

// Visual cues (Phase 5, W-05): a quantity read as a level 0 to 1, arithmetic only.

describe('cueLevel', () => {
  const cue = { from: 0, to: 60 };
  it('is 0 at from, 1 at to and linear between', () => {
    expect(cueLevel(cue, 0)).toBe(0);
    expect(cueLevel(cue, 60)).toBe(1);
    expect(cueLevel(cue, 30)).toBe(0.5);
    expect(cueLevel(cue, 15)).toBe(0.25);
  });

  it('is clamped outside the range', () => {
    expect(cueLevel(cue, -5)).toBe(0);
    expect(cueLevel(cue, 100)).toBe(1);
  });

  it('runs the other way when to is below from', () => {
    const falling = { from: 600, to: 0 };
    expect(cueLevel(falling, 600)).toBe(0);
    expect(cueLevel(falling, 0)).toBe(1);
    expect(cueLevel(falling, 300)).toBe(0.5);
  });

  it('is visible from the visible level and not below', () => {
    expect(cueVisible(CUE_VISIBLE_LEVEL)).toBe(true);
    expect(cueVisible(CUE_VISIBLE_LEVEL - 0.01)).toBe(false);
    expect(cueVisible(0)).toBe(false);
    expect(cueVisible(1)).toBe(true);
  });
});

describe('the DA50 RG cue table', () => {
  it('has unique ids', () => {
    const ids = DA50RG_CUES.cues.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...DA50RG_CUES.ids]).toEqual(ids);
  });

  it('reads quantities that exist', () => {
    for (const cue of DA50RG_CUES.cues) {
      expect(DA50RG_QUANTITIES.get(cue.quantity), cue.id).toBeDefined();
    }
  });

  it('is part of the aircraft environment', () => {
    expect(DA50RG_ENV.cues).toBe(DA50RG_CUES);
  });

  it('has the field cue of the approach scene: a falling cue on the altitude over FIELD_SIGHT_FT above the terrain', () => {
    const cue = DA50RG_CUES.get('field_near');
    expect(cue).toBeDefined();
    expect(cue?.quantity).toBe('altitude_ft');
    expect(cue?.from).toBe(TERRAIN_HEIGHT_FT + FIELD_SIGHT_FT);
    expect(cue?.to).toBe(TERRAIN_HEIGHT_FT);
    expect(FIELD_SIGHT_FT).toBe(1200);
    const level = (altitude: number): number =>
      DA50RG_CUES.levels({ ...DA50RG_QUANTITIES.baseValues(), altitude_ft: altitude })[
        'field_near'
      ] ?? Number.NaN;
    expect(level(TERRAIN_HEIGHT_FT + FIELD_SIGHT_FT)).toBe(0);
    expect(level(TERRAIN_HEIGHT_FT + FIELD_SIGHT_FT / 2)).toBe(0.5);
    expect(level(TERRAIN_HEIGHT_FT)).toBe(1);
    expect(level(TERRAIN_HEIGHT_FT + 5000)).toBe(0);
    expect(level(0)).toBe(1);
  });

  it('has the water cue of the ditching scene: a falling cue on the altitude over WATER_SIGHT_FT above the water', () => {
    const cue = DA50RG_CUES.get('water_near');
    expect(cue).toBeDefined();
    expect(cue?.quantity).toBe('altitude_ft');
    // The values are typed by hand: the water is at sea level and the sight is 600 ft.
    expect(WATER_LEVEL_FT).toBe(0);
    expect(WATER_SIGHT_FT).toBe(600);
    expect(cue?.from).toBe(600);
    expect(cue?.to).toBe(0);
    const level = (altitude: number): number =>
      DA50RG_CUES.levels({ ...DA50RG_QUANTITIES.baseValues(), altitude_ft: altitude })[
        'water_near'
      ] ?? Number.NaN;
    expect(level(600)).toBe(0);
    expect(level(450)).toBe(0.25);
    expect(level(300)).toBe(0.5);
    expect(level(0)).toBe(1);
    expect(level(5000)).toBe(0);
    // The free panel's cruise altitude shows no waves.
    expect(DA50RG_CUES.levels(DA50RG_QUANTITIES.baseValues())['water_near']).toBe(0);
  });

  it('reads the terrain of the approach from the normal of the parameter terrain_ft', () => {
    const terrain = DA50RG_ENV.physics.parameters.find((p) => p.id === 'terrain_ft');
    expect(terrain?.normal).toBe(TERRAIN_HEIGHT_FT);
    expect(DA50RG_QUANTITIES.get('altitude_ft')?.base).toBe(TERRAIN_HEIGHT_FT);
  });

  it('has no id equal to a physics parameter id or a quantity id', () => {
    const parameters = DA50RG_ENV.physics.parameters.map((p) => p.id);
    const quantities = DA50RG_QUANTITIES.all.map((q) => q.id);
    for (const cue of DA50RG_CUES.cues) {
      expect(parameters, cue.id).not.toContain(cue.id);
      expect(quantities, cue.id).not.toContain(cue.id);
    }
  });

  it('shows no flames at the base values and flames from a developing fire', () => {
    const base = DA50RG_QUANTITIES.baseValues();
    expect(DA50RG_CUES.levels(base)['flames']).toBe(0);
    expect(cueVisible(DA50RG_CUES.levels({ ...base, fire_intensity: 40 })['flames'] ?? 0)).toBe(
      true,
    );
    expect(DA50RG_CUES.levels({ ...base, fire_intensity: 100 })['flames']).toBe(1);
  });

  it('shows no cabin smoke at the base values and full smoke from a dense cabin', () => {
    const base = DA50RG_QUANTITIES.baseValues();
    expect(DA50RG_CUES.levels(base)['cabin_smoke']).toBe(0);
    expect(DA50RG_CUES.levels({ ...base, smoke_density: 70 })['cabin_smoke']).toBe(1);
    expect(DA50RG_CUES.levels({ ...base, smoke_density: 100 })['cabin_smoke']).toBe(1);
    expect(cueVisible(DA50RG_CUES.levels({ ...base, smoke_density: 10 })['cabin_smoke'] ?? 0)).toBe(
      true,
    );
  });

  it('shows the ice of each side from its own quantity: clear at the base, full at 60', () => {
    const base = DA50RG_QUANTITIES.baseValues();
    const levels = DA50RG_CUES.levels({ ...base, ice_pilot: 60, ice_copilot: 30 });
    expect(DA50RG_CUES.levels(base)['ice_pilot_side']).toBe(0);
    expect(DA50RG_CUES.levels(base)['ice_copilot_side']).toBe(0);
    expect(levels['ice_pilot_side']).toBe(1);
    expect(levels['ice_copilot_side']).toBe(0.5);
  });

  it('reads the propeller cue from the rpm as two states split at ENGINE_RPM_STOPPED', () => {
    const base = DA50RG_QUANTITIES.baseValues();
    const at = (rpm: number): number => DA50RG_CUES.levels({ ...base, rpm })['prop_stopped'] ?? -1;
    expect(DA50RG_CUES.levels(base)['prop_stopped']).toBe(0);
    expect(at(2300)).toBe(0);
    expect(at(600)).toBe(0);
    expect(at(ENGINE_RPM_STOPPED)).toBe(0);
    expect(at(ENGINE_RPM_STOPPED - 1)).toBe(1);
    expect(at(0)).toBe(1);
    // The engine drone uses the same line (tests/aural.test.ts).
    expect(ENGINE_RPM_STOPPED).toBe(100);
  });

  it('shows the oil streaks from the oil film: clear at the base, full at 50', () => {
    const base = DA50RG_QUANTITIES.baseValues();
    expect(DA50RG_CUES.levels(base)['oil_streaks']).toBe(0);
    expect(DA50RG_CUES.levels({ ...base, oil_film: 25 })['oil_streaks']).toBe(0.5);
    expect(DA50RG_CUES.levels({ ...base, oil_film: 100 })['oil_streaks']).toBe(1);
  });

  it('reads a missing quantity as the start of the range', () => {
    expect(DA50RG_CUES.levels({})['flames']).toBe(0);
  });
});

describe('defineCues rejects a bad table', () => {
  const ok = { id: 'flames', quantity: 'fire_intensity', from: 0, to: 60 };
  it.each([
    ['a bad id pattern', { ...ok, id: 'Flames' }],
    ['an unknown quantity', { ...ok, quantity: 'no_such_quantity' }],
    ['from equal to to', { ...ok, to: 0 }],
    ['a non-finite from', { ...ok, from: Number.NaN }],
  ])('%s', (_name, spec) => {
    expect(() => defineCues([spec], DA50RG_QUANTITIES)).toThrow(CueError);
  });

  it('a duplicate id', () => {
    expect(() => defineCues([ok, ok], DA50RG_QUANTITIES)).toThrow(CueError);
  });
});
