import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES, STALL_HEAT_CUTOUT_S } from '../src/aircraft/da50rg/quantities';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, initSim, simSetup, simulate, stepSim } from '../src/engine/sim';
import type { SimEvent, SimState } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';

// PITOT HEAT and STALL HEAT (Phase 6, plan 06-04; H-01 to H-03, D-12): the two cautions whenever the
// PITOT/STALL HEAT rocker is off, and the ground cut-out of the stall heat. Expected times come from
// STALL_HEAT_CUTOUT_S and the band table of the quantity data.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
/** The blueprint with no scenario parameters, so a case sets exactly the ones it names. */
const scenario = { ...checked.scenario, parameters: {} };

const HEAT = 'sw.pitot_stall_heat';
const TIMER = 'stall_heat_timer_s';
const GROUND = { ground_roll: 1 };
const SECOND = 1000;
const timerDef = DA50RG_QUANTITIES.get(TIMER);
if (timerDef === undefined) throw new Error('no stall heat timer quantity');
const timerTop = timerDef.max;
const warmTop = timerDef.bands.find((b) => b.id === 'warm')?.to ?? Number.NaN;

const given = (controls: Record<string, string>, parameters: Record<string, number>) => {
  const s = { ...scenario, initial: { controls, quantities: {} }, parameters };
  return { setup: simSetup(DA50RG_ENV, s), start: initialQuantities(s, DA50RG_ENV.quantities) };
};

const activeIds = (setup: ReturnType<typeof simSetup>, state: SimState): string[] =>
  DA50RG_CAS.active(
    { controls: state.controls, baseline: setup.baseline, quantities: state.quantities },
    DA50RG_ENV,
  ).map((m) => m.id);

/** The state after `untilMs`, with the controls and parameters of the case and these events. */
function runTo(
  controls: Record<string, string>,
  parameters: Record<string, number>,
  untilMs: number,
  events: SimEvent[] = [],
) {
  const g = given(controls, parameters);
  return {
    setup: g.setup,
    state: simulate(g.setup, { events, start: g.start, untilMs }).state,
  };
}

const timerOf = (state: SimState): number => state.quantities[TIMER] ?? Number.NaN;

describe('the rocker off (H-01)', () => {
  it('shows exactly PITOT HEAT and STALL HEAT at the base quantities, as cautions', () => {
    const { setup, state } = runTo({ [HEAT]: 'off' }, {}, STEP_MS);
    expect(activeIds(setup, state)).toEqual(['pitot_heat', 'stall_heat']);
    const levels = DA50RG_CAS.active(
      { controls: state.controls, baseline: setup.baseline, quantities: state.quantities },
      DA50RG_ENV,
    ).map((m) => `${m.level}:${m.text}`);
    expect(levels).toEqual(['caution:PITOT HEAT', 'caution:STALL HEAT']);
  });

  it('the rocker on shows none in the air', () => {
    const { setup, state } = runTo({}, {}, 60 * SECOND);
    expect(activeIds(setup, state)).toEqual([]);
  });

  it('stays the same two chips for as long as the run lasts, on the ground as well', () => {
    for (const parameters of [{}, GROUND]) {
      const { setup, state } = runTo({ [HEAT]: 'off' }, parameters, 60 * SECOND);
      expect(activeIds(setup, state), JSON.stringify(parameters)).toEqual([
        'pitot_heat',
        'stall_heat',
      ]);
      expect(timerOf(state)).toBe(0);
    }
  });
});

describe('the ground cut-out (H-02)', () => {
  it('on the ground with the heat on the message is absent until the cut-out time has run', () => {
    const before = runTo({}, GROUND, STALL_HEAT_CUTOUT_S * SECOND);
    expect(timerOf(before.state)).toBe(warmTop);
    expect(activeIds(before.setup, before.state)).toEqual([]);
    const after = runTo({}, GROUND, STALL_HEAT_CUTOUT_S * SECOND + STEP_MS);
    expect(activeIds(after.setup, after.state)).toEqual(['stall_heat_ground']);
  });

  it('shows STALL HEAT alone, as a caution, never two STALL HEAT chips', () => {
    const { setup, state } = runTo({}, GROUND, 30 * SECOND);
    const messages = DA50RG_CAS.active(
      { controls: state.controls, baseline: setup.baseline, quantities: state.quantities },
      DA50RG_ENV,
    );
    expect(messages).toEqual([{ id: 'stall_heat_ground', text: 'STALL HEAT', level: 'caution' }]);
  });

  it('switching the heat off removes the ground chip and shows the two off chips at once', () => {
    const events: SimEvent[] = [{ t: 20 * SECOND, id: HEAT, value: 'off' }];
    const before = runTo({}, GROUND, 20 * SECOND - STEP_MS, events);
    expect(activeIds(before.setup, before.state)).toEqual(['stall_heat_ground']);
    const after = runTo({}, GROUND, 20 * SECOND + 2 * STEP_MS, events);
    expect(activeIds(after.setup, after.state)).toEqual(['pitot_heat', 'stall_heat']);
    expect(timerOf(after.state)).toBe(0);
  });

  it('switching the heat on again starts the count over', () => {
    const events: SimEvent[] = [
      { t: 10 * SECOND, id: HEAT, value: 'off' },
      { t: 12 * SECOND, id: HEAT, value: 'on' },
    ];
    const early = runTo({}, GROUND, 12 * SECOND + STALL_HEAT_CUTOUT_S * SECOND, events);
    expect(activeIds(early.setup, early.state)).toEqual([]);
    const late = runTo({}, GROUND, 12 * SECOND + (STALL_HEAT_CUTOUT_S + 1) * SECOND, events);
    expect(activeIds(late.setup, late.state)).toEqual(['stall_heat_ground']);
  });

  it('in the air with the heat on no chip appears however long the run lasts', () => {
    for (const ms of [STALL_HEAT_CUTOUT_S * SECOND, 60 * SECOND, 10 * 60 * SECOND]) {
      const { setup, state } = runTo({}, {}, ms);
      expect(activeIds(setup, state), String(ms)).toEqual([]);
      expect(timerOf(state)).toBe(0);
    }
  });

  it('the timer stays inside its range over a long ground run', () => {
    const g = given({}, GROUND);
    let state = initSim(g.setup, g.start);
    for (let n = 0; n < 900; n += 1) {
      state = stepSim(g.setup, state, []).state;
      const t = timerOf(state);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(timerTop);
    }
    expect(timerOf(state)).toBeGreaterThan(warmTop);
  });
});

describe('a live run equals its replay', () => {
  it('at sampled steps over a ground run with the heat switched off and on', () => {
    const g = given({}, GROUND);
    const store = new PanelStore(DA50RG);
    store.reset({});
    const run = new Run({ setup: g.setup, store, start: g.start });
    const script: Record<number, string> = { 80: 'off', 110: 'on' };
    for (let n = 1; n <= 260; n += 1) {
      const to = script[n];
      if (to !== undefined) {
        const result = store.dispatch(HEAT, to, run.clock.now());
        if (!result.ok) throw new Error(`${HEAT} -> ${to} rejected: ${result.reason}`);
      }
      run.step();
      if (n % 13 === 0 || n === 79 || n === 81 || n === 111 || n === 170) {
        const replay = simulate(g.setup, {
          events: store.events(),
          start: g.start,
          untilMs: run.state.t,
        }).state;
        expect(run.state, `step ${String(n)}`).toEqual(replay);
      }
    }
    // The script mattered: the cut-out came back after the second switch-on.
    expect(activeIds(g.setup, run.state)).toEqual(['stall_heat_ground']);
    run.dispose();
  });
});

// H-03 (owner, 2026-10-28, D-12): the shipped ground situations start with the heat on, so the STALL
// HEAT message comes back STALL_HEAT_CUTOUT_S after the start of the run (Easy, Medium) or after the
// onset (Realistic: the scenario parameters, ground_roll among them, are set by the onset).
describe('the shipped ground situations (H-03)', () => {
  const SCENARIOS = join(root, 'scenarios');
  const groundFiles = readdirSync(SCENARIOS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(SCENARIOS, dir.name))
        .filter((file) => file.endsWith('.toon') && file !== 'pack.toon')
        .map((file) => join('scenarios', dir.name, file)),
    )
    .filter((file) => /^\s*ground_roll:\s*[1-9]/m.test(readFileSync(join(root, file), 'utf8')))
    .sort();

  it('are found: at least one ground situation ships', () => {
    expect(groundFiles.length).toBeGreaterThan(0);
  });

  for (const file of groundFiles) {
    const loaded = checkScenario(readFileSync(join(root, file), 'utf8'), DA50RG_ENV);
    if (!loaded.ok) throw new Error(`${file} does not pass the scenario check`);
    const ground = loaded.scenario;

    /** The time in ms of the first step with the ground message, null when it never shows. */
    const firstGroundMessage = (
      setup: ReturnType<typeof simSetup>,
      start: Record<string, number>,
    ) => {
      let state = initSim(setup, start);
      while (state.t < 20 * SECOND && state.outcome === null) {
        if (activeIds(setup, state).includes('stall_heat_ground')) return state.t;
        state = stepSim(setup, state, []).state;
      }
      return null;
    };

    it(`${file}: starts with the heat on and no message, the STALL HEAT chip comes ${String(STALL_HEAT_CUTOUT_S)} s after the start (Easy and Medium)`, () => {
      expect(ground.initial.controls[HEAT]).not.toBe('off');
      const setup = simSetup(DA50RG_ENV, ground);
      const start = initialQuantities(ground, DA50RG_ENV.quantities);
      expect(activeIds(setup, initSim(setup, start))).not.toContain('stall_heat_ground');
      expect(firstGroundMessage(setup, start)).toBe(STALL_HEAT_CUTOUT_S * SECOND + STEP_MS);
    });

    it(`${file}: Realistic starts clean and the chip comes ${String(STALL_HEAT_CUTOUT_S)} s after the onset`, () => {
      const onsetAt = 6 * SECOND;
      const setup = simSetup(DA50RG_ENV, ground, { onsetAt });
      const start = realisticQuantities(ground, DA50RG_ENV.quantities);
      expect(activeIds(setup, initSim(setup, start))).toEqual([]);
      // The scenario parameters (ground_roll) are the failure: on Realistic they take effect at the onset.
      expect(firstGroundMessage(setup, start)).toBe(
        onsetAt + STALL_HEAT_CUTOUT_S * SECOND + STEP_MS,
      );
    });
  }
});
