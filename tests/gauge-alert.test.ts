import { describe, expect, it } from 'vitest';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { BarGauge } from '../src/ui/panel/frames/BarGauge';
import type { BarGaugeProps } from '../src/ui/panel/frames/BarGauge';
import {
  GLASS_DARK,
  GREEN,
  RED,
  YELLOW,
  gaugeAlertStyle,
  textBoxWidth,
  toneOf,
} from '../src/ui/panel/frames/gauge-alert';
import type { GaugeTone } from '../src/ui/panel/frames/gauge-alert';
import { expand, findElements, textOf } from './vnode-walk';
import type { El } from './vnode-walk';

// Plan 03-12 (C-66 to C-71, T-03-29, T-03-31): the alert look of an MFD gauge. The style table, the
// band colour of a live reading (derived here from the quantity data, not from the function under
// test) and the drawn bar gauge in every tone.

const PLAIN_LABEL = '#aab3bd';
const PLAIN_VALUE = '#ffffff';

describe('gaugeAlertStyle (C-66)', () => {
  it.each(['green', 'none'] as const)('tone %s keeps today’s look and draws no box', (tone) => {
    expect(gaugeAlertStyle(tone)).toMatchObject({
      boxes: false,
      labelFill: PLAIN_LABEL,
      valueFill: PLAIN_VALUE,
      pointerFill: PLAIN_VALUE,
    });
  });

  it('tone yellow: yellow boxes, the dark glass colour for the text, a yellow pointer', () => {
    expect(gaugeAlertStyle('yellow')).toEqual({
      boxes: true,
      boxFill: YELLOW,
      labelFill: GLASS_DARK,
      valueFill: GLASS_DARK,
      pointerFill: YELLOW,
    });
  });

  it('tone red: red boxes, white text, a red pointer', () => {
    expect(gaugeAlertStyle('red')).toEqual({
      boxes: true,
      boxFill: RED,
      labelFill: '#ffffff',
      valueFill: '#ffffff',
      pointerFill: RED,
    });
  });

  it('the palette keeps the values of the glass frames', () => {
    expect([GREEN, YELLOW, RED, GLASS_DARK]).toEqual(['#2fd36f', '#f2c230', '#f0443c', '#05080b']);
  });
});

describe('toneOf follows the band colours of the quantity data (C-67, T-03-29)', () => {
  it.each(DA50RG_QUANTITIES.all.map((d) => [d.id, d] as const))(
    '%s: band middles, bounds and out-of-range values',
    (_id, def) => {
      let from = def.min;
      def.bands.forEach((band, i) => {
        const tone = (v: number): GaugeTone => toneOf(DA50RG_QUANTITIES, def.id, v);
        // The middle of the band and the bound it owns (the lower band owns a bound).
        expect(tone((from + band.to) / 2), `${band.id} middle`).toBe(band.colour);
        expect(tone(band.to), `${band.id} upper bound`).toBe(band.colour);
        // A hair above the bound is the next band; above the maximum it stays the last.
        const next = def.bands[i + 1];
        if (next !== undefined) {
          expect(tone(band.to + 1e-6), `above ${band.id}`).toBe(next.colour);
        }
        from = band.to;
      });
      const first = def.bands[0];
      const last = def.bands[def.bands.length - 1];
      expect(toneOf(DA50RG_QUANTITIES, def.id, def.min), 'the minimum').toBe(first?.colour);
      expect(toneOf(DA50RG_QUANTITIES, def.id, def.min - 1000), 'below min').toBe(first?.colour);
      expect(toneOf(DA50RG_QUANTITIES, def.id, def.max + 1000), 'above max').toBe(last?.colour);
    },
  );

  it('every base reading is plain (green or unmarked): the free panel looks as before', () => {
    for (const def of DA50RG_QUANTITIES.all) {
      const style = gaugeAlertStyle(toneOf(DA50RG_QUANTITIES, def.id, def.base));
      expect(style.boxes, def.id).toBe(false);
    }
  });

  it('an unknown quantity flags nothing', () => {
    expect(toneOf(DA50RG_QUANTITIES, 'no_such_quantity', 1)).toBe('green');
  });
});

describe('textBoxWidth (C-69)', () => {
  it('grows with the text length and with the font size', () => {
    expect(textBoxWidth('OIL', 10)).toBeGreaterThan(0);
    expect(textBoxWidth('OIL TEMP', 10)).toBeGreaterThan(textBoxWidth('OIL', 10));
    expect(textBoxWidth('128 °C', 10)).toBeGreaterThan(textBoxWidth('8 °C', 10));
    expect(textBoxWidth('RPM', 14)).toBeGreaterThan(textBoxWidth('RPM', 10));
  });
});

describe('BarGauge in every tone (C-68, T-03-31)', () => {
  const props: BarGaugeProps = {
    label: 'Oil temp',
    unit: '°C',
    value: 128,
    min: 0,
    max: 150,
    bands: [
      { from: 0, to: 50, color: YELLOW },
      { from: 50, to: 115, color: GREEN },
      { from: 115, to: 125, color: YELLOW },
      { from: 125, to: 150, color: RED },
    ],
    x: 12,
    y: 34,
    w: 130,
    h: 36,
    decimals: 0,
  };
  const draw = (tone?: GaugeTone): El =>
    expand(BarGauge(tone === undefined ? props : { ...props, tone }));
  const boxes = (tree: El): El[] =>
    findElements(tree, (e) => e.props['data-alert-box'] !== undefined);
  const texts = (tree: El): El[] => findElements(tree, (e) => e.tag === 'text');
  const pointer = (tree: El): El => {
    const found = findElements(tree, (e) => e.tag === 'path')[0];
    if (found === undefined) throw new Error('no pointer');
    return found;
  };

  it.each([undefined, 'green', 'none'] as const)(
    'tone %s draws no box and no data-alert, with the plain fills',
    (tone) => {
      const tree = draw(tone);
      expect(boxes(tree)).toEqual([]);
      expect(tree.props['data-alert']).toBeUndefined();
      expect(texts(tree).map((t) => t.props['fill'])).toEqual([PLAIN_LABEL, PLAIN_VALUE]);
      expect(pointer(tree).props['fill']).toBe(PLAIN_VALUE);
    },
  );

  it.each(['yellow', 'red'] as const)('tone %s draws exactly two boxes in the style', (tone) => {
    const style = gaugeAlertStyle(tone);
    const tree = draw(tone);
    expect(tree.props['data-alert']).toBe(tone);
    const drawn = boxes(tree);
    expect(drawn.map((b) => b.props['data-alert-box'])).toEqual(['label', 'value']);
    for (const box of drawn) {
      expect(box.tag).toBe('rect');
      expect(box.props['fill']).toBe(style.boxFill);
      expect(box.props['rx']).toBe(2);
    }
    expect(texts(tree).map((t) => t.props['fill'])).toEqual([style.labelFill, style.valueFill]);
    expect(pointer(tree).props['fill']).toBe(style.pointerFill);
  });

  it('the label box starts at the label and the value box ends at the value, side by side', () => {
    const [label, value] = boxes(draw('red'));
    if (label === undefined || value === undefined) throw new Error('missing boxes');
    const labelRight = Number(label.props['x']) + Number(label.props['width']);
    const valueRight = Number(value.props['x']) + Number(value.props['width']);
    expect(Number(label.props['x'])).toBeLessThanOrEqual(props.x);
    expect(valueRight).toBeGreaterThanOrEqual(props.x + props.w);
    expect(labelRight).toBeLessThan(Number(value.props['x']));
  });

  it('the label and the digits are the same strings in every tone (G-0)', () => {
    const strings = (tone?: GaugeTone) => texts(draw(tone)).map((t) => textOf(t));
    const plain = strings();
    expect(plain).toEqual(['OIL TEMP', '128 °C']);
    for (const tone of ['green', 'yellow', 'red', 'none'] as const) {
      expect(strings(tone), tone).toEqual(plain);
    }
  });
});
