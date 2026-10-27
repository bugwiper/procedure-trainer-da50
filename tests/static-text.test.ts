import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type {
  CircuitBreakerDef,
  CodeEntryDef,
  ControlDef,
  DetentLeverDef,
  GuardedToggleDef,
  MomentaryButtonDef,
  RotaryDef,
  ToggleDef,
} from '../src/engine/registry';
import { BatBody } from '../src/ui/panel/skins/Bat';
import { BreakerBody } from '../src/ui/panel/skins/Breaker';
import { RockerBody } from '../src/ui/panel/skins/Rocker';
import { WindowBody } from '../src/ui/panel/skins/Window';
import { PushButtonBody } from '../src/ui/panel/skins/PushButton';
import type { PressedSide } from '../src/ui/panel/skins/PushButton';
import { LeverBody } from '../src/ui/panel/widgets/DetentLever';
import { CodeEntryBody } from '../src/ui/panel/widgets/CodeEntry';
import { GuardCover } from '../src/ui/panel/widgets/GuardedToggle';
import { RotaryBody } from '../src/ui/panel/widgets/Rotary';
import { SoftkeyBody } from '../src/ui/panel/widgets/Toggle';
import { CB_REFERENCE } from './layout-reference';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { Tree } from './vnode-walk';

// State-independent text gate (owner findings G-0.1, G-0.3): what a control prints must not
// change with its state. Pure vnode checks, no DOM. Later plans add the other families.

/** Sorted text strings of an expanded body. */
function textStrings(tree: Tree): string[] {
  return findElements(tree, (el) => el.tag === 'text')
    .map((el) => textOf(el))
    .sort();
}

type Rockerish = ToggleDef | GuardedToggleDef;

function isRockerish(c: ControlDef): c is Rockerish {
  return (
    (c.kind === 'toggle' && c.skin === 'rocker') ||
    (c.kind === 'guarded-toggle' && c.size !== undefined)
  );
}

const ROCKERS = DA50RG.controls.filter(isRockerish);

describe('toggle family text is state-independent', () => {
  it('rockers: the same text strings in every position', () => {
    expect(ROCKERS.length).toBeGreaterThan(0);
    for (const def of ROCKERS) {
      const texts = (['low', 'mid', 'high'] as const).map((position) =>
        textStrings(expand(RockerBody({ def, position, pressed: false }))),
      );
      expect(texts[0], def.id).toEqual([def.label]);
      expect(texts[1], def.id).toEqual(texts[0]);
      expect(texts[2], def.id).toEqual(texts[0]);
    }
  });

  it('bats: the same text strings in every position', () => {
    const bats = DA50RG.controls.filter(
      (c): c is ToggleDef => c.kind === 'toggle' && (c.skin ?? 'bat') === 'bat',
    );
    expect(bats.length).toBeGreaterThan(0);
    for (const def of bats) {
      const texts = (['low', 'mid', 'high'] as const).map((position) =>
        textStrings(expand(BatBody({ def, position, pressed: false }))),
      );
      // A nameless bat (the de-ice mode toggle) prints no text at all: placards name it.
      expect(texts[0], def.id).toEqual(def.nameless === true ? [] : [def.label]);
      expect(texts[1], def.id).toEqual(texts[0]);
      expect(texts[2], def.id).toEqual(texts[0]);
    }
  });

  it('softkeys: no printed text at all, selected or not, pressed or not', () => {
    const keys = DA50RG.controls.filter(
      (c): c is ToggleDef => c.kind === 'toggle' && c.skin === 'softkey',
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const def of keys) {
      for (const isSecond of [false, true]) {
        for (const pressed of [false, true]) {
          const tree = expand(SoftkeyBody({ isSecond, pressed }));
          expect(textStrings(tree), `${def.id} ${String(isSecond)} ${String(pressed)}`).toEqual([]);
          expect(
            findElements(tree, (el) => 'data-state-text' in el.props),
            def.id,
          ).toHaveLength(0);
        }
      }
    }
  });

  it('guard covers: no text, open or closed', () => {
    const guarded = DA50RG.controls.filter(
      (c): c is GuardedToggleDef => c.kind === 'guarded-toggle',
    );
    expect(guarded.length).toBeGreaterThan(0);
    for (const def of guarded) {
      for (const guardOpen of [false, true]) {
        expect(textStrings(expand(GuardCover({ def, guardOpen }))), def.id).toEqual([]);
      }
    }
  });
});

describe('lever family text is state-independent', () => {
  const levers = DA50RG.controls.filter((c): c is DetentLeverDef => c.kind === 'detent-lever');

  it('every lever at every detent: no state text, the same text strings, at most 40 elements', () => {
    expect(levers.length).toBeGreaterThanOrEqual(11);
    for (const def of levers) {
      const region = DA50RG.regions.find((r) => r.id === def.region);
      const regionWidth = region?.bounds.w ?? def.hit.w;
      const first = textStrings(
        expand(
          LeverBody({ def, state: def.detents[0]!.id, handlePos: 0, dragging: false, regionWidth }),
        ),
      );
      for (const detent of def.detents) {
        const tree = expand(
          LeverBody({ def, state: detent.id, handlePos: detent.pos, dragging: false, regionWidth }),
        );
        const id = `${def.id}/${detent.id}`;
        expect(
          findElements(tree, (el) => 'data-state-text' in el.props),
          id,
        ).toHaveLength(0);
        expect(textStrings(tree), id).toEqual(first);
        expect(countElements(tree), id).toBeLessThanOrEqual(40);
      }
    }
  });
});

describe('tap-toggle lever (parking flap) text is state-independent', () => {
  const flapLevers = DA50RG.controls.filter(
    (c): c is DetentLeverDef => c.kind === 'detent-lever' && c.tapToggle === true,
  );

  // The body marker each tap-toggle skin draws: FlapBody sets data-flap, PedalsBody data-pedals.
  const BODY_MARKER: Readonly<Record<string, string>> = {
    'parking-flap': 'data-flap',
    'toe-brakes': 'data-pedals',
    'door-release': 'data-door',
  };

  it('the PARKING BRAKE flap, the TOE BRAKES pedals and the DOOR RELEASE lever print no text in either state', () => {
    expect(flapLevers.map((d) => d.id).sort()).toEqual([
      'lv.door_release',
      'lv.parking_brake',
      'lv.toe_brakes',
    ]);
    for (const def of flapLevers) {
      for (const detent of def.detents) {
        const tree = expand(
          LeverBody({
            def,
            state: detent.id,
            handlePos: detent.pos,
            dragging: false,
            regionWidth: def.hit.w,
          }),
        );
        const id = `${def.id}/${detent.id}`;
        expect(
          findElements(tree, (el) => (BODY_MARKER[def.skin ?? ''] ?? '') in el.props),
          id,
        ).toHaveLength(1);
        expect(textStrings(tree), id).toEqual([]);
        expect(
          findElements(tree, (el) => 'data-state-text' in el.props),
          id,
        ).toHaveLength(0);
        expect(countElements(tree), id).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('window toggle (emergency window) text is state-independent', () => {
  const windows = DA50RG.controls.filter(
    (c): c is ToggleDef => c.kind === 'toggle' && c.skin === 'window',
  );

  it('the emergency window prints no text in either state, pressed or not, with a handful of elements', () => {
    expect(windows.map((d) => d.id)).toEqual(['sw.emerg_window']);
    for (const open of [false, true]) {
      for (const pressed of [false, true]) {
        const tree = expand(WindowBody({ open, pressed }));
        const id = `${String(open)}/${String(pressed)}`;
        expect(textStrings(tree), id).toEqual([]);
        expect(
          findElements(tree, (el) => 'data-state-text' in el.props),
          id,
        ).toHaveLength(0);
        expect(countElements(tree), id).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('push button family text is state-independent', () => {
  const buttons = DA50RG.controls.filter(
    (c): c is MomentaryButtonDef => c.kind === 'momentary-button',
  );

  it('every button in every state: no state text, the same text strings', () => {
    expect(buttons.length).toBeGreaterThan(0);
    for (const def of buttons) {
      const sideOf = (i: number): PressedSide =>
        def.states.length === 3 ? (i === 1 ? 'left' : i === 2 ? 'right' : null) : null;
      const renders = def.states.map((st, i) => ({ state: st.id, side: sideOf(i) }));
      const trees = renders.map(({ state, side }) =>
        expand(PushButtonBody({ def, state, pressedSide: side })),
      );
      const first = textStrings(trees[0]!);
      // A nameless button (the FADEC TEST button) prints no text at all: a placard names it.
      if (def.nameless === true) expect(first, def.id).toEqual([]);
      else expect(first.length, def.id).toBeGreaterThan(0);
      for (const tree of trees) {
        expect(
          findElements(tree, (el) => 'data-state-text' in el.props),
          def.id,
        ).toHaveLength(0);
        expect(textStrings(tree), def.id).toEqual(first);
      }
    }
  });

  it('the spring toggle keeps exactly its two captions STALL TEST and GEAR TEST', () => {
    const def = buttons.find((b) => b.skin === 'spring-bat');
    expect(def).toBeDefined();
    const tree = expand(PushButtonBody({ def: def!, state: 'neutral', pressedSide: null }));
    expect(textStrings(tree)).toEqual(['GEAR', 'STALL', 'TEST', 'TEST']);
  });
});

describe('knob family text is state-independent', () => {
  const knobs = DA50RG.controls.filter((c): c is RotaryDef => c.kind === 'rotary');

  it('every knob at every stop: no state text, the same text strings, at most 40 elements', () => {
    expect(knobs.length).toBeGreaterThan(0);
    for (const def of knobs) {
      const first = textStrings(
        expand(RotaryBody({ def, state: def.stops[0]!.id, pressed: false })),
      );
      // A nameless knob is named by a plate title or placard, not by its own text.
      if (def.nameless === true) expect(first, def.id).not.toContain(def.label.split(' ')[0]);
      else expect(first, def.id).toContain(def.label.split(' ')[0]);
      // The FAN prints OFF only: the three stops are fan symbols, no label, no number (G-3).
      if (def.id === 'sw.env_fan') {
        expect(first, def.id).toEqual(['OFF']);
        // Art unchanged by the click spots (R2-4.1): one disc, three glyphs, no hit rectangle.
        for (const stop of def.stops) {
          const tree = expand(RotaryBody({ def, state: stop.id, pressed: false }));
          expect(
            findElements(tree, (el) => el.tag === 'circle'),
            stop.id,
          ).toHaveLength(1);
          expect(
            findElements(tree, (el) => 'data-fan-symbol' in el.props).map(
              (el) => el.props['data-fan-symbol'],
            ),
            stop.id,
          ).toEqual(['f1', 'f2', 'f3']);
          expect(
            findElements(tree, (el) => 'data-hit' in el.props || 'data-detent' in el.props),
            stop.id,
          ).toHaveLength(0);
        }
      }
      for (const stop of def.stops) {
        for (const pressed of [false, true]) {
          const tree = expand(RotaryBody({ def, state: stop.id, pressed }));
          const id = `${def.id}/${stop.id}`;
          expect(
            findElements(tree, (el) => 'data-state-text' in el.props),
            id,
          ).toHaveLength(0);
          expect(textStrings(tree), id).toEqual(first);
          expect(countElements(tree), id).toBeLessThanOrEqual(40);
        }
      }
    }
  });
});

describe('circuit breaker family text is state-independent', () => {
  const breakers = DA50RG.controls.filter(
    (c): c is CircuitBreakerDef => c.kind === 'circuit-breaker',
  );

  it('every breaker in both states: the label lines and the rating only, no state text, at most 12 elements', () => {
    expect(breakers).toHaveLength(CB_REFERENCE.length);
    for (const def of breakers) {
      const expected = [...def.labelLines, def.rating].sort();
      for (const state of def.states.map((s) => s.id)) {
        for (const pressed of [false, true]) {
          const tree = expand(BreakerBody({ def, state, pressed }));
          const id = `${def.id}/${state}/${String(pressed)}`;
          expect(
            findElements(tree, (el) => 'data-state-text' in el.props),
            id,
          ).toHaveLength(0);
          expect(textStrings(tree), id).toEqual(expected);
          expect(countElements(tree), id).toBeLessThanOrEqual(12);
        }
      }
    }
  });
});

describe('code entry family text is state-independent except the readout (D-11, C-17)', () => {
  const units = DA50RG.controls.filter((c): c is CodeEntryDef => c.kind === 'code-entry');

  /** The text strings outside the readout element. */
  function staticStrings(def: CodeEntryDef, readout: string): string[] {
    const tree = expand(CodeEntryBody({ def, readout }));
    return findElements(tree, (el) => el.tag === 'text' && el.props['data-glass'] === undefined)
      .map((el) => textOf(el))
      .sort();
  }

  it('the name and the key legends are identical for two different codes', () => {
    expect(units.length).toBeGreaterThan(0);
    for (const def of units) {
      const a = staticStrings(def, '1200');
      expect(a, def.id).toEqual(staticStrings(def, '7700'));
      expect(a, def.id).toEqual(staticStrings(def, '7---'));
      // The name and one legend per key; no state text.
      expect(a, def.id).toEqual([def.label, ...def.keys.map((k) => k.label)].sort());
      expect(
        findElements(
          expand(CodeEntryBody({ def, readout: '7700' })),
          (el) => 'data-state-text' in el.props,
        ),
        def.id,
      ).toHaveLength(0);
    }
  });

  it('the only text that differs with the code is inside the element marked data-glass readout', () => {
    for (const def of units) {
      const render = (readout: string) => expand(CodeEntryBody({ def, readout }));
      const readouts = (readout: string) =>
        findElements(render(readout), (el) => el.props['data-glass'] === 'readout');
      const marked = readouts('1200');
      expect(marked, def.id).toHaveLength(1);
      expect(textOf(marked[0]!), def.id).toBe('1200');
      expect(textOf(readouts('7700')[0]!), def.id).toBe('7700');
      // Every text element is either the readout or one of the static labels.
      const texts = findElements(render('7700'), (el) => el.tag === 'text');
      expect(texts.length, def.id).toBe(def.keys.length + 2);
    }
  });
});
