import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG_CUES } from '../src/aircraft/da50rg/cues';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { CUE_VISIBLE_LEVEL } from '../src/engine/cues';
import { flameOpacity, flameScale } from '../src/ui/panel/windscreen/cue-layers';
import {
  OIL_MAX_OPACITY,
  OIL_TABLE_SIZE,
  oilOpacity,
  oilStreakCount,
} from '../src/ui/panel/windscreen/OilStreaks';
import { BLUR_OPACITY } from '../src/ui/panel/windscreen/frame';
import {
  CRYSTAL_TABLE_SIZE,
  VEIL_MAX_OPACITY,
  crystalCount,
  veilOpacity,
} from '../src/ui/panel/windscreen/Ice';
import { CabinSmoke, SMOKE_MAX_OPACITY, smokeOpacity } from '../src/ui/panel/windscreen/CabinSmoke';
import { SCENES } from '../src/ui/panel/windscreen/scenes';
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

const render = (cues: Record<string, number>, scene = 'cruise', spray = false): El =>
  expand(Windscreen({ scene, cues, spray }));

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
    const clip = findElements(
      full,
      (el) => el.tag === 'clipPath' && el.props['id'] === 'w-opening',
    );
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
    expect(inner).toEqual(['cruise', 'blade', 'cowl', 'ice', 'cues']);
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

describe('the cloud scene and the moving runway (phase 05 plan 03, A-05)', () => {
  const css = readFileSync(new URL('../src/ui/stage.css', import.meta.url), 'utf8');
  const marks = (id: string): El[] =>
    findElements(render({}, id), (el) => el.props['class'] === 'w-roll-mark');

  it('the scene ids are the keys of the art record, the cloud among them', () => {
    expect([...SCENE_IDS].sort()).toEqual(Object.keys(SCENES).sort());
    expect(SCENE_IDS).toContain('cloud');
  });

  it('the cloud scene is one sheet: no horizon, no landscape, no moving part', () => {
    const tree = render({}, 'cloud');
    const scene = findElements(tree, (el) => el.props['data-scene'] === 'cloud')[0] as El;
    const paints = findElements(scene, (el) => typeof el.props['fill'] === 'string').map((el) =>
      String(el.props['fill']),
    );
    expect(paints[0]).toBe('url(#w-cloud)');
    expect(findElements(scene, (el) => el.tag === 'polygon' || el.tag === 'path')).toEqual([]);
    expect(marks('cloud')).toEqual([]);
  });

  it('only the take-off roll carries the scrolling marks', () => {
    for (const id of SCENE_IDS) {
      if (id === 'takeoff_roll') expect(marks(id).length).toBeGreaterThan(0);
      else expect(marks(id)).toEqual([]);
    }
  });

  it('every mark brings both animation properties, the end beyond the middle beyond 1', () => {
    for (const mark of marks('takeoff_roll')) {
      const style = String(mark.props['style']);
      const mid = Number(/--roll-mid:([\d.]+)/.exec(style)?.[1]);
      const end = Number(/--roll-to:([\d.]+)/.exec(style)?.[1]);
      expect(mid).toBeGreaterThan(1);
      expect(end).toBeGreaterThan(mid);
    }
  });

  it('the scrolling is CSS only, at one named speed, and stops under reduced motion', () => {
    expect(css).toMatch(/\.panel-svg \.w-roll-mark\s*\{[^}]*--w-roll-period:/);
    expect(css).toMatch(/@keyframes w-roll\b/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.w-roll-mark\s*\{\s*animation:\s*none/);
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
    const defined = new Set(
      findElements(tree, (el) => typeof el.props['id'] === 'string').map((el) =>
        String(el.props['id']),
      ),
    );
    for (const id of defined) expect(id.startsWith('w-'), id).toBe(true);
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

describe('the ice cues and the spray (Phase 5, C-05, owner answers of 2026-10-27)', () => {
  const iceAt = (pilot: number, copilot: number): Record<string, number> =>
    DA50RG_CUES.levels({
      ...DA50RG_QUANTITIES.baseValues(),
      ice_pilot: pilot,
      ice_copilot: copilot,
    });
  const side = (tree: El, name: 'pilot' | 'copilot'): El[] =>
    findElements(tree, (el) => el.props['data-cue'] === `ice_${name}_side`);
  const spray = (tree: El): El[] =>
    findElements(tree, (el) => el.props['data-spray'] !== undefined);
  const crystalPath = (el: El): string =>
    String(findElements(el, (e) => e.tag === 'path')[0]?.props['d']);

  it('draws nothing on clear glass or below the visible level', () => {
    expect(side(render(iceAt(0, 0)), 'pilot')).toEqual([]);
    expect(side(render(iceAt(0, 0)), 'copilot')).toEqual([]);
    const below = CUE_VISIBLE_LEVEL * 60 - 0.5;
    expect(side(render(iceAt(below, below)), 'pilot')).toEqual([]);
    expect(side(render(iceAt(below, below)), 'copilot')).toEqual([]);
  });

  it('draws each side from its own level, the other one stays clear', () => {
    expect(side(render(iceAt(40, 0)), 'pilot')).toHaveLength(1);
    expect(side(render(iceAt(40, 0)), 'copilot')).toEqual([]);
    expect(side(render(iceAt(0, 40)), 'pilot')).toEqual([]);
    expect(side(render(iceAt(0, 40)), 'copilot')).toHaveLength(1);
  });

  it('clips each side to its own half of the opening, split at the strut', () => {
    const tree = render(iceAt(60, 60));
    const clips = findElements(
      tree,
      (el) => el.tag === 'clipPath' && String(el.props['id']).startsWith('w-ice-'),
    );
    expect(clips.map((c) => c.props['id'])).toEqual(['w-ice-pilot', 'w-ice-copilot']);
    const [left, right] = clips.map((c) => findElements(c, (e) => e.tag === 'rect')[0]);
    expect(Number(left?.props['x']) + Number(left?.props['width'])).toBe(1130);
    expect(Number(right?.props['x'])).toBe(1130);
    expect(side(tree, 'pilot')[0]?.props['clip-path']).toBe('url(#w-ice-pilot)');
    expect(side(tree, 'copilot')[0]?.props['clip-path']).toBe('url(#w-ice-copilot)');
  });

  it('thickens the veil with the level and never exceeds the maximum', () => {
    expect(veilOpacity(0.2)).toBeLessThan(veilOpacity(0.8));
    expect(veilOpacity(1)).toBe(VEIL_MAX_OPACITY);
    expect(VEIL_MAX_OPACITY).toBeLessThanOrEqual(0.7);
  });

  it('adds crystals with the level from a fixed table, the same on every render', () => {
    expect(crystalCount(0.1)).toBeGreaterThanOrEqual(1);
    expect(crystalCount(0.1)).toBeLessThan(crystalCount(0.5));
    expect(crystalCount(0.5)).toBeLessThan(crystalCount(1));
    expect(crystalCount(1)).toBe(CRYSTAL_TABLE_SIZE);
    const a = crystalPath(side(render(iceAt(30, 0)), 'pilot')[0] as El);
    const b = crystalPath(side(render(iceAt(30, 0)), 'pilot')[0] as El);
    const more = crystalPath(side(render(iceAt(50, 0)), 'pilot')[0] as El);
    expect(a).toBe(b);
    expect(more.startsWith(a)).toBe(true);
    expect(more.length).toBeGreaterThan(a.length);
    expect(String(side(render(iceAt(30, 0)), 'pilot')[0]?.props['data-crystals'])).toBe(
      String(crystalCount(0.5)),
    );
  });

  it('keeps the crystals of the two sides apart (different tables)', () => {
    const tree = render(iceAt(60, 60));
    expect(crystalPath(side(tree, 'pilot')[0] as El)).not.toBe(
      crystalPath(side(tree, 'copilot')[0] as El),
    );
  });

  it('shows the spray only while the flag is set, and then on the pilot half only', () => {
    expect(spray(render(iceAt(0, 0)))).toEqual([]);
    expect(spray(render(iceAt(60, 60), 'cruise', false))).toEqual([]);
    const on = spray(render(iceAt(0, 0), 'cruise', true));
    expect(on).toHaveLength(1);
    expect(on[0]?.props['data-spray']).toBe('pilot');
    expect(on[0]?.props['clip-path']).toBe('url(#w-ice-pilot)');
    const streaks = findElements(on[0] as El, (el) => el.props['class'] === 'w-spray')[0];
    const xs = [
      ...String(streaks?.props['d']).matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g),
    ].map((m) => Number(m[1]));
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) expect(x).toBeLessThan(1130);
  });

  it('runs the streaks upward: every streak ends higher than it starts', () => {
    const on = spray(render(iceAt(0, 0), 'cruise', true))[0] as El;
    const d = String(findElements(on, (el) => el.props['class'] === 'w-spray')[0]?.props['d']);
    for (const streak of d.split('M').filter((part) => part !== '')) {
      const ys = [...streak.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) =>
        Number(m[2]),
      );
      expect(ys.at(-1) as number).toBeLessThan(ys[0] as number);
    }
  });

  it('keeps the flat-vector rules at full ice with the spray: no text, no filter, own w- ids', () => {
    const tree = render({ ...flamesAt(60), ...iceAt(60, 60) }, 'cruise', true);
    expect(findElements(tree, (el) => el.tag === 'text' || el.tag === 'tspan')).toEqual([]);
    for (const tag of FORBIDDEN_TAGS) {
      expect(
        findElements(tree, (el) => el.tag === tag),
        tag,
      ).toEqual([]);
    }
    const ids = findElements(tree, (el) => typeof el.props['id'] === 'string').map((el) =>
      String(el.props['id']),
    );
    for (const id of ids) expect(id.startsWith('w-'), id).toBe(true);
    const used = new Set<string>();
    for (const el of findElements(tree, () => true)) {
      for (const value of Object.values(el.props)) {
        if (typeof value !== 'string') continue;
        for (const match of value.matchAll(/url\(#([^)]+)\)/g)) used.add(match[1] ?? '');
      }
    }
    for (const id of used) expect(ids.includes(id), id).toBe(true);
  });

  it('is compact: both sides and the spray add a handful of elements, not hundreds', () => {
    const clear = findElements(render({}), () => true).length;
    const iced = findElements(render(iceAt(60, 60), 'cruise', true), () => true).length;
    expect(iced - clear).toBeLessThan(25);
  });

  it('every cue of the aircraft table has art: the windscreen layer or the cabin overlay', () => {
    const levels: Record<string, number> = {};
    for (const id of DA50RG_CUES.ids) levels[id] = 1;
    const tree = render(levels, 'cruise', true);
    const smoke = expand(CabinSmoke({ level: 1 }));
    for (const id of DA50RG_CUES.ids) {
      const drawn =
        findElements(tree, (el) => el.props['data-cue'] === id).length +
        findElements(smoke, (el) => el.props['data-cue'] === id).length;
      expect(drawn, id).toBeGreaterThan(0);
    }
  });
});

describe('the stopped propeller (Phase 5, C-06)', () => {
  const rpmAt = (rpm: number): Record<string, number> =>
    DA50RG_CUES.levels({ ...DA50RG_QUANTITIES.baseValues(), rpm });
  const wedge = (tree: El): El =>
    findElements(tree, (el) => el.props['data-part'] === 'blade')[0] as El;
  const crisp = (tree: El): El[] =>
    findElements(tree, (el) => el.props['data-part'] === 'blade_stopped');

  it('shows the blur wedge and no crisp blade while the engine turns', () => {
    const tree = render(rpmAt(1995));
    expect(Number(wedge(tree).props['fill-opacity'])).toBe(BLUR_OPACITY);
    expect(crisp(tree)).toEqual([]);
  });

  it('fades the wedge and shows the crisp blade as the level rises', () => {
    const half = render(rpmAt(300));
    expect(Number(wedge(half).props['fill-opacity'])).toBeLessThan(BLUR_OPACITY);
    expect(Number(wedge(half).props['fill-opacity'])).toBeGreaterThan(0);
    expect(crisp(half)).toHaveLength(1);
    expect(Number(crisp(half)[0]?.props['opacity'])).toBe(0.5);
    const stopped = render(rpmAt(0));
    expect(Number(wedge(stopped).props['fill-opacity'])).toBe(0);
    expect(Number(crisp(stopped)[0]?.props['opacity'])).toBe(1);
    expect(crisp(stopped)[0]?.props['data-cue']).toBe('prop_stopped');
  });

  it('draws the crisp blade from the visible level and not below', () => {
    expect(crisp(render(rpmAt(600 - 0.5)))).toEqual([]);
    expect(crisp(render(rpmAt(600 - CUE_VISIBLE_LEVEL * 600 + 1)))).toEqual([]);
    expect(crisp(render(rpmAt(600 - CUE_VISIBLE_LEVEL * 600 - 1)))).toHaveLength(1);
  });

  it('reads no cue on a bare level table: the wedge as before', () => {
    expect(Number(wedge(render({})).props['fill-opacity'])).toBe(BLUR_OPACITY);
  });
});

describe('the oil streaks (Phase 5, C-06)', () => {
  const oilAt = (film: number): Record<string, number> =>
    DA50RG_CUES.levels({ ...DA50RG_QUANTITIES.baseValues(), oil_film: film });
  const streaks = (tree: El): El[] =>
    findElements(tree, (el) => el.props['data-cue'] === 'oil_streaks');
  const pathOf = (tree: El): string =>
    String(findElements(streaks(tree)[0] as El, (el) => el.tag === 'path')[0]?.props['d']);

  it('draws nothing on clear glass or below the visible level', () => {
    expect(streaks(render(oilAt(0)))).toEqual([]);
    expect(streaks(render({}))).toEqual([]);
    expect(streaks(render(oilAt(CUE_VISIBLE_LEVEL * 50 - 0.5)))).toEqual([]);
  });

  it('draws streaks from the visible level, more of them and darker with the level', () => {
    expect(streaks(render(oilAt(CUE_VISIBLE_LEVEL * 50 + 0.5)))).toHaveLength(1);
    expect(oilStreakCount(0.1)).toBeGreaterThanOrEqual(1);
    expect(oilStreakCount(0.1)).toBeLessThan(oilStreakCount(0.6));
    expect(oilStreakCount(1)).toBe(OIL_TABLE_SIZE);
    expect(oilOpacity(0.2)).toBeLessThan(oilOpacity(0.8));
    expect(oilOpacity(1)).toBe(OIL_MAX_OPACITY);
  });

  it('adds streaks from a fixed table: the same on every render, more is a longer path', () => {
    const a = pathOf(render(oilAt(15)));
    expect(a).toBe(pathOf(render(oilAt(15))));
    const more = pathOf(render(oilAt(35)));
    expect(more.startsWith(a)).toBe(true);
    expect(more.length).toBeGreaterThan(a.length);
  });

  it('keeps the flat-vector rules: one path, no paint reference, no text, no filter', () => {
    const tree = streaks(render(oilAt(50)))[0] as El;
    expect(findElements(tree, (el) => el.tag === 'path')).toHaveLength(1);
    expect(findElements(tree, (el) => el.tag === 'text')).toEqual([]);
    for (const tag of FORBIDDEN_TAGS)
      expect(findElements(tree, (el) => el.tag === tag)).toEqual([]);
    for (const el of findElements(tree, () => true)) {
      for (const value of Object.values(el.props)) expect(String(value)).not.toContain('url(');
    }
  });
});
