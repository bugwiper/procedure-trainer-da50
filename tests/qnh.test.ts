import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { PFD_QNH_QUANTITY, qnhReadout } from '../src/aircraft/da50rg/avionics';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { initialQuantities } from '../src/engine/predicates';
import { simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';
import type { PanelBridge } from '../src/ui/bridge';
import { GLASS_TURQUOISE } from '../src/ui/panel/frames/MfdFrame';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
import { parsePreviewQuantities } from '../src/ui/preview';
import { expand, findElements, textOf } from './vnode-walk';
import type { El } from './vnode-walk';

// Phase 6.1, plan 03 (D-12, D-13): the barometer setting as a static display quantity in hPa, shown
// under the altitude tape in the turquoise of the glass header. Display only: no model, no altitude
// correction. Numbers here are typed by hand from the design; the data is checked against them.

const QNH = 'qnh_hpa';
const MINUTE = 60_000;
/** The turquoise of the glass header, typed again so that a slip in the constant fails. */
const TURQUOISE = '#3fd1e0';

const def = DA50RG_QUANTITIES.get(QNH);
if (def === undefined) throw new Error('no qnh_hpa');

describe('the quantity qnh_hpa', () => {
  it('exists with the range 950 to 1050, the base 1013 and one unmarked band', () => {
    expect(PFD_QNH_QUANTITY).toBe(QNH);
    expect([def.min, def.max, def.base, def.unit]).toEqual([950, 1050, 1013, 'hPa']);
    expect(def.bands.map((b) => [b.id, b.colour, b.to])).toEqual([['unmarked', 'none', 1050]]);
  });

  it('has no model: a five minute simulation leaves the value alone', () => {
    const scenarioText = readFileSync(
      fileURLToPath(new URL('./fixtures/scenarios/smoke-onset.toon', import.meta.url)),
      'utf8',
    );
    const checked = checkScenario(scenarioText, DA50RG_ENV);
    if (!checked.ok) throw new Error('the fixture does not pass');
    const scenario = { ...checked.scenario, parameters: {}, outcomes: [] };
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    expect(start[QNH]).toBe(1013);
    const after = simulate(setup, { events: [], start, untilMs: 5 * MINUTE }).state;
    expect(after.quantities[QNH]).toBe(1013);
  });
});

describe('qnhReadout', () => {
  it('rounds to whole hPa', () => {
    expect(qnhReadout(1013)).toBe(1013);
    expect(qnhReadout(1013.4)).toBe(1013);
    expect(qnhReadout(1013.5)).toBe(1014);
    expect(qnhReadout(1021)).toBe(1021);
  });

  it('reads the base for a missing or non-finite reading', () => {
    expect(qnhReadout(undefined)).toBe(1013);
    expect(qnhReadout(Number.NaN)).toBe(1013);
    expect(qnhReadout(Number.POSITIVE_INFINITY)).toBe(1013);
  });
});

describe('the preview flag ?q=qnh_hpa:', () => {
  it('sets a value inside the range and ignores values outside it (T-06.1-05)', () => {
    expect(parsePreviewQuantities('?q=qnh_hpa:1021', DA50RG_QUANTITIES)).toEqual({ [QNH]: 1021 });
    expect(parsePreviewQuantities('?q=qnh_hpa:99999', DA50RG_QUANTITIES)).toEqual({});
    expect(parsePreviewQuantities('?q=qnh_hpa:949', DA50RG_QUANTITIES)).toEqual({});
    expect(parsePreviewQuantities('?q=qnh_hpa:1051', DA50RG_QUANTITIES)).toEqual({});
    expect(parsePreviewQuantities('?q=qnh_hpa:950', DA50RG_QUANTITIES)).toEqual({ [QNH]: 950 });
    expect(parsePreviewQuantities('?q=qnh_hpa:1050', DA50RG_QUANTITIES)).toEqual({ [QNH]: 1050 });
  });
});

describe('a scenario that lays qnh_hpa into its start quantities', () => {
  const text = readFileSync(
    fileURLToPath(new URL('./fixtures/scenarios/smoke-onset.toon', import.meta.url)),
    'utf8',
  ).replace(
    '    lv.env_circ: recirc\n',
    '    lv.env_circ: recirc\n  quantities:\n    qnh_hpa: 1021\n',
  );

  it('passes the scenario check and starts the run with that value', () => {
    expect(text).toContain('qnh_hpa: 1021');
    const checked = checkScenario(text, DA50RG_ENV);
    if (!checked.ok) throw new Error(JSON.stringify(checked));
    const scenario = { ...checked.scenario, parameters: {}, outcomes: [] };
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    expect(start[QNH]).toBe(1021);
    const setup = simSetup(DA50RG_ENV, scenario);
    const after = simulate(setup, { events: [], start, untilMs: 5 * MINUTE }).state;
    expect(after.quantities[QNH]).toBe(1021);
  });
});

describe('the PFD readout', () => {
  const region = DA50RG.regions.find((r) => r.id === 'pfd');
  if (region === undefined) throw new Error('no pfd region');
  const render = (qnh: number | undefined): El => {
    const values = { ...DA50RG_QUANTITIES.baseValues() };
    if (qnh !== undefined) values[QNH] = qnh;
    const bridge = {
      registry: DA50RG,
      stateOf: () => ({ value: 'map' }),
      quantities: { value: values },
      cas: { value: [] },
      cueLevels: { value: {} },
    } as unknown as PanelBridge;
    return expand(PfdFrame({ region, bridge }));
  };
  const readout = (tree: El): El | undefined =>
    findElements(tree, (e) => 'data-qnh-readout' in e.props)[0];

  it('shows the value of the quantity in turquoise at size 8 and the static unit HPA at size 6', () => {
    expect(GLASS_TURQUOISE).toBe(TURQUOISE);
    const tree = render(undefined);
    expect(textOf(readout(tree) ?? tree)).toBe('1013');
    expect(readout(tree)?.props['fill']).toBe(TURQUOISE);
    expect(readout(tree)?.props['font-size']).toBe(8);
    const unit = findElements(tree, (e) => e.tag === 'text' && textOf(e) === 'HPA');
    expect(unit).toHaveLength(1);
    expect(unit[0]?.props['fill']).toBe(TURQUOISE);
    expect(unit[0]?.props['font-size']).toBe(6);
  });

  it('follows the quantity and rounds to whole hPa; the unit text never changes', () => {
    expect(textOf(readout(render(1021)) ?? render(1021))).toBe('1021');
    expect(textOf(readout(render(1008.6)) ?? render(1008.6))).toBe('1009');
    const texts = (tree: El): string[] =>
      findElements(tree, (e) => e.tag === 'text' && !('data-qnh-readout' in e.props)).map(textOf);
    expect(texts(render(1021))).toEqual(texts(render(undefined)));
  });

  it('is gone with the old baro box and its text 1013 HPA', () => {
    const tree = render(undefined);
    expect(findElements(tree, (e) => 'data-baro-box' in e.props)).toHaveLength(0);
    expect(findElements(tree, (e) => e.tag === 'text' && textOf(e) === '1013 HPA')).toHaveLength(0);
  });
});
