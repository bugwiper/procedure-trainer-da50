import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { PLACARDS, placardLineY } from '../src/aircraft/da50rg/placards';
import { LEVER_ART } from '../src/ui/panel/skins/LeverHandles';
import {
  BRACKET_GROUPS,
  ENV_BOXES,
  HEADING_FRAME,
  PLATES,
  PLATE_HEADINGS,
} from '../src/aircraft/da50rg/plates';
import { DEF_IDS, Defs } from '../src/ui/panel/Defs';
import {
  BUS_ORDER,
  BUS_OUTLINES,
  BUS_TITLES,
  BUS_TITLE_STYLE,
  busTitleCut,
} from '../src/aircraft/da50rg/bus-boxes';
import { roundedPolygonPath } from '../src/ui/panel/BusPanelArt';
import {
  PanelShell,
  bracketPath,
  groupBoxPath,
  temperatureTriangle,
} from '../src/ui/panel/PanelShell';
import { PANEL_VIEWBOX } from './layout-reference';
import { countElements, expand, findElements, textOf } from './vnode-walk';

// PNL-10, D-01, D-02, D-06, T-01.1-05: the static shell is pure, handler-free flat vector art.

const shell = expand(PanelShell({ registry: DA50RG }));
const shellText = textOf(shell);

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('PanelShell purity (P1 D-09)', () => {
  it('is one shell layer with pointer-events none', () => {
    expect(shell.tag).toBe('g');
    expect(shell.props['data-layer']).toBe('shell');
    expect(shell.props['pointer-events']).toBe('none');
  });

  it('carries no handler, data-hit or data-detent anywhere', () => {
    const offenders = findElements(shell, (el) =>
      Object.keys(el.props).some(
        (key) => /^on[A-Z]/.test(key) || key === 'data-hit' || key === 'data-detent',
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('draws a real number of elements (not an empty shell)', () => {
    expect(countElements(shell)).toBeGreaterThan(60);
  });
});

describe('shell silhouette follows the 2180 wide panel space (U-01)', () => {
  /** Largest absolute x number in a path whose commands are absolute. */
  function maxX(d: string): number {
    const xs: number[] = [];
    for (const m of d.matchAll(/[MLHQAV]\s*([^MLHQAVZ]*)/g)) {
      const cmd = m[0][0];
      const nums = (m[1] ?? '')
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (cmd === 'H') xs.push(...nums);
      else if (cmd === 'M' || cmd === 'L') xs.push(nums[0] ?? 0);
      else if (cmd === 'Q') xs.push(nums[0] ?? 0, nums[2] ?? 0);
      else if (cmd === 'A') xs.push(nums[5] ?? 0);
    }
    return Math.max(...xs);
  }

  it('the knee cavity is as wide as the viewBox', () => {
    const cavity = findElements(shell, (el) => el.props['data-shell'] === 'knee-cavity')[0];
    expect(cavity?.props['width']).toBe(PANEL_VIEWBOX.w);
  });

  it('the face plate ends at x 2160 and the coaming at x 2180', () => {
    const plate = findElements(shell, (el) => el.props['data-shell'] === 'face-plate')[0];
    const plateD = findElements(plate ?? shell, (el) => el.tag === 'path').map((el) =>
      String(el.props['d']),
    );
    expect(Math.max(...plateD.map(maxX))).toBe(2160);
    const coaming = findElements(shell, (el) => el.props['data-shell'] === 'coaming')[0];
    const coamingD = findElements(coaming ?? shell, (el) => el.tag === 'path').map((el) =>
      String(el.props['d']),
    );
    expect(Math.max(...coamingD.map(maxX))).toBe(PANEL_VIEWBOX.w);
  });
});

describe('PanelShell flat-vector rules (UI-SPEC rendering)', () => {
  const FORBIDDEN_TAGS = [
    'image',
    'filter',
    'mask',
    'feGaussianBlur',
    'feDropShadow',
    'foreignObject',
  ];

  it.each(FORBIDDEN_TAGS)('uses no %s element', (tag) => {
    expect(findElements(shell, (el) => el.tag === tag)).toEqual([]);
  });

  it('has no href or xlinkHref that starts with data:', () => {
    const offenders = findElements(shell, (el) =>
      ['href', 'xlinkHref', 'xlink:href'].some((key) => {
        const value = el.props[key];
        return typeof value === 'string' && value.startsWith('data:');
      }),
    );
    expect(offenders).toEqual([]);
  });

  it('references only ids that Defs defines', () => {
    const used = new Set<string>();
    findElements(shell, () => true).forEach((el) => {
      for (const value of Object.values(el.props)) {
        if (typeof value !== 'string') continue;
        for (const match of value.matchAll(/url\(#([^)]+)\)/g)) {
          const id = match[1];
          if (id !== undefined) used.add(id);
        }
      }
    });
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) expect(DEF_IDS as readonly string[]).toContain(id);
  });
});

describe('Defs', () => {
  const defs = expand(Defs());
  const idOf = (el: { props: Readonly<Record<string, unknown>> }) => el.props['id'];

  it('defines exactly the twelve DefId ids, once each', () => {
    const ids = findElements(defs, (el) => typeof idOf(el) === 'string').map(idOf);
    expect(DEF_IDS).toHaveLength(12);
    expect([...ids].sort()).toEqual([...DEF_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the amber lamp halo as a radial gradient of at most three stops', () => {
    const halo = findElements(defs, (el) => idOf(el) === 'g-halo-amber');
    expect(halo).toHaveLength(1);
    expect(halo[0]?.tag).toBe('radialGradient');
  });

  it('prefixes every id with g- or p-', () => {
    for (const id of DEF_IDS) expect(id).toMatch(/^[gp]-/);
  });

  it('gives every gradient at most three stops', () => {
    const gradients = findElements(
      defs,
      (el) => el.tag === 'linearGradient' || el.tag === 'radialGradient',
    );
    expect(gradients.length).toBe(10);
    for (const g of gradients) {
      const stops = g.children.filter((c) => typeof c !== 'string' && c.tag === 'stop');
      expect(stops.length).toBeGreaterThanOrEqual(2);
      expect(stops.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('PanelShell brand marks (D-05)', () => {
  it('reads GO-AROUND twice and DA50RG once, and no airframe maker mark', () => {
    expect(occurrences(shellText, 'GO-AROUND')).toBe(2);
    expect(occurrences(shellText, 'RUBIN')).toBe(0);
    expect(occurrences(shellText, 'DA50RG')).toBe(1);
  });

  it('never names a real brand', () => {
    expect(shellText).not.toMatch(/garmin|diamond/i);
  });
});

describe('PanelShell layers (UI-SPEC Panel Surface)', () => {
  it.each([
    'knee-cavity',
    'face-plate',
    'console',
    'coaming',
    'lights-recess',
    'bezel',
    'centre-stack',
    'switch-strips',
    'bus-panel',
    'left-strip',
    'decor',
    'environmental-plate',
  ])('draws the %s layer', (layer) => {
    expect(findElements(shell, (el) => el.props['data-shell'] === layer).length).toBeGreaterThan(0);
  });

  it('draws two display bezels and no placeholder outline on the centre stack', () => {
    expect(findElements(shell, (el) => el.props['data-shell'] === 'bezel')).toHaveLength(2);
    expect(findElements(shell, (el) => el.props['data-shell'] === 'reserved-outline')).toEqual([]);
    const stack = findElements(shell, (el) => el.props['data-shell'] === 'centre-stack')[0];
    const plate = findElements(
      stack ?? shell,
      (el) => el.props['data-plate'] === 'centre-stack',
    )[0];
    expect([
      plate?.props['x'],
      plate?.props['y'],
      plate?.props['width'],
      plate?.props['height'],
    ]).toEqual([875, 185, 285, 390]);
    expect(plate?.props['fill']).toBe('#101215');
  });

  it('draws the three unit plates from the plate data with the Table E2 fills', () => {
    const centre = findElements(shell, (el) => el.props['data-shell'] === 'centre-stack')[0];
    if (centre === undefined) throw new Error('no centre-stack layer');
    for (const [id, fill, x, y, w, h] of [
      ['ap-unit', '#101215', 1162, 185, 89, 421],
      ['pfd-left-unit', '#0c0d0f', 272, 185, 72, 421],
      ['mfd-right-unit', '#0c0d0f', 1782, 185, 84, 421],
    ] as const) {
      const plate = findElements(centre, (el) => el.props['data-plate'] === id)[0];
      expect(plate, id).toBeDefined();
      expect(
        [plate?.props['x'], plate?.props['y'], plate?.props['width'], plate?.props['height']],
        id,
      ).toEqual([x, y, w, h]);
      expect(plate?.props['fill'], id).toBe(fill);
      expect(plate?.props['rx'], id).toBe(8);
    }
  });

  it.each([
    'LIGHTS',
    'ESSENTIAL BUS',
    'MAIN BUS',
    'AVIONICS BUS',
    'LANDING GEAR',
    'VLE / VLO = 162 KIAS',
    'ESS BUS NOT FOR NORMAL OPERATION',
    'NO SMOKING',
    'ENVIRONMENTAL CONTROL',
  ])('carries the placard text "%s"', (text) => {
    expect(shellText).toContain(text);
  });

  it('draws the bus panel from data: the plate, three outlines and three titles, no breaker shape', () => {
    expect(findElements(shell, (el) => String(el.props['data-shell']).includes('breaker'))).toEqual(
      [],
    );
    expect(findElements(shell, (el) => el.props['data-shell'] === 'bus-bracket')).toEqual([]);
    const layer = findElements(shell, (el) => el.props['data-shell'] === 'bus-panel')[0];
    if (layer === undefined) throw new Error('no bus layer');
    const bus = PLATES.find((p) => p.id === 'bus-panel');
    const plate = findElements(layer, (el) => el.props['data-plate'] === 'bus-panel')[0];
    expect([plate?.props['x'], plate?.props['y']]).toEqual([bus?.x, bus?.y]);
    expect([plate?.props['width'], plate?.props['height']]).toEqual([bus?.w, bus?.h]);
    const outlines = findElements(layer, (el) => el.props['data-shell'] === 'bus-outline');
    expect(outlines.map((el) => el.props['data-bus'])).toEqual(['essential', 'main', 'avionics']);
    for (const o of outlines) {
      expect(o.tag).toBe('path');
      expect(o.props['fill']).toBe('none');
      expect(o.props['stroke']).toBe('#6b727c');
      expect(o.props['stroke-width']).toBe(1);
    }
    const titles = findElements(layer, (el) => el.props['data-shell'] === 'bus-title');
    expect(titles.map((el) => textOf(el))).toEqual(['ESSENTIAL BUS', 'MAIN BUS', 'AVIONICS BUS']);
    for (const t of titles) expect(t.props['font-size']).toBe(8);
  });

  it('R3-1.1: the three titles are plain filled text at the earlier anchors', () => {
    const layer = findElements(shell, (el) => el.props['data-shell'] === 'bus-panel')[0];
    if (layer === undefined) throw new Error('no bus layer');
    const titles = findElements(layer, (el) => el.props['data-shell'] === 'bus-title');
    expect(titles.map((t) => [t.props['x'], t.props['y']])).toEqual([
      [1996, 226],
      [1924, 378],
      [1960, 480],
    ]);
    for (const t of titles) {
      expect(t.tag).toBe('text');
      expect(t.props['fill']).toBe('#c9d0d8');
      expect(t.props['font-size']).toBe(8);
      expect(t.props['text-anchor']).toBe('middle');
    }
  });

  it('R3-1.1: no text element of the whole shell carries a stroke or a painting order', () => {
    const texts = findElements(shell, (el) => el.tag === 'text');
    expect(texts.length).toBeGreaterThan(60);
    const offenders = texts.filter((el) =>
      ['stroke', 'stroke-width', 'stroke-linejoin', 'paint-order', 'paintOrder'].some(
        (key) => key in el.props,
      ),
    );
    expect(offenders.map((el) => textOf(el))).toEqual([]);
  });

  it('R3-1.1: each title is preceded by one plate-coloured cut rectangle without a stroke', () => {
    const layer = findElements(shell, (el) => el.props['data-shell'] === 'bus-panel')[0];
    if (layer === undefined) throw new Error('no bus layer');
    const plateFill = findElements(layer, (el) => el.props['data-plate'] === 'bus-panel')[0]?.props[
      'fill'
    ];
    expect(BUS_TITLE_STYLE.cut).toBe(plateFill);
    const pairs = findElements(
      layer,
      (el) => el.props['data-shell'] === 'bus-title-cut' || el.props['data-shell'] === 'bus-title',
    );
    expect(pairs.map((el) => el.props['data-shell'])).toEqual([
      'bus-title-cut',
      'bus-title',
      'bus-title-cut',
      'bus-title',
      'bus-title-cut',
      'bus-title',
    ]);
    BUS_TITLES.forEach((title, i) => {
      const cutEl = pairs[i * 2];
      const cut = busTitleCut(title);
      expect(cutEl?.tag).toBe('rect');
      expect([cutEl?.props['x'], cutEl?.props['y']]).toEqual([cut.x, cut.y]);
      expect([cutEl?.props['width'], cutEl?.props['height']]).toEqual([cut.w, cut.h]);
      expect(cutEl?.props['fill']).toBe('#15171a');
      expect(cutEl?.props['stroke']).toBeUndefined();
      expect(pairs[i * 2 + 1]?.props['data-bus']).toBe(title.bus);
    });
  });

  it('draws three plugs, three pump boxes and the sub-panel as inert shell shapes', () => {
    const plugs = findElements(shell, (el) => el.props['data-shell'] === 'bus-plug');
    expect(plugs).toHaveLength(3);
    expect(plugs.map((el) => [el.props['cx'], el.props['cy'], el.props['r']])).toEqual([
      [1978, 349, 11],
      [2086, 456, 11],
      [2122, 514, 11],
    ]);
    for (const el of plugs) {
      expect(el.props['fill']).toBe('#050506');
      expect(el.props['stroke']).toBe('#2d3138');
    }
    const boxes = findElements(shell, (el) => el.props['data-shell'] === 'bus-pump-box');
    expect(boxes.map((el) => [el.props['x'], el.props['y'], el.props['width']])).toEqual([
      [2106, 275, 32],
      [2106, 319, 32],
      [2106, 382, 32],
    ]);
    const sub = findElements(shell, (el) => el.props['data-shell'] === 'bus-subpanel');
    expect(sub).toHaveLength(1);
    expect([sub[0]?.props['x'], sub[0]?.props['y']]).toEqual([1878, 642]);
    expect(sub[0]?.props['fill']).toBe('#101215');
    // Nothing of the bus layer takes a pointer.
    const layer = findElements(shell, (el) => el.props['data-shell'] === 'bus-panel')[0];
    const live = findElements(layer ?? shell, (el) =>
      Object.keys(el.props).some((k) => /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'role'),
    );
    expect(live).toEqual([]);
  });

  it('the plug labels are ADF, and DATA over LINK, with the breaker label baselines', () => {
    const labels = findElements(shell, (el) => el.props['data-shell'] === 'bus-plug-label');
    expect(labels.map((el) => textOf(el))).toEqual(['ADF', 'DATA', 'LINK']);
    // The last line sits 16 above the plug centre, earlier lines 7 higher (breaker label rule).
    expect(labels.map((el) => el.props['y'])).toEqual([456 - 16, 514 - 23, 514 - 16]);
    for (const el of labels) {
      expect(el.props['font-size']).toBe(6);
      expect(el.props['fill']).toBe('#aab3bd');
      expect(el.props['text-anchor']).toBe('middle');
    }
    expect(labels.map((el) => el.props['x'])).toEqual([2086, 2122, 2122]);
  });

  it('the shell text holds ADF, DATA and LINK once each', () => {
    expect(occurrences(shellText, 'ADF')).toBe(1);
    expect(occurrences(shellText, 'DATA')).toBe(1);
    expect(occurrences(shellText, 'LINK')).toBe(1);
  });

  it('draws in order: plate, sub-panel, outlines, pump boxes, plugs, then the cut and title pairs', () => {
    const layer = findElements(shell, (el) => el.props['data-shell'] === 'bus-panel')[0];
    if (layer === undefined) throw new Error('no bus layer');
    const marks = findElements(
      layer,
      (el) =>
        el.props['data-plate'] === 'bus-panel' ||
        [
          'bus-subpanel',
          'bus-outline',
          'bus-pump-box',
          'bus-plug',
          'bus-title-cut',
          'bus-title',
        ].includes(String(el.props['data-shell'])),
    ).map((el) => String(el.props['data-plate'] ?? el.props['data-shell']));
    const first = (name: string) => marks.indexOf(name);
    const last = (name: string) => marks.lastIndexOf(name);
    expect(first('bus-panel')).toBe(0);
    expect(last('bus-panel')).toBeLessThan(first('bus-subpanel'));
    expect(last('bus-subpanel')).toBeLessThan(first('bus-outline'));
    expect(last('bus-outline')).toBeLessThan(first('bus-pump-box'));
    expect(last('bus-pump-box')).toBeLessThan(first('bus-plug'));
    expect(last('bus-plug')).toBeLessThan(first('bus-title-cut'));
    expect(first('bus-title-cut')).toBeLessThan(first('bus-title'));
  });

  it('the old narrow bus rectangle (x 1836, width 144) is gone', () => {
    const old = findElements(
      shell,
      (el) => el.tag === 'rect' && el.props['x'] === 1836 && el.props['width'] === 144,
    );
    expect(old).toEqual([]);
  });

  it('the rounded-corner path helper returns one move and one corner curve per vertex', () => {
    for (const bus of BUS_ORDER) {
      const pts = BUS_OUTLINES[bus];
      const d = roundedPolygonPath(pts, 4);
      expect(d.match(/M/g), bus).toHaveLength(1);
      expect(d.match(/Q/g), bus).toHaveLength(pts.length);
      expect(d.endsWith('Z'), bus).toBe(true);
    }
    // A 10 x 10 square rounded by 2 starts 2 along the first edge.
    const square = roundedPolygonPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      2,
    );
    expect(square.startsWith('M2 0')).toBe(true);
    expect(square.match(/Q/g)).toHaveLength(4);
  });

  it('draws the static vent as concentric rings', () => {
    const rings = findElements(shell, (el) => el.props['data-shell'] === 'vent-ring');
    expect(rings.length).toBeGreaterThanOrEqual(3);
  });
});

// Plate placards (owner findings G-0.1, G-0.3, G-6): static text printed on a plate beside a
// control, data in placards.ts, positioned relative to a control id and drawn by the shell.
describe('plate placards', () => {
  const drawn = findElements(shell, (el) => el.props['data-placard'] !== undefined);

  /** Global centre of a registry control. */
  function centreOf(id: string): { x: number; y: number; region: string } {
    const def = DA50RG.get(id);
    if (def === undefined) throw new Error(`unknown control ${id}`);
    const region = DA50RG.regions.find((r) => r.id === def.region);
    if (region === undefined) throw new Error(`unknown region ${def.region}`);
    return { x: region.bounds.x + def.x, y: region.bounds.y + def.y, region: region.id };
  }

  it('has placards, each with a unique id, a registry control to sit near and lines', () => {
    expect(PLACARDS.length).toBeGreaterThan(0);
    expect(new Set(PLACARDS.map((p) => p.id)).size).toBe(PLACARDS.length);
    for (const p of PLACARDS) {
      expect(DA50RG.get(p.near), `${p.id} near ${p.near}`).toBeDefined();
      expect(p.lines.length, p.id).toBeGreaterThan(0);
      expect([6, 8], p.id).toContain(p.size);
    }
  });

  it('every placard sits inside the plate that carries its control region', () => {
    for (const p of PLACARDS) {
      const c = centreOf(p.near);
      const plate = PLATES.find((pl) => pl.regions.includes(c.region));
      expect(plate, `${p.id} has a plate`).toBeDefined();
      if (plate === undefined) continue;
      p.lines.forEach((line, i) => {
        const width = line.length * p.size * 0.62;
        const x0 = p.anchor === 'start' ? c.x + p.dx : c.x + p.dx - width;
        const y = c.y + placardLineY(p, i);
        expect(x0, `${p.id} line ${i} left`).toBeGreaterThanOrEqual(plate.x);
        expect(x0 + width, `${p.id} line ${i} right`).toBeLessThanOrEqual(plate.x + plate.w);
        expect(y - p.size, `${p.id} line ${i} top`).toBeGreaterThanOrEqual(plate.y);
        expect(y, `${p.id} line ${i} bottom`).toBeLessThanOrEqual(plate.y + plate.h);
      });
    }
  });

  it('the start point of every placard lies inside some plate (no browser needed)', () => {
    for (const p of PLACARDS) {
      const def = DA50RG.get(p.near);
      const region = DA50RG.regions.find((r) => r.id === def?.region);
      if (def === undefined || region === undefined) continue;
      const x = region.bounds.x + def.x + p.dx;
      const y = region.bounds.y + def.y + placardLineY(p, 0);
      const plate = PLATES.find(
        (pl) => x >= pl.x && x <= pl.x + pl.w && y >= pl.y && y <= pl.y + pl.h,
      );
      expect(plate, `${p.id} starts on a plate`).toBeDefined();
    }
  });

  it('draws one text element per placard line, with exactly the PLACARDS lines', () => {
    const expected = PLACARDS.flatMap((p) => p.lines);
    expect(drawn.map((el) => textOf(el))).toEqual(expected);
    expect(new Set(drawn.map((el) => el.props['data-placard'])).size).toBe(PLACARDS.length);
  });

  it('draws each line at its control centre plus the offsets', () => {
    for (const p of PLACARDS) {
      const c = centreOf(p.near);
      const lines = drawn.filter((el) => el.props['data-placard'] === p.id);
      expect(lines, p.id).toHaveLength(p.lines.length);
      lines.forEach((el, i) => {
        expect(el.props['x'], `${p.id} ${i} x`).toBe(c.x + p.dx);
        expect(el.props['y'], `${p.id} ${i} y`).toBe(c.y + placardLineY(p, i));
        expect(el.props['text-anchor'], `${p.id} ${i}`).toBe(p.anchor);
        expect(el.props['font-size'], `${p.id} ${i}`).toBe(p.size);
      });
    }
  });

  it('the ELT has ON, ARMED and RESET / TEST (two lines) as plain text without state behaviour', () => {
    const elt = PLACARDS.filter((p) => p.near === 'sw.elt');
    expect(elt.map((p) => p.lines.join(' '))).toEqual(['ON', 'ARMED', 'RESET / TEST']);
    expect(elt.every((p) => p.anchor === 'start' && p.size === 6)).toBe(true);
    expect(elt[2]?.lines).toHaveLength(2);
    // On the right of the rocker and aligned with the three tap thirds of its hit rectangle.
    const hit = DA50RG.get('sw.elt')?.hit;
    expect(hit).toBeDefined();
    if (hit === undefined) return;
    const third = hit.h / 3;
    const tops = [-hit.h / 2, -hit.h / 2 + third, -hit.h / 2 + 2 * third];
    // ON, ARMED and the first RESET / TEST line baseline lie in the top, middle and bottom third.
    elt.forEach((p, i) => {
      const y = placardLineY(p, 0);
      expect(y, p.id).toBeGreaterThanOrEqual(tops[i] ?? 0);
      expect(y, p.id).toBeLessThanOrEqual((tops[i] ?? 0) + third);
    });
    for (const p of elt) expect(p.dx, p.id).toBeGreaterThan(hit.w / 2);
  });

  it('the de-ice mode toggle has HIGH above, NORM left of the middle and OFF below, in its thirds', () => {
    const mode = PLACARDS.filter((p) => p.near === 'sw.deice_mode');
    expect(mode.map((p) => p.lines.join(' '))).toEqual(['HIGH', 'NORM', 'OFF']);
    expect(mode.map((p) => p.anchor)).toEqual(['middle', 'end', 'middle']);
    expect(mode.every((p) => p.size === 6)).toBe(true);
    const hit = DA50RG.get('sw.deice_mode')?.hit;
    expect(hit).toEqual({ w: 40, h: 90 });
    if (hit === undefined) return;
    // HIGH, NORM and OFF lie at the heights of the top, middle and bottom position of the handle.
    const third = hit.h / 3;
    const tops = [-hit.h / 2, -hit.h / 2 + third, -hit.h / 2 + 2 * third];
    mode.forEach((p, i) => {
      const y = placardLineY(p, 0);
      expect(y, p.id).toBeGreaterThanOrEqual(tops[i] ?? 0);
      expect(y, p.id).toBeLessThanOrEqual((tops[i] ?? 0) + third);
    });
    // NORM stands left of the toggle body, HIGH and OFF centred on it.
    expect(mode[1]?.dx).toBeLessThan(0);
    expect(mode[0]?.dx).toBe(0);
    expect(mode[2]?.dx).toBe(0);
  });

  it('the ICE LIGHT toggle has ICE LIGHT above, OFF right of the middle and ANNUN- / TEST below', () => {
    const own = PLACARDS.filter((p) => p.near === 'sw.deice_ice_light');
    expect(own.map((p) => p.lines.join(' '))).toEqual(['ICE LIGHT', 'OFF', 'ANNUN- TEST']);
    expect(own.map((p) => p.anchor)).toEqual(['middle', 'start', 'middle']);
    expect(own.every((p) => p.size === 6)).toBe(true);
    expect(own[2]?.lines).toHaveLength(2);
    const hit = DA50RG.get('sw.deice_ice_light')?.hit;
    expect(hit).toEqual({ w: 30, h: 69 });
    if (hit === undefined) return;
    // ICE LIGHT, OFF and the first ANNUN- line lie in the top, middle and bottom third.
    const third = hit.h / 3;
    const tops = [-hit.h / 2 - 8, -hit.h / 2 + third, -hit.h / 2 + 2 * third];
    own.forEach((p, i) => {
      const y = placardLineY(p, 0);
      expect(y, p.id).toBeGreaterThanOrEqual(tops[i] ?? 0);
      expect(y, p.id).toBeLessThanOrEqual((tops[i] ?? 0) + third + 8);
    });
    // OFF stands right of the toggle body (the bezel r 7), the other two are centred on it.
    expect(own[1]?.dx).toBeGreaterThan(7);
    expect(own[0]?.dx).toBe(0);
    expect(own[2]?.dx).toBe(0);
  });

  it('PARKING / BRAKE (two lines) and THROTTLE are centred above their levers, COWL FLAP above its group', () => {
    const by = (id: string) => PLACARDS.find((p) => p.id === id);
    const brake = by('parking_brake.name');
    const throttle = by('throttle.name');
    const cowl = by('cowl_flap.name');
    expect(brake?.near).toBe('lv.parking_brake');
    expect(brake?.lines).toEqual(['PARKING', 'BRAKE']);
    expect(throttle?.near).toBe('lv.power');
    expect(throttle?.lines).toEqual(['THROTTLE']);
    expect(cowl?.near).toBe('lv.cowl_flap');
    expect(cowl?.lines).toEqual(['COWL FLAP']);
    for (const p of [brake, throttle, cowl]) {
      expect(p?.anchor).toBe('middle');
      expect(p?.size).toBe(6);
    }
    expect(brake?.dx).toBe(0);
    expect(throttle?.dx).toBe(0);
  });

  it('WINDOW and DOOR LOCK are 8 unit placards centred under their controls, inside their region and below the hit (owner 2026-10-27)', () => {
    const rows = [
      ['cabin.window', 'sw.emerg_window', ['WINDOW']],
      ['cabin.door_lock', 'lv.door_release', ['DOOR LOCK']],
    ] as const;
    for (const [id, near, lines] of rows) {
      const p = PLACARDS.find((q) => q.id === id);
      expect(p?.near, id).toBe(near);
      expect(p?.lines, id).toEqual(lines);
      expect(p?.size, id).toBe(8);
      expect(p?.anchor, id).toBe('middle');
      expect(p?.dx, id).toBe(0);
      const def = DA50RG.get(near);
      const region = DA50RG.regions.find((r) => r.id === def?.region);
      if (p === undefined || def === undefined || region === undefined) throw new Error(id);
      const c = centreOf(near);
      const baseline = c.y + placardLineY(p, 0);
      // Under the hit and inside the region.
      expect(baseline - p.size, `${id} clear of the hit`).toBeGreaterThan(c.y + def.hit.h / 2);
      expect(baseline, `${id} inside the region`).toBeLessThanOrEqual(
        region.bounds.y + region.bounds.h,
      );
      const width = lines[0].length * p.size * 0.62;
      expect(c.x - width / 2, `${id} left`).toBeGreaterThanOrEqual(region.bounds.x);
      expect(c.x + width / 2, `${id} right`).toBeLessThanOrEqual(region.bounds.x + region.bounds.w);
    }
  });

  it('the pedestal sits on one plate below the environmental control plate', () => {
    const pedestal = PLATES.find((pl) => pl.id === 'pedestal');
    const env = PLATES.find((pl) => pl.id === 'environmental');
    expect(pedestal?.regions).toEqual(['pedestal']);
    expect(env).toBeDefined();
    if (pedestal === undefined || env === undefined) return;
    expect(pedestal.y).toBeGreaterThanOrEqual(env.y + env.h);
  });

  /** Each pedestal placard is printed above the highest handle position of its lever. */
  it.each(['lv.cowl_flap', 'lv.parking_brake', 'lv.power'])(
    'the placard of %s lies above the highest handle position',
    (id) => {
      const def = DA50RG.get(id);
      expect(def?.kind).toBe('detent-lever');
      if (def?.kind !== 'detent-lever' || def.skin === undefined) return;
      const own = PLACARDS.filter((p) => p.near === id);
      expect(own.length, id).toBeGreaterThan(0);
      const handleTop = -def.track.length / 2 - LEVER_ART[def.skin].along;
      for (const p of own) {
        const last = placardLineY(p, p.lines.length - 1);
        expect(last, p.id).toBeLessThanOrEqual(handleTop);
      }
    },
  );
});

// Environmental control plate (plan 20, owner finding G-3): the plate, four outlined group boxes
// with titles and the temperature triangle are static shell art.
describe('plate headings (plan 22, G-1)', () => {
  const headings = findElements(shell, (el) => el.props['data-shell'] === 'plate-heading');

  it('the shell draws every heading of the data, the de-ice one reading DE ICE without a hyphen, then the numerals 1 and 2', () => {
    expect(PLATE_HEADINGS.map((h) => h.text)).toEqual(['DE ICE', '1', '2']);
    expect(headings).toHaveLength(PLATE_HEADINGS.length);
    expect(headings.map((el) => textOf(el))).toEqual(PLATE_HEADINGS.map((h) => h.text));
    expect(shellText).not.toContain('DE-ICE');
  });

  it('draws a white outline frame around the text and nothing else (no fill)', () => {
    for (const [i, h] of PLATE_HEADINGS.entries()) {
      const el = headings[i];
      if (el === undefined) throw new Error('missing heading');
      const frame = findElements(el, (e) => e.tag === 'rect')[0];
      expect(frame?.props['fill'], h.id).toBe('none');
      expect(frame?.props['stroke'], h.id).toBe('#e6e9ed');
      expect(frame?.props['stroke-width'], h.id).toBe(1.2);
      expect(HEADING_FRAME).toEqual({ stroke: '#e6e9ed', width: 1.2 });
      expect([frame?.props['x'], frame?.props['y']]).toEqual([h.x, h.y]);
      expect([frame?.props['width'], frame?.props['height']]).toEqual([h.w, h.h]);
    }
  });

  it('each frame lies on its plate and holds its text', () => {
    for (const h of PLATE_HEADINGS) {
      const plate = PLATES.find((pl) => pl.id === h.plate);
      expect(plate, h.id).toBeDefined();
      if (plate === undefined) continue;
      expect(h.x).toBeGreaterThanOrEqual(plate.x);
      expect(h.y).toBeGreaterThanOrEqual(plate.y);
      expect(h.x + h.w).toBeLessThanOrEqual(plate.x + plate.w);
      expect(h.y + h.h).toBeLessThanOrEqual(plate.y + plate.h);
      expect(h.text.length * h.size * 0.62).toBeLessThan(h.w - 8);
      expect(h.size + 4).toBeLessThanOrEqual(h.h);
    }
  });
});

describe('bracket groups of the engine strip (plan 29, R2-5.2)', () => {
  const groups = findElements(shell, (el) => el.props['data-shell'] === 'bracket-group');

  it('the shell draws every bracket group of the data with its outline path and its title', () => {
    expect(BRACKET_GROUPS.length).toBeGreaterThan(0);
    expect(groups).toHaveLength(BRACKET_GROUPS.length);
    for (const g of BRACKET_GROUPS) {
      const el = groups.find((e) => e.props['data-bracket'] === g.id);
      if (el === undefined) throw new Error(`no group ${g.id}`);
      const line = findElements(el, (e) => e.props['data-shell'] === 'bracket-line')[0];
      expect(line?.props['d'], g.id).toBe(bracketPath(g));
      expect(line?.props['fill'], g.id).toBe('none');
      const titles = findElements(el, (e) => e.props['data-shell'] === 'bracket-title');
      expect(
        titles.map((t) => textOf(t)),
        g.id,
      ).toEqual([g.title]);
      expect(titles[0]?.props['font-size'], g.id).toBe(g.size);
    }
  });

  it('every bracket group lies on a plate of the data', () => {
    for (const g of BRACKET_GROUPS) {
      const plate = PLATES.find((p) => p.id === g.plate);
      expect(plate, g.id).toBeDefined();
      if (plate === undefined) continue;
      expect(g.x1).toBeGreaterThanOrEqual(plate.x);
      expect(g.x2).toBeLessThanOrEqual(plate.x + plate.w);
      expect(g.y).toBeGreaterThanOrEqual(plate.y);
      expect(g.y + g.drop).toBeLessThanOrEqual(plate.y + plate.h);
    }
  });
});

describe('environmental control plate (G-3)', () => {
  const env = PLATES.find((pl) => pl.id === 'environmental');

  it('the plate carries env_control and env_circ and ends above the pedestal plate', () => {
    expect(env?.regions).toEqual(['env_control', 'env_circ']);
    const pedestal = PLATES.find((pl) => pl.id === 'pedestal');
    expect(env).toBeDefined();
    if (env === undefined || pedestal === undefined) return;
    expect(env.y + env.h).toBeLessThanOrEqual(pedestal.y);
  });

  it('four titled boxes lie on the plate and do not overlap', () => {
    expect(ENV_BOXES.map((b) => b.title)).toEqual([
      'DIRECTION',
      'TEMPERATURE',
      'FAN',
      'CIRCULATING AIR',
    ]);
    if (env === undefined) throw new Error('no plate');
    for (const b of ENV_BOXES) {
      expect(b.x, b.id).toBeGreaterThanOrEqual(env.x);
      expect(b.y, b.id).toBeGreaterThanOrEqual(env.y);
      expect(b.x + b.w, b.id).toBeLessThanOrEqual(env.x + env.w);
      expect(b.y + b.h, b.id).toBeLessThanOrEqual(env.y + env.h);
    }
    for (let i = 0; i < ENV_BOXES.length; i++) {
      for (let j = i + 1; j < ENV_BOXES.length; j++) {
        const a = ENV_BOXES[i];
        const b = ENV_BOXES[j];
        if (a === undefined || b === undefined) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id} / ${b.id}`).toBe(true);
      }
    }
  });

  it('DIRECTION and TEMPERATURE sit side by side, FAN under DIRECTION, CIRCULATING AIR below', () => {
    const box = (id: string) => ENV_BOXES.find((b) => b.id === id);
    const direction = box('direction');
    const temperature = box('temperature');
    const fan = box('fan');
    const circ = box('circulating-air');
    if (!direction || !temperature || !fan || !circ) throw new Error('box missing');
    expect(direction.y).toBe(temperature.y);
    expect(direction.x + direction.w).toBeLessThanOrEqual(temperature.x);
    expect(fan.y).toBeGreaterThanOrEqual(direction.y + direction.h);
    expect(fan.x).toBe(direction.x);
    expect(circ.y).toBeGreaterThanOrEqual(fan.y + fan.h);
    expect(circ.y).toBeGreaterThanOrEqual(temperature.y + temperature.h);
  });

  it('draws the title, the boxes (outline paths with a title each) and the triangle', () => {
    const boxes = findElements(shell, (el) => el.props['data-shell'] === 'group-box');
    expect(boxes).toHaveLength(4);
    for (const b of boxes) {
      expect(
        findElements(b, (el) => el.tag === 'path' && el.props['fill'] === 'none'),
      ).toHaveLength(1);
      expect(findElements(b, (el) => el.tag === 'text')).toHaveLength(1);
    }
    expect(shellText).toContain('ENVIRONMENTAL CONTROL');
    expect(findElements(shell, (el) => el.props['data-shell'] === 'temp-triangle')).toHaveLength(1);
  });

  it('a box outline is open exactly where its title sits on the top edge', () => {
    const d = groupBoxPath(ENV_BOXES[0]!);
    // Starts and ends on the top edge, the two ends apart by the title width plus 6.
    const first = /^M([\d.]+) ([\d.]+)/.exec(d);
    const last = /H([\d.]+)$/.exec(d);
    expect(Number(first?.[2])).toBe(ENV_BOXES[0]!.y);
    expect(Number(first?.[1]) - Number(last?.[1])).toBeCloseTo('DIRECTION'.length * 4.2 + 6);
  });

  it('the temperature triangle is wide at the top, ends in a point and spans the slot', () => {
    const tri = temperatureTriangle(DA50RG);
    const def = DA50RG.get('lv.env_temp');
    expect(tri).toBeDefined();
    if (tri === undefined || def?.kind !== 'detent-lever') return;
    expect(tri.top.x2 - tri.top.x1).toBeGreaterThan(0);
    expect(tri.tip.y).toBeGreaterThan(tri.top.y);
    // The point is centred under the wide end.
    expect(tri.tip.x).toBeCloseTo((tri.top.x1 + tri.top.x2) / 2);
    // It spans the whole slot, warm stop to cold stop, and lies left of the slot.
    expect(tri.tip.y - tri.top.y).toBeCloseTo(def.track.length);
    const region = DA50RG.regions.find((r) => r.id === def.region);
    expect(tri.top.x2).toBeLessThan((region?.bounds.x ?? 0) + def.x);
    // Long and thin.
    expect(tri.tip.y - tri.top.y).toBeGreaterThan(8 * (tri.top.x2 - tri.top.x1));
  });
});

// Typography contract (UI-SPEC "Typography"): panel text uses exactly four sizes.
describe('declared font-size scale 6, 8, 10, 14', () => {
  const SCALE = [6, 8, 10, 14];
  const root = fileURLToPath(new URL('../', import.meta.url));
  const frames = join(root, 'src/ui/panel/frames');
  const files = [
    ...readdirSync(frames)
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => join(frames, name)),
    join(root, 'src/ui/panel/PanelShell.tsx'),
    join(root, 'src/ui/panel/Defs.tsx'),
    join(root, 'src/ui/panel/BusPanelArt.tsx'),
    join(root, 'src/ui/panel/Panel.tsx'),
  ];

  /** Every font-size value as written: JSX number, JSX string or quoted attribute. */
  function sizesIn(text: string): number[] {
    const out: number[] = [];
    for (const match of text.matchAll(
      /font-size\s*[=:]\s*(?:\{\s*([0-9.]+)\s*\}|["']?([0-9.]+)(?:px)?["']?)/g,
    )) {
      out.push(Number(match[1] ?? match[2]));
    }
    return out;
  }

  it('scans the four frame files and the shell files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files.map((file) => [file.slice(root.length), file] as const))(
    '%s uses only declared sizes',
    (_name, file) => {
      const sizes = sizesIn(readFileSync(file, 'utf8'));
      expect(sizes.filter((size) => !SCALE.includes(size))).toEqual([]);
    },
  );

  it('actually finds font sizes in the frames (the scan is not vacuous)', () => {
    const total = files.reduce((n, file) => n + sizesIn(readFileSync(file, 'utf8')).length, 0);
    expect(total).toBeGreaterThan(20);
  });

  it('the scanner rejects an off-scale size in each written form', () => {
    expect(sizesIn('<text font-size={12} />')).toEqual([12]);
    expect(sizesIn('<text font-size="13" />')).toEqual([13]);
    expect(sizesIn('style="font-size: 9px"')).toEqual([9]);
  });
});

// Glareshield light placards (plan 30, R2-1.1): the real panel prints ON above OFF once per side of
// the four light switches, left of LANDING and right of STROBE. Static plate text; the rockers print
// none.
describe('glareshield light placards (plan 30, R2-1.1)', () => {
  const lights = PLACARDS.filter(
    (p) => p.near === 'sw.light_landing' || p.near === 'sw.light_strobe',
  );
  const by = (id: string) => {
    const p = PLACARDS.find((q) => q.id === id);
    if (p === undefined) throw new Error(`no placard ${id}`);
    return p;
  };

  it('has exactly the four placards ON and OFF per side, size 6, one line each', () => {
    expect(lights.map((p) => p.id).sort()).toEqual([
      'lights.left_off',
      'lights.left_on',
      'lights.right_off',
      'lights.right_on',
    ]);
    expect(lights.map((p) => p.lines.join('')).sort()).toEqual(['OFF', 'OFF', 'ON', 'ON']);
    expect(lights.every((p) => p.size === 6 && p.lines.length === 1)).toBe(true);
    expect(by('lights.left_on').lines).toEqual(['ON']);
    expect(by('lights.left_off').lines).toEqual(['OFF']);
    expect(by('lights.right_on').lines).toEqual(['ON']);
    expect(by('lights.right_off').lines).toEqual(['OFF']);
  });

  it('the left pair stands left of the LANDING footprint and the right pair right of the STROBE one', () => {
    const landing = DA50RG.get('sw.light_landing');
    const strobe = DA50RG.get('sw.light_strobe');
    if (landing === undefined || strobe === undefined) throw new Error('no light rocker');
    for (const id of ['lights.left_on', 'lights.left_off']) {
      const p = by(id);
      expect(p.near, id).toBe('sw.light_landing');
      expect(p.anchor, id).toBe('end');
      expect(p.dx, id).toBeLessThanOrEqual(-landing.hit.w / 2);
    }
    for (const id of ['lights.right_on', 'lights.right_off']) {
      const p = by(id);
      expect(p.near, id).toBe('sw.light_strobe');
      expect(p.anchor, id).toBe('start');
      expect(p.dx, id).toBeGreaterThanOrEqual(strobe.hit.w / 2);
    }
  });

  it('on each side ON stands above OFF', () => {
    for (const side of ['left', 'right']) {
      expect(by(`lights.${side}_on`).dy).toBeLessThan(by(`lights.${side}_off`).dy);
    }
  });

  it('the TAXI and POSITION rockers have no placard of their own (once per side)', () => {
    expect(
      PLACARDS.filter((p) => p.near === 'sw.light_taxi' || p.near === 'sw.light_position'),
    ).toEqual([]);
  });

  it('the shell draws the four words as plate text', () => {
    const ids = new Set(lights.map((p) => p.id));
    const words = findElements(shell, (el) => ids.has(el.props['data-placard'] as string)).map(
      (el) => textOf(el),
    );
    expect(words).toEqual(['ON', 'OFF', 'ON', 'OFF']);
  });
});
