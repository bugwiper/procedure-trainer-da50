import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { RegistryError, defineRegistry, guardIdFor, legalStates } from '../src/engine/registry';
import type {
  ControlSpec,
  DetentLeverDef,
  GuardedToggleDef,
  MomentaryButtonDef,
  RegionDef,
  ToggleDef,
} from '../src/engine/registry';

// Registry invariant suite (PNL-02). Inline fixtures build the malformed definitions.

const VIEW_BOX = { w: 100, h: 100 };
const REGIONS: readonly RegionDef[] = [
  { id: 'r1', name: 'R1', bounds: { x: 0, y: 0, w: 100, h: 100 } },
  { id: 'r2', name: 'R2', bounds: { x: 0, y: 0, w: 100, h: 100 } },
];

const base = { label: 'X', region: 'r1', x: 10, y: 10, hit: { w: 20, h: 20 } };

function toggle(id: string, over: Partial<ToggleDef> = {}): ToggleDef {
  return {
    ...base,
    kind: 'toggle',
    id,
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ],
    default: 'off',
    ...over,
  };
}

function guarded(id: string, over: Partial<GuardedToggleDef> = {}): GuardedToggleDef {
  return {
    ...base,
    kind: 'guarded-toggle',
    id,
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ],
    default: 'off',
    guardOpenHit: { x: -10, y: -20, w: 20, h: 10 },
    ...over,
  };
}

function lever(id: string, over: Partial<DetentLeverDef> = {}): DetentLeverDef {
  return {
    ...base,
    kind: 'detent-lever',
    id,
    detents: [
      { id: 'up', label: 'UP', pos: 0 },
      { id: 'mid', label: 'MID', pos: 0.5 },
      { id: 'down', label: 'DOWN', pos: 1 },
    ],
    default: 'up',
    track: { length: 60, axis: 'v' },
    ...over,
  };
}

function button(id: string, over: Partial<MomentaryButtonDef> = {}): MomentaryButtonDef {
  return {
    ...base,
    kind: 'momentary-button',
    id,
    states: [
      { id: 'released', label: 'RELEASED' },
      { id: 'pressed', label: 'PRESSED' },
    ],
    default: 'released',
    ...over,
  };
}

function build(controls: readonly ControlSpec[], regions: readonly RegionDef[] = REGIONS) {
  return defineRegistry({ viewBox: VIEW_BOX, regions, controls });
}

/** Assert the build throws a RegistryError whose message names `needle`. */
function expectRejected(controls: readonly ControlSpec[], needle: string): void {
  expect(() => build(controls)).toThrow(RegistryError);
  expect(() => build(controls)).toThrow(needle);
}

describe('DA50RG registry', () => {
  it('builds without throwing and contains the tracer controls', () => {
    expect(DA50RG.get('sw.engine_master')).toBeDefined();
    expect(DA50RG.get('sw.mfd_page')).toBeDefined();
  });
});

describe('kind prefix rule', () => {
  it('rejects a toggle whose id starts with "lv."', () => {
    expectRejected([toggle('lv.bad_toggle')], 'lv.bad_toggle');
  });

  it('rejects a guarded toggle, a lever and a button with a foreign prefix', () => {
    expectRejected([guarded('btn.bad_guarded')], 'btn.bad_guarded');
    expectRejected([lever('sw.bad_lever')], 'sw.bad_lever');
    expectRejected([button('lv.bad_button')], 'lv.bad_button');
  });

  it('accepts the matching prefix for every kind', () => {
    expect(() =>
      build([toggle('sw.a'), guarded('sw.b'), lever('lv.c'), button('btn.d')]),
    ).not.toThrow();
  });
});

describe('identity rules', () => {
  it('rejects a duplicate control id, naming it', () => {
    expectRejected([toggle('sw.dup'), toggle('sw.dup')], 'sw.dup');
  });

  it('rejects ids that do not match the id pattern', () => {
    expectRejected([toggle('EngineMaster')], 'EngineMaster');
    expectRejected([toggle('sw')], '"sw"');
  });

  it('rejects an unknown region, naming the control', () => {
    expectRejected([toggle('sw.lost', { region: 'nowhere' })], 'sw.lost');
  });

  it('rejects a duplicate region id', () => {
    expect(() => build([], [REGIONS[0] as RegionDef, REGIONS[0] as RegionDef])).toThrow(
      RegistryError,
    );
  });

  it('rejects a spec id that collides with a derived guard id (either order)', () => {
    const colliding = toggle(guardIdFor('sw.alt'));
    expectRejected([guarded('sw.alt'), colliding], 'sw.alt.guard');
    expectRejected([colliding, guarded('sw.alt')], 'sw.alt.guard');
  });
});

describe('state rules', () => {
  it('rejects a default that is not a legal state', () => {
    expectRejected([toggle('sw.bad_default', { default: 'maybe' })], 'sw.bad_default');
  });

  it('rejects duplicate state ids within one control', () => {
    expectRejected(
      [
        toggle('sw.dup_states', {
          states: [
            { id: 'off', label: 'OFF' },
            { id: 'off', label: 'ALSO OFF' },
          ],
        }),
      ],
      'sw.dup_states',
    );
  });

  it('rejects a control with fewer than two states (empty edge)', () => {
    const few = [{ id: 'off', label: 'OFF' }] as unknown as ToggleDef['states'];
    expectRejected([toggle('sw.single', { states: few })], 'sw.single');
    const none = [] as unknown as ToggleDef['states'];
    expectRejected([toggle('sw.nostate', { states: none })], 'sw.nostate');
  });

  it('rejects a momentary button that does not rest in its first state', () => {
    expectRejected([button('btn.sticky', { default: 'pressed' })], 'btn.sticky');
  });

  it('legalStates returns detent ids in declaration order for a lever', () => {
    const reg = build([lever('lv.order')]);
    const def = reg.get('lv.order');
    expect(def).toBeDefined();
    expect(legalStates(def as DetentLeverDef)).toEqual(['up', 'mid', 'down']);
  });
});

describe('detent lever rules', () => {
  it('rejects fewer than two detents (empty edge)', () => {
    expectRejected([lever('lv.one', { detents: [{ id: 'up', label: 'UP', pos: 0 }] })], 'lv.one');
    expectRejected([lever('lv.none', { detents: [], default: 'up' })], 'lv.none');
  });

  it('rejects a detent pos outside 0..1', () => {
    const detents = [
      { id: 'up', label: 'UP', pos: 0 },
      { id: 'down', label: 'DOWN', pos: 1.2 },
    ];
    expectRejected([lever('lv.high', { detents })], 'lv.high');
    const below = [
      { id: 'up', label: 'UP', pos: -0.1 },
      { id: 'down', label: 'DOWN', pos: 1 },
    ];
    expectRejected([lever('lv.low', { detents: below })], 'lv.low');
  });

  it('rejects two detents at the same pos (adjacency edge)', () => {
    const detents = [
      { id: 'up', label: 'UP', pos: 0.5 },
      { id: 'down', label: 'DOWN', pos: 0.5 },
    ];
    expectRejected([lever('lv.equal', { detents })], 'lv.equal');
  });

  it('rejects decreasing detent positions', () => {
    const detents = [
      { id: 'up', label: 'UP', pos: 0.8 },
      { id: 'down', label: 'DOWN', pos: 0.2 },
    ];
    expectRejected([lever('lv.backwards', { detents })], 'lv.backwards');
  });

  it('rejects a marker that is not one of the lever detents', () => {
    expectRejected([lever('lv.stray', { markers: ['up', 'sideways'] })], 'lv.stray');
  });

  it('rejects duplicate marker ids', () => {
    expectRejected([lever('lv.twice', { markers: ['up', 'up'] })], 'lv.twice');
  });

  it('rejects a drag-only lever with a non-empty markers list', () => {
    expectRejected([lever('lv.drag', { dragOnly: true, markers: ['up'] })], 'lv.drag');
  });

  it('accepts a drag-only lever with no markers and a lever with a marker subset', () => {
    expect(() =>
      build([
        lever('lv.drag_ok', { dragOnly: true }),
        lever('lv.subset', { markers: ['up', 'down'] }),
      ]),
    ).not.toThrow();
  });
});

describe('guard derivation', () => {
  it('derives a guard directly after its switch', () => {
    const reg = build([toggle('sw.first'), guarded('sw.alt'), toggle('sw.last')]);
    expect(reg.controls.map((c) => c.id)).toEqual([
      'sw.first',
      'sw.alt',
      'sw.alt.guard',
      'sw.last',
    ]);
  });

  it('gives the derived guard closed/open states, default closed and guards set to the switch', () => {
    const reg = build([guarded('sw.alt')]);
    const guard = reg.get('sw.alt.guard');
    expect(guard?.kind).toBe('guard');
    if (guard?.kind !== 'guard') throw new Error('guard missing');
    expect(guard.default).toBe('closed');
    expect(guard.states.map((s) => s.id)).toEqual(['closed', 'open']);
    expect(guard.guards).toBe('sw.alt');
    expect(guard.openHit).toEqual({ x: -10, y: -20, w: 20, h: 10 });
  });
});

describe('ordering and empty input', () => {
  it('region.controlIds follow declaration order, guard after its switch', () => {
    const reg = build([
      toggle('sw.a'),
      toggle('sw.other', { region: 'r2' }),
      guarded('sw.b'),
      button('btn.c'),
    ]);
    const r1 = reg.regions.find((r) => r.id === 'r1');
    const r2 = reg.regions.find((r) => r.id === 'r2');
    expect(r1?.controlIds).toEqual(['sw.a', 'sw.b', 'sw.b.guard', 'btn.c']);
    expect(r2?.controlIds).toEqual(['sw.other']);
  });

  it('a region with no controls has empty controlIds and the build succeeds', () => {
    const reg = build([toggle('sw.a')]);
    const r2 = reg.regions.find((r) => r.id === 'r2');
    expect(r2?.controlIds).toEqual([]);
  });

  it('a registry with zero controls builds', () => {
    const reg = build([]);
    expect(reg.controls).toEqual([]);
    expect(reg.get('sw.anything')).toBeUndefined();
  });
});
