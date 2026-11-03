import { describe, expect, it, vi } from 'vitest';
import { CATALOG_REFERENCE } from './checklist-catalog-reference';
import { findElements, expand } from './vnode-walk';
import {
  LABEL_LINE_STEP,
  SESSION_LAYOUT,
  labelBaseline,
  labelLineStep,
} from '../src/ui/panel/session-area';
import type { LocalRect } from '../src/ui/panel/session-area';

// The two-line choose tabs (Phase 9, plan 09-05, R-17, P-08): the label size and the line step of a
// session button, the fit of every tab line by the glyph rule of the panel, and the proof that a
// button at the default size is drawn exactly as before. SessionButton keeps a press signal, so the
// signal hook is replaced by a plain cell and the component is expanded without a render context.
vi.mock('@preact/signals', () => ({
  useSignal: <T>(value: T) => ({ value }),
}));
const { SessionButton } = await import('../src/ui/panel/widgets/SessionButton');

const RECT: LocalRect = { x: 35, y: 110, w: (370 - 2 * 10) / 3, h: 80 };
const props = {
  rect: RECT,
  ariaLabel: 'x',
  id: 'session.test',
  onActivate: () => undefined,
} as const;

const textOf = (label: string, labelSize?: number) => {
  const tree = expand(
    SessionButton({ ...props, label, ...(labelSize === undefined ? {} : { labelSize }) }),
  );
  const [text] = findElements(tree, (el) => el.tag === 'text');
  if (text === undefined) throw new Error('the button has no text');
  return text;
};

describe('a session button at the default size is drawn as before', () => {
  it('one line: size 14, baseline 5 below the middle, anchored in the middle', () => {
    const text = textOf('CLOSE LIST');
    expect(text.props['font-size']).toBe(14);
    expect(text.props['y']).toBe(RECT.y + RECT.h / 2 + 5);
    expect(text.props['x']).toBe(RECT.x + RECT.w / 2);
    expect(text.children).toEqual(['CLOSE LIST']);
  });

  it('two lines: the baselines are 18 apart, the block centred on the baseline of one line', () => {
    const text = textOf('Brief passengers\n(if time permits)');
    expect(text.props['font-size']).toBe(14);
    expect(text.props['y']).toBe(RECT.y + RECT.h / 2 + 5);
    const spans = text.children.filter((child) => typeof child !== 'string');
    expect(spans.map((span) => span.props['dy'])).toEqual([-9, 18]);
    expect(spans.map((span) => span.props['x'])).toEqual([
      RECT.x + RECT.w / 2,
      RECT.x + RECT.w / 2,
    ]);
  });

  it('the helpers give the former numbers for the default size', () => {
    expect(labelBaseline(RECT)).toBe(RECT.y + RECT.h / 2 + SESSION_LAYOUT.label.baselineOffset);
    expect(labelBaseline(RECT, SESSION_LAYOUT.label.size)).toBe(labelBaseline(RECT));
    expect(labelLineStep()).toBe(18);
    expect(LABEL_LINE_STEP).toBe(18);
  });
});

describe('a label of another size keeps the proportions', () => {
  const size = SESSION_LAYOUT.choose.tabLabelSize;

  it('draws the size given, the baseline offset and the line step scaled with it', () => {
    const text = textOf('Annunciated\nWARNINGS', size);
    expect(text.props['font-size']).toBe(size);
    const scale = size / SESSION_LAYOUT.label.size;
    expect(text.props['y']).toBeCloseTo(RECT.y + RECT.h / 2 + 5 * scale, 9);
    const dy = text.children
      .filter((child) => typeof child !== 'string')
      .map((span) => span.props['dy']);
    expect(dy[0]).toBeCloseTo(-(18 * scale) / 2, 9);
    expect(dy[1]).toBeCloseTo(18 * scale, 9);
  });

  it('centres the two lines on the button: the mean of the baselines is the middle plus the offset', () => {
    const step = labelLineStep(size);
    const first = labelBaseline(RECT, size) - step / 2;
    const second = first + step;
    expect((first + second) / 2).toBeCloseTo(labelBaseline(RECT, size), 9);
    // The block of two lines (cap height about 0.72 of the size) lies inside the button.
    const top = first - 0.72 * size;
    const bottom = second + 0.28 * size;
    expect(top).toBeGreaterThan(RECT.y);
    expect(bottom).toBeLessThan(RECT.y + RECT.h);
  });
});

describe('every line of every tab fits its tab by the glyph rule of the panel', () => {
  const GLYPH = 0.62;
  const MARGIN = 6;
  const size = SESSION_LAYOUT.choose.tabLabelSize;

  it('has two lines per tab in the independent reference, and no empty line', () => {
    for (const group of CATALOG_REFERENCE) {
      const lines = group.tab.split('\n');
      expect(lines, group.id).toHaveLength(2);
      for (const line of lines) expect(line.length, group.id).toBeGreaterThan(0);
    }
  });

  it('keeps 6 units free on each side of the widest line of every tab', () => {
    for (const rect of SESSION_LAYOUT.choose.tabs) {
      for (const group of CATALOG_REFERENCE) {
        for (const line of group.tab.split('\n')) {
          expect(line.length * size * GLYPH, `${group.id}: ${line}`).toBeLessThanOrEqual(
            rect.w - 2 * MARGIN,
          );
        }
      }
    }
  });

  it('takes the largest size in use on the panel that fits (a bigger one would break the rule)', () => {
    const widest = Math.max(
      ...CATALOG_REFERENCE.flatMap((g) => g.tab.split('\n').map((line) => line.length)),
    );
    const tab = SESSION_LAYOUT.choose.tabs[0];
    if (tab === undefined) throw new Error('no tab');
    // The sizes used on the panel: 14 of the buttons, 10 of the small labels, 8 and 6 of the plates.
    const inUse = [14, 10, 8, 6];
    const fitting = inUse.filter((candidate) => widest * candidate * GLYPH <= tab.w - 2 * MARGIN);
    expect(Math.max(...fitting)).toBe(size);
  });

  it('keeps the tab rectangles at the former size, so the hit size is unchanged', () => {
    for (const rect of SESSION_LAYOUT.choose.tabs) {
      expect(rect.w).toBeCloseTo((370 - 2 * 10) / 3, 9);
      expect(rect.h).toBe(80);
    }
  });
});
