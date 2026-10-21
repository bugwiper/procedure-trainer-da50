import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Built-panel gate for owner finding G-0.1: nothing printed on the panel changes with state.
// Controls and lamps show their state by position and light only. The spec drives the real
// pointer handlers and reads only the DOM, so it also runs against the live site.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

/**
 * All text strings of the panel svg (every svg text element): trimmed, non-empty, sorted. The
 * glass displays (PFD and MFD regions) are excluded unless the text belongs to a control: their
 * content is instrument data, and the MFD page softkey legitimately switches it between MAP and
 * ENGINE. Everything else on the panel is placard, caption or scale text and must stay put.
 */
async function panelText(page: Page): Promise<string[]> {
  return page.locator('[data-testid="panel"]').evaluate((svg) =>
    Array.from(svg.querySelectorAll('text'))
      .filter(
        (el) =>
          el.closest('[data-control-id]') !== null ||
          el.closest('[data-region-id="pfd"], [data-region-id="mfd"]') === null,
      )
      .map((el) => (el.textContent ?? '').trim())
      .filter((text) => text.length > 0)
      .sort(),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('no element of the built panel carries the state-text marker', async ({ page }) => {
  await expect(page.locator('[data-state-text]')).toHaveCount(0);
  await expect(page.locator('[data-indicator-group]')).toHaveCount(0);
});

test('the panel text is identical before and after operating a representative set of controls', async ({
  page,
  hasTouch,
}) => {
  const before = await panelText(page);
  expect(before.length).toBeGreaterThan(0);
  // The lamps keep their static captions.
  for (const caption of ['NOSE', 'LEFT', 'RIGHT', 'UNSAFE', 'UP', 'T/O 133 KIAS', 'LDG 121 KIAS']) {
    expect(before, caption).toContain(caption);
  }

  // A rocker, a bat, the ENGINE softkey and a dimmer knob step.
  await activate(page.locator('[data-hit="sw.light_landing"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.light_landing"]')).not.toHaveAttribute(
    'data-state',
    'off',
  );
  await activate(page.locator('[data-hit="sw.alternator_1"]'), hasTouch);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.mfd_page"]')).toHaveAttribute(
    'data-state',
    'engine',
  );
  const hit = page.locator('[data-hit="sw.instr_light"]');
  const box = await hit.boundingBox();
  if (box === null) throw new Error('no bounding box');
  const stepBefore = await page
    .locator('[data-control-id="sw.instr_light"]')
    .getAttribute('data-state');
  if (hasTouch) await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect(page.locator('[data-control-id="sw.instr_light"]')).not.toHaveAttribute(
    'data-state',
    stepBefore ?? '',
  );

  // The levers: GEAR to DOWN, FLAPS to LDG.
  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await expect(page.locator('[data-indicator-id="lt.gear_nose"]')).toHaveAttribute(
    'data-lit',
    'true',
  );
  await activate(page.locator('[data-detent="lv.flaps:ldg"]'), hasTouch);
  await expect(page.locator('[data-indicator-id="lt.flap_ldg"]')).toHaveAttribute(
    'data-lit',
    'true',
  );

  // The de-ice guard lifted.
  await activate(page.locator('[data-hit="sw.deice_alternate.guard"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.deice_alternate.guard"]')).toHaveAttribute(
    'data-state',
    'open',
  );

  const after = await panelText(page);
  expect(after).toEqual(before);
});

/**
 * The texts printed on the engine plate: every svg text whose box lies fully inside the plate box
 * (1 unit of slack), as { text, inside } pairs for the text of the plate and the near misses.
 */
async function enginePlateTexts(page: Page): Promise<{ text: string; inside: boolean }[]> {
  return page.locator('[data-testid="panel"]').evaluate((node) => {
    const svg = node as unknown as SVGSVGElement;
    const plate = svg.querySelector('[data-plate="engine"]');
    if (plate === null) throw new Error('no engine plate');
    const p = plate.getBoundingClientRect();
    const out: { text: string; inside: boolean }[] = [];
    for (const el of Array.from(svg.querySelectorAll('text'))) {
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      // Only the texts whose centre lies on the plate belong to it.
      if (cx < p.left || cx > p.right || cy < p.top || cy > p.bottom) continue;
      out.push({
        text: (el.textContent ?? '').trim(),
        inside:
          r.left >= p.left - 1 &&
          r.right <= p.right + 1 &&
          r.top >= p.top - 1 &&
          r.bottom <= p.bottom + 1,
      });
    }
    return out;
  });
}

test('the FADEC group reads FADEC, AUTO, FORCE B and TEST once each on the engine plate', async ({
  page,
}) => {
  const texts = await enginePlateTexts(page);
  for (const word of ['FADEC', 'AUTO', 'FORCE B', 'TEST']) {
    const found = texts.filter((t) => t.text === word);
    expect(found.length, word).toBe(1);
    expect(found[0]?.inside, `${word} lies on the engine plate`).toBe(true);
  }
  await expect(page.locator('[data-bracket="fadec"] [data-shell="bracket-title"]')).toHaveText(
    'FADEC',
  );
  await expect(page.locator('[data-placard="fadec.auto"]')).toHaveCount(1);
  await expect(page.locator('[data-placard="fadec.force_b"]')).toHaveCount(1);
  await expect(page.locator('[data-placard="fadec.test"]')).toHaveCount(1);
  // The switch and the button carry no text of their own.
  await expect(page.locator('[data-control-id="sw.fadec"] text')).toHaveCount(0);
  await expect(page.locator('[data-control-id="btn.fadec_test"] text')).toHaveCount(0);
});

test('operating the FADEC switch and the FADEC TEST button changes no printed text', async ({
  page,
  hasTouch,
}) => {
  const before = await panelText(page);
  await expect(page.locator('[data-control-id="sw.fadec"]')).toHaveAttribute('data-state', 'auto');
  await activate(page.locator('[data-hit="sw.fadec"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.fadec"]')).toHaveAttribute(
    'data-state',
    'force_b',
  );
  await activate(page.locator('[data-hit="btn.fadec_test"]'), hasTouch);
  expect(await panelText(page)).toEqual(before);
});

test('the ALTERNATOR group reads ALTERNATOR, ON, OFF, 1 and 2 once each on the engine plate', async ({
  page,
}) => {
  const texts = await enginePlateTexts(page);
  for (const word of ['ALTERNATOR', 'ON', 'OFF', '1', '2']) {
    const found = texts.filter((t) => t.text === word);
    expect(found.length, word).toBe(1);
    expect(found[0]?.inside, `${word} lies on the engine plate`).toBe(true);
  }
  await expect(page.locator('[data-shell="bracket-title"]')).toHaveText(['FADEC', 'ALTERNATOR']);
  // The switches draw no text of their own.
  await expect(page.locator('[data-control-id="sw.alternator_1"] text')).toHaveCount(0);
  await expect(page.locator('[data-control-id="sw.alternator_2"] text')).toHaveCount(0);
  // The numeral frames are outlines without fill.
  for (const id of ['alternator-1', 'alternator-2']) {
    const frame = page.locator(`[data-shell="plate-heading"][data-heading="${id}"] rect`);
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('fill', 'none');
  }
});

test('operating both alternator switches changes no printed text', async ({ page, hasTouch }) => {
  const before = await panelText(page);
  for (const id of ['sw.alternator_1', 'sw.alternator_2']) {
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(page.locator(`[data-control-id="${id}"]`)).toHaveAttribute('data-state', 'off');
  }
  expect(await panelText(page)).toEqual(before);
});
