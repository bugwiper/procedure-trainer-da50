import { describe, expect, it } from 'vitest';
import { DA50RG_CUES } from '../src/aircraft/da50rg/cues';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { CUE_VISIBLE_LEVEL } from '../src/engine/cues';
import { flameOpacity, flameScale } from '../src/ui/panel/windscreen/cue-layers';
import { Windscreen } from '../src/ui/panel/windscreen/Windscreen';
import { WINDSCREEN_REFERENCE } from './layout-reference';
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

  it('draws the opening over the whole windscreen height', () => {
    const clip = findElements(full, (el) => el.tag === 'clipPath');
    expect(clip).toHaveLength(1);
    const rect = findElements(clip[0] as El, (el) => el.tag === 'rect')[0];
    expect(rect?.props['y']).toBe(-WINDSCREEN_REFERENCE.h);
    expect(Number(rect?.props['height'])).toBeGreaterThanOrEqual(WINDSCREEN_REFERENCE.h);
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
