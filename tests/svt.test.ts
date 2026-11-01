import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { ATTITUDE } from '../src/aircraft/da50rg/pfd-layout';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
import { SVT_STYLES, SyntheticVision } from '../src/ui/panel/frames/SyntheticVision';
import type { Session } from '../src/ui/session';
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

// D-02 guard (Phase 6.1, plan 02): the PFD stays free of a deviation bar and of a map. No paint of
// the PFD is magenta (the colour of such a bar and of a route), no element names a deviation or a
// map, and the inset map frame stays an empty frame.

/** Hue in degrees (0 to 360), saturation and lightness of a #rrggbb colour. */
function hsl(hex: string): { hue: number; saturation: number; lightness: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  return { hue, saturation, lightness };
}

/** Magenta by hue (280 to 335) and saturation over 0.5. */
function isMagenta(hex: string): boolean {
  const { hue, saturation } = hsl(hex);
  return hue >= 280 && hue <= 335 && saturation > 0.5;
}

describe('the magenta helper (self-test)', () => {
  it('flags magenta and passes the PFD colours', () => {
    expect(isMagenta('#ff00ff')).toBe(true);
    expect(isMagenta('#c0409a')).toBe(true);
    for (const ok of ['#ffffff', '#000000', '#f2c230', '#2c68ad', '#3fd1e0', '#7a5230']) {
      expect(isMagenta(ok), ok).toBe(false);
    }
  });
});

const pfdRegion = DA50RG.regions.find((r) => r.id === 'pfd');
if (pfdRegion === undefined) throw new Error('no pfd region');

function pfdTree(scene: string): El {
  const bridge = {
    registry: DA50RG,
    stateOf: () => ({ value: 'map' }),
    quantities: { value: DA50RG_QUANTITIES.baseValues() },
    cas: { value: [] },
  } as unknown as PanelBridge;
  const session = { scene: { value: scene } } as unknown as Session;
  return expand(PfdFrame({ region: pfdRegion as never, bridge, session }));
}

describe('the PFD stays free of a deviation bar and of a map (D-02)', () => {
  it.each(SCENE_IDS)('%s: no magenta paint anywhere on the PFD', (scene) => {
    const painted = findElements(pfdTree(scene), () => true).flatMap((e) =>
      ['fill', 'stroke', 'stop-color'].map((key) => e.props[key]),
    );
    const hexes = painted.filter(
      (v): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v),
    );
    expect(hexes.length).toBeGreaterThan(10);
    expect(hexes.filter(isMagenta)).toEqual([]);
  });

  it('has no element that names a deviation bar or a map (the inset map frame excepted)', () => {
    const marked = findElements(pfdTree(DEFAULT_SCENE), (e) =>
      Object.entries(e.props).some(([key, value]) => {
        if (key === 'data-inset-map') return false;
        const text = `${key} ${typeof value === 'string' ? value : ''}`;
        return key.startsWith('data-') || key === 'id' || key === 'class'
          ? /deviation|cdi|vdi|glideslope|\bmap\b|route|waypoint/i.test(text)
          : false;
      }),
    );
    expect(marked).toEqual([]);
  });

  it('keeps the inset map frame empty', () => {
    const frames = findElements(pfdTree(DEFAULT_SCENE), (e) => 'data-inset-map' in e.props);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.children).toEqual([]);
  });
});
