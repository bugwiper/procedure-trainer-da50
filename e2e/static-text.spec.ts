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
 * glass displays (PFD and MFD regions) and the session area are excluded unless the text belongs
 * to a control: their content is instrument data, and the MFD page softkey legitimately switches
 * it between MAP and ENGINE. The session area's text follows the session state (main view or
 * choose list), never a control state (UI-SPEC U-06). Everything else on the panel is placard,
 * caption or scale text and must stay put.
 */
async function panelText(page: Page): Promise<string[]> {
  return page.locator('[data-testid="panel"]').evaluate((svg) =>
    Array.from(svg.querySelectorAll('text'))
      .filter(
        (el) =>
          el.closest('[data-control-id]') !== null ||
          el.closest(
            '[data-region-id="pfd"], [data-region-id="mfd"], [data-region-id="scenario_area"]',
          ) === null,
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

const LIGHT_IDS = ['sw.light_landing', 'sw.light_taxi', 'sw.light_position', 'sw.light_strobe'];

// Plan 30, R2-1.1: ON and OFF are printed once per side of the four light switches, as plate text.
test('the glareshield prints ON and OFF once per side, as plate text, and the rockers print none', async ({
  page,
}) => {
  const words = await page.locator('[data-testid="panel"]').evaluate((node) =>
    Array.from(node.querySelectorAll('text[data-placard^="lights"]')).map((el) => ({
      text: (el.textContent ?? '').trim(),
      id: el.getAttribute('data-placard'),
      y: Number(el.getAttribute('y')),
    })),
  );
  expect(words.filter((w) => w.text === 'ON')).toHaveLength(2);
  expect(words.filter((w) => w.text === 'OFF')).toHaveLength(2);
  expect(words).toHaveLength(4);
  // All four stand on the glareshield, above y 170 in panel units.
  for (const w of words) expect(w.y, w.id ?? '').toBeLessThan(170);
  // The rockers carry no text but their own names.
  const names: Record<string, string> = {
    'sw.light_landing': 'LANDING',
    'sw.light_taxi': 'TAXI',
    'sw.light_position': 'POSITION',
    'sw.light_strobe': 'STROBE',
  };
  for (const id of LIGHT_IDS) {
    const texts = await page
      .locator(`[data-control-id="${id}"] text`)
      .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
    expect(texts, id).toEqual([names[id]]);
  }
});

test('operating all four light rockers changes no printed text', async ({ page, hasTouch }) => {
  const before = await panelText(page);
  for (const id of LIGHT_IDS) {
    const state = await page.locator(`[data-control-id="${id}"]`).getAttribute('data-state');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(page.locator(`[data-control-id="${id}"]`)).not.toHaveAttribute(
      'data-state',
      state ?? '',
    );
  }
  expect(await panelText(page)).toEqual(before);
});
