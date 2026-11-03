import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { ATTITUDE } from '../src/aircraft/da50rg/pfd-layout';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
import {
  FIELD_HALF_VIEW,
  SVT_STYLES,
  SyntheticVision,
} from '../src/ui/panel/frames/SyntheticVision';
import type { Session } from '../src/ui/session';
import { FIELD_PALETTE, fieldPolygons } from '../src/ui/panel/windscreen/field';
import { WATER_PALETTE, waterPolygons } from '../src/ui/panel/windscreen/water';
import { OPENING, SCENE_CENTRE_X } from '../src/ui/panel/windscreen/geometry';
import { HORIZON_Y, SCENES, SCENE_GRADIENTS } from '../src/ui/panel/windscreen/scenes';
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
    cueLevels: { value: {} },
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

// The art of the scenes (plan 02, task 3).

/**
 * The most shapes one scene may draw: the phones redraw the PFD on every 100 ms simulation step
 * (T-06.1-04), so the view stays flat paint with a small element count.
 */
const MAX_SHAPES_PER_SCENE = 60;
const SHAPE_TAGS = ['rect', 'polygon', 'path', 'line', 'ellipse', 'circle', 'polyline'];

describe('the art of the four scenes', () => {
  const shapes = (scene: string): El[] =>
    findElements(draw(scene), (e) => SHAPE_TAGS.includes(e.tag));

  it.each(SCENE_IDS)('%s: stays under the element cap', (scene) => {
    expect(shapes(scene).length).toBeGreaterThan(3);
    expect(shapes(scene).length).toBeLessThanOrEqual(MAX_SHAPES_PER_SCENE);
  });

  it.each(SCENE_IDS)('%s: draws no filter, mask, clip, image or animation', (scene) => {
    const banned = ['filter', 'mask', 'clipPath', 'image', 'animate', 'animateTransform', 'use'];
    expect(findElements(draw(scene), (e) => banned.includes(e.tag))).toEqual([]);
  });

  it('cruise and cloud draw field patches with a third of the patches left out', () => {
    for (const scene of ['cruise', 'cloud'] as const) {
      const fields = findElements(draw(scene), (e) => e.props['data-svt-art'] === 'fields')[0];
      const patches = findElements(fields as El, (e) => e.tag === 'polygon').length;
      expect(patches, scene).toBeGreaterThan(15);
      // The record has 6 row bands of 10 line bands: 60 cells, a diagonal third left out.
      expect(patches, scene).toBeLessThan(60);
      expect(patches, scene).toBeGreaterThan(60 / 2);
    }
  });

  it('parked draws the apron seams and one yellow taxi wedge', () => {
    const tree = draw('parked');
    expect(findElements(tree, (e) => e.props['data-svt-art'] === 'apron')).toHaveLength(1);
    const taxi = findElements(tree, (e) => 'data-svt-taxi' in e.props);
    expect(taxi).toHaveLength(1);
    expect(String(taxi[0]?.props['fill']).toLowerCase()).toMatch(/^#e/);
  });

  it('the take-off roll draws the runway, two white edge lines and a dashed centre line', () => {
    const tree = draw('takeoff_roll');
    expect(findElements(tree, (e) => 'data-svt-edge' in e.props)).toHaveLength(2);
    const dashes = findElements(tree, (e) => 'data-svt-dash' in e.props);
    expect(dashes.length).toBeGreaterThanOrEqual(3);
    // Every dash is a trapezoid of four points and the dashes shrink with the depth (higher up).
    const widthOf = (el: El): number => {
      const xs = String(el.props['points'])
        .split(' ')
        .map((p) => Number(p.split(',')[0]));
      return Math.max(...xs) - Math.min(...xs);
    };
    for (const dash of dashes) expect(String(dash.props['points']).split(' ')).toHaveLength(4);
    for (let i = 1; i < dashes.length; i += 1) {
      expect(widthOf(dashes[i] as El)).toBeLessThan(widthOf(dashes[i - 1] as El));
    }
  });

  it('every scene keeps the haze band at the horizon', () => {
    for (const scene of SCENE_IDS) {
      expect(
        findElements(draw(scene), (e) => 'data-svt-haze' in e.props),
        scene,
      ).toHaveLength(1);
    }
  });

  it('reaches past the zone: the sky and ground rectangles span 2 x reach about the centre', () => {
    const tree = draw('cruise');
    const rects = findElements(tree, (e) => e.tag === 'rect');
    for (const rect of rects) {
      expect(Number(rect.props['x'])).toBe(ATTITUDE.cx - ATTITUDE.reach);
      expect(Number(rect.props['width'])).toBe(2 * ATTITUDE.reach);
    }
  });
});

// The landing field of the approach scene (Phase 9, D-05, D-07): the synthetic vision draws the
// polygons of field.ts that the windscreen draws too, at the level of the cue field_near.

const drawField = (scene: string, artLevel: number): El =>
  expand(
    SyntheticVision({ scene, cx: ATTITUDE.cx, cy: ATTITUDE.cy, reach: ATTITUDE.reach, artLevel }),
  );

/** The points of a polygon attribute as numbers. */
const pointsOf = (el: El): [number, number][] =>
  String(el.props['points'])
    .split(' ')
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number) as [number, number];
      return [x, y];
    });

const SVT_FIELD = (tree: El): El[] =>
  findElements(tree, (e) => e.props['data-svt-field'] !== undefined);

/** Width and height of the box around the points. */
function extent(points: readonly [number, number][]): { width: number; height: number } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

describe('the landing field of the outlanding scene', () => {
  it('has the style outlanding with the cruise palette and its own art kind', () => {
    expect(SVT_STYLES.outlanding.art).toBe('outlanding');
    expect(SVT_STYLES.outlanding.sky).toBe(SVT_STYLES.cruise.sky);
    expect(SVT_STYLES.outlanding.ground).toBe(SVT_STYLES.cruise.ground);
  });

  it('draws the art and the field for its scene only', () => {
    for (const scene of SCENE_IDS) {
      const tree = drawField(scene, 1);
      const art = findElements(tree, (e) => e.props['data-svt-art'] === 'outlanding');
      expect(art.length, scene).toBe(scene === 'outlanding' ? 1 : 0);
      expect(SVT_FIELD(tree).length, scene).toBe(scene === 'outlanding' ? 1 : 0);
    }
  });

  it('paints the field from the shared palette', () => {
    const tree = drawField('outlanding', 0.6);
    const fills = findElements(tree, () => true).map((e) => e.props['fill']);
    expect(fills).toContain(FIELD_PALETTE.hedge);
    expect(fills).toContain(FIELD_PALETTE.stubble);
    expect(fills).toContain(FIELD_PALETTE.furrow);
  });

  it('grows in extent with the level: 0.2, 0.6 and 1', () => {
    const sizes = [0.2, 0.6, 1].map((level) => {
      const polygon = SVT_FIELD(drawField('outlanding', level))[0];
      if (polygon === undefined) throw new Error('no field polygon');
      return extent(pointsOf(polygon));
    });
    const [a, b, c] = sizes as [(typeof sizes)[0], (typeof sizes)[0], (typeof sizes)[0]];
    expect(b.width).toBeGreaterThan(a.width);
    expect(b.height).toBeGreaterThan(a.height);
    expect(c.width).toBeGreaterThan(b.width);
    expect(c.height).toBeGreaterThan(b.height);
  });

  it('defaults the level to 0: a speck, narrower than a few percent of the view', () => {
    const defaulted = expand(
      SyntheticVision({
        scene: 'outlanding',
        cx: ATTITUDE.cx,
        cy: ATTITUDE.cy,
        reach: ATTITUDE.reach,
      }),
    );
    expect(JSON.stringify(defaulted)).toBe(JSON.stringify(drawField('outlanding', 0)));
    const polygon = SVT_FIELD(defaulted)[0];
    if (polygon === undefined) throw new Error('no field polygon');
    expect(extent(pointsOf(polygon)).width).toBeLessThan(0.1 * 2 * ATTITUDE.reach);
  });

  it('draws the same field as the windscreen: both projections invert to fieldPolygons', () => {
    const depth = OPENING.y + OPENING.h - HORIZON_Y;
    for (const level of [0, 0.2, 0.6, 1]) {
      const expected = fieldPolygons(level).outer;
      const svt = SVT_FIELD(drawField('outlanding', level))[0];
      const windscreen = findElements(
        expand(SCENES.outlanding({ cues: { field_near: level } })),
        (e) => e.props['data-part'] === 'field',
      )[0];
      expect(svt).toBeDefined();
      expect(windscreen).toBeDefined();
      if (svt === undefined || windscreen === undefined) return;
      pointsOf(svt).forEach(([x, y], i) => {
        const [lateral, row] = expected[i] ?? [Number.NaN, Number.NaN];
        expect((x - ATTITUDE.cx) / FIELD_HALF_VIEW).toBeCloseTo(lateral, 3);
        expect((y - ATTITUDE.cy) / ATTITUDE.reach).toBeCloseTo(row, 3);
      });
      pointsOf(windscreen).forEach(([x, y], i) => {
        const [lateral, row] = expected[i] ?? [Number.NaN, Number.NaN];
        expect((x - SCENE_CENTRE_X) / (OPENING.w / 2)).toBeCloseTo(lateral, 3);
        expect((y - HORIZON_Y) / depth).toBeCloseTo(row, 3);
      });
    }
  });

  it('draws no text and no animation, filter or mask', () => {
    const tree = drawField('outlanding', 0.7);
    expect(findElements(tree, (e) => e.tag === 'text' || e.tag === 'tspan')).toEqual([]);
    expect(findElements(tree, (e) => /^(animate|filter|mask)/.test(e.tag))).toEqual([]);
    expect(findElements(tree, (e) => 'filter' in e.props || 'mask' in e.props)).toEqual([]);
  });

  it('leaves the other scenes unchanged by an art level', () => {
    for (const scene of SCENE_IDS.filter((id) => id !== 'outlanding' && id !== 'ditching')) {
      expect(JSON.stringify(drawField(scene, 1))).toBe(JSON.stringify(drawField(scene, 0)));
    }
  });
});

// The sea of the ditching scene (Phase 9, plan 09-04, R-03): the synthetic vision draws the polygons of
// water.ts that the windscreen draws too, at the level of the cue water_near.

const SVT_WAVES = (tree: El): El[] =>
  findElements(tree, (e) => e.props['data-svt-wave'] !== undefined);

describe('the sea of the ditching scene', () => {
  it('has the style ditching with the cruise sky, the sea ground and its own art kind', () => {
    expect(SVT_STYLES.ditching.art).toBe('ditching');
    expect(SVT_STYLES.ditching.sky).toBe(SVT_STYLES.cruise.sky);
    expect(SVT_STYLES.ditching.ground).toBe('w-ground-sea');
    expect(SCENE_GRADIENTS['w-ground-sea']).toBeDefined();
  });

  it('draws the art for its scene only', () => {
    for (const scene of SCENE_IDS) {
      const tree = drawField(scene, 1);
      const art = findElements(tree, (e) => e.props['data-svt-art'] === 'ditching');
      expect(art.length, scene).toBe(scene === 'ditching' ? 1 : 0);
      expect(SVT_WAVES(tree).length > 0, scene).toBe(scene === 'ditching');
    }
  });

  it('paints the bands from the shared palette', () => {
    const fills = findElements(drawField('ditching', 0.6), () => true).map((e) => e.props['fill']);
    expect(fills).toContain(WATER_PALETTE.trough);
    expect(fills).toContain(WATER_PALETTE.crest);
  });

  it('moves the nearest band down and thickens it with the level: 0.2, 0.6 and 1', () => {
    const boxes = [0.2, 0.6, 1].map((level) => {
      const nearest = SVT_WAVES(drawField('ditching', level))[0];
      if (nearest === undefined) throw new Error('no wave polygon');
      const points = pointsOf(nearest);
      const ys = points.map(([, y]) => y);
      return { bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys) };
    });
    const [a, b, c] = boxes as [(typeof boxes)[0], (typeof boxes)[0], (typeof boxes)[0]];
    expect(b.bottom).toBeGreaterThan(a.bottom);
    expect(c.bottom).toBeGreaterThan(b.bottom);
    expect(b.height).toBeGreaterThan(a.height);
    expect(c.height).toBeGreaterThan(b.height);
    // At level 1 the nearest band reaches below the bottom of the view.
    expect(c.bottom).toBeGreaterThan(ATTITUDE.cy + ATTITUDE.reach);
  });

  it('draws the same bands as the windscreen: both projections invert to waterPolygons', () => {
    const depth = OPENING.y + OPENING.h - HORIZON_Y;
    for (const level of [0, 0.2, 0.6, 1]) {
      const expected = waterPolygons(level).troughs;
      const svt = SVT_WAVES(drawField('ditching', level));
      const windscreen = findElements(
        expand(SCENES.ditching({ cues: { water_near: level } })),
        (e) => e.props['data-part'] === 'wave-trough',
      );
      expect(svt.length).toBe(expected.length);
      expect(windscreen.length).toBe(expected.length);
      expected.forEach((quad, band) => {
        const fromSvt = svt[band];
        const fromWindscreen = windscreen[band];
        if (fromSvt === undefined || fromWindscreen === undefined) throw new Error('missing band');
        pointsOf(fromSvt).forEach(([x, y], i) => {
          const [lateral, row] = quad[i] ?? [Number.NaN, Number.NaN];
          expect((x - ATTITUDE.cx) / FIELD_HALF_VIEW).toBeCloseTo(lateral, 3);
          expect((y - ATTITUDE.cy) / ATTITUDE.reach).toBeCloseTo(row, 3);
        });
        pointsOf(fromWindscreen).forEach(([x, y], i) => {
          const [lateral, row] = quad[i] ?? [Number.NaN, Number.NaN];
          expect((x - SCENE_CENTRE_X) / (OPENING.w / 2)).toBeCloseTo(lateral, 3);
          expect((y - HORIZON_Y) / depth).toBeCloseTo(row, 3);
        });
      });
    }
  });

  it('draws no text and no animation, filter or mask', () => {
    const tree = drawField('ditching', 0.7);
    expect(findElements(tree, (e) => e.tag === 'text' || e.tag === 'tspan')).toEqual([]);
    expect(findElements(tree, (e) => /^(animate|filter|mask)/.test(e.tag))).toEqual([]);
    expect(findElements(tree, (e) => 'filter' in e.props || 'mask' in e.props)).toEqual([]);
  });

  it('the windscreen scene carries the cue and its level for the every-cue-has-art gate', () => {
    const group = findElements(
      expand(SCENES.ditching({ cues: { water_near: 0.4 } })),
      (e) => e.props['data-cue'] === 'water_near',
    )[0];
    expect(group?.props['data-level']).toBe(0.4);
  });
});
