import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  DEICE_HIGH_GPH,
  DEICE_NORM_GPH,
  deiceEndurance,
} from '../src/aircraft/da50rg/deice-endurance';
import { formatEndurance } from '../src/aircraft/da50rg/fuel-calculator';
import { DEICE_MAX_ACTIVE, WINDSHIELD_SPRAY_ACTIVE } from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import {
  DEICE_MAX_ACTIVATION_GAL,
  DEICE_MAX_RUN_MS,
  DEICE_SPRAY_ML,
  ML_PER_US_GAL,
  WINDSHIELD_SPRAY_MS,
} from '../src/aircraft/da50rg/physics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { initialQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import type { SimEvent } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';
import { parsePreviewQuantities } from '../src/ui/preview';

// Phase 6, plan 02: the de-ice endurance, the static display quantities of the engine page and the
// de-ice fluid model (E-08): the mode flows, the MAX run, the WIND SHIELD spray and the replay. The
// expectations are computed from the exported constants, never typed as figures.

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
const QUANTITY = 'deice_qty_gal';
/** The quantisation error of the tank scale over a long run, with slack (the scale is 1e-7 gal). */
const TOLERANCE_GAL = 0.002;

describe('deiceEndurance (E-07)', () => {
  const tank = DA50RG_QUANTITIES.get('deice_qty_gal');
  if (tank === undefined) throw new Error('no deice_qty_gal');

  it('uses the owner flows of 3 and 6 gallons per hour', () => {
    expect(DEICE_NORM_GPH).toBe(3);
    expect(DEICE_HIGH_GPH).toBe(6);
  });

  it('is the quantity over the flow in minutes: 6.8 gal last 2:16 at Norm and 1:08 at High', () => {
    const found = deiceEndurance(6.8);
    expect(found.normMin).toBe(Math.floor((6.8 * MINUTES_PER_HOUR) / DEICE_NORM_GPH));
    expect(found.highMin).toBe(Math.floor((6.8 * MINUTES_PER_HOUR) / DEICE_HIGH_GPH));
    expect(formatEndurance(found.normMin)).toBe('2:16');
    expect(formatEndurance(found.highMin)).toBe('1:08');
  });

  it('the base quantity gives about 2:15 and 1:07, within a minute', () => {
    const found = deiceEndurance(tank.base);
    expect(Math.abs(found.normMin - (2 * 60 + 15))).toBeLessThanOrEqual(1);
    expect(Math.abs(found.highMin - (60 + 7))).toBeLessThanOrEqual(1);
  });

  it('falls in proportion to the quantity, and High is half of Norm', () => {
    const full = deiceEndurance(tank.max);
    const half = deiceEndurance(tank.max / 2);
    expect(Math.abs(full.normMin - 2 * half.normMin)).toBeLessThanOrEqual(1);
    expect(Math.abs(full.highMin - 2 * half.highMin)).toBeLessThanOrEqual(1);
    expect(Math.abs(full.normMin - 2 * full.highMin)).toBeLessThanOrEqual(1);
  });

  it('gives 0:00 for an empty tank and never NaN or a negative figure', () => {
    for (const q of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const found = deiceEndurance(q);
      expect(found, String(q)).toEqual({ normMin: 0, highMin: 0 });
      expect(formatEndurance(found.normMin)).toBe('0:00');
    }
  });
});

describe('the static display quantities of the engine page (E-05)', () => {
  const ids = ['rudder_trim_pct', 'oxygen_psi', 'deice_qty_gal', 'service_hours'] as const;

  it.each(ids)('%s exists with a base inside its range', (id) => {
    const def = DA50RG_QUANTITIES.get(id);
    expect(def, id).toBeDefined();
    expect(def?.base).toBeGreaterThanOrEqual(def?.min ?? Number.NaN);
    expect(def?.base).toBeLessThanOrEqual(def?.max ?? Number.NaN);
  });

  it('the de-ice tank holds the owner maximum of 8.3 US gallons on the fine scale of the fuel', () => {
    const def = DA50RG_QUANTITIES.get('deice_qty_gal');
    expect(def?.max).toBe(8.3);
    expect(def?.scale).toBe(DA50RG_QUANTITIES.get('fuel_qty_lh_gal')?.scale);
  });

  it('the oxygen bands run red, yellow, green, unmarked', () => {
    const colours = DA50RG_QUANTITIES.get('oxygen_psi')?.bands.map((b) => b.colour);
    expect(colours).toEqual(['red', 'yellow', 'green', 'none']);
  });

  it('a preview flag with a value outside the range is ignored (T-06-03)', () => {
    const oxygen = DA50RG_QUANTITIES.get('oxygen_psi');
    if (oxygen === undefined) throw new Error('no oxygen_psi');
    expect(parsePreviewQuantities('?q=oxygen_psi:99999', DA50RG_QUANTITIES)).toEqual({});
    expect(
      parsePreviewQuantities(`?q=oxygen_psi:${String(oxygen.max)}`, DA50RG_QUANTITIES),
    ).toEqual({ oxygen_psi: oxygen.max });
  });
});

// ---- the fluid model -------------------------------------------------------------------------

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}tests/fixtures/scenarios/smoke-onset.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the scenario fixture does not pass');
/** The fixture scenario with no parameters and no outcome: nothing but the controls moves a tank. */
const scenario: Scenario = { ...checked.scenario, parameters: {}, outcomes: [] };
const tank = DA50RG_QUANTITIES.get(QUANTITY);
if (tank === undefined) throw new Error('no deice_qty_gal');

const mode = (t: number, value: 'off' | 'norm' | 'high'): SimEvent => ({
  t,
  id: 'sw.deice_mode',
  value,
});
const press = (t: number, id: string): SimEvent[] => [
  { t, id, value: 'pressed' },
  { t: t + 500, id, value: 'released' },
];

function stateAt(untilMs: number, events: readonly SimEvent[], start: Record<string, number> = {}) {
  const setup = simSetup(DA50RG_ENV, scenario);
  return simulate(setup, {
    events,
    start: { ...initialQuantities(scenario, DA50RG_ENV.quantities), ...start },
    untilMs,
  }).state;
}
const gallons = (untilMs: number, events: readonly SimEvent[], start = {}): number => {
  const value = stateAt(untilMs, events, start).quantities[QUANTITY];
  if (value === undefined) throw new Error('no deice quantity');
  return value;
};

describe('the de-ice fluid model (E-08)', () => {
  const T = 10 * MS_PER_MINUTE;

  it('OFF changes nothing, to the last digit', () => {
    expect(gallons(T, [mode(0, 'off')])).toBe(tank.base);
    expect(gallons(T, [])).toBe(tank.base);
  });

  it('NORM uses the NORM flow and HIGH the HIGH flow', () => {
    expect(tank.base - gallons(T, [mode(0, 'norm')])).toBeCloseTo(
      (DEICE_NORM_GPH * T) / MS_PER_HOUR,
      2,
    );
    expect(
      Math.abs(tank.base - gallons(T, [mode(0, 'norm')]) - (DEICE_NORM_GPH * T) / MS_PER_HOUR),
    ).toBeLessThan(TOLERANCE_GAL);
    expect(
      Math.abs(tank.base - gallons(T, [mode(0, 'high')]) - (DEICE_HIGH_GPH * T) / MS_PER_HOUR),
    ).toBeLessThan(TOLERANCE_GAL);
  });

  it('a NORM step takes a tiny volume that the fine scale keeps (it does not round away)', () => {
    const one = gallons(STEP_MS * 2, [mode(0, 'norm')]);
    expect(one).toBeLessThan(tank.base);
  });

  it('a MAX activation on HIGH takes its volume in total over the run, in place of the HIGH flow', () => {
    const pressAt = 60_000;
    const events = [mode(0, 'high'), ...press(pressAt, 'btn.deice_max')];
    // After the run the HIGH flow resumes: compare with the same log without the press.
    const after = pressAt + DEICE_MAX_RUN_MS + 10_000;
    const withMax = gallons(after, events);
    const without = gallons(after, [mode(0, 'high')]);
    const highDuringRun = (DEICE_HIGH_GPH * DEICE_MAX_RUN_MS) / MS_PER_HOUR;
    expect(Math.abs(without - withMax - (DEICE_MAX_ACTIVATION_GAL - highDuringRun))).toBeLessThan(
      TOLERANCE_GAL,
    );
    // The run takes the activation volume in total: the quantity is that much below its start of the
    // run, at the end of the run (the flag marks it).
    const during = stateAt(pressAt + 5_000, events);
    expect(during.flags[DEICE_MAX_ACTIVE]).toBe(true);
    const startOfRun = gallons(pressAt, events);
    const endOfRun = gallons(pressAt + DEICE_MAX_RUN_MS + 3 * STEP_MS, events);
    expect(Math.abs(startOfRun - endOfRun - DEICE_MAX_ACTIVATION_GAL)).toBeLessThan(TOLERANCE_GAL);
    // The HIGH flow resumes after the run.
    const resumed = gallons(after, events) - gallons(after + MS_PER_MINUTE, events);
    expect(Math.abs(resumed - DEICE_HIGH_GPH / MINUTES_PER_HOUR)).toBeLessThan(TOLERANCE_GAL);
  });

  it('a MAX press with the mode on NORM starts no run and no extra use', () => {
    const events = [mode(0, 'norm'), ...press(60_000, 'btn.deice_max')];
    expect(stateAt(65_000, events).flags[DEICE_MAX_ACTIVE]).toBeUndefined();
    expect(Math.abs(gallons(T, events) - gallons(T, [mode(0, 'norm')]))).toBeLessThan(
      TOLERANCE_GAL,
    );
  });

  it('one WIND SHIELD press takes 40 ml over its 10 s, whatever the mode, on top of the mode flow', () => {
    const sprayGal = DEICE_SPRAY_ML / ML_PER_US_GAL;
    for (const m of ['off', 'norm', 'high'] as const) {
      const base = [mode(0, m)];
      const sprayed = [...base, ...press(1_000, 'btn.deice_windshield')];
      const after = 1_000 + WINDSHIELD_SPRAY_MS + 5_000;
      expect(stateAt(1_500, sprayed).flags[WINDSHIELD_SPRAY_ACTIVE], m).toBe(true);
      expect(Math.abs(gallons(after, base) - gallons(after, sprayed) - sprayGal), m).toBeLessThan(
        TOLERANCE_GAL / 10,
      );
    }
  });

  it('never leaves its range: an empty tank stays at 0, a full one does not grow', () => {
    const events = [mode(0, 'high'), ...press(1_000, 'btn.deice_windshield')];
    expect(gallons(T, events, { [QUANTITY]: 0.01 })).toBe(tank.min);
    expect(gallons(T, [mode(0, 'off')], { [QUANTITY]: tank.max })).toBe(tank.max);
    expect(gallons(T, [mode(0, 'norm')], { [QUANTITY]: tank.max })).toBeLessThanOrEqual(tank.max);
  });

  it('a live run equals the replay at every sampled step over NORM, HIGH, MAX and WIND SHIELD', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const live = new Run({
      setup: simSetup(DA50RG_ENV, scenario),
      store,
      start: initialQuantities(scenario, DA50RG_ENV.quantities),
    });
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    const log: [number, () => void][] = [
      [5, () => store.dispatch('sw.deice_mode', 'norm', live.clock.now())],
      [100, () => store.dispatch('sw.deice_mode', 'high', live.clock.now())],
      [200, () => store.dispatch('btn.deice_max', 'pressed', live.clock.now())],
      [205, () => store.dispatch('btn.deice_max', 'released', live.clock.now())],
      [250, () => store.dispatch('btn.deice_windshield', 'pressed', live.clock.now())],
      [255, () => store.dispatch('btn.deice_windshield', 'released', live.clock.now())],
    ];
    const last = Math.ceil((200 * STEP_MS + DEICE_MAX_RUN_MS + 30_000) / STEP_MS);
    for (let n = 1; n <= last; n++) {
      for (const [at, act] of log) if (at === n) act();
      live.step();
      // Every step up to the spray, then every 25th and the steps around the end of the MAX run.
      const endOfMax = 200 + DEICE_MAX_RUN_MS / STEP_MS;
      const sampled = n <= 300 || n % 25 === 0 || Math.abs(n - endOfMax) <= 3 || n === last;
      if (!sampled) continue;
      const replay = simulate(setup, { events: store.events(), start, untilMs: n * STEP_MS });
      expect(live.state.quantities, `step ${String(n)}`).toEqual(replay.state.quantities);
      expect(live.state.flags, `step ${String(n)}`).toEqual(replay.state.flags);
    }
    expect(live.state.quantities[QUANTITY]).toBeLessThan(tank.base);
  }, 30_000);
});
