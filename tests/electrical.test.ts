import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { acuFault, alternatorOnline, electricalState } from '../src/aircraft/da50rg/electrical';
import type { Alternator, ElectricalInputs } from '../src/aircraft/da50rg/electrical';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { initialQuantities } from '../src/engine/predicates';
import { simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';

// The DA50 RG electrical system as aircraft data (phase 4). The expected values are typed from the
// wiring diagrams and Figure 1 of the aircraft documents (described in .planning, never copied), not
// computed from the code under test.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const blueprint = checked.scenario;

/** The control states at the registry defaults (in-flight cruise), overlaid by the given ones. */
function controlsWith(over: Record<string, string> = {}): Record<string, string> {
  const controls: Record<string, string> = {};
  for (const def of DA50RG.controls) controls[def.id] = def.default;
  return { ...controls, ...over };
}

const NORMAL = DA50RG_PHYSICS.normalParameters();

function inputs(
  controls: Record<string, string> = {},
  parameters: Record<string, number> = {},
): ElectricalInputs {
  return { controls: controlsWith(controls), parameters: { ...NORMAL, ...parameters } };
}

const ALTERNATORS: readonly Alternator[] = [1, 2];

describe('alternatorOnline and acuFault (E-04, E-07)', () => {
  for (const n of ALTERNATORS) {
    const sw = `sw.alternator_${String(n)}`;
    const cb = `cb.alt${String(n)}`;
    const output = `alt${String(n)}_output`;
    const short = `alt${String(n)}_short`;

    it(`alternator ${String(n)}: online and without a fault in the normal state`, () => {
      expect(alternatorOnline(inputs(), n, true)).toBe(true);
      expect(acuFault(inputs(), n)).toBe(false);
    });

    it(`alternator ${String(n)}: each cause alone raises the fault`, () => {
      expect(acuFault(inputs({}, { [output]: 0 }), n), 'output 0').toBe(true);
      expect(acuFault(inputs({}, { [output]: 0.5 }), n), 'output below normal').toBe(true);
      expect(acuFault(inputs({}, { [short]: 1 }), n), 'short').toBe(true);
      expect(acuFault(inputs({ [cb]: 'out' }), n), 'breaker out').toBe(true);
      expect(acuFault(inputs({ [sw]: 'off' }), n), 'switch OFF').toBe(true);
    });

    it(`alternator ${String(n)}: each cause alone takes it offline, a short alone does not`, () => {
      expect(alternatorOnline(inputs({}, { [output]: 0 }), n, true)).toBe(false);
      expect(alternatorOnline(inputs({ [cb]: 'out' }), n, true)).toBe(false);
      expect(alternatorOnline(inputs({ [sw]: 'off' }), n, true)).toBe(false);
      expect(alternatorOnline(inputs({}, { [short]: 1 }), n, true)).toBe(true);
    });

    it(`alternator ${String(n)}: engine stopped or ELECT. MASTER off is offline but no fault`, () => {
      expect(alternatorOnline(inputs(), n, false)).toBe(false);
      expect(acuFault(inputs(), n)).toBe(false);
      const masterOff = inputs({ 'sw.elect_master': 'off' });
      expect(alternatorOnline(masterOff, n, true)).toBe(false);
      expect(acuFault(masterOff, n)).toBe(false);
    });
  }

  it('the alternators are independent of each other', () => {
    const one = inputs({}, { alt1_output: 0 });
    expect(acuFault(one, 1)).toBe(true);
    expect(acuFault(one, 2)).toBe(false);
    expect(alternatorOnline(one, 2, true)).toBe(true);
  });
});

describe('a failed alternator raises its caution within one step and nothing else', () => {
  const setupFor = (parameters: Record<string, number>) => {
    const scenario = {
      ...blueprint,
      initial: { controls: {}, quantities: {} },
      parameters,
    };
    return {
      setup: simSetup(DA50RG_ENV, scenario),
      start: initialQuantities(scenario, DA50RG_ENV.quantities),
    };
  };
  const run = (parameters: Record<string, number>, untilMs: number) => {
    const { setup, start } = setupFor(parameters);
    return simulate(setup, { events: [], start, untilMs }).state;
  };
  const active = (state: ReturnType<typeof run>): string[] =>
    DA50RG_CAS.active(
      { controls: state.controls, baseline: {}, quantities: state.quantities },
      DA50RG_ENV,
    ).map((m) => m.id);

  it('the base state shows no caution', () => {
    expect(active(run({}, 1000))).toEqual([]);
  });

  it('alt2_output 0: ALTN 2 FAIL after one step, alt1_fault stays 0', () => {
    const state = run({ alt2_output: 0 }, 100);
    expect(state.quantities['alt2_fault']).toBe(1);
    expect(state.quantities['alt1_fault']).toBe(0);
    expect(active(state)).toEqual(['altn_2_fail']);
    expect(active(run({ alt2_output: 0 }, 60_000))).toEqual(['altn_2_fail']);
  });

  it('alt1_output 0: ALTN 1 FAIL after one step, alt2_fault stays 0', () => {
    const state = run({ alt1_output: 0 }, 100);
    expect(state.quantities['alt1_fault']).toBe(1);
    expect(state.quantities['alt2_fault']).toBe(0);
    expect(active(state)).toEqual(['altn_1_fail']);
    expect(active(run({ alt1_output: 0 }, 60_000))).toEqual(['altn_1_fail']);
  });
});

// ---------------------------------------------------------------------------------------------
// The bus model. Expected values are typed from the five wiring diagrams (normal, alternator 1
// failed, alternator 2 failed, ESS BUS on, both failed) and from Figure 1; "26" is the battery
// voltage at a full battery (22 plus 4), "19" the dead-bus target one volt below the scale.

const REGULATED = 28;
const BATTERY_FULL_V = 26;
const DEAD_V = 19;

interface Expected {
  tieClosed: boolean;
  main: boolean;
  essential: boolean;
  avionics: boolean;
  ecuA: boolean;
  ecuB: boolean;
  mainPump: boolean;
  emergPump: boolean;
  racc: boolean;
  alt1Amps: number;
  alt2Amps: number;
  busVolts: number;
  batteryPerMinute: number;
}

/** The normal state of diagram 400: everything on, RACC on, charging. */
const NORMAL_STATE: Expected = {
  tieClosed: true,
  main: true,
  essential: true,
  avionics: true,
  ecuA: true,
  ecuB: true,
  mainPump: true,
  emergPump: true,
  racc: true,
  alt1Amps: 30,
  alt2Amps: 10,
  busVolts: REGULATED,
  batteryPerMinute: 10,
};

/** The EMERG FUEL PUMP switch is on in every case here so that the pump is observable. */
const PUMP_ON = { 'sw.emerg_fuel_pump': 'on' };

function stateFor(
  controls: Record<string, string> = {},
  parameters: Record<string, number> = {},
  options: { charge?: number; engine?: boolean } = {},
) {
  const engine = options.engine ?? true;
  const given = { ...PUMP_ON, ...(engine ? {} : { 'sw.engine_master': 'off' }), ...controls };
  return electricalState(
    {
      controls: controlsWith(given),
      parameters: { ...NORMAL, ...parameters },
      quantities: { battery_pct: options.charge ?? 100 },
    },
    engine,
  );
}

function expectState(actual: ReturnType<typeof stateFor>, expected: Expected, label: string) {
  for (const key of Object.keys(expected) as (keyof Expected)[]) {
    expect(actual[key], `${label}: ${key}`).toBe(expected[key]);
  }
}

describe('electricalState: the five diagrams and Figure 1', () => {
  it('the result is frozen', () => {
    expect(Object.isFrozen(stateFor())).toBe(true);
  });

  it('normal (diagram 400): tie closed, every bus and consumer on, RACC on, charging', () => {
    expectState(stateFor(), NORMAL_STATE, 'normal');
  });

  it('alternator 1 failed, ESS BUS off (the ALTN 1 FAIL start): main on the battery through the closed tie', () => {
    expectState(
      stateFor({}, { alt1_output: 0 }),
      { ...NORMAL_STATE, alt1Amps: 0, busVolts: BATTERY_FULL_V, batteryPerMinute: -25 },
      'alt1 failed',
    );
  });

  it('alternator 1 failed, ESS BUS on (diagram 402): tie energised, main on alternator 2, RACC shed', () => {
    expectState(
      stateFor({ 'sw.ess_bus': 'on' }, { alt1_output: 0 }),
      { ...NORMAL_STATE, tieClosed: false, racc: false, alt1Amps: 0, alt2Amps: 30 },
      'alt1 failed, ESS on',
    );
  });

  it('alternator 2 failed (diagram 404): tie closed, alternator 1 carries both buses, RACC off', () => {
    expectState(
      stateFor({}, { alt2_output: 0 }),
      { ...NORMAL_STATE, racc: false, alt2Amps: 0 },
      'alt2 failed',
    );
  });

  it('ESS BUS on with both healthy (diagram 401): the relay is energised, 15 and 15 A, RACC off', () => {
    expectState(
      stateFor({ 'sw.ess_bus': 'on' }),
      { ...NORMAL_STATE, tieClosed: false, racc: false, alt1Amps: 15, alt2Amps: 15 },
      'ESS on',
    );
  });

  it('both failed, ESS BUS off: main and essential on the battery, discharging', () => {
    expectState(
      stateFor({}, { alt1_output: 0, alt2_output: 0 }),
      {
        ...NORMAL_STATE,
        racc: false,
        alt1Amps: 0,
        alt2Amps: 0,
        busVolts: BATTERY_FULL_V,
        batteryPerMinute: -25,
      },
      'both failed',
    );
  });

  it('both failed, ESS BUS on (diagram 406): main dead, ECU B, pump and avionics off, ECU A and main pump on', () => {
    expectState(
      stateFor({ 'sw.ess_bus': 'on' }, { alt1_output: 0, alt2_output: 0 }),
      {
        tieClosed: false,
        main: false,
        essential: true,
        avionics: false,
        ecuA: true,
        ecuB: false,
        mainPump: true,
        emergPump: false,
        racc: false,
        alt1Amps: 0,
        alt2Amps: 0,
        busVolts: BATTERY_FULL_V,
        batteryPerMinute: -25,
      },
      'both failed, ESS on',
    );
  });

  it('the load sharing direction of the normal checklist test: ESS BUS on, alternator 2 rises and alternator 1 falls; off again, the reverse', () => {
    const off = stateFor();
    const on = stateFor({ 'sw.ess_bus': 'on' });
    expect(on.alt2Amps).toBeGreaterThan(off.alt2Amps);
    expect(on.alt1Amps).toBeLessThan(off.alt1Amps);
    const back = stateFor({ 'sw.ess_bus': 'off' });
    expect(back.alt1Amps).toBeGreaterThan(on.alt1Amps);
    expect(back.alt2Amps).toBeLessThan(on.alt2Amps);
  });

  it('a single alternator carries the whole main load with ESS BUS on, in either direction', () => {
    expect(stateFor({ 'sw.ess_bus': 'on' }, { alt1_output: 0 }).alt2Amps).toBe(30);
    expect(stateFor({ 'sw.ess_bus': 'on' }, { alt2_output: 0 }).alt1Amps).toBe(30);
  });

  it('a partial output scales its own current', () => {
    expect(stateFor({}, { alt1_output: 0.5 }).alt1Amps).toBe(15);
    expect(stateFor({}, { alt2_output: 0.5 }).alt2Amps).toBe(5);
  });

  it('engine stopped, ESS BUS off: main on the battery, avionics and the pump on, ECUs and main pump off', () => {
    expectState(
      stateFor({}, {}, { engine: false }),
      {
        tieClosed: true,
        main: true,
        essential: true,
        avionics: true,
        ecuA: false,
        ecuB: false,
        mainPump: false,
        emergPump: true,
        racc: false,
        alt1Amps: 0,
        alt2Amps: 0,
        busVolts: BATTERY_FULL_V,
        batteryPerMinute: -25,
      },
      'engine stopped',
    );
  });

  it('engine stopped, ESS BUS on: main dead, the pump unpowered, ECUs and main pump off', () => {
    const state = stateFor({ 'sw.ess_bus': 'on' }, {}, { engine: false });
    expect(state.main).toBe(false);
    expect(state.avionics).toBe(false);
    expect(state.emergPump).toBe(false);
    expect(state.essential).toBe(true);
    expect([state.ecuA, state.ecuB, state.mainPump]).toEqual([false, false, false]);
  });

  it('ELECT. MASTER off: no alternator, no battery bus, hot bus kept, ESS BUS on does nothing', () => {
    for (const ess of ['off', 'on']) {
      const state = stateFor({ 'sw.elect_master': 'off', 'sw.ess_bus': ess });
      expect(state.alt1Online, ess).toBe(false);
      expect(state.alt2Online, ess).toBe(false);
      expect(state.batteryBus, ess).toBe(false);
      expect(state.essential, ess).toBe(false);
      expect(state.main, ess).toBe(false);
      expect(state.hot, ess).toBe(true);
      expect(state.tieEnergised, ess).toBe(false);
      expect(state.busVolts, ess).toBe(DEAD_V);
      expect(state.batteryPerMinute, ess).toBe(0);
      expect([state.emergPump, state.ecuB, state.avionics], ess).toEqual([false, false, false]);
    }
  });

  it('ELECT. MASTER off: ECU A and the main pump stay powered with ALTERNATOR 1 on, not with it off', () => {
    const on = stateFor({ 'sw.elect_master': 'off' });
    expect([on.ecuA, on.mainPump]).toEqual([true, true]);
    const off = stateFor({ 'sw.elect_master': 'off', 'sw.alternator_1': 'off' });
    expect([off.ecuA, off.mainPump]).toEqual([false, false]);
  });

  it('excitation fallback: alternator 1 failed, flat battery, ESS BUS on: alternator 2 still carries the main bus', () => {
    const state = stateFor({ 'sw.ess_bus': 'on' }, { alt1_output: 0 }, { charge: 0 });
    expect(state.alt2Online).toBe(true);
    expect(state.tieEnergised).toBe(true);
    expect(state.main).toBe(true);
    expect(state.essential).toBe(true);
    expect(state.busVolts).toBe(REGULATED);
    expect(state.batteryPerMinute).toBe(10);
  });

  it('a flat battery with no alternator leaves every bus dead and the hot bus empty', () => {
    const state = stateFor({}, { alt1_output: 0, alt2_output: 0 }, { charge: 0 });
    expect([state.main, state.essential, state.hot, state.batteryFeed]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(state.busVolts).toBe(DEAD_V);
    expect(state.batteryPerMinute).toBe(0);
  });
});

describe('electricalState: each breaker alone (E-09)', () => {
  it('ESS TIE or MAIN TIE out: the essential bus is on the battery, the main bus on alternator 1', () => {
    for (const cb of ['cb.ess_tie', 'cb.main_tie']) {
      const state = stateFor({ [cb]: 'out' });
      expect(state.tiePath, cb).toBe(false);
      expect(state.main, cb).toBe(true);
      expect(state.essential, cb).toBe(true);
      expect(state.alternatorOnEssential, cb).toBe(false);
      expect(state.busVolts, cb).toBe(BATTERY_FULL_V);
      expect(state.batteryPerMinute, cb).toBe(-25);
    }
  });

  it('ESS TIE or MAIN TIE out with alternator 1 failed and ESS BUS off: the main bus is dead', () => {
    for (const cb of ['cb.ess_tie', 'cb.main_tie']) {
      const state = stateFor({ [cb]: 'out' }, { alt1_output: 0 });
      expect(state.main, cb).toBe(false);
      expect(state.essential, cb).toBe(true);
      expect(state.avionics, cb).toBe(false);
    }
  });

  it('BATT out: the essential bus is fed from the main bus only, the battery stays as it is', () => {
    const state = stateFor({ 'cb.batt': 'out' });
    expect(state.batteryFeed).toBe(false);
    expect(state.essential).toBe(true);
    expect(state.main).toBe(true);
    expect(state.busVolts).toBe(REGULATED);
    expect(state.batteryPerMinute).toBe(0);
  });

  it('MASTER CTRL. out: the avionic bus is off, the rest as normal', () => {
    expectState(stateFor({ 'cb.master_ctrl': 'out' }), { ...NORMAL_STATE, avionics: false }, 'mc');
  });

  it('ECU A, ECU B, MAIN PUMP, EMERG PUMP and AV BUS: each takes only its own consumer away', () => {
    const own: Record<string, keyof Expected> = {
      'cb.ecu_a': 'ecuA',
      'cb.ecu_b': 'ecuB',
      'cb.main_pump': 'mainPump',
      'cb.emerg_pump': 'emergPump',
      'cb.av_bus': 'avionics',
    };
    for (const [cb, consumer] of Object.entries(own)) {
      expectState(stateFor({ [cb]: 'out' }), { ...NORMAL_STATE, [consumer]: false }, cb);
    }
  });
});

describe('electricalState: every combination of the alternator switches, ESS BUS, ELECT. MASTER and the engine', () => {
  const onOff = ['on', 'off'] as const;
  for (const a1 of onOff) {
    for (const a2 of onOff) {
      for (const ess of onOff) {
        for (const elect of onOff) {
          for (const engine of [true, false]) {
            const label = `alt1 ${a1}, alt2 ${a2}, ESS ${ess}, ELECT ${elect}, engine ${String(engine)}`;
            it(label, () => {
              const state = stateFor(
                {
                  'sw.alternator_1': a1,
                  'sw.alternator_2': a2,
                  'sw.ess_bus': ess,
                  'sw.elect_master': elect,
                },
                {},
                { engine },
              );
              // The main bus is live only through alternator 1, alternator 2 with the tie
              // energised, or the closed contact with the tie breakers in and the battery behind it.
              const viaContact =
                state.tieClosed && state.tiePath && state.batteryFeed && !state.alt1Online;
              const viaAlt2 = state.alt2Online && state.tieEnergised;
              if (state.main) {
                expect(state.alt1Online || viaAlt2 || viaContact).toBe(true);
              } else {
                expect(state.alt1Online || viaAlt2).toBe(false);
              }
              // The relay never energises with ESS BUS off or ELECT. MASTER off; its contact is
              // then closed.
              if (ess === 'off' || elect === 'off') {
                expect(state.tieEnergised).toBe(false);
                expect(state.tieClosed).toBe(true);
              }
              // With ESS BUS on the battery never feeds the main bus.
              if (ess === 'on' && !state.alt1Online && !state.alt2Online) {
                expect(state.main).toBe(false);
              }
              // Alternator 2 carries the main bus only with the tie energised, i.e. ESS BUS on.
              if (ess === 'off') expect(viaAlt2).toBe(false);
              // RACC lives on alternator 2 with ESS BUS off and is shed by ESS BUS on.
              expect(state.racc).toBe(state.alt2Online && ess === 'off');
            });
          }
        }
      }
    }
  }
});
