import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { createPackProvider, OPEN_ACCESS } from '../src/scenario/packs';
import { createPanelBridge } from '../src/ui/bridge';
import { createSession } from '../src/ui/session';

// The cost control of the sheet marks (plan 07-06, R-24, T-07-19): one grade per state of the log and
// checklist, nothing graded while the sheet is hidden or shows the list. A counting wrapper stands in
// for `grade` (it still grades), so the calls the session makes can be counted.
const calls = vi.hoisted(() => ({ count: 0 }));
vi.mock('../src/engine/grading', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/grading')>();
  return {
    ...actual,
    grade: (...args: Parameters<typeof actual.grade>) => {
      calls.count += 1;
      return actual.grade(...args);
    },
  };
});

const root = fileURLToPath(new URL('../', import.meta.url));
const TEXT = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
const MANIFEST = `format: 1
title: Engine
free: true
scenarios[1]:
  - id: eng-oil-temp-green
    title: ENG OIL TEMP
    file: eng-oil-temp-green
`;

async function easyRun() {
  const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
  const session = createSession({
    bridge,
    packs: {
      provider: createPackProvider({
        manifests: { '/scenarios/engine/pack.toon': MANIFEST },
        loaders: { '/scenarios/engine/eng-oil-temp-green.toon': () => Promise.resolve(TEXT) },
      }),
      policy: OPEN_ACCESS,
    },
    env: DA50RG_ENV,
    rng: () => 0,
    onRunStart: () => undefined,
  });
  await session.newSituation();
  session.setLevel('easy');
  session.startRun();
  expect(session.screen.value).toBe('running');
  return { bridge, session };
}

const credited = (r: Awaited<ReturnType<typeof easyRun>>): string[] =>
  r.session.checklistMarks.value?.steps.filter((s) => s.credited).map((s) => s.id) ?? [];

describe('the marks of the sheet are graded once per state of the log (T-07-19)', () => {
  it('grades once when the sheet opens and not again for an unchanged log', async () => {
    const r = await easyRun();
    calls.count = 0;
    r.session.toggleChecklist();
    expect(calls.count).toBe(1);
    r.session.toggleChecklist();
    r.session.toggleChecklist();
    expect(calls.count).toBe(1);
    r.bridge.actuate('lv.power', 'p50');
    expect(calls.count).toBe(2);
  });

  it('grades nothing while the sheet is hidden, and grades the new state once when it is shown again', async () => {
    const r = await easyRun();
    r.session.toggleChecklist();
    r.session.toggleChecklist();
    calls.count = 0;
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    expect(calls.count).toBe(0);
    r.session.toggleChecklist();
    expect(calls.count).toBe(1);
    expect(credited(r).length).toBeGreaterThan(0);
  });

  it('a retract followed by a different event of the same count gives fresh marks, not the stale entry', async () => {
    const r = await easyRun();
    r.session.toggleChecklist();
    const cowl = r.bridge.actuate('lv.cowl_flap', 'open');
    if (!cowl.ok) throw new Error('rejected');
    expect(credited(r)).toEqual(['open_cowl_flap']);
    const before = r.bridge.store.events().filter((e) => e.source === 'user').length;
    expect(r.bridge.retract(cowl.event.seq).ok).toBe(true);
    expect(credited(r)).toEqual([]);
    calls.count = 0;
    r.bridge.actuate('lv.power', 'p50');
    expect(r.bridge.store.events().filter((e) => e.source === 'user').length).toBe(before);
    expect(calls.count).toBe(1);
    expect(credited(r)).toEqual(['reduce_power']);
  });

  it('grades nothing while the Realistic list is shown, also after the onset', async () => {
    const r = await easyRun();
    r.session.resetPanel();
    await r.session.leaveRun();
    await r.session.newSituation();
    r.session.setLevel('realistic');
    expect(r.session.level.value).toBe('realistic');
    const at = r.session.onset.value?.at ?? 0;
    r.session.clock.value?.advance(at);
    r.session.toggleChecklist();
    expect(r.session.checklistView.value).toBe('list');
    calls.count = 0;
    r.bridge.actuate('lv.power', 'p50');
    r.bridge.actuate('lv.cowl_flap', 'open');
    expect(calls.count).toBe(0);
    expect(r.session.checklistMarks.value).toBeNull();
  });
});
