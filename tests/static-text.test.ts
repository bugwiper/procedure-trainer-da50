import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type {
  ControlDef,
  DetentLeverDef,
  GuardedToggleDef,
  MomentaryButtonDef,
  RotaryDef,
  ToggleDef,
} from '../src/engine/registry';
import { BatBody } from '../src/ui/panel/skins/Bat';
import { RockerBody } from '../src/ui/panel/skins/Rocker';
import { PushButtonBody } from '../src/ui/panel/skins/PushButton';
import type { PressedSide } from '../src/ui/panel/skins/PushButton';
import { LeverBody } from '../src/ui/panel/widgets/DetentLever';
import { GuardCover } from '../src/ui/panel/widgets/GuardedToggle';
import { RotaryBody } from '../src/ui/panel/widgets/Rotary';
import { SoftkeyBody } from '../src/ui/panel/widgets/Toggle';
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
      expect(texts[0], def.id).toEqual([def.label]);
      expect(texts[1], def.id).toEqual(texts[0]);
      expect(texts[2], def.id).toEqual(texts[0]);
    }
  });

  it('softkeys: the same text strings selected and not selected', () => {
    const keys = DA50RG.controls.filter(
      (c): c is ToggleDef => c.kind === 'toggle' && c.skin === 'softkey',
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const def of keys) {
      const texts = [false, true].map((isSecond) =>
        textStrings(expand(SoftkeyBody({ def, labelWidth: 20, isSecond, pressed: false }))),
      );
      expect(texts[0], def.id).toEqual([def.label]);
      expect(texts[1], def.id).toEqual(texts[0]);
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
    expect(levers.length).toBeGreaterThanOrEqual(12);
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
      expect(first.length, def.id).toBeGreaterThan(0);
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
