import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS, DEICE_MAX_ACTIVE } from '../src/aircraft/da50rg/indicators';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { OPEN_ACCESS, createPackProvider } from '../src/scenario/packs';
import type { AccessPolicy } from '../src/scenario/packs';
import { createPanelBridge } from '../src/ui/bridge';
import { VITE_PACKS } from '../src/scenario/packs-vite';
import { SESSION_LAYOUT } from '../src/ui/panel/session-area';
import { createSession, pickRandom } from '../src/ui/session';

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
}

function rig(
  options: {
    manifest?: string;
    files?: Record<string, string | Error>;
    policy?: AccessPolicy;
    rng?: () => number;
    listFails?: boolean;
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
  const provider = createPackProvider({
    manifests: {
      '/scenarios/engine/pack.toon':
        options.listFails === true ? 'format: 1\nbogus: 1' : (options.manifest ?? MANIFEST_ONE),
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
  });
  return { session, bridge, onRunStart, loads };
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
      oil_temp_c: 128,
      oil_pressure_bar: 5,
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

describe('choose list guard (U-08)', () => {
  it('the shipped manifests list at most as many scenarios as the choose view has rows', async () => {
    const metas = await VITE_PACKS.listPacks();
    const total = metas.reduce((sum, meta) => sum + meta.scenarios.length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(SESSION_LAYOUT.choose.maxRows);
  });
});

describe('complete', () => {
  it('grades golden-like actuations as pass', async () => {
    const r = await started();
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
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
    expect(result?.reasons).toEqual([{ kind: 'critical_missed', count: 2 }]);
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
    const expected = { ...DA50RG_QUANTITIES.baseValues(), oil_temp_c: 128, oil_pressure_bar: 5 };
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
    expect(run.state.quantities['oil_pressure_bar']).toBe(5);
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
});
