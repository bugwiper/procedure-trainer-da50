import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { OPEN_ACCESS, createPackProvider } from '../src/scenario/packs';
import type { AccessPolicy } from '../src/scenario/packs';
import { createPanelBridge } from '../src/ui/bridge';
import { createSession, pickRandom } from '../src/ui/session';

// The session machine (plan 02-06, Table N1; SES-01, SES-03, SES-04, SCN-05, D-13): node
// environment, a real bridge over the DA50 RG and a fake pack provider built from the real
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
  for (const [name, text] of Object.entries(files)) {
    loaders[`/scenarios/engine/${name}.toon`] = () => {
      loads.push(name);
      return text instanceof Error ? Promise.reject(text) : Promise.resolve(text);
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

/** A started run on the blueprint. */
async function started(options: Parameters<typeof rig>[0] = {}): Promise<Rig> {
  const r = rig(options);
  await r.session.newSituation();
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
  it('starts the run in the scenario baseline with an empty log', async () => {
    const { session, bridge, onRunStart } = rig();
    expect(session.screen.value).toBe('free');
    expect(bridge.stateOf('lv.power').value).toBe('p70');

    await session.newSituation();

    expect(session.screen.value).toBe('running');
    expect(session.scenario.value?.id).toBe('eng-oil-temp-green');
    expect(session.result.value).toBeNull();
    expect(session.loadFailure.value).toBeNull();
    expect(session.busy.value).toBe(false);
    expect(bridge.stateOf('lv.power').value).toBe('p75');
    expect(bridge.stateOf('lv.cowl_flap').value).toBe('closed');
    expect(bridge.quantities.value).toEqual({
      ...DA50RG_QUANTITIES.idleValues(),
      oil_temp_c: 128,
      oil_pressure_bar: 5,
    });
    // The baseline is applied, never dispatched.
    expect(bridge.store.events()).toEqual([]);
    expect(onRunStart).toHaveBeenCalledTimes(1);
    expect(session.clock.value?.now()).toBe(0);
  });

  it('picks the first and the last entry of two with rng 0 and 0.99', async () => {
    const files = { 'eng-oil-temp-green': BLUEPRINT, 'eng-oil-temp-copy': COPY };
    const first = rig({ manifest: MANIFEST_TWO, files, rng: () => 0 });
    await first.session.newSituation();
    expect(first.session.scenario.value?.id).toBe('eng-oil-temp-green');

    const last = rig({ manifest: MANIFEST_TWO, files, rng: () => 0.99 });
    await last.session.newSituation();
    expect(last.session.scenario.value?.id).toBe('eng-oil-temp-copy');
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
    expect(r.onRunStart).toHaveBeenCalledTimes(1);
    expect(r.session.busy.value).toBe(false);
    expect(r.session.screen.value).toBe('running');
  });

  it('a denied pack is never opened: loadFailure, still free, panel untouched', async () => {
    const policy: AccessPolicy = { canAccess: () => false };
    const r = rig({ policy });
    await r.session.newSituation();
    expect(r.session.screen.value).toBe('free');
    expect(r.session.loadFailure.value?.reason).toBe('denied');
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
    expect(r.session.loadFailure.value?.reason).toBe('denied');
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
    expect(r.session.loadFailure.value).not.toBeNull();
    open = true;
    await r.session.newSituation();
    expect(r.session.loadFailure.value).toBeNull();
    expect(r.session.screen.value).toBe('running');
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

    expect(r.session.screen.value).toBe('running');
    expect(r.session.result.value).toBeNull();
    expect(r.bridge.stateOf('lv.power').value).toBe('p75');
    expect(r.bridge.store.events()).toEqual([]);
    expect(r.session.clock.value?.now()).toBe(0);
    expect(r.onRunStart).toHaveBeenCalledTimes(2);
  });
});
