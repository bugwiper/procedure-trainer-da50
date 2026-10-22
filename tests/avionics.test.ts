import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_PANEL,
  AUTOPILOT_PANEL,
  BEZEL_COLUMNS,
  GLASS,
  MFD_ENGINE_LEGENDS,
  MFD_MAP_LEGENDS,
  EFIS_ALTITUDE_TAPE,
  EFIS_SPEED_TAPE,
  PFD_LEGENDS,
  SOFTKEY_CENTRE_Y,
  SOFTKEY_KEY,
  SOFTKEY_ROWS,
  STANDBY_EFIS,
  legendTabCentreX,
  softkeyCentre,
} from '../src/aircraft/da50rg/avionics';
import type { ColumnText } from '../src/aircraft/da50rg/avionics';
import { DA50RG, VIEWBOX } from '../src/aircraft/da50rg/panel';
import { PLATES } from '../src/aircraft/da50rg/plates';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { AudioPanelFrame } from '../src/ui/panel/frames/AudioPanelFrame';
import { AutopilotPanelFrame } from '../src/ui/panel/frames/AutopilotPanelFrame';
import { BezelColumnFrame } from '../src/ui/panel/frames/BezelColumnFrame';
import { formatReading } from '../src/ui/panel/frames/ArcGauge';
import { MfdFrame } from '../src/ui/panel/frames/MfdFrame';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
import { SoftkeysFrame } from '../src/ui/panel/frames/SoftkeysFrame';
import { StandbyEfisFrame } from '../src/ui/panel/frames/StandbyEfisFrame';
import { UnitHousing } from '../src/ui/panel/frames/UnitHousing';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { El } from './vnode-walk';

// Glass display shape (PNL-13, D-04): the softkey rows, the legend tables and the glass zones as
// data, and the inert key art drawn from them. Centres are typed in as literals so the data
// cannot agree with itself by construction.

// Table D2: MFD key centres, global x.
const MFD_CENTRES = [
  1288, 1329.5, 1371, 1412.5, 1454, 1495.5, 1537, 1578.5, 1620, 1661.5, 1703, 1744.5,
] as const;

// Table D2: PFD key centres, global x.
const PFD_CENTRES = [
  401.0, 438.9, 476.8, 514.7, 552.6, 590.5, 628.4, 666.3, 704.2, 742.1, 780.0, 817.9,
] as const;

function region(id: string) {
  const found = DA50RG.regions.find((r) => r.id === id);
  if (found === undefined) throw new Error(`unknown region ${id}`);
  return found;
}

/** A bridge with only what the frames read: registry, MFD page signal, base quantities, no CAS. */
function fakeBridge(page: 'map' | 'engine'): PanelBridge {
  return {
    registry: DA50RG,
    stateOf: () => ({ value: page }),
    quantities: { value: DA50RG_QUANTITIES.baseValues() },
    cas: { value: [] },
  } as unknown as PanelBridge;
}

describe('MFD softkey row', () => {
  const row = SOFTKEY_ROWS.mfd;

  it('has 12 keys at 1288 + 41.5 i with centre y 589', () => {
    expect(SOFTKEY_CENTRE_Y).toBe(589);
    for (let i = 0; i < 12; i++) {
      const c = softkeyCentre('mfd', i);
      expect(c.x, `slot ${i + 1}`).toBeCloseTo(MFD_CENTRES[i] ?? Number.NaN, 6);
      expect(c.y).toBe(589);
    }
    expect(row.regionId).toBe('mfd_softkeys');
  });

  it('the key is 30 x 20 with rx 3', () => {
    expect([SOFTKEY_KEY.w, SOFTKEY_KEY.h, SOFTKEY_KEY.rx]).toEqual([30, 20, 3]);
  });

  it('every key lies inside mfd_softkeys and no two keys overlap', () => {
    const b = region('mfd_softkeys').bounds;
    expect(b).toEqual({ x: 1262, y: 570, w: 510, h: 38 });
    for (let i = 0; i < 12; i++) {
      const c = softkeyCentre('mfd', i);
      expect(c.x - 15, `slot ${i + 1} left`).toBeGreaterThanOrEqual(b.x);
      expect(c.x + 15, `slot ${i + 1} right`).toBeLessThanOrEqual(b.x + b.w);
      expect(c.y - 10, `slot ${i + 1} top`).toBeGreaterThanOrEqual(b.y);
      expect(c.y + 10, `slot ${i + 1} bottom`).toBeLessThanOrEqual(b.y + b.h);
      if (i > 0) {
        const prev = softkeyCentre('mfd', i - 1);
        expect(c.x - prev.x, `gap before slot ${i + 1}`).toBeGreaterThan(30);
      }
    }
  });

  it('sw.mfd_page is key 1: global centre (1288, 589)', () => {
    const def = DA50RG.get('sw.mfd_page');
    expect(def).toBeDefined();
    if (def === undefined) return;
    const b = region(def.region).bounds;
    expect([b.x + def.x, b.y + def.y]).toEqual([1288, 589]);
    expect(softkeyCentre('mfd', 0)).toEqual({ x: 1288, y: 589 });
  });
});

describe('MFD legend tables', () => {
  const nonBlank = (list: readonly string[]) => list.filter((t) => t !== '');

  it('both tables have 12 slots; the map page has 6 legends and the engine page 4', () => {
    expect(MFD_MAP_LEGENDS).toHaveLength(12);
    expect(MFD_ENGINE_LEGENDS).toHaveLength(12);
    expect(nonBlank(MFD_MAP_LEGENDS)).toEqual([
      'Engine',
      'Map Opt',
      'Detail',
      'All',
      'Charts',
      'Checklist',
    ]);
    expect(nonBlank(MFD_ENGINE_LEGENDS)).toEqual(['Engine', 'DEC Fuel', 'INC Fuel', 'RST Fuel']);
    expect(MFD_MAP_LEGENDS[0]).toBe('Engine');
    expect(MFD_MAP_LEGENDS[2]).toBe('Map Opt');
    expect(MFD_ENGINE_LEGENDS.slice(3, 6)).toEqual(['DEC Fuel', 'INC Fuel', 'RST Fuel']);
  });

  it('every legend tab centre is its key centre minus the screen region x (1269)', () => {
    expect(region('mfd').bounds.x).toBe(1269);
    for (let i = 0; i < 12; i++) {
      expect(legendTabCentreX('mfd', i), `slot ${i + 1}`).toBeCloseTo(
        (MFD_CENTRES[i] ?? Number.NaN) - 1269,
        6,
      );
    }
    expect(legendTabCentreX('mfd', 0)).toBeCloseTo(19, 6);
  });

  it('the glass zones are the Table D4 bands', () => {
    expect(GLASS.header).toEqual({ y0: 4, y1: 28 });
    expect(GLASS.content).toEqual({ y0: 30, y1: 343 });
    expect(GLASS.legend).toEqual({ y0: 345, y1: 363 });
    expect(GLASS.tab).toEqual({ y: 349, h: 13, baseline: 358.5, width: { pfd: 34, mfd: 37 } });
  });
});

describe('SoftkeysFrame on mfd_softkeys', () => {
  const tree = expand(SoftkeysFrame({ region: region('mfd_softkeys'), bridge: fakeBridge('map') }));
  const keys = findElements(tree, (el) => 'data-softkey' in el.props);

  it('draws the 11 inert keys, none for slot 1 (the control), marked mfd:2 to mfd:12', () => {
    expect(keys.map((k) => k.props['data-softkey'])).toEqual(
      Array.from({ length: 11 }, (_, i) => `mfd:${i + 2}`),
    );
  });

  it('carries no handler and switches pointer events off', () => {
    expect(tree.props['pointer-events']).toBe('none');
    const all = findElements(tree, () => true);
    for (const el of all) {
      for (const name of Object.keys(el.props)) expect(name, el.tag).not.toMatch(/^on[A-Z]/);
      expect(el.props['data-hit']).toBeUndefined();
    }
  });

  it('each key is a 30 x 20 rect centred on its slot, region-local, with an up-triangle', () => {
    const origin = region('mfd_softkeys').bounds;
    keys.forEach((key, n) => {
      const slot = n + 1;
      const rect = findElements(key, (el) => el.tag === 'rect')[0];
      const cx = Number(rect?.props['x']) + 15;
      const cy = Number(rect?.props['y']) + 10;
      expect(cx + origin.x, `slot ${slot + 1} x`).toBeCloseTo(MFD_CENTRES[slot] ?? Number.NaN, 6);
      expect(cy + origin.y).toBe(589);
      expect([rect?.props['width'], rect?.props['height'], rect?.props['rx']]).toEqual([30, 20, 3]);
      const tri = findElements(key, (el) => el.tag === 'path' && el.props['fill'] === '#e6e9ed');
      expect(tri).toHaveLength(1);
      expect(findElements(key, (el) => el.tag === 'text')).toHaveLength(0);
    });
  });
});

describe('MfdFrame legend row', () => {
  const tabsOf = (page: 'map' | 'engine'): El[] =>
    findElements(
      expand(MfdFrame({ region: region('mfd'), bridge: fakeBridge(page) })),
      (el) => 'data-legend-tab' in el.props,
    );

  it('draws 12 tabs on the map page, 37 wide, none selected', () => {
    const tabs = tabsOf('map');
    expect(tabs).toHaveLength(12);
    expect(tabs.filter((t) => t.props['data-selected'] === 'true')).toHaveLength(0);
    expect(tabs.map((t) => textOf(t))).toEqual(MFD_MAP_LEGENDS.map((t) => t));
    for (const [i, tab] of tabs.entries()) {
      const rect = findElements(tab, (el) => el.tag === 'rect')[0];
      expect(Number(rect?.props['width']), `slot ${i + 1}`).toBe(37);
      expect(Number(rect?.props['x']) + 18.5, `slot ${i + 1}`).toBeCloseTo(
        (MFD_CENTRES[i] ?? Number.NaN) - 1269,
        6,
      );
      expect(Number(rect?.props['y'])).toBe(349);
      expect(Number(rect?.props['height'])).toBe(13);
    }
  });

  it('draws 12 tabs on the engine page with the Engine tab selected (border and underline)', () => {
    const tabs = tabsOf('engine');
    expect(tabs).toHaveLength(12);
    const selected = tabs.filter((t) => t.props['data-selected'] === 'true');
    expect(selected).toHaveLength(1);
    const tab = selected[0];
    expect(tab === undefined ? '' : textOf(tab)).toBe('Engine');
    const border =
      tab === undefined ? [] : findElements(tab, (el) => el.props['stroke'] === '#3fd1e0');
    expect(border).toHaveLength(1);
    expect(border[0]?.props['stroke-width']).toBe(1.2);
    const bar =
      tab === undefined
        ? []
        : findElements(tab, (el) => el.tag === 'rect' && el.props['fill'] === '#3ddc84');
    expect(bar).toHaveLength(1);
    expect(bar[0]?.props['height']).toBe(2);
    expect(tabs.map((t) => textOf(t))).toEqual(MFD_ENGINE_LEGENDS.map((t) => t));
  });
});

describe('PFD softkey row and region', () => {
  it('pfd_softkeys {356, 570, 479, 38} is named PFD SOFTKEYS and overlaps no region', () => {
    const r = region('pfd_softkeys');
    expect(r.bounds).toEqual({ x: 356, y: 570, w: 479, h: 38 });
    expect(r.name).toBe('PFD SOFTKEYS');
    expect(r.controlIds).toEqual([]);
    const a = r.bounds;
    for (const other of DA50RG.regions) {
      if (other.id === r.id) continue;
      const b = other.bounds;
      const overlap =
        Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
        Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
      expect(overlap, other.id).toBe(false);
    }
    // It ends where landing_gear starts, and below the screen.
    expect(a.x + a.w).toBe(835);
    expect(region('landing_gear').bounds.x).toBe(836);
    expect(region('pfd').bounds.y + region('pfd').bounds.h).toBe(567);
  });

  it('has 12 keys at 401.0 + 37.9 i with centre y 589, inside the region, last ending left of landing_gear', () => {
    const b = region('pfd_softkeys').bounds;
    expect(SOFTKEY_ROWS.pfd.regionId).toBe('pfd_softkeys');
    for (let i = 0; i < 12; i++) {
      const c = softkeyCentre('pfd', i);
      expect(c.x, `slot ${i + 1}`).toBeCloseTo(PFD_CENTRES[i] ?? Number.NaN, 6);
      expect(c.y).toBe(589);
      expect(c.x - 15, `slot ${i + 1} left`).toBeGreaterThanOrEqual(b.x);
      expect(c.x + 15, `slot ${i + 1} right`).toBeLessThanOrEqual(b.x + b.w);
      expect(c.y - 10).toBeGreaterThanOrEqual(b.y);
      expect(c.y + 10).toBeLessThanOrEqual(b.y + b.h);
      if (i > 0) expect(c.x - softkeyCentre('pfd', i - 1).x).toBeGreaterThan(30);
    }
    expect(softkeyCentre('pfd', 0).x - 15).toBeCloseTo(386, 6);
    expect(softkeyCentre('pfd', 11).x + 15).toBeCloseTo(832.9, 6);
    expect(softkeyCentre('pfd', 11).x + 15).toBeLessThan(region('landing_gear').bounds.x);
  });

  it('the PFD legend table has the 12 entries of Table D3 in order', () => {
    expect([...PFD_LEGENDS]).toEqual([
      'CAS',
      'Map/HSI',
      'TFC Map',
      'PFD Opt',
      'OBS',
      'CDI',
      'DME',
      'XPDR',
      'Ident',
      'TMR/REF',
      'Nearest',
      'Alerts',
    ]);
  });

  it('every legend tab centre is its key centre minus the screen region x (362)', () => {
    expect(region('pfd').bounds.x).toBe(362);
    for (let i = 0; i < 12; i++) {
      expect(legendTabCentreX('pfd', i), `slot ${i + 1}`).toBeCloseTo(
        (PFD_CENTRES[i] ?? Number.NaN) - 362,
        6,
      );
    }
    expect(legendTabCentreX('pfd', 0)).toBeCloseTo(39, 6);
    expect(legendTabCentreX('pfd', 1) - legendTabCentreX('pfd', 0)).toBeCloseTo(37.9, 6);
  });
});

describe('SoftkeysFrame on pfd_softkeys', () => {
  const tree = expand(SoftkeysFrame({ region: region('pfd_softkeys'), bridge: fakeBridge('map') }));
  const keys = findElements(tree, (el) => 'data-softkey' in el.props);

  it('draws 12 inert keys marked pfd:1 to pfd:12, region-local, without handlers', () => {
    expect(keys.map((k) => k.props['data-softkey'])).toEqual(
      Array.from({ length: 12 }, (_, i) => `pfd:${i + 1}`),
    );
    expect(tree.props['pointer-events']).toBe('none');
    for (const el of findElements(tree, () => true)) {
      for (const name of Object.keys(el.props)) expect(name, el.tag).not.toMatch(/^on[A-Z]/);
    }
    keys.forEach((key, i) => {
      const rect = findElements(key, (el) => el.tag === 'rect')[0];
      expect(Number(rect?.props['x']) + 15 + 356, `slot ${i + 1}`).toBeCloseTo(
        PFD_CENTRES[i] ?? Number.NaN,
        6,
      );
      expect(Number(rect?.props['y']) + 10 + 570).toBe(589);
    });
  });
});

describe('PfdFrame legend row and test ids', () => {
  const tree = expand(PfdFrame({ region: region('pfd'), bridge: fakeBridge('map') }));
  const tabs = findElements(tree, (el) => 'data-legend-tab' in el.props);

  it('draws 12 tabs 34 wide at local y 349 with the Table D3 legends', () => {
    expect(tabs).toHaveLength(12);
    expect(tabs.map((t) => textOf(t))).toEqual([...PFD_LEGENDS]);
    tabs.forEach((tab, i) => {
      const rect = findElements(tab, (el) => el.tag === 'rect')[0];
      expect(Number(rect?.props['width'])).toBe(34);
      expect(Number(rect?.props['y'])).toBe(349);
      expect(Number(rect?.props['x']) + 17, `slot ${i + 1}`).toBeCloseTo(
        (PFD_CENTRES[i] ?? Number.NaN) - 362,
        6,
      );
    });
  });

  it('keeps the four PFD test ids', () => {
    for (const id of ['pfd-attitude', 'pfd-airspeed', 'pfd-altitude', 'pfd-heading']) {
      expect(
        findElements(tree, (el) => el.props['data-testid'] === id),
        id,
      ).toHaveLength(1);
    }
  });
});

// Glass zones (Table D4): every glass element belongs to one tagged zone group.
describe('glass header, content and legend zones', () => {
  const zoneOf = (tree: El, zone: string): El[] =>
    findElements(tree, (el) => el.props['data-glass-zone'] === zone);
  const textsIn = (el: El): string[] =>
    findElements(el, (e) => e.tag === 'text').map((t) => textOf(t));

  const pfd = expand(PfdFrame({ region: region('pfd'), bridge: fakeBridge('map') }));
  const mfdMap = expand(MfdFrame({ region: region('mfd'), bridge: fakeBridge('map') }));
  const mfdEngine = expand(MfdFrame({ region: region('mfd'), bridge: fakeBridge('engine') }));

  it.each([
    ['pfd', pfd],
    ['mfd map page', mfdMap],
    ['mfd engine page', mfdEngine],
  ] as const)('%s has one header, one content, one legend and a tagged screen rect', (_n, tree) => {
    expect(zoneOf(tree, 'header')).toHaveLength(1);
    expect(zoneOf(tree, 'content')).toHaveLength(1);
    expect(zoneOf(tree, 'legend')).toHaveLength(1);
    const screen = zoneOf(tree, 'screen');
    expect(screen).toHaveLength(1);
    expect(screen[0]?.tag).toBe('rect');
  });

  it.each([
    ['pfd', pfd],
    ['mfd map page', mfdMap],
    ['mfd engine page', mfdEngine],
  ] as const)(
    '%s header carries the frequency boxes, labels and one swap arrow path',
    (_n, tree) => {
      const header = zoneOf(tree, 'header')[0];
      if (header === undefined) throw new Error('no header');
      const texts = textsIn(header);
      for (const t of [
        '109.90',
        '111.50',
        '114.80',
        '118.100',
        'RX',
        '123.725',
        '121.500',
        '133.330',
        'N1',
        'N2',
        '1C',
        '2M',
      ]) {
        expect(texts, t).toContain(t);
      }
      expect(
        findElements(header, (e) => e.tag === 'path' && e.props['data-swap-arrow'] !== undefined),
      ).toHaveLength(1);
      // Sizes on the glass are 6, 8, 10 or 14 only.
      for (const el of findElements(header, (e) => e.tag === 'text')) {
        expect([6, 8, 10, 14]).toContain(el.props['font-size']);
      }
    },
  );

  it('the MFD header centre shows the page title; the PFD header centre is empty', () => {
    const title = (tree: El): string[] =>
      findElements(tree, (e) => e.props['data-glass-title'] !== undefined).map((t) => textOf(t));
    expect(title(mfdMap)).toEqual(['Map - Navigation Map']);
    expect(title(mfdEngine)).toEqual(['EIS - Engine']);
    expect(title(pfd)).toEqual([]);
  });

  it('keeps the test ids of both screens and the page logic', () => {
    const ids = (tree: El): unknown[] =>
      findElements(tree, (e) => e.props['data-testid'] !== undefined).map(
        (e) => e.props['data-testid'],
      );
    expect(ids(pfd)).toEqual([
      'pfd-attitude',
      'cas-chips',
      'pfd-airspeed',
      'pfd-altitude',
      'pfd-heading',
    ]);
    expect(ids(mfdMap)).toEqual(['mfd-map-page', 'mfd-engine-strip', 'mfd-map']);
    expect(ids(mfdEngine)).toEqual(['mfd-engine-page']);
  });

  it('the PFD content follows Table D5 (labels, heading block, bank arc, compass, inset map, baro box)', () => {
    const content = zoneOf(pfd, 'content')[0];
    if (content === undefined) throw new Error('no content');
    const text = (s: string): El | undefined =>
      findElements(content, (e) => e.tag === 'text' && textOf(e) === s)[0];
    expect(text('KT')?.props['y']).toBe(276);
    expect(text('FT')?.props['y']).toBe(276);
    expect(text('KT')?.props['font-size']).toBe(8);
    expect(text('360')?.props['y']).toBe(302);
    expect(text('HDG')?.props['y']).toBe(328);
    const head = findElements(content, (e) => e.props['data-testid'] === 'pfd-heading')[0];
    const box = head === undefined ? undefined : findElements(head, (e) => e.tag === 'rect')[0];
    expect([box?.props['y'], box?.props['height']]).toEqual([276, 60]);
    // Bank arc: 10 tick marks (10, 20, 30, 45, 60 degrees each side) and a roll pointer.
    expect(findElements(content, (e) => 'data-bank-tick' in e.props)).toHaveLength(10);
    expect(findElements(content, (e) => 'data-roll-pointer' in e.props)).toHaveLength(1);
    // Compass arc: 12 ticks.
    expect(findElements(content, (e) => 'data-compass-tick' in e.props)).toHaveLength(12);
    expect(findElements(content, (e) => 'data-compass-arc' in e.props)).toHaveLength(1);
    // Inset map rectangle and baro box.
    const inset = findElements(content, (e) => 'data-inset-map' in e.props)[0];
    expect([inset?.props['x'], inset?.props['width'], inset?.props['fill']]).toEqual([
      6,
      90,
      '#0e1a14',
    ]);
    expect(textsIn(content)).toContain('1013 HPA');
  });

  it('the MFD content follows Table D6 (strip pitch 38 height 36, engine page rows)', () => {
    const strip = findElements(mfdMap, (e) => e.props['data-testid'] === 'mfd-engine-strip')[0];
    if (strip === undefined) throw new Error('no strip');
    const gauges = findElements(strip, (e) => e.props['data-gauge'] !== undefined);
    expect(gauges).toHaveLength(8);
    // Each bar gauge's first text sits at y + 11 (see BarGauge); y = 34 + 38 i.
    gauges.forEach((g, i) => {
      const label = findElements(g, (e) => e.tag === 'text')[0];
      expect(label?.props['y'], `gauge ${i}`).toBe(34 + 38 * i + 11);
    });
    const page = findElements(mfdEngine, (e) => e.props['data-testid'] === 'mfd-engine-page')[0];
    if (page === undefined) throw new Error('no engine page');
    const title = findElements(page, (e) => e.tag === 'text' && textOf(e) === 'ENGINE')[0];
    expect(title?.props['y']).toBe(46);
    const arcs = findElements(page, (e) => e.props['data-gauge'] !== undefined);
    expect(arcs).toHaveLength(12);
  });
});

// Plan 03-02 (D-12, C-12, T-03-04): every gauge of the map strip and of the engine page reads a
// named quantity; its scale and band colours are the quantity data and its readout prints at the
// gauge's resolution. The gauge table is the independent reference (Table Q1).
const GAUGE_REFERENCE: readonly {
  readonly label: string;
  readonly quantity: string;
  readonly decimals: number;
}[] = [
  { label: 'RPM', quantity: 'rpm', decimals: 0 },
  { label: 'Load', quantity: 'load_pct', decimals: 0 },
  { label: 'Oil pres', quantity: 'oil_pressure_bar', decimals: 1 },
  { label: 'Oil temp', quantity: 'oil_temp_c', decimals: 0 },
  { label: 'Coolant temp', quantity: 'coolant_temp_c', decimals: 0 },
  { label: 'Gearbox temp', quantity: 'gearbox_temp_c', decimals: 0 },
  { label: 'Fuel temp', quantity: 'fuel_temp_c', decimals: 0 },
  { label: 'Fuel pres', quantity: 'fuel_pressure_bar', decimals: 1 },
  { label: 'Fuel qty LH', quantity: 'fuel_qty_lh_gal', decimals: 1 },
  { label: 'Fuel qty RH', quantity: 'fuel_qty_rh_gal', decimals: 1 },
  { label: 'Volts', quantity: 'bus_volts', decimals: 1 },
  { label: 'Amps', quantity: 'alt1_amps', decimals: 0 },
];
const STRIP_LABELS = [
  'RPM',
  'Load',
  'Oil pres',
  'Oil temp',
  'Coolant temp',
  'Gearbox temp',
  'Volts',
  'Fuel qty LH',
] as const;
const BAND_COLOURS: Readonly<Record<string, string>> = {
  green: '#2fd36f',
  yellow: '#f2c230',
  red: '#f0443c',
  none: '#3a424b',
};

describe('MFD gauges read quantities (plan 03-02)', () => {
  const bridgeWith = (page: 'map' | 'engine', values: Record<string, number>): PanelBridge =>
    ({
      ...fakeBridge(page),
      quantities: { value: values },
    }) as unknown as PanelBridge;
  const render = (page: 'map' | 'engine', values: Record<string, number>) =>
    expand(MfdFrame({ region: region('mfd'), bridge: bridgeWith(page, values) }));
  const gaugeOf = (tree: El, label: string): El => {
    const found = findElements(tree, (e) => e.props['data-gauge'] === label)[0];
    if (found === undefined) throw new Error(`no gauge ${label}`);
    return found;
  };
  const refOf = (label: string) => {
    const found = GAUGE_REFERENCE.find((g) => g.label === label);
    const def = found === undefined ? undefined : DA50RG_QUANTITIES.get(found.quantity);
    if (found === undefined || def === undefined) throw new Error(`no reference for ${label}`);
    return { ...found, def };
  };
  /** A value inside the range with a fractional part, different from the base. */
  const stubValues = (): Record<string, number> =>
    Object.fromEntries(
      DA50RG_QUANTITIES.all.map((d) => [d.id, d.min + (d.max - d.min) * 0.4137 + 0.0123]),
    );

  it('the engine page draws one gauge per reference row and the strip the first eight', () => {
    const page = render('engine', {});
    const labels = findElements(page, (e) => e.props['data-gauge'] !== undefined).map(
      (e) => e.props['data-gauge'],
    );
    expect([...labels].sort()).toEqual(GAUGE_REFERENCE.map((g) => g.label).sort());
    const strip = findElements(render('map', {}), (e) => e.props['data-gauge'] !== undefined).map(
      (e) => e.props['data-gauge'],
    );
    expect(strip).toEqual([...STRIP_LABELS]);
  });

  it.each(['map', 'engine'] as const)(
    'on the %s page every gauge has the band colours and proportions of its quantity',
    (pageName) => {
      const tree = render(pageName, {});
      const labels = pageName === 'map' ? STRIP_LABELS : GAUGE_REFERENCE.map((g) => g.label);
      for (const label of labels) {
        const { def } = refOf(label);
        const gauge = gaugeOf(tree, label);
        const bands = findElements(gauge, (e) =>
          pageName === 'engine' && ['RPM', 'Load', 'Oil pres'].includes(label)
            ? e.tag === 'path'
            : e.tag === 'rect',
        );
        expect(bands, label).toHaveLength(def.bands.length);
        const colours = bands.map((b) => (b.tag === 'path' ? b.props['stroke'] : b.props['fill']));
        expect(colours, label).toEqual(def.bands.map((b) => BAND_COLOURS[b.colour]));
        if (bands[0]?.tag === 'rect') {
          const total = bands.reduce((sum, b) => sum + Number(b.props['width']), 0);
          let from = def.min;
          bands.forEach((b, i) => {
            const to = def.bands[i]?.to ?? Number.NaN;
            expect(Number(b.props['width']) / total, `${label} band ${String(i)}`).toBeCloseTo(
              (to - from) / (def.max - def.min),
              6,
            );
            from = to;
          });
        }
      }
    },
  );

  /** The digital readout of a gauge: its glass-digits text, exactly. */
  const readoutOf = (gauge: El): string => {
    const digits = findElements(gauge, (e) => e.props['class'] === 'glass-digits')[0];
    if (digits === undefined) throw new Error('no readout');
    return textOf(digits);
  };
  const isArc = (pageName: string, label: string): boolean =>
    pageName === 'engine' && ['RPM', 'Load', 'Oil pres'].includes(label);

  it.each(['map', 'engine'] as const)(
    'on the %s page every gauge prints a stub value at its resolution',
    (pageName) => {
      const values = stubValues();
      const tree = render(pageName, values);
      const labels = pageName === 'map' ? STRIP_LABELS : GAUGE_REFERENCE.map((g) => g.label);
      for (const label of labels) {
        const { quantity, decimals, def } = refOf(label);
        const shown = (values[quantity] ?? Number.NaN).toFixed(decimals);
        const expected = isArc(pageName, label) ? shown : `${shown} ${def.unit.toUpperCase()}`;
        expect(readoutOf(gaugeOf(tree, label)), label).toBe(expected);
      }
    },
  );

  it('without a value every gauge prints the base of its quantity at its resolution', () => {
    const tree = render('engine', {});
    for (const g of GAUGE_REFERENCE) {
      const def = DA50RG_QUANTITIES.get(g.quantity);
      const shown = (def?.base ?? Number.NaN).toFixed(g.decimals);
      const expected = isArc('engine', g.label) ? shown : `${shown} ${def?.unit.toUpperCase()}`;
      expect(readoutOf(gaugeOf(tree, g.label)), g.label).toBe(expected);
    }
  });

  it('formatReading keeps its output when no resolution is given', () => {
    expect(formatReading(2093.27)).toBe('2093.3');
    expect(formatReading(91)).toBe('91');
    expect(formatReading(0.4)).toBe('0.4');
  });
});

// Plan 06: region-owned housings of the inert avionics units (D-05, D-06, T-01.2-11). The housing
// of audio, backup EFIS and autopilot is a rounded rectangle equal to the region frame; the three
// bezel columns draw no housing (the unit plate is theirs). Every unit group is announced as not
// operable, carries data-unit, hides its children and holds no handler or hit rectangle.
const UNIT_NAMES: Readonly<Record<string, string>> = {
  audio_panel: 'AUDIO PANEL',
  standby_efis: 'BACKUP EFIS',
  autopilot_panel: 'AUTOPILOT PANEL',
};

const COLUMN_NAMES: Readonly<Record<string, string>> = {
  pfd_bezel_left: 'PFD KNOB COLUMN LEFT',
  pfd_bezel_right: 'PFD KNOB COLUMN RIGHT',
  mfd_bezel_right: 'MFD KNOB COLUMN RIGHT',
};

describe('UnitHousing', () => {
  const render = (id: string) =>
    expand(UnitHousing({ region: region(id), bridge: fakeBridge('map') }));

  it.each(Object.keys(UNIT_NAMES))('%s is a not-operable image group with its housing', (id) => {
    const tree = render(id);
    expect(tree.tag).toBe('g');
    expect(tree.props['role']).toBe('img');
    expect(tree.props['aria-label']).toBe(`${UNIT_NAMES[id]} (NOT OPERABLE)`);
    expect(tree.props['data-unit']).toBe(id);
    const { w, h } = region(id).bounds;
    const housing = findElements(tree, (e) => e.props['data-unit-housing'] !== undefined);
    expect(housing).toHaveLength(1);
    expect(housing[0]?.tag).toBe('rect');
    expect(
      ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke', 'stroke-width'].map(
        (k) => housing[0]?.props[k],
      ),
    ).toEqual([0, 0, w, h, 4, '#0c0d0f', '#2d3138', 1]);
  });

  it.each(Object.keys(UNIT_NAMES))('%s carries no handler, hit rectangle or control id', (id) => {
    const offenders = findElements(render(id), (el) =>
      Object.keys(el.props).some(
        (k) =>
          /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
      ),
    );
    expect(offenders).toEqual([]);
  });

  it.each(Object.keys(UNIT_NAMES))('%s children are hidden from assistive technology', (id) => {
    const tree = render(id);
    const wrapper = findElements(tree, (e) => e.props['data-unit-art'] !== undefined)[0];
    expect(wrapper?.props['aria-hidden']).toBe('true');
    expect(wrapper?.props['pointer-events']).toBe('none');
  });
});

describe('UnitHousing on the bezel columns', () => {
  it.each(Object.keys(COLUMN_NAMES))('%s draws only the not-operable group, no housing', (id) => {
    const tree = expand(UnitHousing({ region: region(id), bridge: fakeBridge('map') }));
    expect(tree.props['role']).toBe('img');
    expect(tree.props['aria-label']).toBe(`${COLUMN_NAMES[id]} (NOT OPERABLE)`);
    expect(tree.props['data-unit']).toBe(id);
    expect(findElements(tree, (e) => e.props['data-unit-housing'] !== undefined)).toEqual([]);
    expect(findElements(tree, (e) => e.tag === 'rect')).toEqual([]);
  });
});

// Plan 06: geometry of the inert units against their plates and neighbours, and the review text.
describe('inert avionics unit geometry', () => {
  const UNIT_IDS = [
    'pfd_bezel_left',
    'pfd_bezel_right',
    'audio_panel',
    'standby_efis',
    'autopilot_panel',
    'mfd_bezel_right',
  ] as const;
  const b = (id: string) => region(id).bounds;

  it('every unit region lies inside its plate and inside the viewBox', () => {
    for (const id of UNIT_IDS) {
      const plate = PLATES.find((p) => p.regions.includes(id));
      expect(plate, `${id} has a plate`).toBeDefined();
      const r = b(id);
      expect(r.x, id).toBeGreaterThanOrEqual(plate?.x ?? Infinity);
      expect(r.y, id).toBeGreaterThanOrEqual(plate?.y ?? Infinity);
      expect(r.x + r.w, id).toBeLessThanOrEqual((plate?.x ?? 0) + (plate?.w ?? 0));
      expect(r.y + r.h, id).toBeLessThanOrEqual((plate?.y ?? 0) + (plate?.h ?? 0));
      expect(r.x + r.w, id).toBeLessThanOrEqual(VIEWBOX.w);
      expect(r.y + r.h, id).toBeLessThanOrEqual(VIEWBOX.h);
    }
  });

  it('audio panel and backup EFIS do not overlap, and both clear the dimmer knob region', () => {
    const audio = b('audio_panel');
    const efis = b('standby_efis');
    const knobs = b('light_knobs');
    expect(audio.x + audio.w).toBeLessThanOrEqual(efis.x);
    // The audio panel lies left of the dimmer knobs, the backup EFIS below them.
    expect(audio.x + audio.w).toBeLessThanOrEqual(knobs.x);
    expect(efis.y).toBeGreaterThanOrEqual(knobs.y + knobs.h);
  });

  it('the autopilot panel lies right of the dimmer knob region', () => {
    const ap = b('autopilot_panel');
    const knobs = b('light_knobs');
    expect(ap.x).toBeGreaterThanOrEqual(knobs.x + knobs.w);
  });

  it('no unit region holds a control', () => {
    for (const id of UNIT_IDS) expect(region(id).controlIds, id).toEqual([]);
  });
});

describe('review document on the centre stack (plan 06)', () => {
  const review = readFileSync(
    fileURLToPath(new URL('../docs/PANEL-REVIEW.md', import.meta.url)),
    'utf8',
  );

  it('describes the plates and regions, the compressed widths and the shared slot', () => {
    for (const needle of [
      '875, 185, 285, 390',
      '`ap-unit`',
      '`pfd-left-unit`',
      '`mfd-right-unit`',
      '`standby_efis`',
      '70 percent',
      'share the slot',
    ]) {
      expect(review, needle).toContain(needle);
    }
  });

  it('no longer calls the outlines reserved placeholders', () => {
    expect(review).not.toContain('Reserved, not controls');
    expect(review).not.toContain('reserved audio, standby and autopilot outlines');
    expect(review).not.toContain('880, 185, 360, 375');
  });
});

// Plan 07: the knob and key columns beside the glass displays (D-04, D-05), inert art as data.
// Positions are typed in as global literals (Tables F1 to F3); the data holds region-local
// coordinates, so the helper below adds the region origin back.

type ColumnId = 'pfd_bezel_left' | 'pfd_bezel_right' | 'mfd_bezel_right';

function columnElements(id: ColumnId) {
  return BEZEL_COLUMNS[id];
}

/** Global position of a column element: region-local data plus the region origin. */
function globalPos(id: ColumnId, e: { cx: number; cy: number }) {
  const { x, y } = region(id).bounds;
  return { x: e.cx + x, y: e.cy + y };
}

function knobsOf(id: ColumnId) {
  return columnElements(id).filter((e) => e.kind === 'knob');
}

function renderColumn(id: ColumnId) {
  return expand(BezelColumnFrame({ region: region(id), bridge: fakeBridge('map') }));
}

/** Round parts (knobs, joystick) and rectangles of a column as global boxes for overlap checks. */
function solids(id: ColumnId) {
  const out: { name: string; x0: number; y0: number; x1: number; y1: number; round: boolean }[] =
    [];
  for (const e of columnElements(id)) {
    if (e.kind === 'text') continue;
    const g = globalPos(id, e);
    if (e.kind === 'knob' || e.kind === 'joystick') {
      out.push({
        name: e.id,
        x0: g.x - e.r,
        y0: g.y - e.r,
        x1: g.x + e.r,
        y1: g.y + e.r,
        round: true,
      });
    } else {
      out.push({
        name: e.id,
        x0: g.x - e.w / 2,
        y0: g.y - e.h / 2,
        x1: g.x + e.w / 2,
        y1: g.y + e.h / 2,
        round: false,
      });
    }
  }
  return out;
}

function expectNoOverlap(id: ColumnId): void {
  const list = solids(id);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a === undefined || b === undefined) continue;
      const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
      expect(apart, `${id}: ${a.name} and ${b.name} overlap`).toBe(true);
    }
  }
}

function expectInside(id: ColumnId): void {
  const r = region(id).bounds;
  const plate = PLATES.find((p) => p.regions.includes(id));
  expect(plate, `${id} plate`).toBeDefined();
  for (const e of columnElements(id)) {
    if (e.kind === 'text') {
      const g = { x: e.x + r.x, y: e.y + r.y };
      expect(g.x, `${id} text "${e.text}" x`).toBeGreaterThanOrEqual(r.x);
      expect(g.x, `${id} text "${e.text}" x`).toBeLessThanOrEqual(r.x + r.w);
      expect(g.y, `${id} text "${e.text}" y`).toBeGreaterThan(r.y);
      expect(g.y, `${id} text "${e.text}" y`).toBeLessThanOrEqual(r.y + r.h);
      continue;
    }
  }
  for (const s of solids(id)) {
    expect(s.x0, `${id} ${s.name} left`).toBeGreaterThanOrEqual(r.x);
    expect(s.y0, `${id} ${s.name} top`).toBeGreaterThanOrEqual(r.y);
    expect(s.x1, `${id} ${s.name} right`).toBeLessThanOrEqual(r.x + r.w);
    expect(s.y1, `${id} ${s.name} bottom`).toBeLessThanOrEqual(r.y + r.h);
    expect(s.x0, `${id} ${s.name} plate left`).toBeGreaterThanOrEqual(plate?.x ?? Infinity);
    expect(s.y0, `${id} ${s.name} plate top`).toBeGreaterThanOrEqual(plate?.y ?? Infinity);
    expect(s.x1, `${id} ${s.name} plate right`).toBeLessThanOrEqual(
      (plate?.x ?? 0) + (plate?.w ?? 0),
    );
    expect(s.y1, `${id} ${s.name} plate bottom`).toBeLessThanOrEqual(
      (plate?.y ?? 0) + (plate?.h ?? 0),
    );
  }
}

describe('bezel column data: region origins', () => {
  it('the table holds exactly the three column regions', () => {
    expect(Object.keys(BEZEL_COLUMNS).sort()).toEqual([
      'mfd_bezel_right',
      'pfd_bezel_left',
      'pfd_bezel_right',
    ]);
  });
});

describe('pfd_bezel_left column (Table F1)', () => {
  const id = 'pfd_bezel_left';

  it('has four knobs and one swap button', () => {
    expect(knobsOf(id)).toHaveLength(4);
    expect(columnElements(id).filter((e) => e.kind === 'swap')).toHaveLength(1);
    expect(columnElements(id).filter((e) => e.kind === 'joystick')).toHaveLength(0);
    expect(columnElements(id).filter((e) => e.kind === 'key')).toHaveLength(0);
  });

  it('pins the small knob, the swap button and the NAV, HDG and ALT knobs', () => {
    const find = (name: string) => columnElements(id).find((e) => 'id' in e && e.id === name);
    const nav = find('nav');
    const hdg = find('hdg');
    const alt = find('alt');
    const small = find('vol');
    const swap = find('swap');
    expect(nav?.kind === 'knob' && [globalPos(id, nav), nav.r]).toEqual([{ x: 308, y: 278 }, 16]);
    expect(hdg?.kind === 'knob' && [globalPos(id, hdg), hdg.r]).toEqual([{ x: 308, y: 350 }, 16]);
    expect(alt?.kind === 'knob' && [globalPos(id, alt), alt.r]).toEqual([{ x: 308, y: 568 }, 15]);
    expect(small?.kind === 'knob' && [globalPos(id, small), small.r]).toEqual([
      { x: 299, y: 212 },
      7,
    ]);
    expect(swap?.kind === 'swap' && [globalPos(id, swap), swap.w, swap.h]).toEqual([
      { x: 316, y: 234 },
      24,
      12,
    ]);
  });

  it('carries the static texts at the Table F1 baselines', () => {
    const r = region(id).bounds;
    const texts = columnElements(id)
      .filter((e) => e.kind === 'text')
      .map((e) => [e.text, e.x + r.x, e.y + r.y, e.size, e.anchor]);
    expect(texts).toEqual([
      ['VOL', 309, 210, 6, 'start'],
      ['PUSH ID', 309, 217, 6, 'start'],
      ['NAV', 308, 258, 8, 'middle'],
      ['PUSH', 308, 302, 6, 'middle'],
      ['1-2', 308, 309, 6, 'middle'],
      ['HDG', 308, 330, 8, 'middle'],
      ['PUSH', 308, 374, 6, 'middle'],
      ['HDG SYNC', 308, 381, 6, 'middle'],
      ['ALT', 308, 548, 8, 'middle'],
    ]);
  });

  it('every part and text anchor lies inside the region and the plate; no parts overlap', () => {
    expectInside(id);
    expectNoOverlap(id);
  });

  it('renders as a not-operable image group from the data', () => {
    const tree = renderColumn(id);
    expect(tree.props['role']).toBe('img');
    expect(tree.props['aria-label']).toBe('PFD KNOB COLUMN LEFT (NOT OPERABLE)');
    expect(tree.props['data-unit']).toBe(id);
    expect(findElements(tree, (e) => e.props['data-knob'] !== undefined)).toHaveLength(4);
    expect(findElements(tree, (e) => e.props['data-swap'] !== undefined)).toHaveLength(1);
    const strings = findElements(tree, (e) => e.tag === 'text').map((e) => textOf(e));
    expect(strings).toEqual([
      'VOL',
      'PUSH ID',
      'NAV',
      'PUSH',
      '1-2',
      'HDG',
      'PUSH',
      'HDG SYNC',
      'ALT',
    ]);
  });

  it('carries no handler, hit rectangle, control id or tabindex and stays within 150 elements', () => {
    const tree = renderColumn(id);
    const offenders = findElements(tree, (el) =>
      Object.keys(el.props).some(
        (k) =>
          /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
      ),
    );
    expect(offenders).toEqual([]);
    expect(countElements(tree)).toBeLessThanOrEqual(150);
  });

  it('uses only the font sizes 6 and 8', () => {
    for (const el of findElements(renderColumn(id), (e) => e.tag === 'text')) {
      expect([6, 8]).toContain(el.props['font-size']);
    }
  });

  it('draws no gradient, filter or raster', () => {
    const tree = renderColumn(id);
    expect(
      findElements(tree, (e) =>
        ['image', 'filter', 'linearGradient', 'radialGradient'].includes(e.tag),
      ),
    ).toEqual([]);
    const fills = findElements(tree, (e) => typeof e.props['fill'] === 'string').map((e) =>
      String(e.props['fill']),
    );
    expect(fills.filter((f) => f.startsWith('url('))).toEqual([]);
  });

  it('draws each knob as disc, one knurl path, cap circle and one highlight path', () => {
    const tree = renderColumn(id);
    const knobs = findElements(tree, (e) => e.props['data-knob'] !== undefined);
    for (const k of knobs) {
      expect(
        findElements(k, (e) => e.tag === 'circle'),
        'two circles',
      ).toHaveLength(2);
      expect(
        findElements(k, (e) => e.tag === 'path'),
        'two paths',
      ).toHaveLength(2);
      expect(findElements(k, (e) => e.tag === 'text')).toEqual([]);
    }
  });
});

describe('pfd_bezel_right column (Table F2)', () => {
  const id = 'pfd_bezel_right';

  it('has four knobs, one joystick, one swap button and six keys', () => {
    expect(knobsOf(id)).toHaveLength(4);
    expect(columnElements(id).filter((e) => e.kind === 'joystick')).toHaveLength(1);
    expect(columnElements(id).filter((e) => e.kind === 'swap')).toHaveLength(1);
    expect(columnElements(id).filter((e) => e.kind === 'key')).toHaveLength(6);
  });

  it('pins the COM and FMS knobs, the joystick, the swap button and the keys', () => {
    const find = (name: string) => columnElements(id).find((e) => 'id' in e && e.id === name);
    const com = find('com');
    const fms = find('fms');
    const range = find('range');
    const swap = find('swap');
    expect(com?.kind === 'knob' && [globalPos(id, com), com.r]).toEqual([{ x: 909, y: 276 }, 16]);
    expect(fms?.kind === 'knob' && [globalPos(id, fms), fms.r]).toEqual([{ x: 909, y: 548 }, 17]);
    expect(range?.kind === 'joystick' && [globalPos(id, range), range.r]).toEqual([
      { x: 909, y: 406 },
      11,
    ]);
    expect(swap?.kind === 'swap' && [globalPos(id, swap), swap.w, swap.h]).toEqual([
      { x: 919, y: 234 },
      22,
      12,
    ]);
    const keys = columnElements(id).filter((e) => e.kind === 'key');
    const first = keys[0];
    const last = keys[5];
    expect(first && globalPos(id, first)).toEqual({ x: 895, y: 448 });
    expect(last && globalPos(id, last)).toEqual({ x: 923, y: 492 });
    for (const k of keys) expect([k.w, k.h]).toEqual([26, 18]);
  });

  it('the keys sit in two columns and three rows and the columns do not overlap', () => {
    const keys = columnElements(id).filter((e) => e.kind === 'key');
    expect(keys.map((k) => [globalPos(id, k).x, globalPos(id, k).y])).toEqual([
      [895, 448],
      [923, 448],
      [895, 470],
      [923, 470],
      [895, 492],
      [923, 492],
    ]);
    expect(895 + 13).toBeLessThan(923 - 13);
    expect(keys.map((k) => k.legend)).toEqual([null, 'MENU', 'FPL', 'PROC', 'CLR', 'ENT']);
  });

  it('carries the static texts at the Table F2 baselines', () => {
    const r = region(id).bounds;
    const texts = columnElements(id)
      .filter((e) => e.kind === 'text')
      .map((e) => [e.text, e.x + r.x, e.y + r.y, e.size, e.anchor]);
    expect(texts).toEqual([
      ['VOL', 909, 210, 6, 'start'],
      ['PUSH SQ', 909, 217, 6, 'start'],
      ['EMERG', 879, 237, 6, 'start'],
      ['COM', 909, 256, 8, 'middle'],
      ['PUSH', 909, 300, 6, 'middle'],
      ['1-2', 909, 307, 6, 'middle'],
      ['CRS/BARO', 909, 324, 8, 'middle'],
      ['PUSH', 909, 368, 6, 'middle'],
      ['CRS CTR', 909, 375, 6, 'middle'],
      ['RANGE', 909, 392, 8, 'middle'],
      ['PUSH', 909, 426, 6, 'middle'],
      ['PAN', 909, 433, 6, 'middle'],
      ['DFLT MAP', 879, 508, 6, 'start'],
      ['FMS', 909, 526, 8, 'middle'],
      // Table F2 says 573; moved up 1 unit so the text stays inside the region (art-fit gate).
      ['PUSH CRSR', 909, 572, 6, 'middle'],
    ]);
  });

  it('every part and text anchor lies inside the region and the plate; no parts overlap', () => {
    expectInside(id);
    expectNoOverlap(id);
  });

  it('renders the round parts, swap button, keys and every legend within 150 elements', () => {
    const tree = renderColumn(id);
    expect(tree.props['aria-label']).toBe('PFD KNOB COLUMN RIGHT (NOT OPERABLE)');
    expect(findElements(tree, (e) => e.props['data-knob'] !== undefined)).toHaveLength(4);
    expect(findElements(tree, (e) => e.props['data-joystick'] !== undefined)).toHaveLength(1);
    expect(findElements(tree, (e) => e.props['data-swap'] !== undefined)).toHaveLength(1);
    expect(findElements(tree, (e) => e.props['data-key'] !== undefined)).toHaveLength(6);
    const strings = findElements(tree, (e) => e.tag === 'text').map((e) => textOf(e));
    for (const word of [
      'MENU',
      'FPL',
      'PROC',
      'CLR',
      'ENT',
      'D',
      'DFLT MAP',
      'PUSH CRSR',
      'EMERG',
    ]) {
      expect(strings, word).toContain(word);
    }
    expect(countElements(tree)).toBeLessThanOrEqual(150);
  });

  it('draws the direct-to key as an arrow path with the letter D to its left', () => {
    const tree = renderColumn(id);
    const direct = findElements(tree, (e) => e.props['data-key'] === 'direct-to')[0];
    expect(direct).toBeDefined();
    if (direct === undefined) return;
    const d = findElements(direct, (e) => e.tag === 'text')[0];
    const arrow = findElements(direct, (e) => e.tag === 'path').at(-1);
    expect(d && textOf(d)).toBe('D');
    expect(arrow?.props['stroke']).toBe('#e6e9ed');
    const keyData = columnElements(id).find((e) => e.kind === 'key' && e.id === 'direct-to');
    expect(Number(d?.props['x'])).toBeLessThan(keyData?.kind === 'key' ? keyData.cx : 0);
  });

  it('carries no handler, hit rectangle, control id or tabindex; fonts are 6 and 8', () => {
    const tree = renderColumn(id);
    const offenders = findElements(tree, (el) =>
      Object.keys(el.props).some(
        (k) =>
          /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
      ),
    );
    expect(offenders).toEqual([]);
    for (const el of findElements(tree, (e) => e.tag === 'text')) {
      expect([6, 8]).toContain(el.props['font-size']);
    }
  });
});

describe('mfd_bezel_right column (Table F3)', () => {
  const id = 'mfd_bezel_right';

  it('has four knobs, one joystick, one swap button and six 26 x 18 keys', () => {
    expect(knobsOf(id)).toHaveLength(4);
    expect(columnElements(id).filter((e) => e.kind === 'joystick')).toHaveLength(1);
    expect(columnElements(id).filter((e) => e.kind === 'swap')).toHaveLength(1);
    const keys = columnElements(id).filter((e) => e.kind === 'key');
    expect(keys).toHaveLength(6);
    for (const k of keys) expect([k.w, k.h]).toEqual([26, 18]);
  });

  it('pins the COM and FMS knobs and the first and last key', () => {
    const find = (name: string) => columnElements(id).find((e) => 'id' in e && e.id === name);
    const com = find('com');
    const fms = find('fms');
    expect(com?.kind === 'knob' && [globalPos(id, com), com.r]).toEqual([{ x: 1824, y: 276 }, 16]);
    expect(fms?.kind === 'knob' && [globalPos(id, fms), fms.r]).toEqual([{ x: 1824, y: 548 }, 17]);
    const keys = columnElements(id).filter((e) => e.kind === 'key');
    const first = keys[0];
    const last = keys[5];
    expect(first && globalPos(id, first)).toEqual({ x: 1810, y: 448 });
    expect(last && globalPos(id, last)).toEqual({ x: 1838, y: 492 });
  });

  it('pins the swap button and the texts that depend on the column centre', () => {
    const swap = columnElements(id).find((e) => e.kind === 'swap');
    expect(swap?.kind === 'swap' && [globalPos(id, swap), swap.w, swap.h]).toEqual([
      { x: 1834, y: 234 },
      22,
      12,
    ]);
    const r = region(id).bounds;
    const at = (text: string) =>
      columnElements(id)
        .filter((e): e is ColumnText => e.kind === 'text' && e.text === text)
        .map((e) => [e.x + r.x, e.y + r.y, e.anchor]);
    expect(at('EMERG')).toEqual([[1794, 237, 'start']]);
    expect(at('DFLT MAP')).toEqual([[1794, 508, 'start']]);
    expect(at('VOL')).toEqual([[1824, 210, 'start']]);
    expect(at('PUSH CRSR')).toEqual([[1824, 572, 'middle']]);
  });

  it('equals the PFD right column shifted by +915 in x, element by element', () => {
    const pfd = columnElements('pfd_bezel_right');
    const mfd = columnElements(id);
    expect(mfd).toHaveLength(pfd.length);
    const pr = region('pfd_bezel_right').bounds;
    const mr = region(id).bounds;
    pfd.forEach((a, i) => {
      const b = mfd[i];
      expect(b?.kind, `element ${i}`).toBe(a.kind);
      if (a.kind === 'text' && b?.kind === 'text') {
        expect([b.text, b.x + mr.x, b.y + mr.y, b.size, b.anchor], `text ${a.text}`).toEqual([
          a.text,
          a.x + pr.x + 915,
          a.y + pr.y,
          a.size,
          a.anchor,
        ]);
      } else if (a.kind !== 'text' && b !== undefined && b.kind !== 'text') {
        const ga = globalPos('pfd_bezel_right', a);
        const gb = globalPos(id, b);
        expect([gb.x, gb.y], `${a.kind} ${a.id}`).toEqual([ga.x + 915, ga.y]);
        // Every size, radius and legend is unchanged.
        expect({ ...b, cx: 0, cy: 0 }).toEqual({ ...a, cx: 0, cy: 0 });
      }
    });
  });

  it('every part and text anchor lies inside the region and the plate; no parts overlap', () => {
    expectInside(id);
    expectNoOverlap(id);
    // The two key columns do not overlap.
    expect(1810 + 13).toBeLessThan(1838 - 13);
  });

  it('renders as a not-operable image group with the same parts as the PFD right column', () => {
    const tree = renderColumn(id);
    expect(tree.props['aria-label']).toBe('MFD KNOB COLUMN RIGHT (NOT OPERABLE)');
    expect(findElements(tree, (e) => e.props['data-knob'] !== undefined)).toHaveLength(4);
    expect(findElements(tree, (e) => e.props['data-joystick'] !== undefined)).toHaveLength(1);
    expect(findElements(tree, (e) => e.props['data-swap'] !== undefined)).toHaveLength(1);
    expect(findElements(tree, (e) => e.props['data-key'] !== undefined)).toHaveLength(6);
    const strings = (c: ColumnId) =>
      findElements(renderColumn(c), (e) => e.tag === 'text').map((e) => textOf(e));
    expect(strings(id)).toEqual(strings('pfd_bezel_right'));
  });
});

describe('bezel columns: element budget and inertness', () => {
  const ids = ['pfd_bezel_left', 'pfd_bezel_right', 'mfd_bezel_right'] as const;

  it.each(ids)('%s stays within 150 svg elements', (id) => {
    expect(countElements(renderColumn(id))).toBeLessThanOrEqual(150);
  });

  it('the three columns hold 12 knobs, 2 joysticks, 3 swap buttons and 12 keys', () => {
    const all = ids.flatMap((id) => columnElements(id));
    expect(all.filter((e) => e.kind === 'knob')).toHaveLength(12);
    expect(all.filter((e) => e.kind === 'joystick')).toHaveLength(2);
    expect(all.filter((e) => e.kind === 'swap')).toHaveLength(3);
    expect(all.filter((e) => e.kind === 'key')).toHaveLength(12);
  });

  it.each(ids)(
    '%s has no handler, hit rectangle, control id, tabindex or font other than 6 and 8',
    (id) => {
      const tree = renderColumn(id);
      const offenders = findElements(tree, (el) =>
        Object.keys(el.props).some(
          (k) =>
            /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
        ),
      );
      expect(offenders).toEqual([]);
      for (const el of findElements(tree, (e) => e.tag === 'text')) {
        expect([6, 8]).toContain(el.props['font-size']);
      }
    },
  );

  it('no column region is in the control registry', () => {
    for (const id of ids) expect(region(id).controlIds, id).toEqual([]);
    expect(
      DA50RG.regions
        .filter((r) => r.id.endsWith('bezel_right') || r.id.endsWith('bezel_left'))
        .every((r) => r.controlIds.length === 0),
    ).toBe(true);
  });

  it('the source names no avionics maker, product family or logo (brand rule)', () => {
    const files = [
      '../src/aircraft/da50rg/avionics.ts',
      '../src/ui/panel/frames/BezelColumnFrame.tsx',
    ];
    for (const f of files) {
      const text = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
      expect(text, f).not.toMatch(/garmin|g1000|nxi|logo|wordmark|swoosh/i);
    }
  });
});

describe('review document on the knob columns (plan 07)', () => {
  const review = readFileSync(
    fileURLToPath(new URL('../docs/PANEL-REVIEW.md', import.meta.url)),
    'utf8',
  );

  it('lists the three columns as assumptions with the file to change', () => {
    for (const needle of [
      '`BEZEL_COLUMNS`',
      'src/aircraft/da50rg/avionics.ts',
      'knob sets',
      'about 70 percent',
      'direct-to',
      'PUSH CRSR',
      'no logo',
    ]) {
      expect(review, needle).toContain(needle);
    }
  });
});

// Plan 08 task 1: the audio panel (D-05, T-01.2-13): 21 keys with legends and lamp slivers, a
// volume knob and the red DISPLAY BACKUP button, all inert. Positions are typed in as global
// literals (Table G1); the data holds region-local coordinates.

const AUDIO_LEGENDS = [
  'COM1 MIC',
  'COM1',
  'COM2 MIC',
  'COM2',
  'AUX MIC',
  'AUX',
  'DME',
  'NAV1',
  'ADF',
  'NAV2',
  'PILOT ICS',
  'TEL',
  'COPLT ICS',
  'MUS1',
  'PASS ICS',
  'MUS2',
  'SPKR PA',
  'MKR MUTE',
  'HI SENS',
  'PLAY',
  'MAN SQ',
] as const;

describe('audio panel data (Table G1)', () => {
  const origin = region('audio_panel').bounds;
  const keys = AUDIO_PANEL.filter((e) => e.kind === 'key');
  const glob = (e: { cx: number; cy: number }) => ({ x: e.cx + origin.x, y: e.cy + origin.y });

  it('has 21 keys 25 x 20 with the legends in reading order', () => {
    expect(origin).toEqual({ x: 946, y: 196, w: 60, h: 378 });
    expect(keys).toHaveLength(21);
    expect(keys.map((k) => k.legend)).toEqual([...AUDIO_LEGENDS]);
    for (const k of keys) expect([k.w, k.h]).toEqual([25, 20]);
  });

  it('puts the keys in two columns (962, 990) and eleven rows of pitch 26; row 9 has no right key', () => {
    const rows = [214, 240, 266, 292, 318, 344, 370, 396, 422, 448, 474];
    const expected: [number, number][] = [];
    rows.forEach((y, i) => {
      expected.push([962, y]);
      if (i !== 8) expected.push([990, y]);
    });
    expect(keys.map((k) => [glob(k).x, glob(k).y])).toEqual(expected);
    expect(glob(keys[0] ?? { cx: 0, cy: 0 })).toEqual({ x: 962, y: 214 });
    expect(glob(keys[20] ?? { cx: 0, cy: 0 })).toEqual({ x: 990, y: 474 });
    const row9 = keys.filter((k) => glob(k).y === 422);
    expect(row9.map((k) => k.legend)).toEqual(['SPKR PA']);
  });

  it('has 21 lamp slivers, exactly COM1 MIC, COM1 and PILOT ICS lit (U-16)', () => {
    expect(keys.every((k) => k.lamp === 'lit' || k.lamp === 'unlit')).toBe(true);
    expect(keys.filter((k) => k.lamp === 'lit').map((k) => k.legend)).toEqual([
      'COM1 MIC',
      'COM1',
      'PILOT ICS',
    ]);
  });

  it('has the volume knob (976, 508, R 11) and the DISPLAY BACKUP button (976, 541, r 9)', () => {
    const knobs = AUDIO_PANEL.filter((e) => e.kind === 'knob');
    const buttons = AUDIO_PANEL.filter((e) => e.kind === 'button');
    expect(knobs).toHaveLength(1);
    expect(buttons).toHaveLength(1);
    const k = knobs[0];
    const b = buttons[0];
    expect(k && [glob(k).x, glob(k).y, k.r]).toEqual([976, 508, 11]);
    expect(b && [glob(b).x, glob(b).y, b.r]).toEqual([976, 541, 9]);
  });

  it('carries the DISPLAY and BACKUP legends at baselines 563 and 570, middle anchor, size 6', () => {
    const texts = AUDIO_PANEL.filter((e) => e.kind === 'text').map((e) => [
      e.text,
      e.x + origin.x,
      e.y + origin.y,
      e.size,
      e.anchor,
    ]);
    expect(texts).toEqual([
      ['DISPLAY', 976, 563, 6, 'middle'],
      ['BACKUP', 976, 570, 6, 'middle'],
    ]);
  });

  it('every key lies inside the region and the centre-stack plate; no two keys overlap', () => {
    const plate = PLATES.find((p) => p.regions.includes('audio_panel'));
    expect(plate?.id).toBe('centre-stack');
    for (const k of keys) {
      expect(k.cx - k.w / 2, k.legend ?? '').toBeGreaterThanOrEqual(0);
      expect(k.cx + k.w / 2, k.legend ?? '').toBeLessThanOrEqual(origin.w);
      expect(k.cy - k.h / 2, k.legend ?? '').toBeGreaterThanOrEqual(0);
      expect(k.cy + k.h / 2, k.legend ?? '').toBeLessThanOrEqual(origin.h);
      expect(glob(k).x - k.w / 2).toBeGreaterThanOrEqual(plate?.x ?? Infinity);
      expect(glob(k).x + k.w / 2).toBeLessThanOrEqual((plate?.x ?? 0) + (plate?.w ?? 0));
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i];
        const b = keys[j];
        if (a === undefined || b === undefined) continue;
        const apart =
          a.cx + a.w / 2 <= b.cx - b.w / 2 ||
          b.cx + b.w / 2 <= a.cx - a.w / 2 ||
          a.cy + a.h / 2 <= b.cy - b.h / 2 ||
          b.cy + b.h / 2 <= a.cy - a.h / 2;
        expect(apart, `${a.legend ?? ''} and ${b.legend ?? ''}`).toBe(true);
      }
    }
  });

  it('the knob and button lie inside the region, clear of each other and of the last key row', () => {
    const knob = AUDIO_PANEL.find((e) => e.kind === 'knob');
    const button = AUDIO_PANEL.find((e) => e.kind === 'button');
    if (knob?.kind !== 'knob' || button?.kind !== 'button') throw new Error('parts missing');
    const lastRowBottom = Math.max(...keys.map((k) => k.cy + k.h / 2));
    expect(knob.cy - knob.r).toBeGreaterThan(lastRowBottom);
    expect(button.cy - button.r).toBeGreaterThanOrEqual(knob.cy + knob.r);
    for (const part of [knob, button]) {
      expect(part.cx - part.r).toBeGreaterThanOrEqual(0);
      expect(part.cx + part.r).toBeLessThanOrEqual(origin.w);
      expect(part.cy + part.r).toBeLessThan(origin.h);
    }
    // DISPLAY and BACKUP lie below the button and inside the region.
    for (const t of AUDIO_PANEL.filter((e) => e.kind === 'text')) {
      expect(t.y).toBeGreaterThan(button.cy + button.r);
      expect(t.y).toBeLessThanOrEqual(origin.h);
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(origin.w);
    }
  });
});

describe('AudioPanelFrame', () => {
  const render = () =>
    expand(AudioPanelFrame({ region: region('audio_panel'), bridge: fakeBridge('map') }));

  it('keeps the not-operable group and the housing', () => {
    const tree = render();
    expect(tree.props['role']).toBe('img');
    expect(tree.props['aria-label']).toBe('AUDIO PANEL (NOT OPERABLE)');
    expect(tree.props['data-unit']).toBe('audio_panel');
    expect(findElements(tree, (e) => e.props['data-unit-housing'] !== undefined)).toHaveLength(1);
  });

  it('draws 21 keys, 21 lamp slivers (3 lit), the knob and the DISPLAY BACKUP button', () => {
    const tree = render();
    expect(findElements(tree, (e) => e.props['data-key'] !== undefined)).toHaveLength(21);
    const lamps = findElements(tree, (e) => e.props['data-lamp'] !== undefined);
    expect(lamps).toHaveLength(21);
    const lit = lamps.filter((l) => l.props['data-lamp-lit'] === 'true');
    expect(lit).toHaveLength(3);
    for (const l of lit) expect(l.props['fill']).toBe('#ffb81c');
    for (const l of lamps.filter((x) => x.props['data-lamp-lit'] !== 'true')) {
      expect(l.props['fill']).toBe('#3a3f46');
      expect([l.props['width'], l.props['height']]).toEqual([12, 2]);
    }
    expect(findElements(tree, (e) => e.props['data-knob'] !== undefined)).toHaveLength(1);
    const button = findElements(tree, (e) => e.props['data-display-backup'] !== undefined);
    expect(button).toHaveLength(1);
    const cap = button[0] && findElements(button[0], (e) => e.props['fill'] === '#c4161f');
    expect(cap).toHaveLength(1);
    expect(
      button[0] && findElements(button[0], (e) => e.props['stroke'] === '#f0535b'),
    ).toHaveLength(1);
  });

  it('splits two-word legends at the space (cy - 1.4, cy + 5.6) and sets one word at cy + 2.1', () => {
    const tree = render();
    const origin = region('audio_panel').bounds;
    const keyOf = (legend: string) => {
      const data = AUDIO_PANEL.find((e) => e.kind === 'key' && e.legend === legend);
      if (data?.kind !== 'key') throw new Error(legend);
      const el = findElements(tree, (e) => e.props['data-key'] === data.id)[0];
      if (el === undefined) throw new Error(`no key ${legend}`);
      return { data, texts: findElements(el, (e) => e.tag === 'text') };
    };
    const two = keyOf('COM1 MIC');
    expect(two.texts.map((t) => textOf(t))).toEqual(['COM1', 'MIC']);
    expect(Number(two.texts[0]?.props['y'])).toBeCloseTo(two.data.cy - 1.4, 6);
    expect(Number(two.texts[1]?.props['y'])).toBeCloseTo(two.data.cy + 5.6, 6);
    const one = keyOf('AUX');
    expect(one.texts.map((t) => textOf(t))).toEqual(['AUX']);
    expect(Number(one.texts[0]?.props['y'])).toBeCloseTo(one.data.cy + 2.1, 6);
    expect(origin.w).toBe(60);
  });

  it('prints every legend once, the full key list plus DISPLAY and BACKUP', () => {
    const strings = findElements(render(), (e) => e.tag === 'text').map((e) => textOf(e));
    const words = [...AUDIO_LEGENDS.flatMap((l) => l.split(' ')), 'DISPLAY', 'BACKUP'];
    expect([...strings].sort()).toEqual([...words].sort());
  });

  it('carries no handler, hit rectangle, control id or tabindex; fonts 6 and 8; at most 150 elements', () => {
    const tree = render();
    const offenders = findElements(tree, (el) =>
      Object.keys(el.props).some(
        (k) =>
          /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
      ),
    );
    expect(offenders).toEqual([]);
    for (const el of findElements(tree, (e) => e.tag === 'text')) {
      expect([6, 8]).toContain(el.props['font-size']);
    }
    expect(countElements(tree)).toBeLessThanOrEqual(150);
    expect(
      findElements(tree, (e) =>
        ['image', 'filter', 'linearGradient', 'radialGradient'].includes(e.tag),
      ),
    ).toEqual([]);
  });

  it('adds nothing to the control registry', () => {
    expect(region('audio_panel').controlIds).toEqual([]);
  });
});

// Plan 08 task 2: the backup EFIS (D-06): bezelled unit with an attitude display, a tape display
// and one round knob. Rectangles are typed in as global literals (Table G2); the data is local.

describe('backup EFIS data (Table G2)', () => {
  const origin = region('standby_efis').bounds;
  const global = (r: { x: number; y: number; w: number; h: number }) => ({
    x: r.x + origin.x,
    y: r.y + origin.y,
    w: r.w,
    h: r.h,
  });
  const inside = (
    inner: { x: number; y: number; w: number; h: number },
    outer: { x: number; y: number; w: number; h: number },
  ) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h;

  it('pins the housing, the two displays and the knob', () => {
    expect(origin).toEqual({ x: 1026, y: 296, w: 120, h: 278 });
    expect(global(STANDBY_EFIS.housing)).toEqual({ x: 1029, y: 298, w: 114, h: 264 });
    expect(global(STANDBY_EFIS.upper)).toEqual({ x: 1040, y: 308, w: 92, h: 116 });
    expect(global(STANDBY_EFIS.lower)).toEqual({ x: 1040, y: 434, w: 92, h: 116 });
    const k = STANDBY_EFIS.knob;
    expect([k.cx + origin.x, k.cy + origin.y, k.r]).toEqual([1134, 429, 8]);
  });

  it('both displays lie inside the housing, the housing inside the region and the plate', () => {
    expect(inside(STANDBY_EFIS.upper, STANDBY_EFIS.housing)).toBe(true);
    expect(inside(STANDBY_EFIS.lower, STANDBY_EFIS.housing)).toBe(true);
    expect(inside(STANDBY_EFIS.housing, { x: 0, y: 0, w: origin.w, h: origin.h })).toBe(true);
    const plate = PLATES.find((p) => p.regions.includes('standby_efis'));
    expect(plate?.id).toBe('centre-stack');
    expect(inside(global(STANDBY_EFIS.housing), plate ?? { x: 0, y: 0, w: 0, h: 0 })).toBe(true);
  });

  it('the displays do not overlap each other', () => {
    const a = STANDBY_EFIS.upper;
    const b = STANDBY_EFIS.lower;
    expect(a.y + a.h).toBeLessThanOrEqual(b.y);
  });

  it('the knob lies inside the housing and overlaps the right edge of the lower display', () => {
    const k = STANDBY_EFIS.knob;
    const h = STANDBY_EFIS.housing;
    const d = STANDBY_EFIS.lower;
    expect(k.cx - k.r).toBeGreaterThanOrEqual(h.x);
    expect(k.cx + k.r).toBeLessThanOrEqual(h.x + h.w);
    expect(k.cy - k.r).toBeGreaterThanOrEqual(h.y);
    expect(k.cy + k.r).toBeLessThanOrEqual(h.y + h.h);
    // The disc reaches across the display's right edge and into its vertical range.
    expect(k.cx - k.r).toBeLessThan(d.x + d.w);
    expect(k.cx + k.r).toBeGreaterThan(d.x + d.w);
    expect(k.cy + k.r).toBeGreaterThan(d.y);
  });

  it('has the speed numerals 180 down to 100 and five altitude numerals around 1400', () => {
    expect([...EFIS_SPEED_TAPE]).toEqual([180, 160, 140, 120, 100]);
    expect([...EFIS_ALTITUDE_TAPE]).toEqual([1600, 1500, 1400, 1300, 1200]);
  });
});

describe('StandbyEfisFrame', () => {
  const render = () =>
    expand(StandbyEfisFrame({ region: region('standby_efis'), bridge: fakeBridge('map') }));

  it('keeps the not-operable group and draws its own housing', () => {
    const tree = render();
    expect(tree.props['role']).toBe('img');
    expect(tree.props['aria-label']).toBe('BACKUP EFIS (NOT OPERABLE)');
    expect(tree.props['data-unit']).toBe('standby_efis');
    const housing = findElements(tree, (e) => e.props['data-unit-housing'] !== undefined);
    expect(housing).toHaveLength(1);
    const h = STANDBY_EFIS.housing;
    expect(
      ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke'].map((k) => housing[0]?.props[k]),
    ).toEqual([h.x, h.y, h.w, h.h, 4, '#0c0d0f', '#2d3138']);
  });

  it('draws two displays, one knob and no key, lamp or button', () => {
    const tree = render();
    const displays = findElements(tree, (e) => e.props['data-efis-display'] !== undefined);
    expect(displays.map((d) => d.props['data-efis-display'])).toEqual(['attitude', 'tape']);
    expect(findElements(tree, (e) => e.props['data-knob'] !== undefined)).toHaveLength(1);
    expect(findElements(tree, (e) => e.props['data-key'] !== undefined)).toHaveLength(0);
    expect(findElements(tree, (e) => e.props['data-display-backup'] !== undefined)).toHaveLength(0);
  });

  it('the attitude display has blue over brown halves, a horizon, ticks, a roll arc and the fixed symbol', () => {
    const att = findElements(render(), (e) => e.props['data-efis-display'] === 'attitude')[0];
    if (att === undefined) throw new Error('no attitude display');
    const fills = findElements(att, (e) => e.tag === 'rect').map((e) => e.props['fill']);
    expect(fills).toContain('#1f6fc4');
    expect(fills).toContain('#7a5230');
    expect(findElements(att, (e) => e.props['data-efis-horizon'] !== undefined)).toHaveLength(1);
    expect(findElements(att, (e) => e.props['data-efis-pitch'] !== undefined)).toHaveLength(1);
    expect(findElements(att, (e) => e.props['data-efis-roll-arc'] !== undefined)).toHaveLength(1);
    expect(findElements(att, (e) => e.props['data-efis-roll-ticks'] !== undefined)).toHaveLength(1);
    const symbol = findElements(att, (e) => e.props['data-efis-symbol'] !== undefined);
    expect(symbol).toHaveLength(1);
    expect(symbol[0]?.props['stroke']).toBe('#f2c230');
    expect(findElements(att, (e) => e.tag === 'text')).toEqual([]);
  });

  it('the tape display shows KTS, FEET, BARO 1013, the idle readouts and five numerals per tape', () => {
    const tape = findElements(render(), (e) => e.props['data-efis-display'] === 'tape')[0];
    if (tape === undefined) throw new Error('no tape display');
    expect(findElements(tape, (e) => e.tag === 'rect')[0]?.props['fill']).toBe('#05080b');
    const texts = findElements(tape, (e) => e.tag === 'text').map((e) => textOf(e));
    for (const word of ['KTS', 'FEET', 'BARO', '1013', '0', '1400']) {
      expect(texts, word).toContain(word);
    }
    for (const n of [...EFIS_SPEED_TAPE, ...EFIS_ALTITUDE_TAPE]) {
      expect(texts, String(n)).toContain(String(n));
    }
    const bar = findElements(tape, (e) => e.props['data-efis-speed-bar'] !== undefined);
    expect(bar).toHaveLength(1);
    expect([bar[0]?.props['width'], bar[0]?.props['fill']]).toEqual([3, '#2fd36f']);
  });

  it('digits use the glass font class; no logo or maker text', () => {
    const tree = render();
    const texts = findElements(tree, (e) => e.tag === 'text');
    for (const t of texts) {
      if (/^\d+$/.test(textOf(t))) expect(t.props['class'], textOf(t)).toBe('glass-digits');
    }
    const all = texts.map((t) => textOf(t)).join(' ');
    expect(all).not.toMatch(/garmin|g1000|nxi|logo|wordmark|swoosh/i);
  });

  it('carries no handler, hit rectangle, control id or tabindex; sizes 6 and 8; at most 150 elements', () => {
    const tree = render();
    const offenders = findElements(tree, (el) =>
      Object.keys(el.props).some(
        (k) =>
          /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
      ),
    );
    expect(offenders).toEqual([]);
    for (const el of findElements(tree, (e) => e.tag === 'text')) {
      expect([6, 8]).toContain(el.props['font-size']);
    }
    expect(countElements(tree)).toBeLessThanOrEqual(150);
    expect(
      findElements(tree, (e) =>
        ['image', 'filter', 'linearGradient', 'radialGradient'].includes(e.tag),
      ),
    ).toEqual([]);
    expect(region('standby_efis').controlIds).toEqual([]);
  });
});

// Plan 08 task 3: the autopilot panel (D-05): four knobs, a swap button and 12 keys in six rows.
// Positions are typed in as global literals (Table G3).

const AP_LEGENDS = [
  'AP',
  'YD',
  'FD',
  'HDG',
  'NAV',
  'APR',
  'ALT',
  'VNV',
  'VS',
  'NOSE UP',
  'FLC',
  'NOSE DN',
] as const;

describe('autopilot panel data (Table G3)', () => {
  const origin = region('autopilot_panel').bounds;
  const keys = AUTOPILOT_PANEL.filter((e) => e.kind === 'key');
  const knobs = AUTOPILOT_PANEL.filter((e) => e.kind === 'knob');
  const glob = (e: { cx: number; cy: number }) => ({ x: e.cx + origin.x, y: e.cy + origin.y });

  it('has 12 keys 30 x 22 in two columns (1189, 1223) and six rows 404 to 534 in steps of 26', () => {
    expect(origin).toEqual({ x: 1164, y: 196, w: 86, h: 408 });
    expect(keys).toHaveLength(12);
    const rows = [404, 430, 456, 482, 508, 534];
    expect(keys.map((k) => [glob(k).x, glob(k).y])).toEqual(
      rows.flatMap((y) => [
        [1189, y],
        [1223, y],
      ]),
    );
    for (const k of keys) expect([k.w, k.h]).toEqual([30, 22]);
    expect(keys.map((k) => k.legend)).toEqual([...AP_LEGENDS]);
    expect(keys.filter((k) => k.lamp !== undefined)).toEqual([]);
  });

  it('has four knobs (VOL 1196, 212 r 7; NAV 1206, 278 r 16; HDG 1206, 350 r 16; ALT 1206, 582 r 15)', () => {
    expect(knobs.map((k) => [k.id, glob(k).x, glob(k).y, k.r])).toEqual([
      ['vol', 1196, 212, 7],
      ['nav', 1206, 278, 16],
      ['hdg', 1206, 350, 16],
      ['alt', 1206, 582, 15],
    ]);
  });

  it('has the swap button at (1214, 234), 24 x 12', () => {
    const swaps = AUTOPILOT_PANEL.filter((e) => e.kind === 'swap');
    expect(swaps).toHaveLength(1);
    const sw = swaps[0];
    expect(sw && [glob(sw).x, glob(sw).y, sw.w, sw.h]).toEqual([1214, 234, 24, 12]);
  });

  it('carries the static texts at the Table G3 baselines', () => {
    const texts = AUTOPILOT_PANEL.filter((e) => e.kind === 'text').map((e) => [
      e.text,
      e.x + origin.x,
      e.y + origin.y,
      e.size,
      e.anchor,
    ]);
    expect(texts).toEqual([
      ['VOL', 1206, 210, 6, 'start'],
      ['PUSH ID', 1206, 217, 6, 'start'],
      ['NAV', 1206, 258, 8, 'middle'],
      ['PUSH', 1206, 302, 6, 'middle'],
      ['1-2', 1206, 309, 6, 'middle'],
      ['HDG', 1206, 330, 8, 'middle'],
      ['PUSH', 1206, 374, 6, 'middle'],
      ['HDG SYNC', 1206, 381, 6, 'middle'],
      ['ALT', 1206, 562, 8, 'middle'],
    ]);
  });

  it('every part lies inside the region and the ap-unit plate; no two parts overlap', () => {
    const plate = PLATES.find((p) => p.regions.includes('autopilot_panel'));
    expect(plate?.id).toBe('ap-unit');
    const boxes = AUTOPILOT_PANEL.flatMap((e) => (e.kind === 'text' ? [] : [e])).map((e) => {
      const g = glob(e);
      const hw = 'r' in e ? e.r : e.w / 2;
      const hh = 'r' in e ? e.r : e.h / 2;
      return {
        name: 'id' in e ? e.id : '',
        x0: g.x - hw,
        y0: g.y - hh,
        x1: g.x + hw,
        y1: g.y + hh,
      };
    });
    for (const b of boxes) {
      expect(b.x0, b.name).toBeGreaterThanOrEqual(origin.x);
      expect(b.y0, b.name).toBeGreaterThanOrEqual(origin.y);
      expect(b.x1, b.name).toBeLessThanOrEqual(origin.x + origin.w);
      expect(b.y1, b.name).toBeLessThanOrEqual(origin.y + origin.h);
      expect(b.x0, b.name).toBeGreaterThanOrEqual(plate?.x ?? Infinity);
      expect(b.y0, b.name).toBeGreaterThanOrEqual(plate?.y ?? Infinity);
      expect(b.x1, b.name).toBeLessThanOrEqual((plate?.x ?? 0) + (plate?.w ?? 0));
      expect(b.y1, b.name).toBeLessThanOrEqual((plate?.y ?? 0) + (plate?.h ?? 0));
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a === undefined || b === undefined) continue;
        const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
        expect(apart, `${a.name} and ${b.name}`).toBe(true);
      }
    }
  });

  it('the first key row clears the HDG SYNC legend (row top 393, baseline 381)', () => {
    const first = keys[0];
    expect(first && glob(first).y - 11).toBe(393);
    const sync = AUTOPILOT_PANEL.find((e) => e.kind === 'text' && e.text === 'HDG SYNC');
    expect(sync?.kind === 'text' && sync.y + origin.y).toBe(381);
    expect(393).toBeGreaterThan(381);
  });
});

describe('AutopilotPanelFrame', () => {
  const render = () =>
    expand(AutopilotPanelFrame({ region: region('autopilot_panel'), bridge: fakeBridge('map') }));

  it('keeps the not-operable group and the housing equal to the region frame', () => {
    const tree = render();
    expect(tree.props['role']).toBe('img');
    expect(tree.props['aria-label']).toBe('AUTOPILOT PANEL (NOT OPERABLE)');
    expect(tree.props['data-unit']).toBe('autopilot_panel');
    const { w, h } = region('autopilot_panel').bounds;
    const housing = findElements(tree, (e) => e.props['data-unit-housing'] !== undefined);
    expect(housing).toHaveLength(1);
    expect(
      ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke'].map((k) => housing[0]?.props[k]),
    ).toEqual([0, 0, w, h, 4, '#0c0d0f', '#2d3138']);
  });

  it('draws 12 keys, four knobs and one swap button, no lamps and no button', () => {
    const tree = render();
    expect(findElements(tree, (e) => e.props['data-key'] !== undefined)).toHaveLength(12);
    expect(findElements(tree, (e) => e.props['data-knob'] !== undefined)).toHaveLength(4);
    expect(findElements(tree, (e) => e.props['data-swap'] !== undefined)).toHaveLength(1);
    expect(findElements(tree, (e) => e.props['data-lamp'] !== undefined)).toHaveLength(0);
    expect(findElements(tree, (e) => e.props['data-display-backup'] !== undefined)).toHaveLength(0);
  });

  it('NOSE UP and NOSE DN are two lines, the other legends one line', () => {
    const tree = render();
    const linesOf = (legend: string) => {
      const data = AUTOPILOT_PANEL.find((e) => e.kind === 'key' && e.legend === legend);
      if (data?.kind !== 'key') throw new Error(legend);
      const el = findElements(tree, (e) => e.props['data-key'] === data.id)[0];
      return el === undefined
        ? []
        : findElements(el, (e) => e.tag === 'text').map((t) => textOf(t));
    };
    expect(linesOf('NOSE UP')).toEqual(['NOSE', 'UP']);
    expect(linesOf('NOSE DN')).toEqual(['NOSE', 'DN']);
    for (const legend of ['AP', 'YD', 'FD', 'HDG', 'NAV', 'APR', 'ALT', 'VNV', 'VS', 'FLC']) {
      expect(linesOf(legend), legend).toEqual([legend]);
    }
  });

  it('prints the key legends and the knob names and sub-legends of Table G3', () => {
    const strings = findElements(render(), (e) => e.tag === 'text').map((e) => textOf(e));
    const expected = [
      'AP',
      'YD',
      'FD',
      'HDG',
      'NAV',
      'APR',
      'ALT',
      'VNV',
      'VS',
      'NOSE',
      'UP',
      'FLC',
      'NOSE',
      'DN',
      'VOL',
      'PUSH ID',
      'NAV',
      'PUSH',
      '1-2',
      'HDG',
      'PUSH',
      'HDG SYNC',
      'ALT',
    ];
    expect([...strings].sort()).toEqual([...expected].sort());
  });

  it('carries no handler, hit rectangle, control id or tabindex; sizes 6 and 8; at most 150 elements', () => {
    const tree = render();
    const offenders = findElements(tree, (el) =>
      Object.keys(el.props).some(
        (k) =>
          /^on[A-Z]/.test(k) || k === 'data-hit' || k === 'data-control-id' || k === 'tabindex',
      ),
    );
    expect(offenders).toEqual([]);
    for (const el of findElements(tree, (e) => e.tag === 'text')) {
      expect([6, 8]).toContain(el.props['font-size']);
    }
    expect(countElements(tree)).toBeLessThanOrEqual(150);
    expect(region('autopilot_panel').controlIds).toEqual([]);
  });
});

describe('centre-stack units: element budget, inertness and brand rule', () => {
  const units = [
    ['audio_panel', AudioPanelFrame],
    ['standby_efis', StandbyEfisFrame],
    ['autopilot_panel', AutopilotPanelFrame],
  ] as const;

  it.each(units)('%s stays within 150 svg elements', (id, Frame) => {
    const tree = expand(Frame({ region: region(id), bridge: fakeBridge('map') }));
    expect(countElements(tree)).toBeLessThanOrEqual(150);
  });

  it('adds no control: the registry has no id for any unit part and no unit region holds one', () => {
    for (const id of ['audio_panel', 'standby_efis', 'autopilot_panel']) {
      expect(region(id).controlIds, id).toEqual([]);
    }
    expect(
      DA50RG.controls.filter((c) => /audio_panel|efis|display_backup|autopilot/.test(c.id)),
    ).toEqual([]);
  });

  it('the sources of the three units name no avionics maker, product family, model or logo', () => {
    const files = [
      '../src/ui/panel/frames/AudioPanelFrame.tsx',
      '../src/ui/panel/frames/StandbyEfisFrame.tsx',
      '../src/ui/panel/frames/AutopilotPanelFrame.tsx',
    ];
    for (const f of files) {
      const text = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
      expect(text, f).not.toMatch(/garmin|g1000|nxi|gma|gfc|gdu|logo|wordmark|swoosh/i);
    }
  });

  it('the red DISPLAY BACKUP cap colour appears only in the shared renderer file', () => {
    for (const f of ['AudioPanelFrame', 'StandbyEfisFrame', 'AutopilotPanelFrame']) {
      const text = readFileSync(
        fileURLToPath(new URL(`../src/ui/panel/frames/${f}.tsx`, import.meta.url)),
        'utf8',
      );
      expect(text, f).not.toContain('c4161f');
    }
  });
});

describe('review document on the audio panel, backup EFIS and autopilot panel (plan 08)', () => {
  const review = readFileSync(
    fileURLToPath(new URL('../docs/PANEL-REVIEW.md', import.meta.url)),
    'utf8',
  );

  it('describes the three units as assumptions with the file to change', () => {
    for (const needle of [
      '`AUDIO_PANEL`',
      '`STANDBY_EFIS`',
      '`AUTOPILOT_PANEL`',
      'DISPLAY BACKUP',
      'three lit',
      'volume knob legends',
      'left strip of the MFD',
      'src/aircraft/da50rg/avionics.ts',
    ]) {
      expect(review, needle).toContain(needle);
    }
    expect(review).not.toContain('artwork come in plan 08');
  });
});
