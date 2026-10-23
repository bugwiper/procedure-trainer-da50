import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { GLASS_DARK, RED, YELLOW } from '../src/ui/panel/frames/gauge-alert';
import { startScenario } from './support/session';
import { activate } from './support/zoom';

// PNL-04 (plan 03-12): the MFD gauges restyle by the band their live value is in. In ENG OIL TEMP
// on Easy the oil temperature starts in the red band (red boxes behind the label and the value,
// white text, a red pointer) and turns yellow after the correct actions (yellow boxes, dark text,
// a yellow pointer); a gauge in green is drawn plain. No spec reads the e2e window hook, the tone
// is read from the drawn attributes.

const ROW = 'engine.eng-oil-temp-green';
const WHITE = '#ffffff';

type Tone = 'red' | 'yellow';
const LOOK: Readonly<Record<Tone, { box: string; text: string; pointer: string }>> = {
  red: { box: RED, text: WHITE, pointer: RED },
  yellow: { box: YELLOW, text: GLASS_DARK, pointer: YELLOW },
};

const gaugeOf = (page: Page, label: string): Locator =>
  page.locator(`[data-region-id="mfd"] [data-gauge="${label}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

/**
 * The alert marks of one gauge, as drawn: boxes, their texts and the pointer (the marker of a bar,
 * the needle of an arc; an arc has a third, plain text for its unit).
 */
async function expectAlert(gauge: Locator, tone: Tone, kind: 'bar' | 'arc' = 'bar'): Promise<void> {
  const look = LOOK[tone];
  await expect(gauge).toHaveAttribute('data-alert', tone);
  const boxes = gauge.locator('[data-alert-box]');
  await expect(boxes).toHaveCount(2);
  await expect(boxes.nth(0)).toHaveAttribute('data-alert-box', 'label');
  await expect(boxes.nth(1)).toHaveAttribute('data-alert-box', 'value');
  for (const i of [0, 1]) await expect(boxes.nth(i)).toHaveAttribute('fill', look.box);
  const texts = gauge.locator(':scope > text');
  await expect(texts).toHaveCount(kind === 'bar' ? 2 : 3);
  for (const i of [0, 1]) await expect(texts.nth(i)).toHaveAttribute('fill', look.text);
  if (kind === 'bar') {
    await expect(gauge.locator(':scope > path')).toHaveAttribute('fill', look.pointer);
  } else {
    await expect(gauge.locator(':scope > line[transform]')).toHaveAttribute('stroke', look.pointer);
  }
}

/**
 * Each text lies inside its box and the two boxes of the gauge do not overlap. Horizontally the
 * text box (getBBox) must be inside the rectangle; vertically the baseline and the cap line (0.7
 * of the font size above it) must be, because the text box of a font also holds its line gap.
 */
async function expectBoxesHoldTheirText(gauge: Locator): Promise<void> {
  const geometry = await gauge.evaluate((g) => {
    const rects = Array.from(g.querySelectorAll<SVGRectElement>('[data-alert-box]'));
    const texts = Array.from(g.querySelectorAll<SVGTextElement>(':scope > text'));
    const box = (r: SVGRectElement) => ({
      left: r.x.baseVal.value,
      top: r.y.baseVal.value,
      right: r.x.baseVal.value + r.width.baseVal.value,
      bottom: r.y.baseVal.value + r.height.baseVal.value,
    });
    return rects.map((r, i) => {
      const t = texts[i];
      if (t === undefined) throw new Error('no text for a box');
      const b = t.getBBox();
      const size = Number(t.getAttribute('font-size'));
      const baseline = t.y.baseVal.getItem(0).value;
      return {
        box: box(r),
        text: { left: b.x, right: b.x + b.width, baseline, capLine: baseline - 0.7 * size },
      };
    });
  });
  expect(geometry).toHaveLength(2);
  for (const { box, text } of geometry) {
    expect(text.left, 'text left').toBeGreaterThanOrEqual(box.left);
    expect(text.right, 'text right').toBeLessThanOrEqual(box.right);
    expect(text.capLine, 'cap line').toBeGreaterThanOrEqual(box.top);
    expect(text.baseline, 'baseline').toBeLessThanOrEqual(box.bottom);
  }
  const [a, b] = geometry;
  if (a === undefined || b === undefined) throw new Error('missing boxes');
  const apart =
    a.box.right <= b.box.left ||
    b.box.right <= a.box.left ||
    a.box.bottom <= b.box.top ||
    b.box.bottom <= a.box.top;
  expect(apart, 'the two boxes do not overlap').toBe(true);
}

test('the oil temperature is red-boxed on the map strip at the start of an Easy run, a green gauge is plain', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW);
  const oilTemp = gaugeOf(page, 'Oil temp');
  await expectAlert(oilTemp, 'red');
  await expectBoxesHoldTheirText(oilTemp);
  // An untouched gauge in its green band has no alert mark and no box.
  const oilPres = gaugeOf(page, 'Oil pres');
  await expect(oilPres).not.toHaveAttribute('data-alert', /.*/);
  await expect(oilPres.locator('[data-alert-box]')).toHaveCount(0);
});

test('the oil temperature bar on the engine page is red, then yellow after the correct actions', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  const oilTemp = gaugeOf(page, 'Oil temp');
  await expectAlert(oilTemp, 'red');
  await expectBoxesHoldTheirText(oilTemp);

  // The correct actions: POWER to the 50 % marker, the cowl flap to the open marker.
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p50');
  await activate(page.locator('[data-detent="lv.cowl_flap:open"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.cowl_flap"]')).toHaveAttribute(
    'data-state',
    'open',
  );

  await expect(oilTemp).toHaveAttribute('data-alert', 'yellow', { timeout: 20_000 });
  await expectAlert(oilTemp, 'yellow');
  await expectBoxesHoldTheirText(oilTemp);
});

test('with ENGINE MASTER off the oil pressure arc turns red while the RPM arc stays plain', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  const oilPres = gaugeOf(page, 'Oil pres');
  const rpm = gaugeOf(page, 'RPM');
  await expect(oilPres).not.toHaveAttribute('data-alert', /.*/);

  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.engine_master"]')).toHaveAttribute(
    'data-state',
    'off',
  );

  await expect(oilPres).toHaveAttribute('data-alert', 'red', { timeout: 10_000 });
  await expectAlert(oilPres, 'red', 'arc');
  await expectBoxesHoldTheirText(oilPres);
  // The engine spins down towards 0 rpm, which lies in the green band of the RPM scale: the arc
  // keeps its plain look all the way.
  await expect
    .poll(async () => Number(await rpm.locator('text.glass-digits').textContent()), {
      timeout: 15_000,
    })
    .toBeLessThan(300);
  await expect(rpm).not.toHaveAttribute('data-alert', /.*/);
  await expect(rpm.locator('[data-alert-box]')).toHaveCount(0);
});
