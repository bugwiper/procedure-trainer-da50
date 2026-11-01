import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { ATTITUDE } from '../src/aircraft/da50rg/pfd-layout';
import { SVT_STYLES, SyntheticVision } from '../src/ui/panel/frames/SyntheticVision';
import { SCENE_GRADIENTS } from '../src/ui/panel/windscreen/scenes';
import { expand, findElements } from './vnode-walk';
import type { El } from './vnode-walk';

// The synthetic vision of the PFD (Phase 6.1, PNL-26): one style per scene id of the aircraft data,
// painted from the palette table the windscreen reads too, a pure component without text.

const draw = (scene: string): El =>
  expand(SyntheticVision({ scene, cx: ATTITUDE.cx, cy: ATTITUDE.cy, reach: ATTITUDE.reach }));

/** The stop colours of the gradient `id` defined inside the tree, in document order. */
function stopColours(tree: El, id: string): string[] {
  const gradient = findElements(tree, (e) => e.tag === 'linearGradient' && e.props['id'] === id)[0];
  if (gradient === undefined) throw new Error(`no gradient ${id}`);
  return findElements(gradient, (e) => e.tag === 'stop').map((s) => String(s.props['stop-color']));
}

/** The colours a palette entry names, top, middle (if any), bottom. */
function paletteColours(id: keyof typeof SCENE_GRADIENTS): string[] {
  const { top, mid, bottom } = SCENE_GRADIENTS[id];
  return mid === null ? [top, bottom] : [top, mid, bottom];
}

describe('the style record', () => {
  it('covers every scene id of the aircraft data and nothing else', () => {
    expect(Object.keys(SVT_STYLES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('names only palette entries', () => {
    for (const style of Object.values(SVT_STYLES)) {
      expect(Object.keys(SCENE_GRADIENTS)).toContain(style.sky);
      expect(Object.keys(SCENE_GRADIENTS)).toContain(style.ground);
    }
  });
});

describe('the component', () => {
  it.each(SCENE_IDS)('%s: the root carries the drawn scene id', (scene) => {
    const root = draw(scene);
    expect(root.props['data-svt']).toBeDefined();
    expect(root.props['data-svt-scene']).toBe(scene);
  });

  it.each(SCENE_IDS)(
    '%s: the sky and ground gradients equal the palette entries of the style',
    (scene) => {
      const tree = draw(scene);
      const style = SVT_STYLES[scene];
      expect(stopColours(tree, 'pfd-svt-sky')).toEqual(paletteColours(style.sky));
      expect(stopColours(tree, 'pfd-svt-ground')).toEqual(paletteColours(style.ground));
    },
  );

  it('draws an unknown scene id as the default scene', () => {
    const tree = draw('no_such_scene');
    expect(tree.props['data-svt-scene']).toBe(DEFAULT_SCENE);
    expect(stopColours(tree, 'pfd-svt-sky')).toEqual(paletteColours(SVT_STYLES[DEFAULT_SCENE].sky));
  });

  it.each(SCENE_IDS)('%s: has no text element and expands without a render context', (scene) => {
    expect(findElements(draw(scene), (e) => e.tag === 'text' || e.tag === 'tspan')).toEqual([]);
  });

  it('draws the runway on the take-off roll only', () => {
    for (const scene of SCENE_IDS) {
      const runway = findElements(draw(scene), (e) => e.props['data-svt-art'] === 'runway');
      expect(runway.length, scene).toBe(scene === 'takeoff_roll' ? 1 : 0);
    }
  });

  it('keeps every paint reference on a gradient it defines itself', () => {
    for (const scene of SCENE_IDS) {
      const tree = draw(scene);
      const defined = new Set(
        findElements(tree, (e) => e.tag === 'linearGradient').map((e) => String(e.props['id'])),
      );
      for (const id of defined) expect(id.startsWith('pfd-svt-'), id).toBe(true);
      for (const el of findElements(tree, () => true)) {
        const fill = el.props['fill'];
        const match = typeof fill === 'string' ? /^url\(#([^)]+)\)$/.exec(fill) : null;
        if (match !== null)
          expect(defined.has(match[1] ?? ''), `${scene} ${String(fill)}`).toBe(true);
      }
    }
  });
});
