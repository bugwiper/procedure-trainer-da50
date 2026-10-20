import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type { ControlDef, GuardedToggleDef, ToggleDef } from '../src/engine/registry';
import { RockerBody } from '../src/ui/panel/skins/Rocker';
import { expand, findElements, textOf } from './vnode-walk';
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
});
