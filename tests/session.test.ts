import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS, DEICE_MAX_ACTIVE } from '../src/aircraft/da50rg/indicators';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { followOnFromSeed } from '../src/engine/follow-on';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { panelOnly, realisticQuantities } from '../src/engine/predicates';
import { MAX_RUN_MS, STEP_MS, onsetFromSeed, simSetup, simulate } from '../src/engine/sim';
import { variantFromSeed } from '../src/engine/variants';
import { checkScenario } from '../src/scenario/lint';
import { parseScenario } from '../src/scenario/parse';
import { OPEN_ACCESS, createPackProvider } from '../src/scenario/packs';
import type { AccessPolicy } from '../src/scenario/packs';
import type { Scenario } from '../src/scenario/schema';
import { createPanelBridge } from '../src/ui/bridge';
import { FurtherAreaFrame } from '../src/ui/panel/frames/FurtherAreaFrame';
import { checklistHead } from '../src/ui/outline';
import { anyModalOpen } from '../src/ui/modals';
import { SESSION_LAYOUT, pageCount, pageSlice } from '../src/ui/panel/session-area';
import { CATALOG_REFERENCE } from './checklist-catalog-reference';
import { followOnOffer, reasonLines } from '../src/ui/debrief-text';
import { attachClockDriver } from '../src/ui/clock-driver';
import {
  LEVELS,
  LEVEL_HINTS,
  RUN_ERROR_PATH,
  createSession,
  pickRandom,
  retrySeeds,
} from '../src/ui/session';

// The session machine (plan 02-06, Table N1; plan 02-11 adds the briefing; SES-01, SES-03, SES-04,
// SCN-05, D-13, D-14): node environment, a real bridge over the DA50 RG and a fake pack provider built from the real
// blueprint text. Credit follows the resulting state of the recorded log.

const root = fileURLToPath(new URL('../', import.meta.url));
const BLUEPRINT = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
const COPY = BLUEPRINT.replace('id: eng-oil-temp-green', 'id: eng-oil-temp-copy');
if (COPY === BLUEPRINT) throw new Error('the blueprint id line was not found');

const MANIFEST_ONE = `format: 1
title: Engine
free: true
scenarios[1]:
  - id: eng-oil-temp-green
    title: ENG OIL TEMP
    file: eng-oil-temp-green
`;

const MANIFEST_TWO = `format: 1
title: Engine
free: true
scenarios[2]:
  - id: eng-oil-temp-green
    title: ENG OIL TEMP
    file: eng-oil-temp-green
  - id: eng-oil-temp-copy
    title: ENG OIL TEMP 2
    file: eng-oil-temp-copy
`;

interface Rig {
  readonly session: ReturnType<typeof createSession>;
  readonly bridge: ReturnType<typeof createPanelBridge>;
  readonly onRunStart: ReturnType<typeof vi.fn>;
  /** Names of the scenario files the provider loaded, in call order. */
  readonly loads: string[];
  /** Breaks (true) or repairs (false) the pack manifest, so the next list load fails or works. */
  setListBroken(broken: boolean): void;
}

function rig(
  options: {
    manifest?: string;
    files?: Record<string, string | Error>;
    policy?: AccessPolicy;
    rng?: () => number;
    listFails?: boolean;
    freeScene?: string;
  } = {},
): Rig {
  const files = options.files ?? { 'eng-oil-temp-green': BLUEPRINT };
  const loads: string[] = [];
  const loaders: Record<string, () => Promise<string>> = {};
  for (const name of Object.keys(files)) {
    loaders[`/scenarios/engine/${name}.toon`] = () => {
      loads.push(name);
      // Read at call time, so a test can repair a file between a failure and the retry.
      const text = files[name];
      return text === undefined || text instanceof Error
        ? Promise.reject(text ?? new Error('no file'))
        : Promise.resolve(text);
    };
  }
  let listBroken = options.listFails === true;
  const provider = createPackProvider({
    manifests: {
      // Read at call time, so a test can break the list after the first load.
      get '/scenarios/engine/pack.toon'(): string {
        return listBroken ? 'format: 1\nbogus: 1' : (options.manifest ?? MANIFEST_ONE);
      },
    },
    loaders,
  });
  const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
  const onRunStart = vi.fn();
  const session = createSession({
    bridge,
    packs: { provider, policy: options.policy ?? OPEN_ACCESS },
    env: DA50RG_ENV,
    rng: options.rng ?? (() => 0),
    onRunStart,
    ...(options.freeScene === undefined ? {} : { freeScene: options.freeScene }),
  });
  return {
    session,
    bridge,
    onRunStart,
    loads,
    setListBroken: (broken: boolean) => {
      listBroken = broken;
    },
  };
}

/** A started run on the blueprint: NEW SITUATION, then Start run. */
async function started(options: Parameters<typeof rig>[0] = {}): Promise<Rig> {
  const r = rig(options);
  await r.session.newSituation();
  expect(r.session.screen.value).toBe('briefing');
  r.session.startRun();
  expect(r.session.screen.value).toBe('running');
  return r;
}

describe('pickRandom', () => {
  it('picks the item at floor(rng * n) and clamps at the last', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(pickRandom(items, () => 0)).toBe('a');
    expect(pickRandom(items, () => 0.26)).toBe('b');
    expect(pickRandom(items, () => 0.99)).toBe('d');
    expect(pickRandom(items, () => 1)).toBe('d');
  });

  it('throws RangeError for an empty list', () => {
    expect(() => pickRandom([], () => 0)).toThrow(RangeError);
  });
});

describe('newSituation', () => {
  it('opens the briefing and leaves the panel, the log and the last run untouched', async () => {
    const { session, bridge, onRunStart } = rig();
    expect(session.screen.value).toBe('free');
    expect(bridge.stateOf('lv.power').value).toBe('p70');

    await session.newSituation();

    expect(session.screen.value).toBe('briefing');
    expect(session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');
    expect(session.briefing.value?.branches.map((b) => b.status)).toEqual([
      'not_applicable',
      'applies',
      'open',
    ]);
    // Not a run yet: no scenario of a run, no result, no clock, panel still as the user left it.
    expect(session.scenario.value).toBeNull();
    expect(session.result.value).toBeNull();
    expect(session.clock.value).toBeNull();
    expect(session.loadFailure.value).toBeNull();
    expect(session.busy.value).toBe(false);
    expect(bridge.stateOf('lv.power').value).toBe('p70');
    expect(bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
    expect(bridge.store.events()).toEqual([]);
    expect(onRunStart).not.toHaveBeenCalled();
  });

  it('startRun starts the run in the scenario baseline with an empty log', async () => {
    const { session, bridge, onRunStart } = rig();
    await session.newSituation();

    session.startRun();

    expect(session.screen.value).toBe('running');
    expect(session.scenario.value?.id).toBe('eng-oil-temp-green');
    expect(session.briefing.value).toBeNull();
    expect(session.result.value).toBeNull();
    expect(session.loadFailure.value).toBeNull();
    expect(bridge.stateOf('lv.power').value).toBe('p75');
    expect(bridge.stateOf('lv.cowl_flap').value).toBe('closed');
    expect(bridge.quantities.value).toEqual({
      ...DA50RG_QUANTITIES.baseValues(),
      altitude_ft: 4500,
      oil_temp_c: 128,
      oil_pressure_bar: 4.16,
    });
    // The baseline is applied, never dispatched.
    expect(bridge.store.events()).toEqual([]);
    expect(onRunStart).toHaveBeenCalledTimes(1);
    expect(session.clock.value?.now()).toBe(0);
  });

  it('backToPanel returns to free with nothing changed', async () => {
    const { session, bridge, onRunStart } = rig();
    bridge.actuate('lv.power', 'p50');
    await session.newSituation();

    session.backToPanel();

    expect(session.screen.value).toBe('free');
    expect(session.briefing.value).toBeNull();
    expect(session.scenario.value).toBeNull();
    expect(session.clock.value).toBeNull();
    expect(bridge.stateOf('lv.power').value).toBe('p50');
    expect(bridge.store.events()).toHaveLength(1);
    expect(onRunStart).not.toHaveBeenCalled();
    // A later NEW SITUATION briefs again.
    await session.newSituation();
    expect(session.screen.value).toBe('briefing');
  });

  it('keeps the last run when a briefing is left again', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.session.complete();
    r.session.closeDebrief();
    const graded = r.session.result.value;
    const last = r.session.scenario.value;

    await r.session.newSituation();
    r.session.backToPanel();

    expect(r.session.result.value).toBe(graded);
    expect(r.session.scenario.value).toBe(last);
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
  });

  it('a second NEW SITUATION press during the briefing does nothing', async () => {
    const r = rig();
    await r.session.newSituation();
    const briefed = r.session.briefing.value;
    await r.session.newSituation();
    expect(r.session.briefing.value).toBe(briefed);
    expect(r.loads).toEqual(['eng-oil-temp-green']);
  });

  it('startRun and backToPanel do nothing outside the briefing', async () => {
    const free = rig();
    free.session.startRun();
    free.session.backToPanel();
    expect(free.session.screen.value).toBe('free');
    expect(free.onRunStart).not.toHaveBeenCalled();

    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.session.startRun();
    r.session.backToPanel();
    expect(r.session.screen.value).toBe('running');
    expect(r.bridge.store.events()).toHaveLength(1);
    expect(r.onRunStart).toHaveBeenCalledTimes(1);

    r.session.complete();
    r.session.startRun();
    r.session.backToPanel();
    expect(r.session.screen.value).toBe('debrief');
  });

  it('picks the first and the last entry of two with rng 0 and 0.99', async () => {
    const files = { 'eng-oil-temp-green': BLUEPRINT, 'eng-oil-temp-copy': COPY };
    const first = rig({ manifest: MANIFEST_TWO, files, rng: () => 0 });
    await first.session.newSituation();
    expect(first.session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');

    const last = rig({ manifest: MANIFEST_TWO, files, rng: () => 0.99 });
    await last.session.newSituation();
    expect(last.session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
  });

  it('does nothing while running', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    const clock = r.session.clock.value;
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('running');
    expect(r.session.clock.value).toBe(clock);
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
    expect(r.bridge.store.events()).toHaveLength(1);
    expect(r.onRunStart).toHaveBeenCalledTimes(1);
  });

  it('does nothing in the debrief', async () => {
    const r = await started();
    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('debrief');
    expect(r.onRunStart).toHaveBeenCalledTimes(1);
  });

  it('ignores a second press while a pack loads', async () => {
    const r = rig();
    const first = r.session.newSituation();
    expect(r.session.busy.value).toBe(true);
    await r.session.newSituation();
    await first;
    expect(r.loads).toEqual(['eng-oil-temp-green']);
    expect(r.onRunStart).not.toHaveBeenCalled();
    expect(r.session.busy.value).toBe(false);
    expect(r.session.screen.value).toBe('briefing');
  });

  it('a denied pack is never opened: the empty message, still free, panel untouched', async () => {
    const policy: AccessPolicy = { canAccess: () => false };
    const r = rig({ policy });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.empty.value).toBe(true);
    expect(r.session.loadFailure.value).toBeNull();
    expect(r.loads).toEqual([]);
    expect(r.onRunStart).not.toHaveBeenCalled();
    expect(r.bridge.stateOf('lv.power').value).toBe('p70');
    expect(r.session.busy.value).toBe(false);
  });

  it('a policy that throws denies', async () => {
    const policy: AccessPolicy = {
      canAccess: () => {
        throw new Error('boom');
      },
    };
    const r = rig({ policy });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.empty.value).toBe(true);
    expect(r.loads).toEqual([]);
  });

  it('a pack that rejects sets load-failed and stays free', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': new Error('offline') } });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.loadFailure.value?.reason).toBe('load-failed');
    expect(r.onRunStart).not.toHaveBeenCalled();
    expect(r.bridge.stateOf('lv.power').value).toBe('p70');
  });

  it('an unreadable manifest sets load-failed and stays free', async () => {
    const r = rig({ listFails: true });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.loadFailure.value?.reason).toBe('load-failed');
    expect(r.session.busy.value).toBe(false);
  });

  it('an invalid scenario file sets invalid and stays free', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': 'format: 1\nbogus: 1' } });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.loadFailure.value?.reason).toBe('invalid');
  });

  it('a later press clears the failure and can start', async () => {
    let open = false;
    const policy: AccessPolicy = { canAccess: () => open };
    const r = rig({ policy });
    await r.session.newSituation();
    expect(r.session.empty.value).toBe(true);
    open = true;
    await r.session.newSituation();
    expect(r.session.empty.value).toBe(false);
    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('briefing');
  });
});

const MANIFEST_TWO_PACKS = {
  '/scenarios/engine/pack.toon': MANIFEST_TWO,
  '/scenarios/locked/pack.toon': `format: 1
title: Locked
free: false
scenarios[1]:
  - id: eng-oil-temp-locked
    title: LOCKED ONE
    file: eng-oil-temp-locked
`,
};

describe('openChooser, closeChooser and chooseScenario (SES-01, D-14, D-20, PLT-03)', () => {
  /** A rig over two packs: engine (two scenarios) and locked (one), listing never loads text. */
  function chooserRig(policy: AccessPolicy = OPEN_ACCESS) {
    const loads: string[] = [];
    const loaders: Record<string, () => Promise<string>> = {};
    const files: Record<string, string> = {
      '/scenarios/engine/eng-oil-temp-green.toon': BLUEPRINT,
      '/scenarios/engine/eng-oil-temp-copy.toon': COPY,
      '/scenarios/locked/eng-oil-temp-locked.toon': BLUEPRINT.replace(
        'id: eng-oil-temp-green',
        'id: eng-oil-temp-locked',
      ),
    };
    for (const [key, text] of Object.entries(files)) {
      loaders[key] = () => {
        loads.push(key);
        return Promise.resolve(text);
      };
    }
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    const session = createSession({
      bridge,
      packs: { provider: createPackProvider({ manifests: MANIFEST_TWO_PACKS, loaders }), policy },
      env: DA50RG_ENV,
      rng: () => 0,
      onRunStart: () => undefined,
    });
    return { session, bridge, loads };
  }

  it('lists every scenario of every allowed pack in manifest order without loading any text', async () => {
    const { session, loads } = chooserRig();
    await session.openChooser();
    expect(session.screen.value).toBe('choosing');
    expect(session.choices.value.map((c) => [c.pack, c.scenario, c.title])).toEqual([
      ['engine', 'eng-oil-temp-green', 'ENG OIL TEMP'],
      ['engine', 'eng-oil-temp-copy', 'ENG OIL TEMP 2'],
      ['locked', 'eng-oil-temp-locked', 'LOCKED ONE'],
    ]);
    expect(loads).toEqual([]);
    expect(session.busy.value).toBe(false);
    expect(session.busyKey.value).toBeNull();
  });

  it('hides a pack the policy denies (T-02-23)', async () => {
    const { session } = chooserRig({ canAccess: (id) => id !== 'locked' });
    await session.openChooser();
    expect(session.choices.value.map((c) => c.pack)).toEqual(['engine', 'engine']);
  });

  it('closeChooser returns to free and empties the list', async () => {
    const { session } = chooserRig();
    await session.openChooser();
    session.closeChooser();
    expect(session.screen.value).toBe('free');
    expect(session.choices.value).toEqual([]);
    session.closeChooser();
    expect(session.screen.value).toBe('free');
  });

  it('chooseScenario opens the briefing of exactly that entry, not a random one', async () => {
    const { session, loads, bridge } = chooserRig();
    await session.openChooser();
    await session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-copy' });
    expect(session.screen.value).toBe('briefing');
    expect(session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
    // A pack loads as a whole (one chunk per pack); the other pack stays untouched.
    expect(loads.every((key) => key.startsWith('/scenarios/engine/'))).toBe(true);
    expect(loads.length).toBeGreaterThan(0);
    expect(session.choices.value).toEqual([]);
    expect(bridge.store.events()).toEqual([]);
    expect(bridge.stateOf('lv.power').value).toBe('p70');
  });

  it('names the pressed row in busyKey while the pack loads and ignores a second press', async () => {
    const { session, loads } = chooserRig();
    await session.openChooser();
    const first = session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-green' }, 'k1');
    expect(session.busy.value).toBe(true);
    expect(session.busyKey.value).toBe('k1');
    await session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-copy' }, 'k2');
    await first;
    // The second press was ignored: the pack loaded once (both of its files, once each).
    expect(loads).toHaveLength(2);
    expect(session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');
    expect(session.busyKey.value).toBeNull();
  });

  it('chooseScenario, closeChooser and openChooser do nothing in the wrong state', async () => {
    const { session } = chooserRig();
    await session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-green' });
    expect(session.screen.value).toBe('free');
    await session.openChooser();
    await session.openChooser();
    expect(session.screen.value).toBe('choosing');
    await session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-green' });
    session.closeChooser();
    await session.openChooser();
    expect(session.screen.value).toBe('briefing');
  });

  it('a listing without an allowed scenario opens the empty message, never an empty list', async () => {
    const { session } = chooserRig({ canAccess: () => false });
    await session.openChooser();
    expect(session.screen.value).toBe('free');
    expect(session.empty.value).toBe(true);
    session.dismissEmpty();
    expect(session.empty.value).toBe(false);
  });

  it('an unreadable manifest sets load-failed and stays free', async () => {
    const r = rig({ listFails: true });
    await r.session.openChooser();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.loadFailure.value?.reason).toBe('load-failed');
  });
});

describe('leave-run confirm (U-03, T-02-24)', () => {
  it('NEW SITUATION and CHOOSE SITUATION during a run ask first and change nothing else', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    const clock = r.session.clock.value;

    await r.session.newSituation();
    expect(r.session.confirm.value).toBe('new');
    expect(r.session.screen.value).toBe('running');
    r.session.keepGoing();
    expect(r.session.confirm.value).toBeNull();

    await r.session.openChooser();
    expect(r.session.confirm.value).toBe('choose');
    expect(r.session.screen.value).toBe('running');
    expect(r.session.choices.value).toEqual([]);

    expect(r.session.clock.value).toBe(clock);
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
    expect(r.bridge.store.events()).toHaveLength(1);
    expect(r.session.busy.value).toBe(false);
  });

  it('keepGoing leaves the run unchanged', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    await r.session.newSituation();
    r.session.keepGoing();
    expect(r.session.screen.value).toBe('running');
    expect(r.session.scenario.value?.id).toBe('eng-oil-temp-green');
    expect(r.bridge.store.events()).toHaveLength(1);
    expect(r.session.confirm.value).toBeNull();
  });

  it('leaveRun ends the run without a result, resets the panel, then opens a new briefing', async () => {
    const r = await started();
    const clock = r.session.clock.value;
    clock?.advance(1234);
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    await r.session.newSituation();

    await r.session.leaveRun();

    // Never graded: no result, no scenario of a run, no clock.
    expect(r.session.result.value).toBeNull();
    expect(r.session.scenario.value).toBeNull();
    expect(r.session.clock.value).toBeNull();
    expect(r.session.confirm.value).toBeNull();
    // The panel is back at the registry defaults and the quantities at their base values; the log is empty.
    expect(r.bridge.stateOf('lv.power').value).toBe('p70');
    expect(r.bridge.stateOf('lv.cowl_flap').value).toBe('closed');
    expect(r.bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
    expect(r.bridge.store.events()).toEqual([]);
    // The pressed action ran: a briefing of a new situation.
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');
    // The run's time source is gone: a later event is not stamped by the dropped virtual clock.
    r.bridge.actuate('lv.flaps', 'to');
    expect(r.bridge.store.events().at(-1)?.t).not.toBe(clock?.now());
  });

  it('leaveRun after CHOOSE SITUATION opens the list', async () => {
    const r = await started();
    await r.session.openChooser();
    await r.session.leaveRun();
    expect(r.session.screen.value).toBe('choosing');
    expect(r.session.choices.value.map((c) => c.scenario)).toEqual(['eng-oil-temp-green']);
    expect(r.session.result.value).toBeNull();
  });

  it('RESET during a run asks first, then leaveRun resets the panel and leaves nothing open', async () => {
    const r = await started();
    r.session.clock.value?.advance(1234);
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');

    r.session.resetPanel();
    expect(r.session.confirm.value).toBe('reset');
    expect(r.session.screen.value).toBe('running');
    expect(r.bridge.store.events()).toHaveLength(2);
    r.session.keepGoing();
    expect(r.session.screen.value).toBe('running');

    r.session.resetPanel();
    await r.session.leaveRun();
    expectOriginalPanel(r);
  });

  it('leaveRun does nothing without a pending confirm or outside a run', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    await r.session.leaveRun();
    expect(r.session.screen.value).toBe('running');
    expect(r.bridge.store.events()).toHaveLength(1);

    const free = rig();
    await free.session.leaveRun();
    expect(free.session.screen.value).toBe('free');
  });

  it('keepGoing and the confirm do nothing in the debrief', async () => {
    const r = await started();
    r.session.complete();
    await r.session.newSituation();
    expect(r.session.confirm.value).toBeNull();
    expect(r.session.screen.value).toBe('debrief');
  });
});

describe('load failure, retry and dismiss (U-16, U-18)', () => {
  it('retryLoad repeats a random pick and succeeds once the loader works', async () => {
    const files: Record<string, string | Error> = { 'eng-oil-temp-green': new Error('offline') };
    const r = rig({ files });
    await r.session.newSituation();
    expect(r.session.loadFailure.value?.reason).toBe('load-failed');
    expect(r.session.screen.value).toBe('free');

    files['eng-oil-temp-green'] = BLUEPRINT;
    await r.session.retryLoad();

    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');
  });

  it('retryLoad repeats the same chosen entry, not a random one', async () => {
    const files: Record<string, string | Error> = {
      'eng-oil-temp-green': BLUEPRINT,
      'eng-oil-temp-copy': new Error('offline'),
    };
    const r = rig({ manifest: MANIFEST_TWO, files, rng: () => 0 });
    await r.session.openChooser();
    await r.session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-copy' });
    expect(r.session.loadFailure.value?.reason).toBe('load-failed');
    expect(r.session.screen.value).toBe('choosing');

    files['eng-oil-temp-copy'] = COPY;
    await r.session.retryLoad();

    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
  });

  it('retryLoad that fails again keeps the failure', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': new Error('offline') } });
    await r.session.newSituation();
    await r.session.retryLoad();
    expect(r.session.loadFailure.value?.reason).toBe('load-failed');
    expect(r.session.screen.value).toBe('free');
    expect(r.session.busy.value).toBe(false);
  });

  it('dismissFailure returns to free, also from the list', async () => {
    const files: Record<string, string | Error> = {
      'eng-oil-temp-green': BLUEPRINT,
      'eng-oil-temp-copy': new Error('offline'),
    };
    const r = rig({ manifest: MANIFEST_TWO, files });
    await r.session.openChooser();
    await r.session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-copy' });
    r.session.dismissFailure();
    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.choices.value).toEqual([]);
    // Nothing to retry any more.
    await r.session.retryLoad();
    expect(r.session.screen.value).toBe('free');
  });

  it('an empty listing sets empty for NEW SITUATION and CHOOSE SITUATION, never an empty list', async () => {
    const policy: AccessPolicy = { canAccess: () => false };
    const a = rig({ policy });
    await a.session.newSituation();
    expect(a.session.empty.value).toBe(true);
    expect(a.session.screen.value).toBe('free');
    const b = rig({ policy });
    await b.session.openChooser();
    expect(b.session.empty.value).toBe(true);
    expect(b.session.screen.value).toBe('free');
    expect(b.session.choices.value).toEqual([]);
  });

  it('a second NEW SITUATION while busy is ignored and busyKey names the first button', async () => {
    const r = rig();
    const first = r.session.newSituation();
    expect(r.session.busyKey.value).toBe('session.new');
    await r.session.openChooser();
    expect(r.session.busyKey.value).toBe('session.new');
    await first;
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.busyKey.value).toBeNull();
  });
});

describe('choose list paging (Phase 5.1, P-06)', () => {
  /** A manifest of nine scenarios (the first page is full, the third holds one). */
  const NINE = Array.from({ length: 9 }, (_, i) => `s${String(i + 1)}`);
  const MANIFEST_NINE = `format: 1
title: Engine
free: true
scenarios[${String(NINE.length)}]:
${NINE.map((id) => `  - id: ${id}\n    title: SITUATION ${id}\n    file: ${id}`).join('\n')}
`;
  const nineRig = (): Rig =>
    rig({
      manifest: MANIFEST_NINE,
      files: Object.fromEntries(
        NINE.map((id) => [id, BLUEPRINT.replace('id: eng-oil-temp-green', `id: ${id}`)]),
      ),
    });
  const rows = SESSION_LAYOUT.choose.maxRows;
  // A scenario the catalog does not know stands in the last group, which is the group these cases use.
  const onPage = (r: Rig): string[] =>
    pageSlice(r.session.groupChoices.value, r.session.choosePage.value).map((c) => c.scenario);

  it('lists every situation on exactly one page and at most maxRows on a page', async () => {
    const r = nineRig();
    await r.session.openChooser();
    expect(r.session.choices.value.map((c) => c.scenario)).toEqual(NINE);
    expect(pageCount(NINE.length)).toBe(Math.ceil(NINE.length / rows));
    const seen: string[] = [];
    for (let page = 0; page < pageCount(NINE.length); page++) {
      expect(r.session.choosePage.value).toBe(page);
      const listed = onPage(r);
      expect(listed.length).toBeGreaterThan(0);
      expect(listed.length).toBeLessThanOrEqual(rows);
      seen.push(...listed);
      r.session.nextPage();
    }
    expect(seen).toEqual(NINE);
  });

  it('nextPage wraps from the last page to the first', async () => {
    const r = nineRig();
    await r.session.openChooser();
    const pages = pageCount(NINE.length);
    for (let i = 0; i < pages; i++) r.session.nextPage();
    expect(r.session.choosePage.value).toBe(0);
    expect(onPage(r)).toEqual(NINE.slice(0, rows));
  });

  it('starts on the first page whenever the chooser opens', async () => {
    const r = nineRig();
    await r.session.openChooser();
    r.session.nextPage();
    expect(r.session.choosePage.value).toBe(1);
    r.session.closeChooser();
    expect(r.session.choosePage.value).toBe(0);
    await r.session.openChooser();
    expect(r.session.choosePage.value).toBe(0);
    r.session.nextPage();
    r.session.resetPanel();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.choosePage.value).toBe(0);
  });

  it('a row of a later page opens its briefing', async () => {
    const r = nineRig();
    await r.session.openChooser();
    r.session.nextPage();
    const choice = pageSlice(r.session.groupChoices.value, r.session.choosePage.value)[0];
    expect(choice?.scenario).toBe(NINE[rows]);
    if (choice !== undefined) await r.session.chooseScenario(choice);
    expect(r.session.screen.value).toBe('briefing');
  });

  it('nextPage does nothing outside the choose view, and one page stays one page', async () => {
    const r = rig({ manifest: MANIFEST_TWO });
    r.session.nextPage();
    expect(r.session.choosePage.value).toBe(0);
    await r.session.openChooser();
    expect(pageCount(r.session.groupChoices.value.length)).toBe(1);
    r.session.nextPage();
    expect(r.session.choosePage.value).toBe(0);
  });

  it('counts at least one page for no situation and pages every count (T-05.1-02)', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(rows)).toBe(1);
    expect(pageCount(rows + 1)).toBe(2);
    expect(pageSlice([], 0)).toEqual([]);
    expect(pageSlice([1, 2, 3], 5)).toEqual([]);
  });
});

describe('choose tabs (plan 07-06, R-16, R-18)', () => {
  const textOf = (id: string): string => BLUEPRINT.replace('id: eng-oil-temp-green', `id: ${id}`);
  const manifest = (title: string, ids: readonly string[]): string =>
    `format: 1
title: ${title}
free: true
scenarios[${String(ids.length)}]:
${ids.map((id) => `  - id: ${id}\n    title: ${id.slice(0, 18)}\n    file: ${id}`).join('\n')}
`;
  // Known to the catalog: ENG OIL TEMP (warnings), ALTN 1 FAIL (cautions), ENGINE FIRE IN FLIGHT
  // (emergency). The three stray ones are not in the catalog and stand in the last group.
  const STRAYS = ['stray-a', 'stray-b', 'stray-c'];
  const MANIFESTS = {
    '/scenarios/engine/pack.toon': manifest('Engine', [
      'eng-oil-temp-green',
      'eng-fire-in-flight',
      ...STRAYS,
    ]),
    '/scenarios/electrical/pack.toon': manifest('Electrical', ['elec-altn1-fail']),
  };
  const files: [string, string][] = [
    ['engine', 'eng-oil-temp-green'],
    ['engine', 'eng-fire-in-flight'],
    ...STRAYS.map((id): [string, string] => ['engine', id]),
    ['electrical', 'elec-altn1-fail'],
  ];
  function tabRig(policy: AccessPolicy = OPEN_ACCESS): Rig {
    const loaders: Record<string, () => Promise<string>> = {};
    for (const [pack, id] of files) {
      loaders[`/scenarios/${pack}/${id}.toon`] = () => Promise.resolve(textOf(id));
    }
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    const session = createSession({
      bridge,
      packs: { provider: createPackProvider({ manifests: MANIFESTS, loaders }), policy },
      env: DA50RG_ENV,
      rng: () => 0,
      onRunStart: () => undefined,
    });
    return { session, bridge, onRunStart: vi.fn(), loads: [], setListBroken: () => undefined };
  }
  const groupIds = DA50RG_ENV.catalog.groups.map((g) => g.id);
  const scenariosOf = (r: Rig): string[] => r.session.groupChoices.value.map((c) => c.scenario);

  it('lists the choices in the catalog order, unknown scenarios last', async () => {
    const r = tabRig();
    await r.session.openChooser();
    expect(r.session.choices.value.map((c) => c.scenario)).toEqual([
      'eng-oil-temp-green',
      'elec-altn1-fail',
      'eng-fire-in-flight',
      ...STRAYS,
    ]);
  });

  it('opens on the first group that has a situation and shows only that group', async () => {
    const r = tabRig();
    await r.session.openChooser();
    expect(r.session.chooseGroup.value).toBe(groupIds[0]);
    expect(scenariosOf(r)).toEqual(['eng-oil-temp-green']);
    // Without the engine pack the first group is empty, so the cautions open.
    const cautions = tabRig({ canAccess: (pack) => pack !== 'engine' });
    await cautions.session.openChooser();
    expect(cautions.session.chooseGroup.value).toBe(groupIds[1]);
    expect(scenariosOf(cautions)).toEqual(['elec-altn1-fail']);
  });

  it('puts every choice in exactly one group, a scenario the catalog does not know in the last', async () => {
    const r = tabRig();
    await r.session.openChooser();
    const seen: string[] = [];
    for (const id of groupIds) {
      r.session.chooseTab(id);
      expect(r.session.chooseGroup.value).toBe(id);
      seen.push(...scenariosOf(r));
    }
    expect([...seen].sort()).toEqual(r.session.choices.value.map((c) => c.scenario).sort());
    r.session.chooseTab(groupIds[groupIds.length - 1] ?? '');
    expect(scenariosOf(r)).toEqual(['eng-fire-in-flight', ...STRAYS]);
  });

  it('a tab change shows page 1; an unknown id and a press outside the list do nothing', async () => {
    const r = tabRig();
    r.session.chooseTab(groupIds[1] ?? '');
    expect(r.session.chooseGroup.value).toBe(groupIds[0]);
    await r.session.openChooser();
    r.session.chooseTab(groupIds[groupIds.length - 1] ?? '');
    r.session.nextPage();
    expect(r.session.choosePage.value).toBe(1);
    r.session.chooseTab(groupIds[1] ?? '');
    expect(r.session.choosePage.value).toBe(0);
    r.session.chooseTab('no-such-group');
    expect(r.session.chooseGroup.value).toBe(groupIds[1]);
  });

  it('NEXT PAGE wraps inside the selected group, and a group of one page stays on it', async () => {
    const r = tabRig();
    await r.session.openChooser();
    const rows = SESSION_LAYOUT.choose.maxRows;
    r.session.chooseTab(groupIds[groupIds.length - 1] ?? '');
    const total = scenariosOf(r).length;
    expect(total).toBeGreaterThan(rows);
    const pages = pageCount(total);
    const seen: string[] = [];
    for (let page = 0; page < pages; page++) {
      expect(r.session.choosePage.value).toBe(page);
      seen.push(...pageSlice(r.session.groupChoices.value, page).map((c) => c.scenario));
      r.session.nextPage();
    }
    expect(r.session.choosePage.value).toBe(0);
    expect(seen).toEqual(scenariosOf(r));
    r.session.chooseTab(groupIds[0] ?? '');
    r.session.nextPage();
    expect(r.session.choosePage.value).toBe(0);
  });

  it('resets the tab where the chooser closes, the panel resets and a run starts', async () => {
    const last = groupIds[groupIds.length - 1] ?? '';
    const r = tabRig();
    await r.session.openChooser();
    r.session.chooseTab(last);
    r.session.closeChooser();
    expect(r.session.chooseGroup.value).toBe(groupIds[0]);

    await r.session.openChooser();
    r.session.chooseTab(last);
    r.session.resetPanel();
    expect(r.session.chooseGroup.value).toBe(groupIds[0]);

    await r.session.openChooser();
    r.session.chooseTab(last);
    await r.session.chooseScenario({ pack: 'engine', scenario: 'eng-fire-in-flight' });
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.chooseGroup.value).toBe(groupIds[0]);
    expect(r.session.choosePage.value).toBe(0);
  });

  it('the pad has as many tab rectangles as the catalog has groups, and one tab label each', () => {
    expect(SESSION_LAYOUT.choose.tabs).toHaveLength(CATALOG_REFERENCE.length);
    expect(DA50RG_ENV.catalog.groups.map((g) => g.tab)).toEqual(
      CATALOG_REFERENCE.map((g) => g.tab),
    );
  });
});

describe('complete', () => {
  it('grades golden-like actuations as pass', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    r.session.toggleDecision('conduct_precautionary');
    r.session.complete();

    expect(r.session.screen.value).toBe('debrief');
    const result = r.session.result.value;
    expect(result?.result).toBe('pass');
    expect(result?.steps.map((s) => [s.id, s.credited])).toEqual([
      ['reduce_power', true],
      ['open_cowl_flap', true],
    ]);
  });

  it('grades an empty log as fail with two critical steps missed', async () => {
    const r = await started();
    r.session.complete();
    const result = r.session.result.value;
    expect(result?.result).toBe('fail');
    // The shipped file also asks for the flight decision (Phase 7): an empty run never switched from
    // the preselected Continue to destination, which this file does not accept.
    expect(result?.reasons).toEqual([
      { kind: 'critical_missed', count: 2 },
      { kind: 'conduct', status: 'wrong' },
    ]);
  });

  it('hands grade plain records stamped by the run clock, and pauses that clock', async () => {
    const r = await started();
    const clock = r.session.clock.value;
    if (clock === null) throw new Error('no clock');
    clock.advance(1500);
    r.bridge.actuate('lv.power', 'p50');
    clock.advance(500);
    r.bridge.actuate('lv.cowl_flap', 'open');
    r.session.complete();

    const expected: Recording = {
      scenarioId: 'eng-oil-temp-green',
      completedAt: 2000,
      events: [
        { t: 1500, id: 'lv.power', value: 'p50' },
        { t: 2000, id: 'lv.cowl_flap', value: 'open' },
      ],
    };
    const scenario = r.session.scenario.value;
    if (scenario === null) throw new Error('no scenario');
    expect(r.session.result.value).toEqual(grade(scenario, DA50RG_ENV, expected));
    expect(clock.paused).toBe(true);
    clock.advance(1000);
    expect(clock.now()).toBe(2000);
  });

  it('stamps a harmful action with the virtual time of its event', async () => {
    const r = await started();
    r.session.clock.value?.advance(3000);
    r.bridge.actuate('lv.power', 'p80');
    r.session.complete();
    expect(r.session.result.value?.harmful.map((h) => [h.id, h.t])).toEqual([
      ['power_increased', 3000],
    ]);
  });

  it('restores performance.now as the time source after the run', async () => {
    const r = await started();
    r.session.clock.value?.advance(9_000_000_000);
    r.session.complete();
    r.bridge.actuate('lv.flaps', 'to');
    const t = r.bridge.store.events().at(-1)?.t ?? 0;
    expect(t).not.toBe(9_000_000_000);
  });

  it('credits the resulting state: a retracted actuation is absent from the graded recording (D-13)', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    const cowl = r.bridge.actuate('lv.cowl_flap', 'open');
    if (!cowl.ok) throw new Error('cowl flap rejected');
    expect(r.bridge.retract(cowl.event.seq).ok).toBe(true);
    r.session.complete();

    const result = r.session.result.value;
    expect(result?.result).toBe('fail');
    expect(result?.steps.map((s) => [s.id, s.credited])).toEqual([
      ['reduce_power', true],
      ['open_cowl_flap', false],
    ]);
  });

  it('a retracted harmful action does not count', async () => {
    const r = await started();
    const raised = r.bridge.actuate('lv.power', 'p80');
    if (!raised.ok) throw new Error('power rejected');
    r.bridge.retract(raised.event.seq);
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    r.session.toggleDecision('conduct_precautionary');
    r.session.complete();
    expect(r.session.result.value?.harmful).toEqual([]);
    expect(r.session.result.value?.result).toBe('pass');
  });

  it('does nothing outside a run', async () => {
    const r = rig();
    r.session.complete();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.result.value).toBeNull();
    await r.session.newSituation();
    r.session.complete();
    expect(r.session.screen.value).toBe('briefing');
    r.session.startRun();
    r.session.complete();
    const graded = r.session.result.value;
    r.session.complete();
    expect(r.session.result.value).toBe(graded);
    expect(r.session.screen.value).toBe('debrief');
  });
});

describe('closeDebrief', () => {
  it('returns to free and keeps the control state and the quantities of the end state (U-10)', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    r.session.complete();
    const graded = r.session.result.value;

    r.session.closeDebrief();

    expect(r.session.screen.value).toBe('free');
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
    expect(r.bridge.stateOf('lv.cowl_flap').value).toBe('open');
    expect(r.bridge.quantities.value['oil_temp_c']).toBe(128);
    expect(r.bridge.store.events()).toHaveLength(2);
    expect(r.session.result.value).toBe(graded);
    expect(r.session.clock.value).toBeNull();
  });

  it('does nothing outside the debrief', async () => {
    const r = await started();
    r.session.closeDebrief();
    expect(r.session.screen.value).toBe('running');
    const free = rig();
    free.session.closeDebrief();
    expect(free.session.screen.value).toBe('free');
  });

  it('the next run starts from the baseline again with a fresh clock and no result', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.session.complete();
    r.session.closeDebrief();

    await r.session.newSituation();
    r.session.startRun();

    expect(r.session.screen.value).toBe('running');
    expect(r.session.result.value).toBeNull();
    expect(r.bridge.stateOf('lv.power').value).toBe('p75');
    expect(r.bridge.store.events()).toEqual([]);
    expect(r.session.clock.value?.now()).toBe(0);
    expect(r.onRunStart).toHaveBeenCalledTimes(2);
  });
});

describe('level (phase 02.1)', () => {
  it('is asked first: levelPicked is false on every opened briefing until setLevel', async () => {
    const r = rig();
    expect(r.session.levelPicked.value).toBe(false);
    await r.session.newSituation();
    expect(r.session.levelPicked.value).toBe(false);
    r.session.setLevel('easy');
    expect(r.session.levelPicked.value).toBe(true);
    r.session.backToPanel();
    await r.session.newSituation();
    expect(r.session.levelPicked.value).toBe(false);
  });

  it('is easy at creation', () => {
    expect(rig().session.level.value).toBe('easy');
  });

  it('is set in the briefing and survives startRun, complete and closeDebrief and the next briefing', async () => {
    const r = rig();
    await r.session.newSituation();
    r.session.setLevel('medium');
    expect(r.session.level.value).toBe('medium');
    r.session.startRun();
    expect(r.session.level.value).toBe('medium');
    r.bridge.actuate('lv.power', 'p50');
    r.session.complete();
    expect(r.session.level.value).toBe('medium');
    r.session.closeDebrief();
    expect(r.session.level.value).toBe('medium');

    await r.session.newSituation();
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.level.value).toBe('medium');
    r.session.setLevel('easy');
    expect(r.session.level.value).toBe('easy');
  });

  it('does nothing on free, choosing, running and debrief', async () => {
    const r = rig({
      manifest: MANIFEST_TWO,
      files: { 'eng-oil-temp-green': BLUEPRINT, 'eng-oil-temp-copy': COPY },
    });
    r.session.setLevel('medium');
    expect(r.session.screen.value).toBe('free');
    expect(r.session.level.value).toBe('easy');

    await r.session.openChooser();
    expect(r.session.screen.value).toBe('choosing');
    r.session.setLevel('medium');
    expect(r.session.level.value).toBe('easy');

    await r.session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-green' });
    expect(r.session.screen.value).toBe('briefing');
    r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    r.session.setLevel('medium');
    expect(r.session.level.value).toBe('easy');

    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
    r.session.setLevel('medium');
    expect(r.session.level.value).toBe('easy');
  });

  it('grading ignores the level: the same actuations give deep-equal results', async () => {
    const results = [];
    for (const level of ['easy', 'medium'] as const) {
      const r = rig();
      await r.session.newSituation();
      r.session.setLevel(level);
      r.session.startRun();
      r.bridge.actuate('lv.power', 'p100');
      r.bridge.actuate('lv.power', 'p50');
      r.bridge.actuate('lv.cowl_flap', 'open');
      r.session.complete();
      results.push(r.session.result.value);
    }
    expect(results[0]).not.toBeNull();
    expect(results[0]).toEqual(results[1]);
  });
});

describe('run (phase 03)', () => {
  const runOf = (r: Rig) => {
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    return run;
  };

  it('startRun creates a run at the scenario quantities, mirrored by the bridge', async () => {
    const free = rig();
    expect(free.session.run.value).toBeNull();

    const r = await started();
    const run = runOf(r);
    const expected = {
      ...DA50RG_QUANTITIES.baseValues(),
      altitude_ft: 4500,
      oil_temp_c: 128,
      oil_pressure_bar: 4.16,
    };
    expect(run.state.t).toBe(0);
    expect(run.state.quantities).toEqual(expected);
    expect(r.bridge.quantities.value).toEqual(expected);
    expect(run.clock).toBe(r.session.clock.value);
  });

  it('50 steps move the oil temperature, the bridge follows every step, the clock reads 5000', async () => {
    const r = await started();
    const run = runOf(r);
    const first = r.bridge.quantities.value['oil_temp_c'];
    for (let i = 0; i < 50; i++) {
      run.step();
      expect(r.bridge.quantities.value, `step ${String(i + 1)}`).toEqual(run.state.quantities);
    }
    expect(run.clock.now()).toBe(5000);
    expect(r.session.clock.value?.now()).toBe(5000);
    expect(run.state.quantities['oil_temp_c']).not.toBe(first);
    // The pressure follows the oil temperature, which moves a little in 5 s: it stays near the start value.
    expect(run.state.quantities['oil_pressure_bar']).toBeCloseTo(4.16, 1);
  });

  it('an actuation at clock time T is in the run controls only after the next step', async () => {
    const r = await started();
    const run = runOf(r);
    run.step();
    r.bridge.actuate('lv.power', 'p50');
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
    expect(run.state.controls['lv.power']).toBe('p75');
    run.step();
    expect(run.state.controls['lv.power']).toBe('p50');
  });

  it('after complete a further step changes nothing; closeDebrief sets run to null', async () => {
    const r = await started();
    const run = runOf(r);
    run.step();
    run.step();
    r.session.complete();
    const frozen = run.state;
    const shown = r.bridge.quantities.value;
    run.step();
    expect(run.state).toBe(frozen);
    expect(r.bridge.quantities.value).toBe(shown);
    expect(run.clock.now()).toBe(200);
    expect(r.session.run.value).toBe(run);

    r.session.closeDebrief();
    expect(r.session.run.value).toBeNull();
    // The end state of the run stays on the panel (C-04).
    expect(r.bridge.quantities.value).toBe(shown);
  });

  it('leaveRun sets run to null and a disposed run no longer feeds the bridge', async () => {
    const r = await started();
    const run = runOf(r);
    run.step();
    await r.session.newSituation();
    await r.session.leaveRun();
    expect(r.session.run.value).toBeNull();
    expect(r.bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
    run.step();
    expect(r.bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
  });

  it('the next run starts a fresh run from the scenario quantities', async () => {
    const r = await started();
    const old = runOf(r);
    for (let i = 0; i < 20; i++) old.step();
    r.session.complete();
    r.session.closeDebrief();
    await r.session.newSituation();
    r.session.startRun();
    const next = runOf(r);
    expect(next).not.toBe(old);
    expect(next.state.t).toBe(0);
    expect(r.bridge.quantities.value['oil_temp_c']).toBe(128);
  });

  /** MAX pressed with the mode on HIGH, then two steps so the reaction has started. */
  const startMaxRun = (r: Rig) => {
    const run = runOf(r);
    run.step();
    r.bridge.actuate('sw.deice_mode', 'high');
    run.step();
    r.bridge.actuate('btn.deice_max', 'pressed');
    run.step();
    return run;
  };

  it('every run step pushes the flags to the bridge and the top de-ice lamp follows (C-23)', async () => {
    const r = await started();
    expect(r.bridge.flags.value).toEqual({});
    const run = startMaxRun(r);
    expect(run.state.flags[DEICE_MAX_ACTIVE]).toBe(true);
    expect(r.bridge.flags.value).toEqual(run.state.flags);
    expect(r.bridge.indicatorOf('lt.deice_max').value).toBe(true);

    r.bridge.actuate('sw.deice_mode', 'norm');
    run.step();
    expect(r.bridge.flags.value).toEqual({});
    expect(r.bridge.indicatorOf('lt.deice_max').value).toBe(false);
  });

  it('closeDebrief clears the flags and keeps the quantities as the run left them', async () => {
    const r = await started();
    const run = startMaxRun(r);
    r.session.complete();
    // A paused run keeps its lamp until the debrief closes.
    expect(r.bridge.indicatorOf('lt.deice_max').value).toBe(true);
    const quantities = r.bridge.quantities.value;

    r.session.closeDebrief();

    expect(r.bridge.flags.value).toEqual({});
    expect(r.bridge.indicatorOf('lt.deice_max').value).toBe(false);
    expect(r.bridge.quantities.value).toBe(quantities);
    expect(run.state.flags[DEICE_MAX_ACTIVE]).toBe(true);
  });

  it('leaveRun empties the flags through the reset', async () => {
    const r = await started();
    startMaxRun(r);
    expect(r.bridge.flags.value[DEICE_MAX_ACTIVE]).toBe(true);
    await r.session.newSituation();
    await r.session.leaveRun();
    expect(r.bridge.flags.value).toEqual({});
    expect(r.bridge.indicatorOf('lt.deice_max').value).toBe(false);
  });

  it('the next run starts with empty flags even when the last one ended mid reaction', async () => {
    const r = await started();
    startMaxRun(r);
    r.session.complete();
    r.session.closeDebrief();
    await r.session.newSituation();
    r.session.startRun();
    expect(r.bridge.flags.value).toEqual({});
    expect(runOf(r).state.flags).toEqual({});
  });

  it('an ignored run escalates (phase 03): it ends by itself as FAIL with the outcome first', async () => {
    const parsed = parseScenario(BLUEPRINT);
    if (!parsed.ok) throw new Error('the blueprint does not parse');
    const declared = parsed.value.outcomes[0];
    if (declared === undefined) throw new Error('the blueprint declares no outcome');

    const r = await started();
    const run = runOf(r);
    for (let i = 0; i < MAX_RUN_MS / STEP_MS && r.session.screen.value === 'running'; i++) {
      run.step();
    }

    expect(r.session.screen.value).toBe('debrief');
    const result = r.session.result.value;
    expect(result?.result).toBe('fail');
    expect(result?.reasons[0]).toEqual({ kind: 'outcome', id: declared.id });
    expect(result?.outcome).toEqual({ id: declared.id, text: declared.text, t: run.clock.now() });
    expect(run.state.outcome).toEqual({ id: declared.id, t: run.clock.now() });
    if (result === null || result === undefined) throw new Error('no result');
    expect(reasonLines(result)[0]).toContain(declared.text);
    // The run is over: a further step changes nothing.
    const frozen = run.state;
    run.step();
    expect(run.state).toBe(frozen);
  });
});

describe('realistic level (phase 03, D-05)', () => {
  const parsed = parseScenario(BLUEPRINT);
  if (!parsed.ok) throw new Error('the blueprint does not parse');
  const blueprint = parsed.value;
  const window = blueprint.onset?.window_s;
  if (window === undefined) throw new Error('the blueprint declares no onset');
  const NO_ONSET = BLUEPRINT.replace(/\n#[^\n]*\nonset:\n[\s\S]*$/, '\n');
  if (NO_ONSET === BLUEPRINT) throw new Error('the onset block of the blueprint was not found');

  /** An rng that returns the given values in turn, then 0; the first is consumed by the random pick. */
  const sequence = (values: readonly number[]): (() => number) => {
    let next = 0;
    return () => values[next++] ?? 0;
  };
  const SEED_DRAW = 0.75;
  const SEED = Math.floor(SEED_DRAW * 4_294_967_296);

  async function realistic(rng: () => number = sequence([0.5, SEED_DRAW])): Promise<Rig> {
    const r = rig({ rng });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('briefing');
    r.session.setLevel('realistic');
    return r;
  }

  const runOf = (r: Rig) => {
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    return run;
  };

  it('starts the run at once: running, no briefing, level Realistic', async () => {
    const r = await realistic();
    expect(r.session.screen.value).toBe('running');
    expect(r.session.briefing.value).toBeNull();
    expect(r.session.level.value).toBe('realistic');
    expect(r.session.levelPicked.value).toBe(true);
    expect(r.session.scenario.value?.id).toBe(blueprint.id);
    expect(r.onRunStart).toHaveBeenCalledTimes(1);
  });

  it('draws the seed from the injected rng and records the onset the seed gives', async () => {
    const r = await realistic();
    const onset = r.session.onset.value;
    expect(onset).toEqual({ seed: SEED, at: onsetFromSeed(SEED, window) });
    expect(onset?.at).toBeGreaterThanOrEqual(window[0] * 1000);
    expect(onset?.at).toBeLessThanOrEqual(window[1] * 1000);
    // The same draw gives the same onset; another draw usually another one.
    const again = await realistic(sequence([0.5, SEED_DRAW]));
    expect(again.session.onset.value).toEqual(onset);
    const other = await realistic(sequence([0.5, 0.1]));
    expect(other.session.onset.value?.seed).toBe(Math.floor(0.1 * 4_294_967_296));
  });

  it('starts in the Realistic setup: start quantities, initial controls, an empty log, no message', async () => {
    const r = await realistic();
    // C-61: the base values laid over by the scenario's onset quantities, not its initial ones.
    expect(r.bridge.quantities.value).toEqual({
      ...DA50RG_QUANTITIES.baseValues(),
      ...blueprint.onset?.quantities,
    });
    expect(r.bridge.cas.value).toEqual([]);
    expect(r.bridge.store.events()).toEqual([]);
    expect(r.bridge.stateOf('lv.power').value).toBe('p75');
    expect(r.bridge.stateOf('lv.cowl_flap').value).toBe('closed');
  });

  it('the failure begins by itself after the onset and not before', async () => {
    const r = await realistic();
    const onset = r.session.onset.value;
    if (onset === null) throw new Error('no onset');
    const run = runOf(r);
    while (run.clock.now() <= onset.at) {
      expect(r.bridge.cas.value, `t ${String(run.clock.now())}`).toEqual([]);
      run.step();
    }
    let shown = false;
    for (let i = 0; i < 6000 && r.session.screen.value === 'running' && !shown; i++) {
      run.step();
      shown = r.bridge.cas.value.some((m) => m.text === 'ENG OIL TEMP');
    }
    expect(shown).toBe(true);
  });

  it('the result of complete equals grade of the kept recording, which carries the onset', async () => {
    const r = await realistic();
    const run = runOf(r);
    for (let i = 0; i < 50; i++) run.step();
    r.bridge.actuate('lv.power', 'p60');
    r.session.complete();
    const recording = r.session.recording.value;
    if (recording === null) throw new Error('no recording');
    expect(recording.onset).toEqual(r.session.onset.value);
    expect(r.session.result.value).toEqual(grade(blueprint, DA50RG_ENV, recording));
    expect(r.session.result.value?.timing.onsetAt).toBe(recording.onset?.at);
  });

  it('an ignored realistic run escalates later than the onset and replays identically', async () => {
    const r = await realistic();
    const onset = r.session.onset.value;
    if (onset === null) throw new Error('no onset');
    const run = runOf(r);
    for (let i = 0; i < MAX_RUN_MS / STEP_MS && r.session.screen.value === 'running'; i++) {
      run.step();
    }
    expect(r.session.screen.value).toBe('debrief');
    const result = r.session.result.value;
    expect(result?.result).toBe('fail');
    expect(result?.timing).toEqual({ onsetAt: onset.at, firstActionMs: null });
    const replayed = simulate(simSetup(DA50RG_ENV, blueprint, { onsetAt: onset.at }), {
      events: [],
      start: realisticQuantities(blueprint, DA50RG_ENV.quantities),
      untilMs: MAX_RUN_MS,
    }).state;
    expect(result?.outcome?.t).toBe(replayed.outcome?.t);
    expect(run.state).toEqual(replayed);
  });

  it('Easy and Medium keep the failure from the start: no onset, the scenario quantities, no onset in the recording', async () => {
    for (const level of ['easy', 'medium'] as const) {
      const r = rig();
      await r.session.newSituation();
      r.session.setLevel(level);
      expect(r.session.screen.value).toBe('briefing');
      r.session.startRun();
      expect(r.session.onset.value).toBeNull();
      expect(r.bridge.quantities.value['oil_temp_c']).toBe(128);
      r.session.complete();
      expect(r.session.recording.value).not.toBeNull();
      expect(r.session.recording.value).not.toHaveProperty('onset');
      expect(r.session.result.value?.timing.onsetAt).toBe(0);
    }
  });

  it('a scenario without an onset ignores Realistic', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': NO_ONSET } });
    await r.session.newSituation();
    expect(r.session.briefing.value?.scenario.onset).toBeUndefined();
    r.session.setLevel('realistic');
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.level.value).toBe('easy');
    expect(r.session.levelPicked.value).toBe(false);
    expect(r.session.onset.value).toBeNull();
  });

  it('does nothing outside the briefing, and leaving the run clears the onset', async () => {
    const r = rig();
    r.session.setLevel('realistic');
    expect(r.session.screen.value).toBe('free');
    expect(r.session.level.value).toBe('easy');

    const live = await realistic();
    live.session.setLevel('realistic');
    expect(live.session.onset.value).not.toBeNull();
    await live.session.newSituation();
    expect(live.session.confirm.value).toBe('new');
    await live.session.leaveRun();
    expect(live.session.onset.value).toBeNull();
    expect(live.session.recording.value).toBeNull();
  });

  it('the next run clears the recording and the onset of the last one', async () => {
    const r = await realistic();
    r.session.complete();
    expect(r.session.recording.value).not.toBeNull();
    r.session.closeDebrief();
    await r.session.newSituation();
    r.session.setLevel('easy');
    r.session.startRun();
    expect(r.session.recording.value).toBeNull();
    expect(r.session.onset.value).toBeNull();
  });
});

describe('variants (phase 3.1, V-05)', () => {
  const ALTN = readFileSync(join(root, 'scenarios/electrical/elec-altn1-fail.toon'), 'utf8');
  const parsed = parseScenario(ALTN);
  if (!parsed.ok) throw new Error('the ALTN 1 FAIL file does not parse');
  const altn = parsed.value;
  const MANIFEST_ALTN = `format: 1
title: Electrical
free: true
scenarios[1]:
  - id: ${altn.id}
    title: ALTN 1 FAIL
    file: ${altn.id}
`;
  /** The first rng value whose seed draws the given variant. */
  const drawFor = (id: string): { readonly u: number; readonly seed: number } => {
    for (let seed = 0; seed < 1000; seed++) {
      if (variantFromSeed(seed, altn.variants) === id) return { u: seed / 4_294_967_296, seed };
    }
    throw new Error(`no seed draws ${id}`);
  };
  /** The random pick takes the first value; the variant draw takes the second. */
  const altnRig = (u: number): Rig =>
    rig({
      manifest: MANIFEST_ALTN,
      files: { [altn.id]: ALTN },
      rng: (() => {
        const values = [0, u];
        let next = 0;
        return () => values[next++] ?? 0;
      })(),
    });

  it('draws the cause by seed on Easy, starts in its state, records it and names it in the result', async () => {
    const { u, seed } = drawFor('breaker_popped');
    const r = altnRig(u);
    await r.session.newSituation();
    r.session.setLevel('easy');
    r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    expect(r.session.variant.value).toEqual({ id: 'breaker_popped', seed });
    // The session keeps the file's own scenario; the run used the one the cause made.
    expect(r.session.scenario.value?.variants).toHaveLength(altn.variants.length);
    expect(r.bridge.stateOf('cb.alt1').value).toBe('out');

    expect(r.bridge.actuate('cb.alt1', 'in').ok).toBe(true);
    r.session.toggleDecision('conduct_precautionary');
    r.session.complete();
    const recording = r.session.recording.value;
    expect(recording?.variant).toEqual({ id: 'breaker_popped', seed });
    expect(r.session.result.value?.variant).toBe('breaker_popped');
    expect(r.session.result.value?.result).toBe('pass');
    if (recording === null) throw new Error('no recording');
    expect(r.session.result.value).toEqual(grade(altn, DA50RG_ENV, recording));
  });

  it('the other cause starts with the breaker in and wants the pair', async () => {
    const { u, seed } = drawFor('alternator_dead');
    const r = altnRig(u);
    await r.session.newSituation();
    r.session.setLevel('easy');
    r.session.startRun();
    expect(r.session.variant.value).toEqual({ id: 'alternator_dead', seed });
    expect(r.bridge.stateOf('cb.alt1').value).toBe('in');
    r.bridge.actuate('sw.alternator_1', 'off');
    r.bridge.actuate('sw.ess_bus', 'on');
    r.session.toggleDecision('conduct_precautionary');
    r.session.complete();
    expect(r.session.result.value?.variant).toBe('alternator_dead');
    expect(r.session.result.value?.result).toBe('pass');
  });

  it('a scenario without variants draws none and its recording names none', async () => {
    const r = await started();
    expect(r.session.variant.value).toBeNull();
    r.session.complete();
    expect(r.session.recording.value).not.toHaveProperty('variant');
    expect(r.session.result.value).not.toHaveProperty('variant');
  });

  it('leaving the run clears the variant', async () => {
    const { u } = drawFor('breaker_popped');
    const r = altnRig(u);
    await r.session.newSituation();
    r.session.setLevel('easy');
    r.session.startRun();
    await r.session.newSituation();
    await r.session.leaveRun();
    expect(r.session.variant.value).toBeNull();
  });
});

describe('a failing step (WR-03, V-13)', () => {
  /** The real session with the real driver on a fake frame scheduler. */
  function driven(r: Rig) {
    let time = 0;
    let pending: (() => void) | null = null;
    attachClockDriver({
      session: r.session,
      raf: (callback) => {
        pending = callback;
        return 1;
      },
      cancelRaf: () => {
        pending = null;
      },
      now: () => time,
      hidden: () => false,
      blocked: () => false,
      onError: (error) => {
        r.session.failRun(error);
      },
    });
    return (dt: number) => {
      time += dt;
      const frame = pending;
      pending = null;
      frame?.();
    };
  }

  it('a throwing step listener ends the run without a grade, shows the error, and the next run steps', async () => {
    const r = await started();
    const frame = driven(r);
    const first = r.session.run.value;
    if (first === null) throw new Error('no run');
    first.onStep(() => {
      throw new Error('listener failed');
    });
    frame(100);
    expect(r.session.screen.value).toBe('free');
    expect(r.session.run.value).toBeNull();
    expect(r.session.result.value).toBeNull();
    expect(r.session.clock.value).toBeNull();
    const failed = r.session.loadFailure.value;
    expect(failed?.issues[0]?.path).toBe(RUN_ERROR_PATH);
    expect(failed?.issues[0]?.message).toBe('The run stopped because of an error: listener failed');
    expect(r.bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());

    r.session.dismissFailure();
    await r.session.newSituation();
    r.session.startRun();
    const next = r.session.run.value;
    expect(next).not.toBe(first);
    frame(300);
    expect(next?.clock.now()).toBe(300);
    expect(r.session.screen.value).toBe('running');
  });

  it('failRun with no run does nothing', () => {
    const r = rig();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    r.session.failRun(new Error('x'));
    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('free');
    logged.mockRestore();
  });
});

describe('the 30-minute cap (WR-05, V-14)', () => {
  it('stepping a started run to the cap opens the debrief by itself, graded as of the cap', async () => {
    // A blueprint without its outcome, so nothing but the cap can end the run.
    const calm = BLUEPRINT.replace(/outcomes\[1\]:\n(?: {2}.*\n)+/, 'outcomes[0]:\n');
    const r = await started({ files: { 'eng-oil-temp-green': calm } });
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    const steps = MAX_RUN_MS / STEP_MS;
    for (let i = 0; i < steps - 1; i++) run.step();
    expect(r.session.screen.value).toBe('running');
    run.step();
    expect(r.session.screen.value).toBe('debrief');
    const recording = r.session.recording.value;
    expect(recording?.completedAt).toBe(MAX_RUN_MS);
    const scenario = r.session.scenario.value;
    if (scenario === null || recording === null) throw new Error('no run result');
    expect(r.session.result.value).toEqual(grade(scenario, DA50RG_ENV, recording));
    run.step();
    expect(run.clock.now()).toBe(MAX_RUN_MS);
  });
});

describe('the finish of a landing situation (Phase 9, D-09)', () => {
  const FIXTURE = readFileSync(join(root, 'tests/fixtures/scenarios/landing-fixture.toon'), 'utf8');
  const WITHOUT = FIXTURE.replace(/# The run completes by itself[\s\S]*$/, '');
  if (WITHOUT === FIXTURE) throw new Error('the finish section of the fixture was not found');
  const MANIFEST = `format: 1
title: Landing
free: true
scenarios[1]:
  - id: landing-fixture
    title: LANDING FIXTURE
    file: landing-fixture
`;
  const landing = (text: string) =>
    started({ manifest: MANIFEST, files: { 'landing-fixture': text } });

  /** Steps the run until the debrief opens or `max` steps went by; returns the steps taken. */
  function stepToEnd(r: Rig, max = 3000): number {
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    let steps = 0;
    while (r.session.screen.value === 'running' && steps < max) {
      run.step();
      steps += 1;
    }
    return steps;
  }

  it('completes the run by itself in the first step in which the predicate holds', async () => {
    const r = await landing(FIXTURE);
    expect(r.session.endedByFinish.value).toBe(false);
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    const steps = stepToEnd(r);
    expect(r.session.screen.value).toBe('debrief');
    const finish = run.state.finish;
    expect(finish).not.toBeNull();
    expect(finish?.t).toBe(steps * STEP_MS);
    expect(r.session.recording.value?.completedAt).toBe(finish?.t);
    expect(r.session.endedByFinish.value).toBe(true);
    expect(r.session.result.value?.outcome).toBeNull();
    // Once, and nothing steps on.
    run.step();
    expect(r.session.screen.value).toBe('debrief');
    expect(run.clock.now()).toBe(finish?.t);
  });

  it('grades the finished run exactly like a press of Procedure complete at that time', async () => {
    const finished = await landing(FIXTURE);
    stepToEnd(finished);
    const finishedAt = finished.session.recording.value?.completedAt ?? -1;
    // The same situation without a finish, stepped as long and completed by a press.
    const pressed = await landing(WITHOUT);
    const run = pressed.session.run.value;
    if (run === null) throw new Error('no run');
    for (let i = 0; i < finishedAt / STEP_MS; i++) run.step();
    expect(pressed.session.screen.value).toBe('running');
    pressed.session.complete();
    expect(pressed.session.screen.value).toBe('debrief');
    expect(pressed.session.endedByFinish.value).toBe(false);
    expect(pressed.session.recording.value?.completedAt).toBe(finishedAt);
    expect(JSON.stringify(finished.session.result.value)).toBe(
      JSON.stringify(pressed.session.result.value),
    );
  });

  it('does not flag a press of Procedure complete before the field, on a file with a finish', async () => {
    const r = await landing(FIXTURE);
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    for (let i = 0; i < 50; i++) run.step();
    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
    expect(r.session.endedByFinish.value).toBe(false);
  });

  it('clears the flag with Back to panel and with Retry, and Retry runs to the field again', async () => {
    const r = await landing(FIXTURE);
    stepToEnd(r);
    expect(r.session.endedByFinish.value).toBe(true);
    r.session.closeDebrief();
    expect(r.session.endedByFinish.value).toBe(false);

    const again = await landing(FIXTURE);
    stepToEnd(again);
    expect(again.session.endedByFinish.value).toBe(true);
    again.session.retry();
    expect(again.session.screen.value).toBe('running');
    expect(again.session.endedByFinish.value).toBe(false);
    expect(stepToEnd(again)).toBeGreaterThan(0);
    expect(again.session.screen.value).toBe('debrief');
    expect(again.session.endedByFinish.value).toBe(true);
  });

  it('keeps an ordinary run unflagged: the 30 minute cap and a run without a finish', async () => {
    const r = await landing(WITHOUT);
    const run = r.session.run.value;
    if (run === null) throw new Error('no run');
    for (let i = 0; i < MAX_RUN_MS / STEP_MS; i++) run.step();
    expect(r.session.screen.value).toBe('debrief');
    expect(r.session.endedByFinish.value).toBe(false);
  });
});

function expectOriginalPanel(r: Rig): void {
  expect(r.session.screen.value).toBe('free');
  expect(r.session.confirm.value).toBeNull();
  expect(r.session.scenario.value).toBeNull();
  expect(r.session.briefing.value).toBeNull();
  expect(r.session.result.value).toBeNull();
  expect(r.session.recording.value).toBeNull();
  expect(r.session.clock.value).toBeNull();
  expect(r.session.run.value).toBeNull();
  expect(r.bridge.stateOf('lv.power').value).toBe('p70');
  expect(r.bridge.stateOf('lv.cowl_flap').value).toBe('closed');
  expect(r.bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
  expect(r.bridge.flags.value).toEqual({});
  expect(r.bridge.store.events()).toEqual([]);
}

describe('resetPanel (RESET button)', () => {
  it('on the free panel it resets at once, without a confirm', () => {
    const r = rig();
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    r.session.resetPanel();
    expectOriginalPanel(r);
  });

  it('from the briefing it closes the briefing and resets', async () => {
    const r = rig();
    r.bridge.actuate('lv.power', 'p50');
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('briefing');
    r.session.resetPanel();
    expectOriginalPanel(r);
  });

  it('from the choose list it closes the list', async () => {
    const r = rig();
    await r.session.openChooser();
    expect(r.session.screen.value).toBe('choosing');
    r.session.resetPanel();
    expectOriginalPanel(r);
    expect(r.session.choices.value).toEqual([]);
  });

  it('from the debrief it closes the debrief, clears the grade and resets', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
    expect(r.session.result.value).not.toBeNull();
    r.session.resetPanel();
    expectOriginalPanel(r);
  });

  it('is ignored while a load runs', async () => {
    const r = rig();
    r.bridge.actuate('lv.power', 'p50');
    const pending = r.session.newSituation();
    expect(r.session.busy.value).toBe(true);
    r.session.resetPanel();
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
    await pending;
  });
});

describe('level hints', () => {
  it('each level has its one short line (the level card prints them under the buttons)', () => {
    expect(LEVELS.map((level) => LEVEL_HINTS[level])).toEqual([
      'Checklist and panel steps shown in the briefing.',
      'Briefing without the checklist.',
      'No briefing. The failure starts by itself.',
    ]);
  });
});

describe('scene (phase 05, W-07 to W-09)', () => {
  const PARKED = BLUEPRINT.replace('scene: cruise', 'scene: parked');
  const NO_SCENE = BLUEPRINT.replace('scene: cruise\n', '');
  if (PARKED === BLUEPRINT || NO_SCENE === BLUEPRINT)
    throw new Error('the scene line was not found');

  it('is the aircraft default on the free panel, or the known id of the free-panel flag', () => {
    expect(rig().session.scene.value).toBe(DA50RG_ENV.scenes.default);
    expect(rig({ freeScene: 'takeoff_roll' }).session.scene.value).toBe('takeoff_roll');
    expect(rig({ freeScene: 'no_such_scene' }).session.scene.value).toBe(DA50RG_ENV.scenes.default);
  });

  it.each(['easy', 'medium', 'realistic'] as const)(
    'shows the scenario scene from the briefing until RESET on %s',
    async (level) => {
      const r = rig({ files: { 'eng-oil-temp-green': PARKED }, freeScene: 'takeoff_roll' });
      expect(r.session.scene.value).toBe('takeoff_roll');
      await r.session.newSituation();
      expect(r.session.screen.value).toBe('briefing');
      expect(r.session.scene.value).toBe('parked');
      r.session.setLevel(level);
      if (level !== 'realistic') r.session.startRun();
      expect(r.session.screen.value).toBe('running');
      expect(r.session.scene.value).toBe('parked');
      r.session.complete();
      expect(r.session.scene.value).toBe('parked');
      r.session.closeDebrief();
      expect(r.session.scene.value).toBe('parked');
      r.session.resetPanel();
      expect(r.session.screen.value).toBe('free');
      expect(r.session.scene.value).toBe('takeoff_roll');
    },
  );

  it('backing out of the briefing returns to the free-panel scene', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': PARKED } });
    await r.session.newSituation();
    expect(r.session.scene.value).toBe('parked');
    r.session.backToPanel();
    expect(r.session.scene.value).toBe(DA50RG_ENV.scenes.default);
  });

  it('a scenario without a scene shows the aircraft default, not the free-panel flag', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': NO_SCENE }, freeScene: 'takeoff_roll' });
    await r.session.newSituation();
    expect(r.session.scene.value).toBe(DA50RG_ENV.scenes.default);
  });

  it('the shipped scenarios all name a scene of the aircraft', () => {
    expect(DA50RG_ENV.scenes.has('cruise')).toBe(true);
    expect(BLUEPRINT).toContain('scene: cruise');
  });
});

describe('the checklist sheet and its live marks (phase 07, plan 04, R-02)', () => {
  const parsed = parseScenario(BLUEPRINT);
  if (!parsed.ok) throw new Error('the blueprint does not parse');
  const blueprint = parsed.value;
  const [first, second] = blueprint.procedure
    .flatMap((node) => (node.kind === 'decision' ? node.branches.flatMap((b) => b.nodes) : []))
    .flatMap((node) => (node.kind === 'group' ? node.steps : []));
  if (first === undefined || second === undefined)
    throw new Error('the blueprint has no two steps');

  /** A started run on the blueprint at the given level (Realistic starts at once). */
  async function running(
    level: 'easy' | 'medium',
    options: Parameters<typeof rig>[0] = {},
  ): Promise<Rig> {
    const r = rig(options);
    await r.session.newSituation();
    r.session.setLevel(level);
    r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    return r;
  }

  /** The ids the grade of the recording so far credits: the expectation, derived and never typed. */
  function creditedNow(r: Rig): string[] {
    const clock = r.session.clock.value;
    if (clock === null) throw new Error('no clock');
    const recording: Recording = {
      scenarioId: blueprint.id,
      completedAt: clock.now(),
      events: r.bridge.store
        .events()
        .filter((e) => e.source === 'user')
        .map((e) => ({ t: e.t, id: e.id, value: e.value })),
    };
    return grade(blueprint, DA50RG_ENV, recording)
      .steps.filter((step) => step.credited)
      .map((step) => step.id);
  }

  /** The ids the sheet marks Done, or null while it computes nothing. */
  const marked = (r: Rig): string[] | null =>
    r.session.checklistMarks.value?.steps.filter((step) => step.credited).map((step) => step.id) ??
    null;

  it('toggles on Easy and Medium, is hidden at the start and clears when the run ends', async () => {
    for (const level of ['easy', 'medium'] as const) {
      const r = await running(level);
      expect(r.session.checklistShown.value).toBe(false);
      expect(r.session.checklistMarks.value).toBeNull();
      r.session.toggleChecklist();
      expect(r.session.checklistShown.value).toBe(true);
      expect(r.session.checklistMarks.value).not.toBeNull();
      r.session.toggleChecklist();
      expect(r.session.checklistShown.value).toBe(false);
      expect(r.session.checklistMarks.value).toBeNull();
      r.session.toggleChecklist();
      r.session.complete();
      expect(r.session.checklistShown.value).toBe(false);
      expect(r.session.checklistMarks.value).toBeNull();
    }
  });

  it('does nothing outside a run', async () => {
    const r = rig();
    r.session.toggleChecklist();
    expect(r.session.checklistShown.value).toBe(false);
    await r.session.newSituation();
    r.session.toggleChecklist();
    expect(r.session.checklistShown.value).toBe(false);
    r.session.setLevel('easy');
    r.session.startRun();
    r.session.complete();
    r.session.toggleChecklist();
    expect(r.session.checklistShown.value).toBe(false);
    expect(r.session.checklistMarks.value).toBeNull();
  });

  it('marks exactly the ids the grade of the same recording credits, on Easy and on Medium', async () => {
    for (const level of ['easy', 'medium'] as const) {
      const r = await running(level);
      r.session.toggleChecklist();
      expect(marked(r)).toEqual(creditedNow(r));
      expect(marked(r)).toEqual([]);

      r.bridge.actuate('lv.power', 'p50');
      expect(marked(r)).toEqual(creditedNow(r));
      expect(marked(r)).toContain(first.id);
      expect(marked(r)).not.toContain(second.id);

      r.bridge.actuate('lv.cowl_flap', 'open');
      expect(marked(r)).toEqual(creditedNow(r));
      expect(marked(r)).toEqual(expect.arrayContaining([first.id, second.id]));
    }
  });

  it('takes a mark away when the event is retracted', async () => {
    const r = await running('easy');
    r.session.toggleChecklist();
    r.bridge.actuate('lv.power', 'p50');
    expect(marked(r)).toContain(first.id);
    const retracted = r.bridge.store.retract(r.bridge.store.events().length - 1);
    expect(retracted.ok).toBe(true);
    expect(marked(r)).toEqual(creditedNow(r));
    expect(marked(r)).not.toContain(first.id);
  });

  it('computes nothing while the sheet is hidden and catches up when it is shown', async () => {
    const r = await running('easy');
    r.bridge.actuate('lv.power', 'p50');
    expect(r.session.checklistMarks.value).toBeNull();
    r.session.toggleChecklist();
    expect(marked(r)).toContain(first.id);
    r.session.toggleChecklist();
    r.bridge.actuate('lv.cowl_flap', 'open');
    expect(r.session.checklistMarks.value).toBeNull();
    r.session.toggleChecklist();
    expect(marked(r)).toEqual(creditedNow(r));
    expect(marked(r)).toContain(second.id);
  });

  it('is cleared by leaving the run, a failed step, completing, Retry and closing the debrief', async () => {
    const shown = async (): Promise<Rig> => {
      const r = await running('easy');
      r.session.toggleChecklist();
      r.bridge.actuate('lv.power', 'p50');
      expect(marked(r)).toContain(first.id);
      return r;
    };

    const left = await shown();
    left.session.resetPanel();
    await left.session.leaveRun();
    expect(left.session.checklistShown.value).toBe(false);
    expect(left.session.checklistMarks.value).toBeNull();
    expect(left.session.runBranches.value).toEqual([]);

    const failed = await shown();
    failed.session.failRun(new Error('boom'));
    expect(failed.session.checklistShown.value).toBe(false);
    expect(failed.session.checklistMarks.value).toBeNull();

    const done = await shown();
    done.session.complete();
    expect(done.session.checklistMarks.value).toBeNull();
    done.session.retry();
    expect(done.session.screen.value).toBe('running');
    expect(done.session.checklistShown.value).toBe(false);
    expect(done.session.checklistMarks.value).toBeNull();

    const closed = await shown();
    closed.session.complete();
    closed.session.closeDebrief();
    expect(closed.session.checklistShown.value).toBe(false);
    expect(closed.session.checklistMarks.value).toBeNull();
  });

  it('holds the branch statuses the briefing showed, from the file of the run', async () => {
    const r = rig();
    await r.session.newSituation();
    const briefed = r.session.briefing.value?.branches;
    r.session.setLevel('easy');
    r.session.startRun();
    expect(briefed?.length).toBeGreaterThan(0);
    expect(r.session.runBranches.value).toEqual(briefed);
  });

  it('does not block the run clock: no modal is open with the sheet shown, and the clock keeps advancing', async () => {
    const r = await running('easy');
    const clock = r.session.clock.value;
    const run = r.session.run.value;
    if (clock === null || run === null) throw new Error('no run');
    r.session.toggleChecklist();
    expect(r.session.checklistShown.value).toBe(true);
    expect(anyModalOpen.peek()).toBe(false);
    const before = clock.now();
    for (let i = 0; i < 10; i++) run.step();
    expect(clock.now()).toBeGreaterThan(before);
    // The panel still takes a press with the sheet shown.
    r.bridge.actuate('lv.power', 'p50');
    expect(r.bridge.stateOf('lv.power').value).toBe('p50');
  });
});

describe(
  'Realistic: CHOOSE CHECKLIST and the HINT box (phase 07, plan 04, R-03, R-04)',
  { timeout: 30_000 },
  () => {
    const ALTN1 = readFileSync(join(root, 'scenarios/electrical/elec-altn1-fail.toon'), 'utf8');
    const LOCKED = BLUEPRINT.replace('id: eng-oil-temp-green', 'id: eng-oil-temp-locked');
    const MANIFESTS = {
      '/scenarios/engine/pack.toon': MANIFEST_TWO,
      '/scenarios/electrical/pack.toon': `format: 1
title: Electrical
free: true
scenarios[1]:
  - id: elec-altn1-fail
    title: ALTN 1 FAIL
    file: elec-altn1-fail
`,
      '/scenarios/locked/pack.toon': `format: 1
title: Locked
free: false
scenarios[1]:
  - id: eng-oil-temp-locked
    title: LOCKED ONE
    file: eng-oil-temp-locked
`,
    };
    /**
     * The listing order (plan 07-06, R-16): the catalog order of the shipped scenarios (ENG OIL TEMP in
     * the warnings, ALTN 1 FAIL in the cautions), then the scenarios the catalog does not know, in the
     * order of the packs by name and the manifests. A hand-written table.
     */
    const LISTED = [
      'engine.eng-oil-temp-green',
      'electrical.elec-altn1-fail',
      'engine.eng-oil-temp-copy',
      'locked.eng-oil-temp-locked',
    ];
    const TEXTS: Record<string, string> = {
      'engine.eng-oil-temp-green': BLUEPRINT,
      'engine.eng-oil-temp-copy': COPY,
      'electrical.elec-altn1-fail': ALTN1,
      'locked.eng-oil-temp-locked': LOCKED,
    };
    const headingOf = (key: string): string => {
      const parsedFile = parseScenario(TEXTS[key] ?? '');
      if (!parsedFile.ok) throw new Error(`${key} does not parse`);
      return checklistHead(parsedFile.value).heading ?? parsedFile.value.title;
    };
    const refOf = (key: string): { pack: string; scenario: string } => {
      const [pack = '', scenario = ''] = key.split('.');
      return { pack, scenario };
    };
    const OWN = 'engine.eng-oil-temp-green';
    const FOREIGN = 'electrical.elec-altn1-fail';

    const own = parseScenario(BLUEPRINT);
    if (!own.ok) throw new Error('the blueprint does not parse');

    interface ListRig {
      readonly session: ReturnType<typeof createSession>;
      readonly bridge: ReturnType<typeof createPanelBridge>;
      readonly loads: string[];
      readonly broken: Set<string>;
    }

    function listRig(policy: AccessPolicy = OPEN_ACCESS): ListRig {
      const loads: string[] = [];
      const broken = new Set<string>();
      const loaders: Record<string, () => Promise<string>> = {};
      for (const [key, text] of Object.entries(TEXTS)) {
        const [pack = '', id = ''] = key.split('.');
        loaders[`/scenarios/${pack}/${id}.toon`] = () => {
          loads.push(key);
          return broken.has(key) ? Promise.reject(new Error('no file')) : Promise.resolve(text);
        };
      }
      const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
      const draws = [0.75];
      let next = 0;
      const session = createSession({
        bridge,
        packs: { provider: createPackProvider({ manifests: MANIFESTS, loaders }), policy },
        env: DA50RG_ENV,
        rng: () => draws[next++] ?? 0,
        onRunStart: () => undefined,
      });
      return { session, bridge, loads, broken };
    }

    /** A Realistic run of the blueprint; the clock stands at the onset when `afterOnset`. */
    async function realistic(
      afterOnset: boolean,
      policy?: AccessPolicy,
    ): Promise<ListRig & { readonly onsetAt: number }> {
      const r = listRig(policy);
      await r.session.openChooser();
      await r.session.chooseScenario(refOf(OWN));
      r.session.setLevel('realistic');
      expect(r.session.screen.value).toBe('running');
      expect(r.session.scenario.value?.id).toBe('eng-oil-temp-green');
      const began = r.session.onset.value;
      if (began === null) throw new Error('no onset');
      if (afterOnset) r.session.clock.value?.advance(began.at);
      return { ...r, onsetAt: began.at };
    }

    const ready = (r: ListRig) =>
      vi.waitFor(() => {
        expect(r.session.checklistList.value.status).toBe('ready');
      });
    const keys = (r: ListRig): string[] =>
      r.session.checklistList.value.entries.map((e) => `${e.ref.pack}.${e.ref.scenario}`);

    /** The ids marked Done, or null while the sheet marks nothing. */
    const marked = (r: ListRig): string[] | null =>
      r.session.checklistMarks.value?.steps
        .filter((step) => step.credited)
        .map((step) => step.id) ?? null;

    it('opens at the list before the onset and lists every scenario alike, in listing order', async () => {
      const r = await realistic(false);
      expect(r.session.checklistList.value.status).toBe('idle');
      r.session.toggleChecklist();
      expect(r.session.checklistShown.value).toBe(true);
      expect(r.session.checklistView.value).toBe('list');
      expect(r.session.checklistList.value.status).toBe('loading');
      await ready(r);
      expect(keys(r)).toEqual(LISTED);
      expect(r.session.checklistList.value.entries.map((e) => e.heading)).toEqual(
        LISTED.map(headingOf),
      );
      // Nothing on an entry says which one belongs to the situation.
      for (const entry of r.session.checklistList.value.entries) {
        expect(Object.keys(entry).sort()).toEqual(['heading', 'ref', 'scenario']);
      }
      // No load failure, no busy flag: the run and the presses are untouched.
      expect(r.session.loadFailure.value).toBeNull();
      expect(r.session.busy.value).toBe(false);
      expect(r.session.screen.value).toBe('running');
    });

    it('loads the list once per run and only through the pack seam (a denying policy hides a pack, T-07-10)', async () => {
      const r = await realistic(false, { canAccess: (pack) => pack !== 'locked' });
      r.session.toggleChecklist();
      await ready(r);
      expect(keys(r)).toEqual(LISTED.filter((key) => !key.startsWith('locked.')));
      expect(r.loads).not.toContain('locked.eng-oil-temp-locked');
      const before = r.loads.length;
      r.session.toggleChecklist();
      r.session.toggleChecklist();
      expect(r.loads.length).toBe(before);

      // A policy that denies every pack from now on: the run goes on, the list is empty.
      let open = true;
      const none = await realistic(false, { canAccess: () => open });
      open = false;
      none.session.toggleChecklist();
      await ready(none);
      expect(none.session.checklistList.value.entries).toEqual([]);
    });

    it('keeps the run alive when the load fails and loads again after Try again', async () => {
      const r = await realistic(true);
      r.broken.add(FOREIGN);
      r.session.toggleChecklist();
      await vi.waitFor(() => {
        expect(r.session.checklistList.value.status).toBe('failed');
      });
      expect(r.session.screen.value).toBe('running');
      expect(r.session.loadFailure.value).toBeNull();
      expect(r.session.busy.value).toBe(false);
      r.bridge.actuate('lv.power', 'p50');
      expect(r.bridge.stateOf('lv.power').value).toBe('p50');

      r.broken.delete(FOREIGN);
      r.session.retryChecklistList();
      await ready(r);
      expect(keys(r)).toEqual(LISTED);
    });

    it('choosing shows that checklist, switching is free and the last choice is kept', async () => {
      const r = await realistic(true);
      r.session.chooseChecklist(refOf(FOREIGN));
      expect(r.session.checklistChoice.value).toBeNull();
      r.session.toggleChecklist();
      await ready(r);
      r.session.chooseChecklist(refOf(FOREIGN));
      expect(r.session.checklistView.value).toBe('sheet');
      expect(r.session.checklistChoice.value).toEqual({
        ref: refOf(FOREIGN),
        heading: headingOf(FOREIGN),
      });
      r.session.showChecklistList();
      expect(r.session.checklistView.value).toBe('list');
      r.session.chooseChecklist(refOf(OWN));
      r.session.showChecklistList();
      r.session.chooseChecklist(refOf(FOREIGN));
      expect(r.session.checklistChoice.value?.ref).toEqual(refOf(FOREIGN));
      // An entry that is not in the list is ignored.
      r.session.chooseChecklist({ pack: 'engine', scenario: 'nope' });
      expect(r.session.checklistChoice.value?.ref).toEqual(refOf(FOREIGN));
      // Hidden and shown again, the sheet comes back at the chosen checklist, not the list.
      r.session.toggleChecklist();
      r.session.toggleChecklist();
      expect(r.session.checklistView.value).toBe('sheet');
    });

    /** The ids credited by a grade of the real recording so far against the own file. */
    const creditedByGrade = (r: ListRig): string[] => {
      const clock = r.session.clock.value;
      if (clock === null) throw new Error('no clock');
      return grade(own.value, DA50RG_ENV, {
        scenarioId: own.value.id,
        completedAt: clock.now(),
        onset: r.session.onset.value,
        events: r.bridge.store
          .events()
          .filter((e) => e.source === 'user')
          .map((e) => ({ t: e.t, id: e.id, value: e.value })),
      })
        .steps.filter((step) => step.credited)
        .map((step) => step.id);
    };

    it('marks the done steps of the own checklist only after the onset, and the list marks nothing', async () => {
      const early = await realistic(false);
      early.session.toggleChecklist();
      await ready(early);
      early.session.chooseChecklist(refOf(OWN));
      early.bridge.actuate('lv.power', 'p50');
      // Before the onset nothing is marked and no step is program-checked: every row can be ticked.
      expect(early.session.checklistMarks.value).toBeNull();
      expect(early.session.checklistAuto.value).toBe('none');

      const r = await realistic(true);
      r.session.toggleChecklist();
      await ready(r);
      // The list itself marks nothing.
      r.bridge.actuate('lv.power', 'p50');
      expect(r.session.checklistMarks.value).toBeNull();
      expect(r.session.checklistAuto.value).toBe('none');
      r.session.chooseChecklist(refOf(OWN));
      r.bridge.actuate('lv.cowl_flap', 'open');
      expect(marked(r)).toEqual(creditedByGrade(r));
      expect(marked(r)).not.toBeNull();
      expect(r.session.checklistAuto.value).toBe('all');
    });

    it('marks a foreign checklist from what the pilot really did, step by step, panel steps only (R-24)', async () => {
      const r = await realistic(true);
      r.session.toggleChecklist();
      await ready(r);
      r.session.chooseChecklist(refOf(FOREIGN));
      expect(r.session.checklistAuto.value).toBe('panel');
      expect(marked(r)).toEqual([]);
      // The foreign step "Alternator 1 off" is satisfied by a real panel action, wrong for this situation.
      r.bridge.actuate('sw.alternator_1', 'off');
      expect(marked(r)).toEqual(['alt1_off']);
      // The own checklist is unaffected by the foreign view: one more action, own marks follow the own file.
      r.session.showChecklistList();
      r.session.chooseChecklist(refOf(OWN));
      expect(marked(r)).toEqual(creditedByGrade(r));
      expect(marked(r)).not.toContain('alt1_off');
    });

    it('never marks a foreign step that panel state cannot decide, and its row stays tickable (R-24)', async () => {
      const r = await realistic(true);
      r.session.toggleChecklist();
      await ready(r);
      r.session.chooseChecklist(refOf(FOREIGN));
      // The loaded foreign file with its "Essential bus" step asking for a quantity instead of a switch.
      const entry = r.session.checklistList.value.entries.find(
        (e) => e.ref.scenario === 'elec-altn1-fail',
      );
      if (entry === undefined) throw new Error('no entry');
      const changed = JSON.parse(JSON.stringify(entry.scenario)) as typeof entry.scenario;
      const step = changed.procedure
        .flatMap((n) => (n.kind === 'group' ? [...n.steps] : []))
        .find((st) => st.id === 'ess_bus_on');
      if (step === undefined) throw new Error('no ess_bus_on step');
      (step as { done: unknown }).done = {
        check: 'quantity',
        quantity: 'bus_volts',
        op: 'gte',
        value: 0,
      };
      (entry as { scenario: typeof changed }).scenario = changed;
      r.bridge.actuate('sw.alternator_1', 'off');
      r.bridge.actuate('sw.ess_bus', 'on');
      // The panel step is marked; the quantity step is not, whatever the grade says (the outline
      // decides by the predicate, see tests/outline.test.ts), and the marks say "panel steps only".
      expect(marked(r)).toContain('alt1_off');
      expect(r.session.checklistAuto.value).toBe('panel');
      expect(panelOnly(step.done)).toBe(false);
    });

    it('shows no marks and every row tickable when grading the chosen file throws (T-07-19)', async () => {
      const r = await realistic(true);
      r.session.toggleChecklist();
      await ready(r);
      r.session.chooseChecklist(refOf(FOREIGN));
      expect(r.session.checklistMarks.value).not.toBeNull();
      // A foreign file whose grade throws: a step names a control the aircraft does not have.
      const entry = r.session.checklistList.value.entries.find(
        (e) => e.ref.scenario === 'elec-altn1-fail',
      );
      if (entry === undefined) throw new Error('no entry');
      const broken = JSON.parse(JSON.stringify(entry.scenario)) as typeof entry.scenario;
      broken.initial.controls['sw.no_such_control'] = 'on';
      (entry as { scenario: typeof broken }).scenario = broken;
      r.bridge.actuate('sw.alternator_1', 'off');
      expect(r.session.checklistMarks.value).toBeNull();
      expect(r.session.checklistAuto.value).toBe('none');
      expect(r.session.screen.value).toBe('running');
    });

    it('keeps the own steps program-checked once marks are shown (never tappable by the outline contract)', async () => {
      const r = await realistic(true);
      r.session.toggleChecklist();
      await ready(r);
      r.session.chooseChecklist(refOf(OWN));
      expect(r.session.checklistAuto.value).toBe('all');
    });

    it('never changes the grade: one recording grades the same with no choice, a foreign and the own one', async () => {
      const results: string[] = [];
      for (const choice of [null, FOREIGN, OWN] as const) {
        const r = await realistic(true);
        if (choice !== null) {
          r.session.toggleChecklist();
          await ready(r);
          r.session.chooseChecklist(refOf(choice));
        }
        r.bridge.actuate('lv.power', 'p50');
        r.bridge.actuate('lv.cowl_flap', 'open');
        r.session.complete();
        results.push(JSON.stringify(r.session.result.value));
        results.push(JSON.stringify(r.session.recording.value));
      }
      expect(results[0]).toBe(results[2]);
      expect(results[0]).toBe(results[4]);
      expect(results[1]).toBe(results[3]);
      expect(results[1]).toBe(results[5]);
      expect(results[0]).toContain('"result"');
    });

    it('ignores a choice on Easy and Medium and grades the same there', async () => {
      for (const level of ['easy', 'medium'] as const) {
        const outcomes: string[] = [];
        for (const trying of [false, true]) {
          const r = listRig();
          await r.session.openChooser();
          await r.session.chooseScenario(refOf(OWN));
          r.session.setLevel(level);
          r.session.startRun();
          if (trying) {
            r.session.toggleChecklist();
            r.session.chooseChecklist(refOf(FOREIGN));
            r.session.showChecklistList();
            expect(r.session.checklistChoice.value).toBeNull();
            expect(r.session.checklistView.value).toBe('sheet');
            expect(r.session.checklistList.value.status).toBe('idle');
          }
          r.bridge.actuate('lv.power', 'p50');
          r.session.complete();
          outcomes.push(JSON.stringify(r.session.result.value));
        }
        expect(outcomes[0], level).toBe(outcomes[1]);
      }
    });

    it('names the last choice for the debrief and clears everything when the debrief closes', async () => {
      const none = await realistic(true);
      none.session.complete();
      expect(none.session.checklistChoice.value).toBeNull();

      const r = await realistic(true);
      r.session.toggleChecklist();
      await ready(r);
      r.session.chooseChecklist(refOf(OWN));
      r.session.showChecklistList();
      r.session.chooseChecklist(refOf(FOREIGN));
      r.session.complete();
      // The sheet is gone, the choice stays for the debrief.
      expect(r.session.checklistShown.value).toBe(false);
      expect(r.session.checklistChoice.value?.heading).toBe(headingOf(FOREIGN));
      r.session.closeDebrief();
      expect(r.session.checklistChoice.value).toBeNull();
      expect(r.session.checklistList.value).toEqual({ status: 'idle', entries: [] });
      expect(r.session.checklistView.value).toBe('sheet');
    });

    it('keeps the catalog tab of the list for the run: the first group at the start, the last choice after', async () => {
      const groups = DA50RG_ENV.catalog.groups.map((g) => g.id);
      const r = await realistic(false);
      expect(r.session.checklistTab.value).toBe(groups[0]);
      r.session.setChecklistTab('no-such-group');
      expect(r.session.checklistTab.value).toBe(groups[0]);
      r.session.setChecklistTab(groups[2] ?? '');
      expect(r.session.checklistTab.value).toBe(groups[2]);
      // Hiding and showing the sheet keeps the tab; a new run starts at the first group again.
      r.session.toggleChecklist();
      r.session.toggleChecklist();
      expect(r.session.checklistTab.value).toBe(groups[2]);
      r.session.resetPanel();
      await r.session.leaveRun();
      expect(r.session.checklistTab.value).toBe(groups[0]);
      // Easy and Medium have no list: the press does nothing.
      const easy = await started();
      easy.session.setChecklistTab(groups[1] ?? '');
      expect(easy.session.checklistTab.value).toBe(groups[0]);
    });

    describe('ticks on the rows of the sheet (R-23)', () => {
      const ROW = 'step:alt1_off';
      const open = async (afterOnset = true) => {
        const r = await realistic(afterOnset);
        r.session.toggleChecklist();
        await ready(r);
        return r;
      };

      it('toggles a row of the shown checklist and clears it on the second call', async () => {
        const r = await open();
        r.session.chooseChecklist(refOf(FOREIGN));
        expect([...r.session.checklistTicks.value]).toEqual([]);
        r.session.toggleManualMark(ROW);
        expect([...r.session.checklistTicks.value]).toEqual([ROW]);
        r.session.toggleManualMark(ROW);
        expect([...r.session.checklistTicks.value]).toEqual([]);
      });

      it('is ignored while the list is shown, while the sheet is hidden and outside a run', async () => {
        const r = await open();
        r.session.toggleManualMark(ROW);
        expect([...r.session.checklistTicks.value]).toEqual([]);
        r.session.chooseChecklist(refOf(FOREIGN));
        r.session.toggleChecklist();
        r.session.toggleManualMark(ROW);
        r.session.toggleChecklist();
        expect([...r.session.checklistTicks.value]).toEqual([]);
        const idle = listRig();
        idle.session.toggleManualMark(ROW);
        expect([...idle.session.checklistTicks.value]).toEqual([]);
      });

      it('keeps the ticks per checklist while the run goes on', async () => {
        const r = await open();
        r.session.chooseChecklist(refOf(FOREIGN));
        r.session.toggleManualMark(ROW);
        r.session.showChecklistList();
        r.session.chooseChecklist(refOf(OWN));
        expect([...r.session.checklistTicks.value]).toEqual([]);
        r.session.toggleManualMark('line:procedure.0');
        r.session.showChecklistList();
        r.session.chooseChecklist(refOf(FOREIGN));
        expect([...r.session.checklistTicks.value]).toEqual([ROW]);
        r.session.showChecklistList();
        r.session.chooseChecklist(refOf(OWN));
        expect([...r.session.checklistTicks.value]).toEqual(['line:procedure.0']);
      });

      it('can be set before the onset, on every checklist alike', async () => {
        const r = await open(false);
        r.session.chooseChecklist(refOf(OWN));
        r.session.toggleManualMark(ROW);
        expect([...r.session.checklistTicks.value]).toEqual([ROW]);
        expect(r.session.checklistMarks.value).toBeNull();
      });

      it('works on Easy and Medium for the own checklist', async () => {
        const r = await started();
        r.session.toggleChecklist();
        r.session.toggleManualMark('line:procedure.1');
        expect([...r.session.checklistTicks.value]).toEqual(['line:procedure.1']);
      });

      const ticked = async (): Promise<ListRig> => {
        const r = await open();
        r.session.chooseChecklist(refOf(FOREIGN));
        r.session.toggleManualMark(ROW);
        expect(r.session.checklistTicks.value.size).toBe(1);
        return r;
      };
      const none = (r: ListRig): void => {
        expect(r.session.checklistTicks.value.size).toBe(0);
        expect(r.session.checklistAuto.value).toBe('none');
      };

      it('clears them at complete and when the debrief closes', async () => {
        const completed = await ticked();
        completed.session.complete();
        none(completed);
        const closed = await ticked();
        closed.session.complete();
        closed.session.closeDebrief();
        none(closed);
      });

      it('clears them on leaving and on a failed step', async () => {
        const left = await ticked();
        left.session.resetPanel();
        await left.session.leaveRun();
        none(left);
        const failed = await ticked();
        failed.session.failRun(new Error('boom'));
        none(failed);
      });

      it('clears them at Retry', async () => {
        const retried = await ticked();
        retried.session.complete();
        retried.session.retry();
        expect(retried.session.screen.value).toBe('running');
        none(retried);
      });

      it('clears them at Next situation', async () => {
        const next = await ticked();
        next.session.complete();
        await next.session.nextSituation();
        none(next);
      });

      it('never reaches the recording or the grade: the JSON is the same with ticks, a foreign checklist and none', async () => {
        const results: string[] = [];
        for (const mode of ['plain', 'foreign', 'ticked'] as const) {
          const r = await realistic(true);
          if (mode !== 'plain') {
            r.session.toggleChecklist();
            await ready(r);
            r.session.chooseChecklist(refOf(FOREIGN));
          }
          if (mode === 'ticked') {
            r.session.toggleManualMark(ROW);
            r.session.toggleManualMark('line:procedure.0');
          }
          r.bridge.actuate('lv.power', 'p50');
          r.bridge.actuate('lv.cowl_flap', 'open');
          r.session.complete();
          results.push(
            JSON.stringify(r.session.result.value),
            JSON.stringify(r.session.recording.value),
          );
        }
        expect(results[2]).toBe(results[0]);
        expect(results[4]).toBe(results[0]);
        expect(results[3]).toBe(results[1]);
        expect(results[5]).toBe(results[1]);
      });
    });

    it('clears the choice and the list on leaving, a failed step, Retry and Next situation', async () => {
      const chosen = async (): Promise<Awaited<ReturnType<typeof realistic>>> => {
        const r = await realistic(true);
        r.session.toggleChecklist();
        await ready(r);
        r.session.chooseChecklist(refOf(FOREIGN));
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(true);
        return r;
      };
      const cleared = (r: ListRig): void => {
        expect(r.session.checklistChoice.value).toBeNull();
        expect(r.session.checklistList.value).toEqual({ status: 'idle', entries: [] });
        expect(r.session.checklistShown.value).toBe(false);
        expect(r.session.checklistView.value).toBe('sheet');
        expect(r.session.hintShown.value).toBe(false);
      };

      const left = await chosen();
      left.session.resetPanel();
      await left.session.leaveRun();
      cleared(left);

      const failed = await chosen();
      failed.session.failRun(new Error('boom'));
      cleared(failed);

      const retried = await chosen();
      retried.session.complete();
      retried.session.retry();
      expect(retried.session.screen.value).toBe('running');
      cleared(retried);

      const next = await chosen();
      next.session.complete();
      await next.session.nextSituation();
      cleared(next);
    });

    it('drops a list that finishes loading after its run ended', async () => {
      const r = await realistic(true);
      r.session.toggleChecklist();
      expect(r.session.checklistList.value.status).toBe('loading');
      r.session.resetPanel();
      await r.session.leaveRun();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(r.session.checklistList.value).toEqual({ status: 'idle', entries: [] });
    });

    describe('the hint box', () => {
      it('does nothing on Easy and Medium', async () => {
        for (const level of ['easy', 'medium'] as const) {
          const r = listRig();
          await r.session.openChooser();
          await r.session.chooseScenario(refOf(OWN));
          r.session.setLevel(level);
          r.session.startRun();
          r.session.toggleHint();
          expect(r.session.hintShown.value).toBe(false);
        }
      });

      it('does nothing outside a run and before the onset, then toggles', async () => {
        const r = listRig();
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(false);
        await r.session.openChooser();
        await r.session.chooseScenario(refOf(OWN));
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(false);
        r.session.setLevel('realistic');
        const began = r.session.onset.value;
        const clock = r.session.clock.value;
        if (began === null || clock === null) throw new Error('no onset or clock');
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(false);
        clock.advance(began.at - 1);
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(false);
        clock.advance(1);
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(true);
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(false);
      });

      it('is cleared when the run ends and holds the title and the situation of the file itself', async () => {
        const r = await realistic(true);
        r.session.toggleHint();
        expect(r.session.hintShown.value).toBe(true);
        // The box reads the file's own scenario, not a variant's.
        expect(r.session.scenario.value?.title).toBe(own.value.title);
        expect(r.session.scenario.value?.briefing.situation).toBe(own.value.briefing.situation);
        r.session.complete();
        expect(r.session.hintShown.value).toBe(false);
      });

      it('shows the situation of the file, never the cause the draw picked, for a scenario with variants', async () => {
        const altn = parseScenario(ALTN1);
        if (!altn.ok) throw new Error('ALTN 1 FAIL does not parse');
        expect(altn.value.variants.length).toBeGreaterThan(0);
        const r = listRig();
        await r.session.openChooser();
        await r.session.chooseScenario(refOf(FOREIGN));
        r.session.setLevel('realistic');
        expect(r.session.screen.value).toBe('running');
        expect(r.session.variant.value).not.toBeNull();
        expect(r.session.scenario.value).toEqual(altn.value);
      });
    });
  },
);

describe('the marks of a long run are coalesced (phase 07, plan 04, S-02)', { timeout: 30_000 }, () => {
  const SLOW = readFileSync(join(root, 'scenarios/electrical/elec-altn2-fail.toon'), 'utf8');
  const MANIFEST_SLOW = `format: 1
title: Engine
free: true
scenarios[1]:
  - id: elec-altn2-fail
    title: ALTN 2 FAIL
    file: elec-altn2-fail
`;

  it('refreshes at once while a grade is cheap and trailing, once, after a slow one', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const r = rig({ manifest: MANIFEST_SLOW, files: { 'elec-altn2-fail': SLOW } });
      await r.session.newSituation();
      r.session.setLevel('easy');
      r.session.startRun();
      const clock = r.session.clock.value;
      if (clock === null) throw new Error('no clock');
      // 28 minutes into the run a grade replays the whole log: far above 30 ms on this scenario.
      clock.advance(28 * 60_000);
      r.session.toggleChecklist();
      const shown = r.session.checklistMarks.value;
      expect(shown).not.toBeNull();

      // The first event after the slow call is not graded at once ...
      r.bridge.actuate('lv.power', 'p50');
      r.bridge.actuate('lv.cowl_flap', 'open');
      expect(r.session.checklistMarks.value).toBe(shown);
      // ... but once, after the wait, from the log as it stands then.
      vi.advanceTimersByTime(1000);
      const later = r.session.checklistMarks.value;
      expect(later).not.toBe(shown);
      expect(later).not.toBeNull();
      expect(later?.steps).toEqual(
        grade(r.session.scenario.value as Scenario, DA50RG_ENV, {
          scenarioId: 'elec-altn2-fail',
          completedAt: clock.now(),
          events: r.bridge.store
            .events()
            .filter((e) => e.source === 'user')
            .map((e) => ({ t: e.t, id: e.id, value: e.value })),
        }).steps,
      );

      // Leaving the run drops a waiting refresh.
      r.bridge.actuate('lv.power', 'p100');
      r.session.complete();
      vi.advanceTimersByTime(1000);
      expect(r.session.checklistMarks.value).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('grading ignores the level and the sheet (phase 07, plan 04, R-02)', () => {
  /** One scripted run at a level, with the sheet shown or hidden throughout; returns the result JSON. */
  async function scripted(
    level: 'easy' | 'medium' | 'realistic',
    showing: boolean,
  ): Promise<string> {
    let next = 0;
    const draws = [0.5, 0.75];
    const r = rig({ rng: () => draws[next++] ?? 0 });
    await r.session.newSituation();
    r.session.setLevel(level);
    if (level !== 'realistic') r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    const began = r.session.onset.value;
    if (began !== null) r.session.clock.value?.advance(began.at);
    if (showing) r.session.toggleChecklist();
    r.bridge.actuate('lv.power', 'p100');
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    r.session.complete();
    return JSON.stringify(r.session.result.value);
  }

  it('gives the same JSON with the sheet shown and hidden on every level', async () => {
    for (const level of LEVELS) {
      const hidden = await scripted(level, false);
      const shown = await scripted(level, true);
      expect(shown, level).toBe(hidden);
    }
  });

  it('gives Easy and Medium the same JSON', async () => {
    expect(await scripted('easy', true)).toBe(await scripted('medium', false));
  });
});

describe('further actions as footwell toggles (phase 07, plans 02 and 05)', () => {
  /** The shipped text without its own further section, so the cases declare theirs. */
  const stripFurther = (text: string): string => text.split(/^(?:# [^\n]*\n)?further:/m)[0] ?? text;
  const ACCEPT = `further:
  actions[1]:
    - id: atc_mayday
      role: required
  conduct:
    accept[1]: conduct_precautionary
`;
  const NONE = `further:
  actions[1]:
    - id: atc_mayday
      role: recommended
  conduct: none
`;
  const withBlock = (text: string, block: string): string => `${stripFurther(text)}${block}`;
  const GROUND_TEXT = readFileSync(join(root, 'scenarios/fire/eng-fire-ground.toon'), 'utf8');
  const GROUND_MANIFEST = `format: 1
title: Engine
free: true
scenarios[1]:
  - id: eng-fire-ground
    title: ENGINE FIRE GROUND
    file: eng-fire-ground
`;

  /** A started run on the oil temperature scenario with the accept declaration. */
  async function inFlight(): Promise<Rig> {
    const r = rig({ files: { 'eng-oil-temp-green': withBlock(BLUEPRINT, ACCEPT) } });
    await r.session.newSituation();
    r.session.setLevel('easy');
    r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    return r;
  }

  const ids = (r: Rig): string[] => r.session.decisions.value.map((d) => d.id);
  const selected = (r: Rig): { actions: string[]; conduct: string | null } => ({
    actions: [...r.session.furtherSelection.value.actions].sort(),
    conduct: r.session.furtherSelection.value.conduct,
  });

  it('appends one entry per press, in order, with the run clock time and the on flag', async () => {
    const r = await inFlight();
    const clock = r.session.clock.value;
    if (clock === null) throw new Error('no clock');
    clock.advance(1200);
    r.session.toggleDecision('atc_mayday');
    clock.advance(800);
    r.session.toggleDecision('brief_passengers');
    r.session.toggleDecision('atc_mayday');
    clock.advance(500);
    r.session.toggleDecision('conduct_precautionary');
    expect(r.session.decisions.value).toEqual([
      { t: 1200, id: 'atc_mayday', on: true },
      { t: 2000, id: 'brief_passengers', on: true },
      { t: 2000, id: 'atc_mayday', on: false },
      { t: 2500, id: 'conduct_precautionary', on: true },
    ]);
    expect(selected(r)).toEqual({
      actions: ['brief_passengers'],
      conduct: 'conduct_precautionary',
    });
  });

  it('ignores an unknown id and every call outside a running run', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': withBlock(BLUEPRINT, ACCEPT) } });
    r.session.toggleDecision('atc_mayday');
    expect(ids(r)).toEqual([]);
    await r.session.newSituation();
    r.session.toggleDecision('atc_mayday');
    expect(ids(r)).toEqual([]);
    r.session.setLevel('easy');
    r.session.startRun();
    r.session.toggleDecision('nope');
    r.session.toggleDecision('constructor');
    expect(ids(r)).toEqual([]);
    r.session.complete();
    r.session.toggleDecision('atc_mayday');
    expect(ids(r)).toEqual([]);
  });

  it('keeps MAYDAY, PAN PAN PAN and BRIEF PASSENGERS independent toggles', async () => {
    const r = await inFlight();
    r.session.toggleDecision('atc_mayday');
    r.session.toggleDecision('atc_pan_pan');
    r.session.toggleDecision('brief_passengers');
    expect(selected(r).actions).toEqual(['atc_mayday', 'atc_pan_pan', 'brief_passengers']);
    r.session.toggleDecision('atc_pan_pan');
    expect(selected(r).actions).toEqual(['atc_mayday', 'brief_passengers']);
    r.session.toggleDecision('atc_pan_pan');
    expect(selected(r).actions).toEqual(['atc_mayday', 'atc_pan_pan', 'brief_passengers']);
  });

  it('greys the Avoid NVFR and Avoid icing picks out under the emergency landing: a press logs nothing, Avoid IMC stays open, earlier picks stay and count again after switching back', async () => {
    const r = await inFlight();
    r.session.toggleDecision('avoid_nvfr');
    r.session.toggleDecision('avoid_imc');
    expect(selected(r).actions).toEqual(['avoid_imc', 'avoid_nvfr']);
    r.session.toggleDecision('conduct_emergency');
    const logged = r.session.decisions.value.length;
    // The two greyed-out ones ignore a press (switching on and off alike); Avoid IMC still toggles.
    r.session.toggleDecision('avoid_nvfr');
    r.session.toggleDecision('avoid_icing');
    expect(r.session.decisions.value).toHaveLength(logged);
    r.session.toggleDecision('avoid_imc');
    expect(r.session.decisions.value).toHaveLength(logged + 1);
    r.session.toggleDecision('avoid_imc');
    // The earlier pick of Avoid NVFR is untouched in the log and the selection.
    expect(selected(r)).toEqual({
      actions: ['avoid_imc', 'avoid_nvfr'],
      conduct: 'conduct_emergency',
    });
    // Back to another conduct: both are pressable again and the pick is live.
    r.session.toggleDecision('conduct_precautionary');
    r.session.toggleDecision('avoid_icing');
    expect(selected(r).actions).toEqual(['avoid_icing', 'avoid_imc', 'avoid_nvfr']);
  });

  it('preselects Continue to destination and makes the conduct a radio group: another press switches, the selected one is no change', async () => {
    const r = await inFlight();
    // Selected at the start without a press, and nothing in the log.
    expect(selected(r).conduct).toBe('conduct_destination');
    expect(r.session.decisions.value).toEqual([]);
    // A press of the selected button changes and logs nothing.
    r.session.toggleDecision('conduct_destination');
    expect(selected(r).conduct).toBe('conduct_destination');
    expect(r.session.decisions.value).toEqual([]);
    r.session.toggleDecision('conduct_precautionary');
    expect(selected(r).conduct).toBe('conduct_precautionary');
    // A second press of the selected one cannot clear it.
    r.session.toggleDecision('conduct_precautionary');
    expect(selected(r).conduct).toBe('conduct_precautionary');
    r.session.toggleDecision('conduct_emergency');
    expect(selected(r).conduct).toBe('conduct_emergency');
    r.session.toggleDecision('conduct_destination');
    expect(selected(r).conduct).toBe('conduct_destination');
    expect(r.session.decisions.value.map((d) => `${d.id}:${String(d.on)}`)).toEqual([
      'conduct_precautionary:true',
      'conduct_emergency:true',
      'conduct_destination:true',
    ]);
    r.session.toggleDecision('conduct_emergency');
    r.session.complete();
    expect(r.session.result.value?.further?.conduct).toMatchObject({
      last: 'conduct_emergency',
      status: 'wrong',
      picks: [
        'conduct_destination',
        'conduct_precautionary',
        'conduct_emergency',
        'conduct_destination',
        'conduct_emergency',
      ],
    });
  });

  it('grades the preselected default like a pick: a run that never switches fails with the wrong conduct', async () => {
    const r = await inFlight();
    r.session.complete();
    expect(r.session.result.value?.further?.conduct).toMatchObject({
      last: 'conduct_destination',
      picks: ['conduct_destination'],
      status: 'wrong',
    });
    expect(r.session.result.value?.reasons).toContainEqual({ kind: 'conduct', status: 'wrong' });
  });

  it('offers no conduct where the scenario declares none, on the ground, or has no section', async () => {
    const ground = rig({
      manifest: GROUND_MANIFEST,
      files: { 'eng-fire-ground': withBlock(GROUND_TEXT, NONE) },
    });
    await ground.session.newSituation();
    ground.session.setLevel('easy');
    ground.session.startRun();
    expect(ground.session.screen.value).toBe('running');
    ground.session.toggleDecision('conduct_emergency');
    ground.session.toggleDecision('atc_mayday');
    expect(ids(ground)).toEqual(['atc_mayday']);
    // The Avoid actions qualify the conduct: no conduct offered, no Avoid press either (R-21).
    for (const avoid of DA50RG_ENV.further.avoidIds()) ground.session.toggleDecision(avoid);
    expect(ids(ground)).toEqual(['atc_mayday']);

    const bare = rig({ files: { 'eng-oil-temp-green': stripFurther(BLUEPRINT) } });
    await bare.session.newSituation();
    bare.session.setLevel('easy');
    bare.session.startRun();
    bare.session.toggleDecision('conduct_destination');
    bare.session.toggleDecision('brief_passengers');
    expect(ids(bare)).toEqual(['brief_passengers']);
  });

  it('toggles the three Avoid actions independently where a conduct is offered, and they never end the run (R-21)', async () => {
    const r = await inFlight();
    const [imc, nvfr, icing] = DA50RG_ENV.further.avoidIds();
    if (imc === undefined || nvfr === undefined || icing === undefined) throw new Error('no avoid');
    r.session.toggleDecision(nvfr);
    r.session.toggleDecision(imc);
    expect(selected(r).actions).toEqual([imc, nvfr].sort());
    r.session.toggleDecision(nvfr);
    r.session.toggleDecision(icing);
    expect(selected(r).actions).toEqual([icing, imc].sort());
    r.session.toggleDecision(imc);
    r.session.toggleDecision(icing);
    expect(selected(r).actions).toEqual([]);
    expect(r.session.screen.value).toBe('running');
    // The grade of the run is the same with and without the presses, apart from the entries of the Avoid actions.
    const plain = await inFlight();
    for (const avoid of [imc, nvfr, icing]) r.session.toggleDecision(avoid);
    r.session.complete();
    plain.session.complete();
    const [a, b] = [r.session.result.value, plain.session.result.value];
    expect(a?.result).toBe(b?.result);
    expect(a?.reasons).toEqual(b?.reasons);
    expect(a?.steps).toEqual(b?.steps);
  });

  it('puts the presses into the recording and leaves the key out without one', async () => {
    const quiet = await inFlight();
    quiet.session.complete();
    expect(quiet.session.recording.value).not.toBeNull();
    expect('decisions' in (quiet.session.recording.value ?? {})).toBe(false);

    const r = await inFlight();
    r.session.clock.value?.advance(700);
    r.session.toggleDecision('atc_mayday');
    r.session.complete();
    expect(r.session.recording.value?.decisions).toEqual([{ t: 700, id: 'atc_mayday', on: true }]);
  });

  it('passes with the call selected at the end and the right conduct, and fails without it', async () => {
    const play = async (presses: number): Promise<Rig> => {
      const r = await inFlight();
      r.bridge.actuate('lv.power', 'p50');
      r.bridge.actuate('lv.cowl_flap', 'open');
      for (let k = 0; k < presses; k += 1) r.session.toggleDecision('atc_mayday');
      r.session.toggleDecision('conduct_precautionary');
      r.session.complete();
      return r;
    };
    for (const presses of [1, 3]) {
      const good = await play(presses);
      expect(good.session.result.value?.result).toBe('pass');
      expect(reasonLines(good.session.result.value ?? ({} as never))).toEqual([
        'All critical steps done.',
      ]);
    }
    for (const presses of [0, 2]) {
      const bad = await play(presses);
      expect(bad.session.result.value?.result).toBe('fail');
      expect(bad.session.result.value?.reasons).toEqual([{ kind: 'further_missed', count: 1 }]);
    }
  });

  it('never ends the run, never pauses the clock and holds no modal id', async () => {
    const r = await inFlight();
    const clock = r.session.clock.value;
    if (clock === null) throw new Error('no clock');
    r.session.toggleDecision('atc_mayday');
    r.session.toggleDecision('conduct_precautionary');
    r.session.toggleDecision('brief_passengers');
    expect(r.session.screen.value).toBe('running');
    expect(r.session.result.value).toBeNull();
    expect(anyModalOpen.value).toBe(false);
    const before = clock.now();
    clock.advance(500);
    expect(clock.now()).toBe(before + 500);
    r.session.toggleDecision('atc_mayday');
    expect(r.session.screen.value).toBe('running');
  });

  it('clears the presses wherever a run is left or a new one starts', async () => {
    const r = await inFlight();
    r.session.toggleDecision('atc_mayday');
    r.session.complete();
    r.session.closeDebrief();
    expect(ids(r)).toEqual([]);
    expect(selected(r).actions).toEqual([]);

    const again = await inFlight();
    again.session.toggleDecision('atc_mayday');
    again.session.resetPanel();
    again.session.keepGoing();
    expect(ids(again)).toEqual(['atc_mayday']);
    again.session.resetPanel();
    await again.session.leaveRun();
    expect(ids(again)).toEqual([]);

    await again.session.newSituation();
    again.session.setLevel('easy');
    again.session.startRun();
    expect(ids(again)).toEqual([]);
  });

  it('ignores every press before the onset of a Realistic run and works from the onset on', async () => {
    const r = rig({ files: { 'eng-oil-temp-green': withBlock(BLUEPRINT, ACCEPT) } });
    await r.session.newSituation();
    r.session.setLevel('realistic');
    expect(r.session.screen.value).toBe('running');
    const began = r.session.onset.value;
    if (began === null) throw new Error('no onset');
    expect(began.at).toBeGreaterThan(0);
    r.session.toggleDecision('atc_mayday');
    r.session.toggleDecision('conduct_precautionary');
    expect(ids(r)).toEqual([]);
    // Drawn alike before the onset: the preselected default shows, no press changes anything.
    expect(selected(r)).toEqual({ actions: [], conduct: 'conduct_destination' });
    r.session.clock.value?.advance(began.at);
    r.session.toggleDecision('atc_mayday');
    expect(r.session.decisions.value).toEqual([{ t: began.at, id: 'atc_mayday', on: true }]);
  });
});

describe('retry and next situation (phase 07, plan 03, D-14)', () => {
  const ALTN = readFileSync(join(root, 'scenarios/electrical/elec-altn1-fail.toon'), 'utf8');
  const altnParsed = parseScenario(ALTN);
  if (!altnParsed.ok) throw new Error('the ALTN 1 FAIL file does not parse');
  const altn = altnParsed.value;
  const NO_ONSET = BLUEPRINT.replace(/\n#[^\n]*\nonset:\n[\s\S]*$/, '\n').replace(
    'id: eng-oil-temp-green',
    'id: eng-oil-temp-plain',
  );
  if (NO_ONSET.includes('onset:'))
    throw new Error('the onset block of the blueprint was not found');
  const MANIFEST_THREE = `format: 1
title: Engine
free: true
scenarios[3]:
  - id: eng-oil-temp-green
    title: ENG OIL TEMP
    file: eng-oil-temp-green
  - id: eng-oil-temp-copy
    title: ENG OIL TEMP 2
    file: eng-oil-temp-copy
  - id: eng-oil-temp-plain
    title: ENG OIL TEMP 3
    file: eng-oil-temp-plain
`;
  const THREE = {
    'eng-oil-temp-green': BLUEPRINT,
    'eng-oil-temp-copy': COPY,
    'eng-oil-temp-plain': NO_ONSET,
  };
  const MANIFEST_ALTN = `format: 1
title: Electrical
free: true
scenarios[1]:
  - id: ${altn.id}
    title: ALTN 1 FAIL
    file: ${altn.id}
`;
  const SEED_DRAW = 0.75;

  /** An rng that returns the given values in turn, then 0, and counts its calls. */
  const counting = (values: readonly number[]) => {
    const state = { calls: 0 };
    const next = (): number => values[state.calls++] ?? 0;
    return { next, state };
  };

  /** Picks the scenario and the level through the cards, runs and completes it. */
  async function debriefOf(r: Rig, level: 'easy' | 'medium' | 'realistic'): Promise<void> {
    await r.session.newSituation();
    r.session.setLevel(level);
    if (level !== 'realistic') r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
  }

  describe('retrySeeds', () => {
    it('returns the recorded onset, variant, follow-on draw and carried panel as they are', () => {
      const onset = { at: 91000, seed: 7 };
      const variant = { id: 'breaker_popped', seed: 9 };
      const followOn = { seed: 5, from: 'eng-fire-in-flight' };
      const carry = { 'sw.elect_master': 'off' };
      expect(retrySeeds(onset, variant, followOn, carry)).toEqual({
        onset,
        variant,
        followOn,
        carry,
      });
      expect(retrySeeds(onset, variant, followOn)).toEqual({
        onset,
        variant,
        followOn,
        carry: null,
      });
      expect(retrySeeds(onset, null)).toEqual({
        onset,
        variant: null,
        followOn: null,
        carry: null,
      });
    });

    it('returns null for a record that does not exist', () => {
      expect(retrySeeds(null, null)).toEqual({
        onset: null,
        variant: null,
        followOn: null,
        carry: null,
      });
    });
  });

  describe('retry', () => {
    it('starts the same scenario at the same level from a clean state', async () => {
      const r = rig({ files: { 'eng-oil-temp-green': BLUEPRINT } });
      await r.session.newSituation();
      r.session.setLevel('medium');
      r.session.startRun();
      const startPanel = ['lv.power', 'lv.cowl_flap'].map((id) => r.bridge.stateOf(id).value);
      const startQuantities = { ...r.bridge.quantities.value };
      r.bridge.actuate('lv.power', 'p50');
      r.bridge.actuate('lv.cowl_flap', 'open');
      r.session.clock.value?.advance(4000);
      r.session.toggleChecklist();
      r.session.toggleDecision('atc_mayday');
      r.session.complete();
      expect(r.session.result.value).not.toBeNull();
      expect(r.session.recording.value).not.toBeNull();
      const before = r.onRunStart.mock.calls.length;

      r.session.retry();

      expect(r.session.screen.value).toBe('running');
      expect(r.session.scenario.value?.id).toBe('eng-oil-temp-green');
      expect(r.session.level.value).toBe('medium');
      expect(r.bridge.store.events()).toEqual([]);
      expect(['lv.power', 'lv.cowl_flap'].map((id) => r.bridge.stateOf(id).value)).toEqual(
        startPanel,
      );
      expect(r.bridge.quantities.value).toEqual(startQuantities);
      expect(r.session.clock.value?.now()).toBe(0);
      expect(r.session.checklistShown.value).toBe(false);
      expect(r.session.checklistMarks.value).toBeNull();
      expect(r.session.decisions.value).toEqual([]);
      expect(r.session.result.value).toBeNull();
      expect(r.session.recording.value).toBeNull();
      expect(r.onRunStart.mock.calls.length).toBe(before + 1);
    });

    it('draws nothing and keeps the cause of a scenario with variants', async () => {
      const draw = counting([0, 0.4]);
      const r = rig({
        manifest: MANIFEST_ALTN,
        files: { [altn.id]: ALTN },
        rng: draw.next,
      });
      await debriefOf(r, 'easy');
      const cause = r.session.variant.value;
      expect(cause).not.toBeNull();
      const calls = draw.state.calls;

      r.session.retry();

      expect(r.session.screen.value).toBe('running');
      expect(r.session.variant.value).toEqual(cause);
      expect(draw.state.calls).toBe(calls);
      // The same cause puts the same state on the panel.
      r.session.complete();
      expect(r.session.recording.value?.variant).toEqual(cause);
    });

    it('keeps the onset of a Realistic run, and again at the second retry', async () => {
      const draw = counting([0, SEED_DRAW]);
      const r = rig({ files: { 'eng-oil-temp-green': BLUEPRINT }, rng: draw.next });
      await debriefOf(r, 'realistic');
      const onset = r.session.onset.value;
      if (onset === null) throw new Error('no onset');
      const calls = draw.state.calls;

      r.session.retry();
      expect(r.session.screen.value).toBe('running');
      expect(r.session.level.value).toBe('realistic');
      expect(r.session.onset.value).toEqual(onset);
      r.session.complete();
      expect(r.session.recording.value?.onset).toEqual(onset);

      r.session.retry();
      expect(r.session.onset.value).toEqual(onset);
      expect(draw.state.calls).toBe(calls);
    });

    it('does nothing outside the debrief and while a load runs', async () => {
      const free = rig();
      free.session.retry();
      expect(free.session.screen.value).toBe('free');

      const r = await started();
      const log = r.onRunStart.mock.calls.length;
      r.session.retry();
      expect(r.onRunStart.mock.calls.length).toBe(log);
      expect(r.session.screen.value).toBe('running');

      const d = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(d, 'easy');
      const pending = d.session.nextSituation();
      expect(d.session.busy.value).toBe(true);
      const starts = d.onRunStart.mock.calls.length;
      d.session.retry();
      expect(d.onRunStart.mock.calls.length).toBe(starts);
      await pending;
    });

    it('Back to panel is ignored while the next situation loads (IN-04)', async () => {
      const r = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(r, 'easy');
      const pending = r.session.nextSituation();
      expect(r.session.busy.value).toBe(true);
      r.session.closeDebrief();
      expect(r.session.screen.value).toBe('debrief');
      await pending;
      expect(r.session.screen.value).toBe('briefing');
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
    });

    it('a failed list load of Next situation keeps a request, so retry repeats it (IN-04)', async () => {
      const r = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(r, 'easy');
      r.setListBroken(true);
      await r.session.nextSituation();
      expect(r.session.loadFailure.value).not.toBeNull();
      expect(r.session.screen.value).toBe('debrief');
      // The retry of the card runs the list again instead of only dismissing the card.
      r.setListBroken(false);
      await r.session.retryLoad();
      expect(r.session.loadFailure.value).toBeNull();
      expect(r.session.screen.value).toBe('briefing');
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
    });

    it('keeps an illegal baseline as a load failure, like a normal start', async () => {
      const r = rig({ files: { 'eng-oil-temp-green': BLUEPRINT } });
      await debriefOf(r, 'easy');
      const original = r.bridge.reset.bind(r.bridge);
      let calls = 0;
      // Only the baseline of the retry fails; the cleanup that follows resets normally.
      r.bridge.reset = (...args: Parameters<typeof original>): void => {
        if (calls++ === 0) throw new Error('illegal baseline');
        original(...args);
      };
      r.session.retry();
      r.bridge.reset = original;
      expect(r.session.screen.value).toBe('free');
      expect(r.session.loadFailure.value?.reason).toBe('invalid');
      expect(r.session.loadFailure.value?.issues[0]?.message).toContain('illegal baseline');
    });

    it('a normal start still draws the onset first and the cause second', async () => {
      const draw = counting([0, SEED_DRAW, 0.5]);
      const r = rig({ files: { 'eng-oil-temp-green': BLUEPRINT }, rng: draw.next });
      await r.session.newSituation();
      r.session.setLevel('realistic');
      // One draw for the pick, one for the onset; the blueprint has no variants.
      expect(draw.state.calls).toBe(2);
      expect(r.session.onset.value?.seed).toBe(Math.floor(SEED_DRAW * 4_294_967_296));
    });
  });

  describe('nextSituation', () => {
    it('opens the entry after the current one and wraps from the last to the first', async () => {
      const r = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(r, 'easy');
      expect(r.session.scenario.value?.id).toBe('eng-oil-temp-green');

      await r.session.nextSituation();
      expect(r.session.screen.value).toBe('briefing');
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
      r.session.startRun();
      r.session.complete();

      await r.session.nextSituation();
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-plain');
      r.session.startRun();
      r.session.complete();

      await r.session.nextSituation();
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');
    });

    it('a single entry gives the same one', async () => {
      const r = rig();
      await debriefOf(r, 'easy');
      await r.session.nextSituation();
      expect(r.session.screen.value).toBe('briefing');
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-green');
    });

    it('keeps the level and shows the briefing, not the cards, on Easy and Medium', async () => {
      for (const level of ['easy', 'medium'] as const) {
        const r = rig({ files: THREE, manifest: MANIFEST_THREE });
        await debriefOf(r, level);
        await r.session.nextSituation();
        expect(r.session.screen.value).toBe('briefing');
        expect(r.session.level.value).toBe(level);
        expect(r.session.levelPicked.value).toBe(true);
        // The run of the debrief is gone: the free-panel cleanup ran.
        expect(r.session.result.value).toBeNull();
        expect(r.session.recording.value).toBeNull();
        expect(r.session.scenario.value).toBeNull();
        expect(r.session.clock.value).toBeNull();
        expect(r.bridge.store.events()).toEqual([]);
        r.session.startRun();
        expect(r.session.screen.value).toBe('running');
        expect(r.session.scenario.value?.id).toBe('eng-oil-temp-copy');
      }
    });

    it('starts the run at once on Realistic when the next scenario has an onset', async () => {
      const draw = counting([0, SEED_DRAW, 0.25]);
      const r = rig({ files: THREE, manifest: MANIFEST_THREE, rng: draw.next });
      await debriefOf(r, 'realistic');
      await r.session.nextSituation();
      expect(r.session.screen.value).toBe('running');
      expect(r.session.scenario.value?.id).toBe('eng-oil-temp-copy');
      expect(r.session.level.value).toBe('realistic');
      expect(r.session.onset.value).not.toBeNull();
    });

    it('shows the level card when the next scenario has no onset on Realistic', async () => {
      const r = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(r, 'realistic');
      r.session.retry();
      r.session.complete();
      await r.session.nextSituation();
      r.session.startRun();
      r.session.complete();
      // The second entry had an onset; the third has none.
      await r.session.nextSituation();
      expect(r.session.briefing.value?.scenario.id).toBe('eng-oil-temp-plain');
      expect(r.session.screen.value).toBe('briefing');
      expect(r.session.levelPicked.value).toBe(false);
    });

    it('keeps a load failure of the next entry for the message and leaves the debrief', async () => {
      const files: Record<string, string | Error> = { ...THREE };
      const r = rig({ files, manifest: MANIFEST_THREE });
      await debriefOf(r, 'easy');
      // The file is read at call time: it fails only for the request of the next entry.
      files['eng-oil-temp-copy'] = new Error('network down');
      await r.session.nextSituation();
      expect(r.session.loadFailure.value).not.toBeNull();
      expect(r.session.screen.value).toBe('free');
      expect(r.session.busy.value).toBe(false);
    });

    it('does nothing outside the debrief and while busy', async () => {
      const free = rig({ files: THREE, manifest: MANIFEST_THREE });
      await free.session.nextSituation();
      expect(free.session.screen.value).toBe('free');
      expect(free.loads).toEqual([]);

      const running = await started({ files: THREE, manifest: MANIFEST_THREE });
      await running.session.nextSituation();
      expect(running.session.screen.value).toBe('running');

      const d = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(d, 'easy');
      const loadsBefore = d.loads.length;
      const first = d.session.nextSituation();
      await d.session.nextSituation();
      await first;
      // The second call loaded nothing: the same count as one call alone makes.
      const single = rig({ files: THREE, manifest: MANIFEST_THREE });
      await debriefOf(single, 'easy');
      const singleBefore = single.loads.length;
      await single.session.nextSituation();
      expect(d.loads.length - loadsBefore).toBe(single.loads.length - singleBefore);
      expect(d.session.briefing.value?.scenario.id).toBe('eng-oil-temp-copy');
    });
  });
});

describe('the follow-on of the debrief (Phase 9, plans 09-02 and 09-04, D-02, D-03, R-04 to R-06)', () => {
  const SOURCE = readFileSync(join(root, 'tests/fixtures/scenarios/landing-source.toon'), 'utf8');
  const LANDING = readFileSync(join(root, 'tests/fixtures/scenarios/landing-fixture.toon'), 'utf8');
  const manifestOf = (entries: readonly (readonly [string, string])[]): string =>
    `format: 1\ntitle: Engine\nfree: true\nscenarios[${String(entries.length)}]:\n${entries
      .map(([id, title]) => `  - id: ${id}\n    title: ${title}\n    file: ${id}`)
      .join('\n')}\n`;
  const OFF = readFileSync(join(root, 'tests/fixtures/scenarios/landing-fixture-off.toon'), 'utf8');
  const FIRST = { pack: 'engine', scenario: 'landing-fixture' };
  const SECOND = { pack: 'engine', scenario: 'landing-fixture-off' };
  const MANIFEST = manifestOf([
    ['landing-source', 'LANDING SOURCE'],
    ['landing-fixture', 'LANDING FIXTURE'],
    ['landing-fixture-off', 'LANDING NO POWER'],
  ]);
  // The oil-temperature blueprint has an onset; its section accepts the emergency landing and names
  // the two landing fixtures (weights 2 and 1), so the Realistic follow-on can be tried (the landing
  // fixtures have no onset and are landing scenes, so Realistic starts them at once).
  const WITH_ONSET = BLUEPRINT.replace(
    '    accept[1]: conduct_precautionary',
    '    accept[1]: conduct_emergency',
  ).concat(
    '  follow_on:\n    conduct_emergency[2]:\n      - pack: engine\n        scenario: landing-fixture\n        weight: 2\n      - pack: engine\n        scenario: landing-fixture-off\n        weight: 1\n',
  );
  if (WITH_ONSET === BLUEPRINT) throw new Error('the blueprint accept line was not found');
  const MANIFEST_ONSET = manifestOf([
    ['eng-oil-temp-green', 'ENG OIL TEMP'],
    ['landing-fixture', 'LANDING FIXTURE'],
    ['landing-fixture-off', 'LANDING NO POWER'],
  ]);

  const files = (): Record<string, string | Error> => ({
    'landing-source': SOURCE,
    'landing-fixture': LANDING,
    'landing-fixture-off': OFF,
  });
  /** The buttons the debrief shows now, from the session's own level and result. */
  const offerOf = (r: Rig) => {
    if (r.session.result.value === null) throw new Error('no result');
    return followOnOffer(
      r.session.scenario.value?.further,
      DA50RG_ENV.further,
      r.session.level.value === 'realistic',
    );
  };
  /** An rng that returns the given values in turn, then 0. */
  const queue = (values: readonly number[]): (() => number) => {
    let next = 0;
    return () => values[next++] ?? 0;
  };
  /** The rng value that makes the session draw this seed (SEED_RANGE is 2 to the 32nd). */
  const drawing = (seed: number): number => (seed + 0.5) / 4_294_967_296;

  /** The source fixture run to its debrief with the given conduct presses (none: the default stays). */
  async function sourceDebrief(
    presses: readonly string[],
    level: 'easy' | 'medium' = 'easy',
    options: Parameters<typeof rig>[0] = {},
  ): Promise<Rig> {
    const r = rig({ manifest: MANIFEST, files: files(), ...options });
    await r.session.openChooser();
    await r.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
    r.session.setLevel(level);
    r.session.startRun();
    for (const id of presses) r.session.toggleDecision(id);
    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
    return r;
  }

  it('offers one button per target, in the file order, after the emergency landing was picked', async () => {
    const r = await sourceDebrief(['conduct_emergency']);
    const text = DA50RG_ENV.further.option('conduct_emergency')?.followOn;
    expect(offerOf(r)).toEqual([
      // A target the aircraft has no entry for falls back to the generic text (R-08).
      { ref: FIRST, label: text?.label, title: text?.title },
      { ref: SECOND, label: text?.label, title: text?.title },
    ]);
    // The decision to land was made either way: the offer stands after FAIL as well.
    expect(r.session.result.value?.result).toBe('fail');
  });

  it('offers the buttons whatever conduct was selected at the end, after PASS and FAIL (R-13), and nothing for a scenario without the map', async () => {
    const generic = DA50RG_ENV.further.option('conduct_emergency')?.followOn;
    const expected = [
      { ref: FIRST, label: generic?.label, title: generic?.title },
      { ref: SECOND, label: generic?.label, title: generic?.title },
    ];
    // Another conduct at the end, the preselected conduct left alone and no conduct pick at all.
    const other = await sourceDebrief(['conduct_emergency', 'conduct_precautionary']);
    expect(offerOf(other)).toEqual(expected);
    expect(other.session.result.value?.further?.conduct.last).toBe('conduct_precautionary');
    const kept = await sourceDebrief([]);
    expect(offerOf(kept)).toEqual(expected);
    // PASS: the source fixture passes when the electric master is off and the emergency landing is the end.
    const passed = rig({ manifest: MANIFEST, files: files() });
    await passed.session.openChooser();
    await passed.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
    passed.session.startRun();
    passed.bridge.actuate('sw.elect_master', 'off');
    passed.session.toggleDecision('conduct_emergency');
    passed.session.complete();
    expect(passed.session.result.value?.result).toBe('pass');
    expect(offerOf(passed)).toEqual(expected);

    const plain = rig();
    await plain.session.newSituation();
    plain.session.startRun();
    plain.session.toggleDecision('conduct_emergency');
    plain.session.complete();
    expect(offerOf(plain)).toEqual([]);
    await plain.session.continueToFollowOn();
    expect(plain.session.screen.value).toBe('debrief');
    expect(plain.loads.at(-1)).toBe('eng-oil-temp-green');
    expect(new Set(plain.loads)).toEqual(new Set(['eng-oil-temp-green']));
  });

  it('opens the briefing of the chosen target on Easy and Medium with the level kept', async () => {
    for (const level of ['easy', 'medium'] as const) {
      for (const [ref, power] of [
        [FIRST, 'p60'],
        [SECOND, 'p60'],
      ] as const) {
        const r = await sourceDebrief(['conduct_emergency'], level);
        const loaded = r.loads.length;
        await r.session.continueToFollowOn(ref);
        expect(r.session.screen.value, `${level} ${ref.scenario}`).toBe('briefing');
        expect(r.session.briefing.value?.scenario.id).toBe(ref.scenario);
        expect(r.session.level.value).toBe(level);
        expect(r.session.levelPicked.value).toBe(true);
        expect(r.session.openedRef.value).toEqual(ref);
        // Nothing is carried over: the free-panel cleanup ran, the log is empty.
        expect(r.session.result.value).toBeNull();
        expect(r.session.recording.value).toBeNull();
        expect(r.session.decisions.value).toEqual([]);
        expect(r.bridge.store.events()).toEqual([]);
        // The target was read through the seam for the start, and nothing was drawn.
        expect(r.loads.slice(loaded)).toContain(ref.scenario);
        r.session.startRun();
        expect(r.session.screen.value).toBe('running');
        expect(r.session.scenario.value?.id).toBe(ref.scenario);
        expect(r.bridge.stateOf('lv.power').value).toBe(power);
        expect(r.session.furtherSelection.value.picks).toEqual([]);
        expect(r.session.followOn.value).toBeNull();
      }
    }
  });

  it('trusts no argument on Easy and Medium: no ref with two targets, an unoffered ref and a foreign pack start nothing', async () => {
    const r = await sourceDebrief(['conduct_emergency']);
    const loaded = r.loads.length;
    for (const ref of [
      undefined,
      { pack: 'engine', scenario: 'landing-source' },
      { pack: 'engine', scenario: 'nope' },
      { pack: 'other', scenario: 'landing-fixture' },
    ]) {
      await r.session.continueToFollowOn(ref);
      expect(r.session.screen.value).toBe('debrief');
    }
    expect(r.loads.length).toBe(loaded);
  });

  describe('Realistic draws the target by weight (R-05, R-06)', () => {
    /** The oil-temperature source on Realistic, run to its debrief with the emergency landing picked. */
    async function realisticDebrief(draws: readonly number[]): Promise<Rig> {
      const r = rig({
        manifest: MANIFEST_ONSET,
        files: {
          'eng-oil-temp-green': WITH_ONSET,
          'landing-fixture': LANDING,
          'landing-fixture-off': OFF,
        },
        rng: queue(draws),
      });
      await r.session.openChooser();
      await r.session.chooseScenario({ pack: 'engine', scenario: 'eng-oil-temp-green' });
      r.session.setLevel('realistic');
      expect(r.session.screen.value).toBe('running');
      // Presses count from the onset on.
      const run = r.session.run.value;
      const onsetAt = r.session.onset.value?.at ?? Number.POSITIVE_INFINITY;
      if (run === null) throw new Error('no run');
      while (run.clock.now() < onsetAt && r.session.screen.value === 'running') run.step();
      expect(r.session.screen.value).toBe('running');
      r.session.toggleDecision('conduct_emergency');
      r.session.complete();
      expect(r.session.screen.value).toBe('debrief');
      return r;
    }

    it('shows one generic button without a ref', async () => {
      const r = await realisticDebrief([0]);
      const text = DA50RG_ENV.further.option('conduct_emergency')?.followOn;
      expect(offerOf(r)).toEqual([{ ref: null, label: text?.label, title: text?.title }]);
    });

    it('draws with the injected rng, starts the run at once with no briefing and no level card, and records the seed', async () => {
      // The first value is the onset seed of the source run; the second is the follow-on seed.
      // The hand-written table of tests/follow-on-draw.test.ts: seed 1 draws the first target, seed 2 the second.
      for (const [seed, target] of [
        [1, 'landing-fixture'],
        [2, 'landing-fixture-off'],
      ] as const) {
        const r = await realisticDebrief([0, drawing(seed)]);
        const sourceResult = JSON.stringify(r.session.result.value);
        await r.session.continueToFollowOn(FIRST);
        expect(r.session.screen.value, target).toBe('running');
        expect(r.session.briefing.value).toBeNull();
        expect(r.session.levelPicked.value).toBe(true);
        expect(r.session.level.value).toBe('realistic');
        expect(r.session.scenario.value?.id).toBe(target);
        expect(r.session.openedRef.value).toEqual({ pack: 'engine', scenario: target });
        // No onset is drawn for a landing; the draw is recorded with the run.
        expect(r.session.onset.value).toBeNull();
        expect(r.session.followOn.value).toEqual({ seed, from: 'eng-oil-temp-green' });
        expect(r.session.busy.value).toBe(false);
        // The follow-on starts from the panel the source run left (R-14): its power lever.
        expect(r.bridge.stateOf('lv.power').value).toBe('p75');
        // The recording carries the draw, and it grades alike with and without it.
        r.session.complete();
        const recording = r.session.recording.value;
        expect(recording?.followOn).toEqual({ seed, from: 'eng-oil-temp-green' });
        const scenario = r.session.scenario.value;
        if (recording === null || scenario === null) throw new Error('no recording');
        const bare: Recording = { ...recording, followOn: undefined };
        expect(JSON.stringify(grade(scenario, DA50RG_ENV, recording))).toBe(
          JSON.stringify(grade(scenario, DA50RG_ENV, bare)),
        );
        expect(JSON.stringify(grade(scenario, DA50RG_ENV, recording))).toBe(
          JSON.stringify(r.session.result.value),
        );
        // A replay of the draw from the recorded seed and the source file gives the recorded target.
        const parsedSource = checkScenario(WITH_ONSET, DA50RG_ENV);
        if (!parsedSource.ok) throw new Error('the source does not check');
        const list = parsedSource.scenario.further?.follow_on?.['conduct_emergency'] ?? [];
        expect(followOnFromSeed(recording.followOn?.seed ?? -1, list).scenario).toBe(target);
        expect(sourceResult).not.toBe('');
      }
    });

    it('starts at once with the panel the source run left (R-14)', async () => {
      const r = await realisticDebrief([0, drawing(1)]);
      const left = { ...r.bridge.store.snapshot() };
      // The source file starts with its own power lever (p75); a changed lever must be what comes along.
      await r.session.continueToFollowOn();
      expect(r.session.screen.value).toBe('running');
      expect(r.session.briefing.value).toBeNull();
      expect({ ...r.bridge.store.snapshot() }).toEqual(left);
      expect(r.session.carry.value).toEqual(left);
      r.session.complete();
      expect(r.session.recording.value?.carry).toEqual(left);
      // Retry repeats it as well.
      r.bridge.actuate('lv.power', 'p10');
      r.session.retry();
      expect({ ...r.bridge.store.snapshot() }).toEqual(left);
    });

    it('the first run result is the same JSON whatever the draw', async () => {
      const a = await realisticDebrief([0, drawing(1)]);
      const b = await realisticDebrief([0, drawing(2)]);
      const before = JSON.stringify(a.session.result.value);
      expect(before).toBe(JSON.stringify(b.session.result.value));
      await a.session.continueToFollowOn(FIRST);
      await b.session.continueToFollowOn(FIRST);
      expect(a.session.scenario.value?.id).not.toBe(b.session.scenario.value?.id);
    });

    it('ignores the argument on Realistic: the draw decides', async () => {
      const r = await realisticDebrief([0, drawing(1)]);
      await r.session.continueToFollowOn(SECOND);
      expect(r.session.scenario.value?.id).toBe('landing-fixture');
    });

    it('Retry keeps target and seed, again at the second retry; Next situation draws nothing and records nothing', async () => {
      const r = await realisticDebrief([0, drawing(2)]);
      await r.session.continueToFollowOn(FIRST);
      expect(r.session.followOn.value?.seed).toBe(2);
      r.session.complete();
      for (let i = 0; i < 2; i += 1) {
        r.session.retry();
        expect(r.session.screen.value).toBe('running');
        expect(r.session.scenario.value?.id).toBe('landing-fixture-off');
        expect(r.session.followOn.value).toEqual({ seed: 2, from: 'eng-oil-temp-green' });
        expect(r.session.level.value).toBe('realistic');
        r.session.complete();
        expect(r.session.recording.value?.followOn).toEqual({
          seed: 2,
          from: 'eng-oil-temp-green',
        });
      }
      await r.session.nextSituation();
      expect(r.session.followOn.value).toBeNull();
      expect(r.session.recording.value).toBeNull();
    });

    it('a landing chosen from the chooser starts at once on Realistic and records no draw', async () => {
      const r = rig({ manifest: MANIFEST, files: files() });
      await r.session.openChooser();
      await r.session.chooseScenario(FIRST);
      expect(r.session.levelPicked.value).toBe(false);
      r.session.setLevel('realistic');
      expect(r.session.screen.value).toBe('running');
      expect(r.session.briefing.value).toBeNull();
      expect(r.session.onset.value).toBeNull();
      expect(r.session.followOn.value).toBeNull();
      expect(r.bridge.stateOf('lv.power').value).toBe('p60');
    });

    it('Next situation onto a landing starts at once on Realistic and draws nothing; a scenario with neither onset nor landing scene still shows the card', async () => {
      const r = await realisticDebrief([0]);
      await r.session.nextSituation();
      expect(r.session.screen.value).toBe('running');
      expect(r.session.briefing.value).toBeNull();
      expect(r.session.scenario.value?.id).toBe('landing-fixture');
      expect(r.session.level.value).toBe('realistic');
      expect(r.session.onset.value).toBeNull();
      expect(r.session.followOn.value).toBeNull();
      // The source fixture is no landing scene and has no onset: Realistic is not offered there.
      const source = rig({ manifest: MANIFEST, files: files() });
      await source.session.openChooser();
      await source.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
      source.session.setLevel('realistic');
      expect(source.session.screen.value).toBe('briefing');
      expect(source.session.levelPicked.value).toBe(false);
    });
  });

  it('leaves the result, the recording and the debrief data of the first run untouched', async () => {
    const r = await sourceDebrief(['conduct_emergency']);
    const firstResult = r.session.result.value;
    const firstRecording = r.session.recording.value;
    const firstScenario = r.session.scenario.value;
    if (firstResult === null || firstRecording === null || firstScenario === null) {
      throw new Error('no first run');
    }
    const before = JSON.stringify({ firstResult, firstRecording });
    // Computing the offer changes nothing.
    offerOf(r);
    expect(JSON.stringify({ firstResult, firstRecording })).toBe(before);
    expect(JSON.stringify(r.session.result.value)).toBe(JSON.stringify(firstResult));

    await r.session.continueToFollowOn(FIRST);
    r.session.startRun();
    r.session.complete();
    // The follow-on run is graded on its own: another scenario, another recording.
    expect(r.session.result.value?.scenarioId).toBe('landing-fixture');
    expect(r.session.recording.value?.scenarioId).toBe('landing-fixture');
    expect(r.session.result.value?.further?.conduct.declared).toBe('none');
    // The first run's records, held by value, are as they were and grade to the same result.
    expect(JSON.stringify({ firstResult, firstRecording })).toBe(before);
    expect(JSON.stringify(grade(firstScenario, DA50RG_ENV, firstRecording))).toBe(
      JSON.stringify(firstResult),
    );
  });

  it('Retry inside the follow-on restarts the follow-on', async () => {
    const r = await sourceDebrief(['conduct_emergency']);
    await r.session.continueToFollowOn(FIRST);
    r.session.startRun();
    r.session.complete();
    expect(r.session.screen.value).toBe('debrief');
    r.session.retry();
    expect(r.session.screen.value).toBe('running');
    expect(r.session.scenario.value?.id).toBe('landing-fixture');
    expect(r.session.level.value).toBe('easy');
  });

  describe('the follow-on starts with the panel the run left (R-14)', () => {
    /** The source fixture run on the panel: the given actions, the conduct press, then Procedure complete. */
    async function sourceRun(
      actions: readonly (readonly [string, string])[],
      level: 'easy' | 'medium' = 'easy',
      options: Parameters<typeof rig>[0] = {},
    ): Promise<Rig> {
      const r = rig({ manifest: MANIFEST, files: files(), ...options });
      await r.session.openChooser();
      await r.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
      r.session.setLevel(level);
      r.session.startRun();
      for (const [id, value] of actions) r.bridge.actuate(id, value);
      r.session.toggleDecision('conduct_emergency');
      r.session.complete();
      expect(r.session.screen.value).toBe('debrief');
      return r;
    }
    // The pilot did the electric master and left the engine master and fuel valve alone, moved the
    // cowl flap and the power lever: the file of the landing starts at p60 and the registry default.
    const LEFT: readonly (readonly [string, string])[] = [
      ['sw.elect_master', 'off'],
      ['lv.cowl_flap', 'open'],
      ['lv.power', 'p40'],
    ];
    const snapshot = (r: Rig): Record<string, string> => ({ ...r.bridge.store.snapshot() });

    it('the panel of the follow-on is the panel the source run left, a forgotten control included', async () => {
      for (const level of ['easy', 'medium'] as const) {
        const r = await sourceRun(LEFT, level);
        const left = snapshot(r);
        expect(left['sw.fuel_valve']).toBe('normal');
        await r.session.continueToFollowOn(FIRST);
        expect(r.session.screen.value).toBe('briefing');
        // The carry survives the briefing and is the panel the source left.
        expect(r.session.briefing.value?.carry).toEqual(left);
        r.session.startRun();
        expect(r.session.screen.value).toBe('running');
        expect(snapshot(r)).toEqual(left);
        expect(r.bridge.stateOf('lv.power').value).toBe('p40');
        expect(r.bridge.stateOf('sw.fuel_valve').value).toBe('normal');
        expect(r.session.carry.value).toEqual(left);
        expect(r.bridge.store.events()).toEqual([]);
        // The step the pilot did in the source is credited at once, on the sheet marks too.
        r.session.toggleChecklist();
        const done = r.session.checklistMarks.value?.steps.find((s) => s.id === 'elect_master_off');
        expect(done?.credited).toBe(true);
        expect(done?.enteredAt).toBe(-1);
      }
    });

    it('records the carry with the follow-on run and with no other run', async () => {
      const r = await sourceRun(LEFT);
      const left = snapshot(r);
      expect(r.session.recording.value).not.toBeNull();
      expect('carry' in (r.session.recording.value ?? {})).toBe(false);
      await r.session.continueToFollowOn(FIRST);
      r.session.startRun();
      r.session.complete();
      expect(r.session.recording.value?.carry).toEqual(left);
      expect(r.session.result.value?.result).toBe('pass');
      // Next situation, the chooser and NEW SITUATION record none.
      await r.session.nextSituation();
      expect(r.session.briefing.value?.carry).toBeUndefined();
      r.session.startRun();
      expect(r.session.carry.value).toBeNull();
      r.session.complete();
      expect('carry' in (r.session.recording.value ?? {})).toBe(false);
    });

    it('Back to panel from the briefing drops the carry', async () => {
      const r = await sourceRun(LEFT);
      await r.session.continueToFollowOn(FIRST);
      expect(r.session.briefing.value?.carry).toBeDefined();
      r.session.backToPanel();
      expect(r.session.screen.value).toBe('free');
      expect(r.session.briefing.value).toBeNull();
      await r.session.openChooser();
      await r.session.chooseScenario(FIRST);
      r.session.startRun();
      // The file's own baseline: its power lever, the registry default for everything else.
      expect(r.bridge.stateOf('lv.power').value).toBe('p60');
      expect(r.bridge.stateOf('sw.elect_master').value).not.toBe('off');
      expect(r.session.carry.value).toBeNull();
    });

    it('Next situation, NEW SITUATION and the chooser start from the file own baseline', async () => {
      const r = await sourceRun(LEFT);
      await r.session.continueToFollowOn(FIRST);
      r.session.startRun();
      r.session.complete();
      // Next situation from the follow-on's debrief.
      await r.session.nextSituation();
      expect(r.session.briefing.value?.scenario.id).toBe(SECOND.scenario);
      expect(r.session.briefing.value?.carry).toBeUndefined();
      r.session.startRun();
      expect(r.bridge.stateOf('lv.power').value).toBe('p60');
      expect(r.bridge.stateOf('sw.elect_master').value).not.toBe('off');
      expect(r.session.carry.value).toBeNull();
      // LEAVE and NEW SITUATION.
      r.session.resetPanel();
      expect(r.session.confirm.value).toBe('reset');
      await r.session.leaveRun();
      expect(r.session.carry.value).toBeNull();
      await r.session.newSituation();
      expect(r.session.briefing.value?.carry).toBeUndefined();
    });

    it('Retry in the follow-on repeats the same panel, even after the first attempt changed controls', async () => {
      const r = await sourceRun(LEFT);
      const left = snapshot(r);
      await r.session.continueToFollowOn(FIRST);
      r.session.startRun();
      r.bridge.actuate('sw.elect_master', 'on');
      r.bridge.actuate('lv.power', 'p10');
      r.bridge.actuate('sw.engine_master', 'off');
      r.session.complete();
      expect(r.session.result.value?.result).toBe('fail');
      for (let i = 0; i < 2; i += 1) {
        r.session.retry();
        expect(r.session.screen.value).toBe('running');
        expect(snapshot(r)).toEqual(left);
        expect(r.session.carry.value).toEqual(left);
        expect(r.bridge.store.events()).toEqual([]);
        r.bridge.actuate('lv.power', 'p10');
        r.session.complete();
        expect(r.session.recording.value?.carry).toEqual(left);
        expect(r.session.result.value?.result).toBe('pass');
      }
    });

    it('a retried load of the follow-on keeps the carry', async () => {
      const broken = files();
      const r = await sourceRun(LEFT, 'easy', { files: broken });
      const left = snapshot(r);
      broken['landing-fixture'] = new Error('network down');
      await r.session.continueToFollowOn(FIRST);
      expect(r.session.loadFailure.value).not.toBeNull();
      broken['landing-fixture'] = LANDING;
      await r.session.retryLoad();
      expect(r.session.briefing.value?.carry).toEqual(left);
    });

    it('leaves the first run result and recording exactly as they were', async () => {
      const r = await sourceRun(LEFT);
      const before = JSON.stringify({
        result: r.session.result.value,
        recording: r.session.recording.value,
      });
      offerOf(r);
      expect(
        JSON.stringify({ result: r.session.result.value, recording: r.session.recording.value }),
      ).toBe(before);
      const scenario = r.session.scenario.value;
      const recording = r.session.recording.value;
      if (scenario === null || recording === null) throw new Error('no run');
      expect(JSON.stringify(grade(scenario, DA50RG_ENV, recording))).toBe(
        JSON.stringify(r.session.result.value),
      );
    });

    it('a chain of two follow-ons carries the end of the second run into the third', async () => {
      const chained = (id: string, target: string): string =>
        SOURCE.replace('id: landing-source\n', `id: ${id}\n`)
          .replace('title: LANDING SOURCE', `title: ${id}`)
          .replace(
            / {2}follow_on:[\s\S]*$/,
            `  follow_on:\n    conduct_emergency[1]:\n      - pack: engine\n        scenario: ${target}\n        weight: 1\n`,
          );
      const r = rig({
        manifest: manifestOf([
          ['landing-source', 'LANDING SOURCE'],
          ['landing-source-b', 'LANDING SOURCE B'],
          ['landing-fixture', 'LANDING FIXTURE'],
        ]),
        files: {
          'landing-source': chained('landing-source', 'landing-source-b'),
          'landing-source-b': chained('landing-source-b', 'landing-fixture'),
          'landing-fixture': LANDING,
        },
      });
      await r.session.openChooser();
      await r.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
      r.session.startRun();
      r.bridge.actuate('lv.power', 'p40');
      r.session.toggleDecision('conduct_emergency');
      r.session.complete();
      await r.session.continueToFollowOn();
      r.session.startRun();
      expect(r.session.scenario.value?.id).toBe('landing-source-b');
      expect(r.bridge.stateOf('lv.power').value).toBe('p40');
      // The second run changes the panel again and ends with its own conduct press.
      r.bridge.actuate('lv.power', 'p20');
      r.bridge.actuate('sw.elect_master', 'off');
      r.session.toggleDecision('conduct_emergency');
      r.session.complete();
      const secondEnd = snapshot(r);
      await r.session.continueToFollowOn();
      r.session.startRun();
      expect(r.session.scenario.value?.id).toBe('landing-fixture');
      expect(snapshot(r)).toEqual(secondEnd);
      expect(r.bridge.stateOf('lv.power').value).toBe('p20');
      expect(r.session.carry.value).toEqual(secondEnd);
    });

    it('a failed run carries nothing and offers no follow-on', async () => {
      const r = rig({ manifest: MANIFEST, files: files() });
      await r.session.openChooser();
      await r.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
      r.session.startRun();
      r.bridge.actuate('lv.power', 'p40');
      r.session.failRun(new Error('boom'));
      expect(r.session.carry.value).toBeNull();
      expect(r.session.screen.value).toBe('free');
      await r.session.continueToFollowOn(FIRST);
      expect(r.session.screen.value).toBe('free');
    });
  });

  it('does nothing outside the debrief and while a load runs', async () => {
    const free = rig({ manifest: MANIFEST, files: files() });
    await free.session.continueToFollowOn(FIRST);
    expect(free.session.screen.value).toBe('free');
    expect(free.loads).toEqual([]);

    const running = rig({ manifest: MANIFEST, files: files() });
    await running.session.openChooser();
    await running.session.chooseScenario({ pack: 'engine', scenario: 'landing-source' });
    await running.session.continueToFollowOn(FIRST);
    expect(running.session.screen.value).toBe('briefing');
    running.session.startRun();
    running.session.toggleDecision('conduct_emergency');
    await running.session.continueToFollowOn(FIRST);
    expect(running.session.screen.value).toBe('running');
    const readsOfTarget = (r: Rig): number => r.loads.filter((n) => n === 'landing-fixture').length;
    const beforePresses = readsOfTarget(running);
    await running.session.continueToFollowOn(FIRST);
    expect(readsOfTarget(running)).toBe(beforePresses);

    // A second press during the load starts nothing: the loads equal those of one press alone.
    const busy = await sourceDebrief(['conduct_emergency']);
    const single = await sourceDebrief(['conduct_emergency']);
    const singleBefore = readsOfTarget(single);
    await single.session.continueToFollowOn(FIRST);
    const busyBefore = readsOfTarget(busy);
    const first = busy.session.continueToFollowOn(FIRST);
    expect(busy.session.busy.value).toBe(true);
    await busy.session.continueToFollowOn(FIRST);
    await first;
    expect(readsOfTarget(busy) - busyBefore).toBe(readsOfTarget(single) - singleBefore);
    expect(busy.session.briefing.value?.scenario.id).toBe('landing-fixture');
  });

  it('shows the load-failure card for a target the access policy denies, and reads no file of it (T-09-04)', async () => {
    let open = true;
    const r = await sourceDebrief(['conduct_emergency'], 'easy', {
      policy: { canAccess: () => open },
    });
    open = false;
    const loaded = r.loads.length;
    await r.session.continueToFollowOn(FIRST);
    expect(r.session.loadFailure.value?.reason).toBe('denied');
    expect(r.session.screen.value).toBe('free');
    expect(r.loads.length).toBe(loaded);
    expect(r.session.briefing.value).toBeNull();
  });

  it('shows the load-failure state for a missing target, and retry repeats the start', async () => {
    const broken = files();
    const r = await sourceDebrief(['conduct_emergency'], 'easy', { files: broken });
    broken['landing-fixture'] = new Error('network down');
    await r.session.continueToFollowOn(FIRST);
    expect(r.session.loadFailure.value).not.toBeNull();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.busy.value).toBe(false);

    broken['landing-fixture'] = LANDING;
    await r.session.retryLoad();
    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('briefing');
    expect(r.session.briefing.value?.scenario.id).toBe('landing-fixture');
    expect(r.session.level.value).toBe('easy');
  });
});

describe('a landing situation offers no conduct (Phase 9, plan 09-02, D-11)', () => {
  const LANDINGS = {
    'landing-fixture': readFileSync(
      join(root, 'tests/fixtures/scenarios/landing-fixture.toon'),
      'utf8',
    ),
    'landing-fixture-off': readFileSync(
      join(root, 'tests/fixtures/scenarios/landing-fixture-off.toon'),
      'utf8',
    ),
  };
  const MANIFEST = `format: 1
title: Landing
free: true
scenarios[2]:
  - id: landing-fixture
    title: LANDING FIXTURE
    file: landing-fixture
  - id: landing-fixture-off
    title: LANDING NO POWER
    file: landing-fixture-off
`;
  const SET = DA50RG_ENV.further;
  const startOf = async (id: keyof typeof LANDINGS) => {
    const r = rig({ manifest: MANIFEST, files: LANDINGS });
    await r.session.openChooser();
    await r.session.chooseScenario({ pack: 'engine', scenario: id });
    r.session.setLevel('easy');
    r.session.startRun();
    expect(r.session.screen.value).toBe('running');
    return r;
  };

  for (const id of Object.keys(LANDINGS) as (keyof typeof LANDINGS)[]) {
    it(`${id}: the footwell shows MAYDAY, PAN PAN PAN and brief passengers, not the conduct or the Avoid row`, async () => {
      const r = await startOf(id);
      const frame = FurtherAreaFrame({
        session: r.session,
        bridge: r.bridge,
        region: DA50RG.regions[0] as never,
      }) as { props: { children: ({ props: { id: string } } | null)[]; [k: string]: unknown } };
      expect(frame.props['data-further-conduct']).toBe('false');
      const drawn = frame.props.children.flatMap((child) =>
        child === null ? [] : [child.props.id.replace('further.', '')],
      );
      const calls = SET.ids('action').filter((option) => SET.option(option)?.avoid !== true);
      // The slots fix the order on the plate; the set is what matters.
      expect([...drawn].sort()).toEqual([...calls].sort());
      expect([...drawn].sort()).toEqual(['atc_mayday', 'atc_pan_pan', 'brief_passengers']);
    });

    it(`${id}: a press of a conduct or an Avoid button logs nothing, a call is logged`, async () => {
      const r = await startOf(id);
      expect(r.session.furtherSelection.value.conduct).toBeNull();
      for (const option of SET.options) {
        if (option.kind === 'conduct' || option.avoid === true) r.session.toggleDecision(option.id);
      }
      expect(r.session.decisions.value).toEqual([]);
      r.session.toggleDecision('atc_mayday');
      expect(r.session.decisions.value.map((d) => d.id)).toEqual(['atc_mayday']);
      expect(r.session.furtherSelection.value.conduct).toBeNull();
      r.session.complete();
      expect(r.session.result.value?.further?.conduct.declared).toBe('none');
      expect(
        r.session.result.value?.further?.actions.find((a) => a.id === 'atc_mayday')?.done,
      ).toBe(true);
    });
  }
});
