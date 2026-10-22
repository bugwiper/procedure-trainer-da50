import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { SQUAWK_CONTROLS } from '../src/aircraft/da50rg/controls/squawk';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { RegistryError, defineRegistry, legalStates } from '../src/engine/registry';
import type { CodeEntryDef, ControlDef, RegionDef } from '../src/engine/registry';
import { PanelStore } from '../src/engine/store';
import { createEntryBuffer, makeCodeKeyPress } from '../src/ui/panel/code-entry';
import type { PressInfo } from '../src/ui/panel/press-targets';
import { parseScenario } from '../src/scenario/parse';
import { MINIMAL, swap } from './scenario-text';

// The simplified transponder (D-11, PNL-07, C-14 to C-19): the entry rules, the registry checks of
// the code-entry kind, the store validation and the grading of a committed code. Pure node tests,
// no DOM: the widget itself is covered by e2e/xpdr.spec.ts.

const SQUAWK_ID = 'kp.squawk';

function squawkDef(): CodeEntryDef {
  const def = DA50RG.get(SQUAWK_ID);
  if (def?.kind !== 'code-entry') throw new Error('kp.squawk is not a code-entry control');
  return def;
}

const SPEC: CodeEntryDef = (() => {
  const spec = SQUAWK_CONTROLS[0];
  if (spec?.kind !== 'code-entry') throw new Error('no code-entry spec');
  return spec;
})();

const REGION: RegionDef = { id: 'transponder', name: 'T', bounds: { x: 0, y: 0, w: 400, h: 300 } };
const VIEW_BOX = { w: 400, h: 300 };

/** The registry error text of a code-entry definition changed by `patch`; fails if it loads. */
function loadError(patch: Partial<CodeEntryDef>): string {
  try {
    defineRegistry({ viewBox: VIEW_BOX, regions: [REGION], controls: [{ ...SPEC, ...patch }] });
  } catch (error) {
    expect(error).toBeInstanceOf(RegistryError);
    return (error as RegistryError).message;
  }
  throw new Error('the definition loaded but should have been rejected');
}

/** Size to the power of digits, computed from the definition without the power operator. */
function spaceOf(def: CodeEntryDef): number {
  let space = 1;
  for (let i = 0; i < def.digits; i++) space *= [...def.alphabet].length;
  return space;
}

const PRESS_INFO: PressInfo = {
  down: { x: 0, y: 0 },
  up: { x: 0, y: 0 },
  hit: {} as unknown as Element,
};

describe('entry buffer (C-15)', () => {
  it('three digits are typing and the fourth commits the code and empties the buffer', () => {
    const buffer = createEntryBuffer(4);
    expect(buffer.push('7')).toEqual({ kind: 'typing', buffer: '7' });
    expect(buffer.push('7')).toEqual({ kind: 'typing', buffer: '77' });
    expect(buffer.push('0')).toEqual({ kind: 'typing', buffer: '770' });
    expect(buffer.value).toBe('770');
    expect(buffer.push('0')).toEqual({ kind: 'commit', code: '7700' });
    expect(buffer.value).toBe('');
  });

  it('CLR empties a partial entry, and the next entry starts from nothing', () => {
    const buffer = createEntryBuffer(4);
    buffer.push('1');
    buffer.push('2');
    buffer.clear();
    expect(buffer.value).toBe('');
    expect(buffer.push('3')).toEqual({ kind: 'typing', buffer: '3' });
  });

  it('a fifth key after a commit starts a new entry', () => {
    const buffer = createEntryBuffer(4);
    for (const key of '7700') buffer.push(key);
    expect(buffer.push('1')).toEqual({ kind: 'typing', buffer: '1' });
    expect(buffer.value).toBe('1');
  });

  it('refuses a key that is not one character', () => {
    const buffer = createEntryBuffer(4);
    expect(() => buffer.push('')).toThrow(RangeError);
    expect(() => buffer.push('12')).toThrow(RangeError);
    expect(() => createEntryBuffer(0)).toThrow(RangeError);
  });

  it('8 and 9 are not keys of the DA50 transponder, and no code with them is legal', () => {
    const keys = squawkDef().keys.map((k) => k.key);
    expect([...keys].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', 'clr']);
    expect(keys).not.toContain('8');
    expect(keys).not.toContain('9');
    expect(legalStates(squawkDef())).not.toContain('1289');
  });
});

describe('key press factory (C-15, C-16)', () => {
  function setup() {
    const store = new PanelStore(DA50RG);
    const buffer = createEntryBuffer(4);
    let changes = 0;
    const press = (key: string) =>
      makeCodeKeyPress({
        def: squawkDef(),
        key,
        buffer,
        actuate: (id, value) => store.dispatch(id, value, 1000),
        onChange: () => {
          changes += 1;
        },
      });
    return { store, buffer, press, changes: () => changes };
  }

  it('presses 1 to 3 return null and record nothing, the fourth returns the seq of the event', () => {
    const { store, press } = setup();
    expect(press('7').press?.(PRESS_INFO)).toBeNull();
    expect(press('7').press?.(PRESS_INFO)).toBeNull();
    expect(press('0').press?.(PRESS_INFO)).toBeNull();
    expect(store.events()).toHaveLength(0);
    expect(store.get(SQUAWK_ID)).toBe('1200');
    const seq = press('0').press?.(PRESS_INFO);
    expect(seq).toBe(0);
    expect(store.get(SQUAWK_ID)).toBe('7700');
    expect(store.events()).toHaveLength(1);
    expect(store.events()[0]).toMatchObject({ id: SQUAWK_ID, value: '7700', seq: 0 });
  });

  it('re-entering the committed code returns null and records no second event', () => {
    const { store, press } = setup();
    for (const key of '7700') press(key).press?.(PRESS_INFO);
    for (const key of '7700') expect(press(key).press?.(PRESS_INFO) ?? null).toBeNull();
    expect(store.events()).toHaveLength(1);
  });

  it('CLR empties the buffer and records nothing', () => {
    const { store, buffer, press, changes } = setup();
    press('4').press?.(PRESS_INFO);
    expect(buffer.value).toBe('4');
    expect(press('clr').press?.(PRESS_INFO)).toBeNull();
    expect(buffer.value).toBe('');
    expect(changes()).toBe(2);
    expect(store.events()).toHaveLength(0);
  });

  it('release and discard change nothing, and a key is a momentary target', () => {
    const { store, buffer, press } = setup();
    const target = press('5');
    expect(target.cls).toBe('momentary');
    target.press?.(PRESS_INFO);
    target.release?.();
    target.discard?.();
    expect(buffer.value).toBe('5');
    expect(store.events()).toHaveLength(0);
    // A momentary target has no tap: a key never pairs, zooms or retracts.
    expect(Object.hasOwn(target, 'tap')).toBe(false);
  });
});

describe('registry checks of the code-entry kind (C-19)', () => {
  it('loads the shipped kp.squawk with the default 1200', () => {
    const def = squawkDef();
    expect(def.default).toBe('1200');
    expect(def.digits).toBe(4);
    expect(DA50RG.get(SQUAWK_ID)?.region).toBe('transponder');
  });

  it('rejects 5 digits, before any enumeration', () => {
    expect(loadError({ digits: 5, default: '12000' })).toMatch(/1 to 4 digits/);
  });

  it('rejects a code space above 4096', () => {
    expect(loadError({ alphabet: '012345678', default: '1200' })).toMatch(/code space/);
  });

  it('rejects a repeated alphabet character', () => {
    expect(loadError({ alphabet: '01234566' })).toMatch(/repeats a character/);
  });

  it('rejects a missing key', () => {
    expect(loadError({ keys: SPEC.keys.slice(1) })).toMatch(/needs 9 keys/);
  });

  it('rejects a key missing in place of a duplicate', () => {
    const keys = SPEC.keys.map((k) => (k.key === '0' ? { ...k, key: '1' } : k));
    expect(loadError({ keys })).toMatch(/two keys "1"/);
  });

  it('rejects a key outside the alphabet', () => {
    const keys = SPEC.keys.map((k) => (k.key === '7' ? { ...k, key: '8' } : k));
    expect(loadError({ keys })).toMatch(/outside its alphabet/);
  });

  it('rejects a key outside the hit footprint', () => {
    const keys = SPEC.keys.map((k) => (k.key === '3' ? { ...k, x: SPEC.hit.w } : k));
    expect(loadError({ keys })).toMatch(/leaves the .* hit footprint/);
  });

  it('rejects two overlapping keys', () => {
    const zero = SPEC.keys.find((k) => k.key === '0');
    const keys = SPEC.keys.map((k) =>
      k.key === '1' ? { ...k, x: zero?.x ?? 0, y: zero?.y ?? 0 } : k,
    );
    expect(loadError({ keys })).toMatch(/overlap/);
  });

  it('rejects a readout that overlaps a key', () => {
    const zero = SPEC.keys.find((k) => k.key === '0');
    expect(loadError({ display: { x: zero?.x ?? 0, y: zero?.y ?? 0, w: 40, h: 20 } })).toMatch(
      /overlap/,
    );
  });

  it('rejects a default that is not a legal code', () => {
    expect(loadError({ default: '1289' })).toMatch(/not a legal code/);
    expect(loadError({ default: '120' })).toMatch(/not a legal code/);
  });

  it('legalStates has alphabet size to the power of digits entries and is memoised', () => {
    const def = squawkDef();
    const states = legalStates(def);
    expect(states).toHaveLength(spaceOf(def));
    expect(new Set(states).size).toBe(states.length);
    expect(states).toContain('7700');
    expect(states).toContain('0000');
    expect(states).toContain('7777');
    expect(states).not.toContain('7800');
    expect(states).not.toContain('770');
    // The second call returns the very same array, so loops over every control stay fast.
    expect(legalStates(def)).toBe(states);
  });

  it('refuses to enumerate a code space above 4096 even when the load check was bypassed', () => {
    const rogue = { ...SPEC, alphabet: '012345678' } as ControlDef;
    expect(() => legalStates(rogue)).toThrow(RegistryError);
  });
});

describe('store validation of a code (T-03-06)', () => {
  it('accepts 7700 and rejects 7800 and 770 as illegal-state', () => {
    const store = new PanelStore(DA50RG);
    expect(store.dispatch(SQUAWK_ID, '7800', 1)).toEqual({ ok: false, reason: 'illegal-state' });
    expect(store.dispatch(SQUAWK_ID, '770', 1)).toEqual({ ok: false, reason: 'illegal-state' });
    expect(store.dispatch(SQUAWK_ID, '', 1)).toEqual({ ok: false, reason: 'illegal-state' });
    expect(store.events()).toHaveLength(0);
    const result = store.dispatch(SQUAWK_ID, '7700', 2);
    expect(result.ok).toBe(true);
    expect(store.get(SQUAWK_ID)).toBe('7700');
    expect(store.dispatch(SQUAWK_ID, '7700', 3)).toEqual({ ok: false, reason: 'unchanged' });
  });
});

describe('grading a committed code (D-11)', () => {
  // The scenario is built from the minimal fixture: its second critical step asks for the code.
  const text = swap(
    swap(
      swap(MINIMAL, 'id: open_cowl_flap', 'id: squawk_7700'),
      'text: Open cowl flap',
      'text: Squawk 7700',
    ),
    'control: lv.cowl_flap\n          is: open',
    `control: ${SQUAWK_ID}\n          is: "7700"`,
  );
  const parsed = parseScenario(text);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  const scenario = parsed.value;

  function run(events: Recording['events']) {
    return grade(scenario, DA50RG_ENV, { scenarioId: scenario.id, completedAt: 99000, events });
  }
  const credited = (events: Recording['events']) =>
    run(events).steps.find((s) => s.id === 'squawk_7700')?.credited;

  it('credits the step state kp.squawk is 7700 after the code was entered', () => {
    expect(credited([{ t: 5000, id: SQUAWK_ID, value: '7700' }])).toBe(true);
  });

  it('does not credit it without the code, or with another code', () => {
    expect(credited([])).toBe(false);
    expect(credited([{ t: 5000, id: SQUAWK_ID, value: '7600' }])).toBe(false);
  });

  it('does not keep the credit when the code is changed away again', () => {
    expect(
      credited([
        { t: 5000, id: SQUAWK_ID, value: '7700' },
        { t: 6000, id: SQUAWK_ID, value: '1200' },
      ]),
    ).toBe(false);
  });
});
