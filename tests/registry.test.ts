import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import {
  BUTTON_SKINS,
  LEVER_SKINS,
  RegistryError,
  defineRegistry,
  guardIdFor,
  legalStates,
} from '../src/engine/registry';
import type {
  ControlSpec,
  DetentLeverDef,
  GuardedToggleDef,
  MomentaryButtonDef,
  RegionDef,
  ToggleDef,
} from '../src/engine/registry';
import { targetSide } from '../src/ui/panel/viewport';

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

  it('rejects a legends id that is not one of the lever detents, and duplicate legends', () => {
    expectRejected([lever('lv.legend_stray', { legends: ['up', 'sideways'] })], 'lv.legend_stray');
    expectRejected([lever('lv.legend_twice', { legends: ['up', 'up'] })], 'lv.legend_twice');
  });

  it('accepts a nameless lever, an empty legends list and a legends subset (plan 19)', () => {
    expect(() =>
      build([
        lever('lv.bare', { nameless: true, legends: [] }),
        lever('lv.some', { legends: ['up'] }),
      ]),
    ).not.toThrow();
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

describe('toggle skins (UI-SPEC 8.1, 8.2)', () => {
  it('a toggle without skin is a bat and needs no size or colour', () => {
    const reg = build([toggle('sw.plain')]);
    const def = reg.get('sw.plain') as ToggleDef;
    expect(def.skin).toBeUndefined();
    expect(() => build([toggle('sw.bat', { skin: 'bat' })])).not.toThrow();
  });

  it('accepts a rocker with size and colour and a bat with a ball tip', () => {
    expect(() =>
      build([
        toggle('sw.r', { skin: 'rocker', size: 'M', colour: 'white' }),
        toggle('sw.l', { skin: 'rocker', size: 'LIGHT', colour: 'red' }),
        toggle('sw.b', { skin: 'bat', ball: true }),
        toggle('sw.d', { ball: true }),
      ]),
    ).not.toThrow();
  });

  it('rejects a rocker without size or without colour', () => {
    expectRejected([toggle('sw.nosize', { skin: 'rocker', colour: 'white' })], 'sw.nosize');
    expectRejected([toggle('sw.nocolour', { skin: 'rocker', size: 'M' })], 'sw.nocolour');
    expectRejected([toggle('sw.neither', { skin: 'rocker' })], 'sw.neither');
  });

  it('rejects size or colour on a bat, a softkey and a toggle without skin', () => {
    expectRejected([toggle('sw.batsize', { skin: 'bat', size: 'M' })], 'sw.batsize');
    expectRejected([toggle('sw.keycolour', { skin: 'softkey', colour: 'red' })], 'sw.keycolour');
    expectRejected([toggle('sw.plainsize', { size: 'S' })], 'sw.plainsize');
  });

  it('rejects a ball on a rocker or a softkey', () => {
    expectRejected(
      [toggle('sw.rball', { skin: 'rocker', size: 'M', colour: 'white', ball: true })],
      'sw.rball',
    );
    expectRejected([toggle('sw.kball', { skin: 'softkey', ball: true })], 'sw.kball');
  });

  it('rejects a skin, size or colour outside the vocabulary (data cast around the types)', () => {
    expectRejected([toggle('sw.odd', { skin: 'dial' as unknown as 'bat' })], 'sw.odd');
    expectRejected(
      [toggle('sw.big', { skin: 'rocker', size: 'XL' as unknown as 'M', colour: 'white' })],
      'sw.big',
    );
    expectRejected(
      [toggle('sw.blue', { skin: 'rocker', size: 'M', colour: 'blue' as unknown as 'red' })],
      'sw.blue',
    );
  });
});

describe('three-position toggles (plan 18, Table T2)', () => {
  const three = [
    { id: 'reset_test', label: 'RESET / TEST' },
    { id: 'armed', label: 'ARMED' },
    { id: 'on', label: 'ON' },
  ] as const;
  const mid = { states: three, default: 'armed' } as const;

  it('accepts three states on the rocker and the bat skin and lists them bottom to top', () => {
    const reg = build([
      toggle('sw.r3', { ...mid, skin: 'rocker', size: 'S', colour: 'red' }),
      toggle('sw.b3', { ...mid, skin: 'bat' }),
      toggle('sw.d3', { ...mid }),
    ]);
    const def = reg.get('sw.r3');
    expect(def).toBeDefined();
    if (def === undefined) return;
    expect(legalStates(def)).toEqual(['reset_test', 'armed', 'on']);
  });

  it('rejects three states on the softkey skin', () => {
    expectRejected([toggle('sw.k3', { ...mid, skin: 'softkey' })], 'sw.k3');
  });

  it('rejects a guarded toggle with three states (data cast around the types)', () => {
    expectRejected(
      [
        guarded('sw.g3', {
          states: three as unknown as GuardedToggleDef['states'],
          default: 'armed',
        }),
      ],
      'sw.g3',
    );
  });

  it('rejects duplicate state ids and an illegal default among three states', () => {
    const dup = [three[0], three[1], three[0]] as unknown as ToggleDef['states'];
    expectRejected([toggle('sw.dup3', { states: dup, default: 'armed' })], 'sw.dup3');
    expectRejected([toggle('sw.def3', { ...mid, default: 'off' })], 'sw.def3');
  });

  it('rejects four states', () => {
    const four = [...three, { id: 'x', label: 'X' }] as unknown as ToggleDef['states'];
    expectRejected([toggle('sw.four', { states: four, default: 'armed' })], 'sw.four');
  });

  it('targetSide of a three-state toggle is min(width, height / 3)', () => {
    const def = toggle('sw.t3', { ...mid, skin: 'rocker', size: 'S', colour: 'red' });
    expect(targetSide({ ...def, hit: { w: 34, h: 78 } })).toBe(26);
    expect(targetSide({ ...def, hit: { w: 20, h: 78 } })).toBe(20);
    expect(targetSide(toggle('sw.t2', { hit: { w: 34, h: 78 } }))).toBe(34);
  });

  it('the ELT of DA50RG has reset_test, armed, on and rests armed', () => {
    const elt = DA50RG.get('sw.elt');
    expect(elt?.kind).toBe('toggle');
    if (elt === undefined) return;
    expect(legalStates(elt)).toEqual(['reset_test', 'armed', 'on']);
    expect(elt.default).toBe('armed');
  });
});

describe('guarded toggle rocker fields', () => {
  it('accepts both size and colour, or neither', () => {
    expect(() =>
      build([guarded('sw.both', { size: 'M', colour: 'red' }), guarded('sw.none')]),
    ).not.toThrow();
  });

  it('rejects only one of size and colour', () => {
    expectRejected([guarded('sw.onlysize', { size: 'M' })], 'sw.onlysize');
    expectRejected([guarded('sw.onlycolour', { colour: 'red' })], 'sw.onlycolour');
  });
});

describe('momentary button skins and the three-state spring bat', () => {
  const threeStates: MomentaryButtonDef['states'] = [
    { id: 'neutral', label: 'NEUTRAL' },
    { id: 'stall', label: 'STALL TEST' },
    { id: 'gear', label: 'GEAR TEST' },
  ];

  it('accepts a 3-state spring-bat that rests in states[0] and lists all three states', () => {
    const reg = build([
      button('btn.spring', { skin: 'spring-bat', states: threeStates, default: 'neutral' }),
    ]);
    const def = reg.get('btn.spring') as MomentaryButtonDef;
    expect(def.default).toBe(def.states[0].id);
    expect(legalStates(def)).toEqual(['neutral', 'stall', 'gear']);
  });

  it('rejects a 3-state button with any other skin or none', () => {
    expectRejected([button('btn.three', { states: threeStates, default: 'neutral' })], 'btn.three');
    expectRejected(
      [button('btn.dome', { skin: 'blue-dome', states: threeStates, default: 'neutral' })],
      'btn.dome',
    );
  });

  it('rejects four states even with the spring-bat skin', () => {
    const four: MomentaryButtonDef['states'] = [...threeStates, { id: 'x', label: 'X' }];
    expectRejected(
      [button('btn.four', { skin: 'spring-bat', states: four, default: 'neutral' })],
      'btn.four',
    );
  });

  it('a 3-state spring-bat must still rest in its first state', () => {
    expectRejected(
      [button('btn.sticky3', { skin: 'spring-bat', states: threeStates, default: 'gear' })],
      'btn.sticky3',
    );
  });

  it('accepts every two-state skin', () => {
    expect(() =>
      build([
        button('btn.a', { skin: 'chrome-round' }),
        button('btn.b', { skin: 'blue-dome' }),
        button('btn.c', { skin: 'small-black' }),
        button('btn.d'),
      ]),
    ).not.toThrow();
  });

  it('targetSide: a three-state button counts half the width, a two-state one the footprint', () => {
    const three = button('btn.t3', {
      skin: 'spring-bat',
      states: threeStates,
      default: 'neutral',
      hit: { w: 56, h: 30 },
    });
    expect(targetSide(three)).toBe(28);
    expect(targetSide(button('btn.t2', { hit: { w: 66, h: 70 } }))).toBe(66);
  });
});

describe('button skins', () => {
  it('knows the black dome of the de-ice MAX button', () => {
    expect(BUTTON_SKINS).toContain('black-dome');
    for (const skin of BUTTON_SKINS) {
      const spring: Partial<MomentaryButtonDef> =
        skin === 'spring-bat'
          ? {
              states: [
                { id: 'neutral', label: 'NEUTRAL' },
                { id: 'left', label: 'LEFT' },
                { id: 'right', label: 'RIGHT' },
              ],
              default: 'neutral',
            }
          : {};
      expect(() => build([button('btn.s', { skin, ...spring })])).not.toThrow();
    }
  });

  it('rejects a button skin outside the vocabulary', () => {
    expectRejected([button('btn.odd', { skin: 'square' as unknown as 'blue-dome' })], 'btn.odd');
  });
});

describe('lever skins', () => {
  it('accepts every skin of the vocabulary and none', () => {
    expect(LEVER_SKINS).toContain('power-grip');
    expect(LEVER_SKINS).toHaveLength(9);
    expect(LEVER_SKINS).not.toContain('bat-small');
    for (const skin of LEVER_SKINS) expect(() => build([lever('lv.s', { skin })])).not.toThrow();
    expect(() => build([lever('lv.none')])).not.toThrow();
  });

  it('rejects a skin outside the vocabulary', () => {
    expectRejected([lever('lv.odd', { skin: 'wheel' as unknown as 'gear-knob' })], 'lv.odd');
  });
});

describe('DA50RG still passes every invariant', () => {
  it('builds with all Phase 1 and plan 01 to 03 controls', () => {
    expect(DA50RG.controls.length).toBeGreaterThanOrEqual(30);
    expect(DA50RG.get('sw.fuel_trans')?.kind).toBe('rotary');
  });

  it('has 41 non-guard controls after the de-ice rebuild of plan 22', () => {
    expect(DA50RG.controls.filter((c) => c.kind !== 'guard')).toHaveLength(41);
  });
});
