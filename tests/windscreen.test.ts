import { describe, expect, it } from 'vitest';
import { DA50RG_CUES } from '../src/aircraft/da50rg/cues';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { CUE_VISIBLE_LEVEL } from '../src/engine/cues';
import { flameOpacity, flameScale } from '../src/ui/panel/windscreen/cue-layers';
import { CabinSmoke, SMOKE_MAX_OPACITY, smokeOpacity } from '../src/ui/panel/windscreen/CabinSmoke';
import { Windscreen } from '../src/ui/panel/windscreen/Windscreen';
import { OPENING_PATH } from '../src/ui/panel/windscreen/geometry';
import { PANEL_VIEWBOX, WINDSCREEN_REFERENCE } from './layout-reference';
import { expand, findElements, textOf } from './vnode-walk';
import type { El } from './vnode-walk';

// The windscreen layer (Phase 5, W-03 to W-06): pure flat-vector art without text.

const FORBIDDEN_TAGS = [
  'image',
  'filter',
  'mask',
  'feGaussianBlur',
  'feDropShadow',
  'foreignObject',
];

const render = (cues: Record<string, number>, scene = 'cruise'): El =>
  expand(Windscreen({ scene, cues }));

const flamesAt = (fire: number): Record<string, number> =>
  DA50RG_CUES.levels({ ...DA50RG_QUANTITIES.baseValues(), fire_intensity: fire });

const flames = (tree: El): El[] => findElements(tree, (el) => el.props['data-cue'] === 'flames');

describe('the windscreen layer', () => {
  const full = render(flamesAt(60));

  it('is one static layer with pointer-events none and no handler', () => {
    expect(full.tag).toBe('g');
    expect(full.props['data-layer']).toBe('windscreen');
    expect(full.props['pointer-events']).toBe('none');
    const offenders = findElements(full, (el) =>
      Object.keys(el.props).some(
        (key) => /^on[A-Z]/.test(key) || key === 'data-hit' || key === 'data-detent',
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('holds no text at all (G-0)', () => {
    expect(findElements(full, (el) => el.tag === 'text' || el.tag === 'tspan')).toEqual([]);
    expect(textOf(full).trim()).toBe('');
  });

  it.each(FORBIDDEN_TAGS)('uses no %s element', (tag) => {
    expect(findElements(full, (el) => el.tag === tag)).toEqual([]);
  });

  it('references only ids its own defs define, all prefixed w-', () => {
    const defined = new Set(
      findElements(full, (el) => el.tag !== 'defs' && typeof el.props['id'] === 'string').map(
        (el) => String(el.props['id']),
      ),
    );
    for (const id of defined) expect(id.startsWith('w-'), id).toBe(true);
    const used = new Set<string>();
    for (const el of findElements(full, () => true)) {
      for (const value of Object.values(el.props)) {
        if (typeof value !== 'string') continue;
        for (const match of value.matchAll(/url\(#([^)]+)\)/g)) used.add(match[1] ?? '');
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(defined.has(id), id).toBe(true);
  });

  it('clips to the arched opening, which spans the windscreen height and runs under the shield', () => {
    const clip = findElements(full, (el) => el.tag === 'clipPath');
    expect(clip).toHaveLength(1);
    const path = findElements(clip[0] as El, (el) => el.tag === 'path')[0];
    expect(path?.props['d']).toBe(OPENING_PATH);
    const ys = [...OPENING_PATH.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) =>
      Number(m[2]),
    );
    // The arch reaches up to the overhead strip and down below the glare shield top.
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-WINDSCREEN_REFERENCE.h);
    expect(Math.min(...ys)).toBeLessThan(-WINDSCREEN_REFERENCE.h * 0.9);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(100);
  });
});

describe('the frame parts', () => {
  const full = render({});
  const part = (name: string): El[] => findElements(full, (el) => el.props['data-part'] === name);

  it.each(['frame', 'strut', 'overhead', 'blade', 'cowl'])('draws the %s', (name) => {
    expect(part(name)).toHaveLength(1);
  });

  it('puts the strut over the hump of the glare shield at x 1130', () => {
    const strut = findElements(part('strut')[0] as El, (el) => el.tag === 'polygon')[0];
    const xs = String(strut?.props['points'])
      .split(' ')
      .map((p) => Number(p.split(',')[0]));
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(1130);
  });

  it('cuts the opening out of the frame with the even-odd rule', () => {
    const body = findElements(full, (el) => el.props['data-frame-body'] !== undefined)[0];
    expect(body?.props['fill-rule']).toBe('evenodd');
  });

  it('draws the blade translucent and above the hub, to the left of the strut', () => {
    const blade = part('blade')[0];
    expect(Number(blade?.props['fill-opacity'])).toBeLessThan(0.7);
    expect(Number(blade?.props['fill-opacity'])).toBeGreaterThan(0);
  });

  it('keeps the z-order: scene, blade, cowl, cues inside the clip, the frame after them', () => {
    const name = (c: El): string =>
      [c.props['data-part'], c.props['data-scene'], c.props['data-layer']].find(
        (v): v is string => typeof v === 'string',
      ) ?? c.tag;
    const order = (full.children as El[]).map((c) => `${c.tag}:${name(c)}`);
    expect(order.at(-1)).toBe('g:frame');
    const clipped = (full.children as El[]).find((c) => c.props['clip-path'] !== undefined) as El;
    const inner = (clipped.children as El[]).map(name);
    expect(inner).toEqual(['cruise', 'blade', 'cowl', 'cues']);
  });
});

describe('the scenes', () => {
  it('there is one scene per id of the aircraft data, the default among them', () => {
    expect(SCENE_IDS).toContain(DEFAULT_SCENE);
    expect(new Set(SCENE_IDS).size).toBe(SCENE_IDS.length);
  });

  it.each([...SCENE_IDS])('%s renders its own distinct data-scene group', (id) => {
    const tree = render({}, id);
    const groups = findElements(tree, (el) => el.props['data-scene'] !== undefined);
    expect(groups.map((g) => g.props['data-scene'])).toEqual([id]);
    expect(tree.props['data-scene-id']).toBe(id);
    expect(findElements(groups[0] as El, () => true).length).toBeGreaterThan(8);
  });

  it('the scenes differ in their art', () => {
    const sizes = SCENE_IDS.map((id) => JSON.stringify(render({}, id).children).length);
    expect(new Set(sizes).size).toBe(SCENE_IDS.length);
  });

  it('an unknown id falls back to the default scene', () => {
    const tree = render({}, 'no_such_scene');
    expect(findElements(tree, (el) => el.props['data-scene'] === DEFAULT_SCENE)).toHaveLength(1);
  });

  describe.each([...SCENE_IDS])('%s keeps the flat-vector rules', (id) => {
    const tree = render(flamesAt(60), id);
    it('holds no text', () => {
      expect(findElements(tree, (el) => el.tag === 'text' || el.tag === 'tspan')).toEqual([]);
    });
    it.each(FORBIDDEN_TAGS)('uses no %s element', (tag) => {
      expect(findElements(tree, (el) => el.tag === tag)).toEqual([]);
    });
    it('references only ids its own defs define', () => {
      const defined = new Set(
        findElements(tree, (el) => typeof el.props['id'] === 'string').map((el) =>
          String(el.props['id']),
        ),
      );
      const used = new Set<string>();
      for (const el of findElements(tree, () => true)) {
        for (const value of Object.values(el.props)) {
          if (typeof value !== 'string') continue;
          for (const match of value.matchAll(/url\(#([^)]+)\)/g)) used.add(match[1] ?? '');
        }
      }
      for (const name of used) expect(defined.has(name), name).toBe(true);
      for (const name of defined) expect(name.startsWith('w-'), name).toBe(true);
    });
  });
});

describe('the flames cue', () => {
  it('is absent below the visible level, on the free panel and at the Realistic start', () => {
    expect(flames(render({}))).toEqual([]);
    expect(flames(render(flamesAt(0)))).toEqual([]);
    const justBelow = CUE_VISIBLE_LEVEL * 60 - 0.5;
    expect(flames(render(flamesAt(justBelow)))).toEqual([]);
  });

  it('is present from the visible level with size and opacity from the level', () => {
    const at = (fire: number): El => {
      const found = flames(render(flamesAt(fire)));
      expect(found).toHaveLength(1);
      return found[0] as El;
    };
    const small = at(CUE_VISIBLE_LEVEL * 60 + 0.5);
    const developed = at(60);
    expect(Number(small.props['opacity'])).toBeLessThan(Number(developed.props['opacity']));
    expect(String(small.props['transform'])).not.toBe(String(developed.props['transform']));
    expect(Number(developed.props['opacity'])).toBeLessThanOrEqual(1);
  });

  it('grows with the level', () => {
    expect(flameScale(0.1)).toBeLessThan(flameScale(0.5));
    expect(flameScale(0.5)).toBeLessThan(flameScale(1));
    expect(flameOpacity(0.1)).toBeLessThan(flameOpacity(1));
    expect(flameScale(1)).toBe(1);
    expect(flameOpacity(1)).toBe(1);
  });

  it('shows at the Easy start value (intensity 40)', () => {
    expect(flames(render(flamesAt(40)))).toHaveLength(1);
  });

  it('has a smoke trail and flame tongues', () => {
    const group = flames(render(flamesAt(60)))[0] as El;
    expect(findElements(group, (el) => el.tag === 'circle').length).toBeGreaterThan(0);
    expect(findElements(group, (el) => el.tag === 'path').length).toBeGreaterThan(1);
  });
});

describe('the cowl', () => {
  it('has an edge clearly darker than its body so it never blends into cloud', () => {
    const body = findElements(render({}), (el) => el.props['data-cowl-body'] !== undefined)[0];
    expect(body).toBeDefined();
    const stroke = String(body?.props['stroke']);
    const first = findElements(
      render({}),
      (el) => el.tag === 'linearGradient' && el.props['id'] === 'w-cowl',
    )[0];
    const stops = findElements(first as El, (el) => el.tag === 'stop').map((s) =>
      String(s.props['stop-color']),
    );
    const luma = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    for (const body of stops) expect(luma(stroke)).toBeLessThan(luma(body) - 40);
  });
});

describe('the cabin smoke cue (Phase 5, C-02)', () => {
  const smoke = (level: number): El => expand(CabinSmoke({ level }));

  it('opacity follows the level and never exceeds the readable maximum', () => {
    expect(smokeOpacity(0)).toBe(0);
    expect(smokeOpacity(0.5)).toBeLessThan(smokeOpacity(1));
    expect(smokeOpacity(1)).toBe(SMOKE_MAX_OPACITY);
    expect(SMOKE_MAX_OPACITY).toBeLessThanOrEqual(0.75);
    expect(Number(smoke(0.4).props['opacity'])).toBe(smokeOpacity(0.4));
  });

  it('never takes a press: pointer-events none, aria-hidden, no handler, no text', () => {
    const tree = smoke(1);
    expect(tree.props['data-cue']).toBe('cabin_smoke');
    expect(tree.props['pointer-events']).toBe('none');
    expect(tree.props['aria-hidden']).toBe('true');
    const offenders = findElements(tree, (el) =>
      Object.keys(el.props).some((key) => /^on[A-Z]/.test(key) || key === 'data-hit'),
    );
    expect(offenders).toEqual([]);
    expect(findElements(tree, (el) => el.tag === 'text' || el.tag === 'tspan')).toEqual([]);
  });

  it.each(FORBIDDEN_TAGS)('uses no %s element', (tag) => {
    expect(findElements(smoke(1), (el) => el.tag === tag)).toEqual([]);
  });

  it('has its own w- gradients of at most three stops and references only those', () => {
    const tree = smoke(1);
    const gradients = findElements(
      tree,
      (el) => el.tag === 'linearGradient' || el.tag === 'radialGradient',
    );
    expect(gradients.length).toBeGreaterThan(0);
    for (const gradient of gradients) {
      expect(String(gradient.props['id']).startsWith('w-')).toBe(true);
      expect(findElements(gradient, (el) => el.tag === 'stop').length).toBeLessThanOrEqual(3);
    }
    const defined = new Set(gradients.map((g) => String(g.props['id'])));
    const used = new Set<string>();
    for (const el of findElements(tree, () => true)) {
      for (const value of Object.values(el.props)) {
        if (typeof value !== 'string') continue;
        for (const match of value.matchAll(/url\(#([^)]+)\)/g)) used.add(match[1] ?? '');
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(defined.has(id), id).toBe(true);
  });

  it('covers the whole extent with a haze, so no region is left clear', () => {
    const haze = findElements(smoke(1), (el) => el.tag === 'rect')[0];
    expect(Number(haze?.props['y'])).toBe(-WINDSCREEN_REFERENCE.h);
    expect(Number(haze?.props['width'])).toBeGreaterThanOrEqual(PANEL_VIEWBOX.w);
    expect(Number(haze?.props['y']) + Number(haze?.props['height'])).toBeGreaterThanOrEqual(
      PANEL_VIEWBOX.h,
    );
  });
});
