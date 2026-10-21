import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { PLACARDS, placardLineY } from '../src/aircraft/da50rg/placards';
import { LEVER_ART } from '../src/ui/panel/skins/LeverHandles';
import { ENV_BOXES, PLATES } from '../src/aircraft/da50rg/plates';
import { DEF_IDS, Defs } from '../src/ui/panel/Defs';
import { PanelShell, groupBoxPath, temperatureTriangle } from '../src/ui/panel/PanelShell';
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
  it('reads GO-AROUND twice, RUBIN once and DA50RG once', () => {
    expect(occurrences(shellText, 'GO-AROUND')).toBe(2);
    expect(occurrences(shellText, 'RUBIN')).toBe(1);
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

  it('draws two display bezels and three reserved centre-stack outlines', () => {
    expect(findElements(shell, (el) => el.props['data-shell'] === 'bezel')).toHaveLength(2);
    expect(findElements(shell, (el) => el.props['data-shell'] === 'reserved-outline')).toHaveLength(
      3,
    );
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

  it('draws bus brackets with headings only, no circuit-breaker shapes (PNL-12 is 01.2)', () => {
    expect(findElements(shell, (el) => String(el.props['data-shell']).includes('breaker'))).toEqual(
      [],
    );
    expect(findElements(shell, (el) => el.props['data-shell'] === 'bus-bracket')).toHaveLength(3);
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
    expect(files.length).toBeGreaterThanOrEqual(7);
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
