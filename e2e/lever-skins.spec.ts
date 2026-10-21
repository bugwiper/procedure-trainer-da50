import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Lever skins (PNL-11, D-09): the art is in place and every Phase 1 lever behaviour is kept on
// every device. Detailed drag and tap behaviour stays in lever.spec.ts.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

interface Point {
  x: number;
  y: number;
}

async function box(target: Locator) {
  const b = await target.boundingBox();
  if (b === null) throw new Error('no bounding box');
  return b;
}

async function centre(target: Locator): Promise<Point> {
  const b = await box(target);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function mouseDrag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('GEAR is the silver fluted knob and a marker tap moves it between UP and DOWN', async ({
  page,
  hasTouch,
}) => {
  const gear = control(page, 'lv.gear');
  await expect(gear).toHaveAttribute('data-skin', 'gear-knob');
  await expect(gear).toHaveAttribute('role', 'img');
  await expect(gear).toHaveAttribute('aria-label', 'GEAR: UP');
  await expect(gear).toHaveAttribute('data-state', 'up');

  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await expect(gear).toHaveAttribute('data-state', 'down');
  await expect(gear).toHaveAttribute('aria-label', 'GEAR: DOWN');

  await activate(page.locator('[data-detent="lv.gear:up"]'), hasTouch);
  await expect(gear).toHaveAttribute('data-state', 'up');
});

test('a mouse drag from the knob edge to the DOWN end snaps GEAR to DOWN', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'Mouse drag; the touch drag of POWER is covered in lever.spec.ts');
  const gear = control(page, 'lv.gear');
  const disc = gear.locator('circle[r="22"]');
  const b = await box(disc);
  // Inside the visible disc, near its right edge: the whole grip is grabbable.
  const edge = { x: b.x + b.width * 0.9, y: b.y + b.height / 2 };
  const down = await centre(page.locator('[data-detent="lv.gear:down"]'));
  await mouseDrag(page, edge, { x: edge.x, y: down.y });
  await expect(gear).toHaveAttribute('data-state', 'down');
});

test('every detent lever stays within 40 elements', async ({ page }) => {
  const counts = await page.locator('[data-kind="detent-lever"]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-control-id') ?? '',
      nodes: el.querySelectorAll('*').length + 1,
    })),
  );
  expect(counts.length).toBeGreaterThanOrEqual(11);
  for (const c of counts) expect(c.nodes, c.id).toBeLessThanOrEqual(40);
});

const SKINS: Record<string, string> = {
  'lv.flaps': 'flaps-block',
  'lv.alt_static': 'pull-t',
  'lv.emerg_gear': 'pull-tab',
  'lv.alt_air': 'pull-boot',
};

test('FLAPS and the pull handles carry their skins', async ({ page }) => {
  for (const [id, skin] of Object.entries(SKINS)) {
    await expect(control(page, id), id).toHaveAttribute('data-skin', skin);
  }
});

test('FLAPS moves by marker tap', async ({ page, hasTouch }) => {
  await activate(page.locator('[data-detent="lv.flaps:ldg"]'), hasTouch);
  await expect(control(page, 'lv.flaps')).toHaveAttribute('data-state', 'ldg');
});

test('ALTERNATE STATIC and ALTERNATE AIR pull by marker tap, EMERGENCY GEAR EXTENSION gets no marker', async ({
  page,
  hasTouch,
}) => {
  await activate(page.locator('[data-detent="lv.alt_static:open"]'), hasTouch);
  await expect(control(page, 'lv.alt_static')).toHaveAttribute('data-state', 'open');
  await activate(page.locator('[data-detent="lv.alt_air:open"]'), hasTouch);
  await expect(control(page, 'lv.alt_air')).toHaveAttribute('data-state', 'open');
  await expect(page.locator('[data-detent^="lv.emerg_gear:"]')).toHaveCount(0);
});

const CONSOLE_SKINS: Record<string, string> = {
  'lv.power': 'power-grip',
  'lv.cowl_flap': 'cowl-slider',
  'lv.parking_brake': 'parking-flap',
  'lv.env_direction': 'env-slider',
  'lv.env_temp': 'env-slider',
  'lv.env_circ': 'env-slider',
};

test('every pedestal and environmental lever carries its skin', async ({ page }) => {
  for (const [id, skin] of Object.entries(CONSOLE_SKINS)) {
    await expect(control(page, id), id).toHaveAttribute('data-skin', skin);
  }
});

test('the POWER grip carries no emblem or text of its own', async ({ page }) => {
  const power = control(page, 'lv.power');
  await expect(power.locator('[fill="url(#p-carbon)"]')).toHaveCount(1);
  const texts = await power.locator('text').allTextContents();
  expect(texts.filter((t) => t === 'MAX')).toHaveLength(1);
  for (const t of texts) expect(t).not.toMatch(/DIAMOND|RUBIN|DA50/i);
});

test('POWER still drags from p70 to p90 by mouse', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Mouse drag; the touch drag is covered in lever.spec.ts');
  const power = control(page, 'lv.power');
  const handle = await centre(page.locator('[data-hit="lv.power"]'));
  const a = await centre(page.locator('[data-detent="lv.power:p0"]'));
  const b = await centre(page.locator('[data-detent="lv.power:p100"]'));
  await mouseDrag(page, handle, { x: handle.x, y: a.y + (b.y - a.y) * 0.9 });
  await expect(power).toHaveAttribute('data-state', 'p90');
});

test('CIRCULATING AIR moves between its two ends by marker tap and prints no word', async ({
  page,
  hasTouch,
}) => {
  const circ = control(page, 'lv.env_circ');
  await expect(circ.locator('text')).toHaveCount(0);
  await expect(circ.locator('[data-icon]')).toHaveCount(2);
  await activate(page.locator('[data-detent="lv.env_circ:recirc"]'), hasTouch);
  await expect(circ).toHaveAttribute('data-state', 'recirc');
  await expect(circ.locator('text')).toHaveCount(0);
  await activate(page.locator('[data-detent="lv.env_circ:fresh"]'), hasTouch);
  await expect(circ).toHaveAttribute('data-state', 'fresh');
});

test('DIRECTION draws pictograms only and TEMPERATURE prints only COLD and WARM', async ({
  page,
  hasTouch,
}) => {
  const direction = control(page, 'lv.env_direction');
  await expect(direction.locator('[data-icon]')).toHaveCount(3);
  await expect(direction.locator('text')).toHaveCount(0);
  const temp = control(page, 'lv.env_temp');
  for (const step of ['cold', 't25', 'warm', 't50']) {
    await activate(page.locator(`[data-detent="lv.env_temp:${step}"]`), hasTouch);
    await expect(temp).toHaveAttribute('data-state', step);
    expect((await temp.locator('text').allTextContents()).sort()).toEqual(['COLD', 'WARM']);
  }
  await expect(page.locator('[data-shell="temp-triangle"]')).toHaveCount(1);
  await expect(page.locator('[data-shell="group-box"]')).toHaveCount(4);
});

test('PARKING BRAKE is a flap: a tap pulls it up (one wall), a second tap releases it (no wall)', async ({
  page,
  hasTouch,
}) => {
  const brake = control(page, 'lv.parking_brake');
  const hit = page.locator('[data-hit="lv.parking_brake"]');
  await expect(brake).toHaveAttribute('data-state', 'off');
  await expect(brake).toHaveAttribute('data-skin', 'parking-flap');
  // One hit over the whole footprint, no detent markers.
  await expect(hit).toHaveCount(1);
  await expect(page.locator('[data-detent^="lv.parking_brake:"]')).toHaveCount(0);
  await expect(brake.locator('[data-flap-wall]')).toHaveCount(0);
  await activate(hit, hasTouch);
  await expect(brake).toHaveAttribute('data-state', 'set');
  await expect(brake.locator('[data-flap-wall]')).toHaveCount(1);
  // Nothing is printed on the flap: the plate placard names it.
  await expect(brake.locator('text')).toHaveCount(0);
  await activate(hit, hasTouch);
  await expect(brake).toHaveAttribute('data-state', 'off');
  await expect(brake.locator('[data-flap-wall]')).toHaveCount(0);
  await expect(brake.locator('text')).toHaveCount(0);
});

test('the pedestal levers print no name of their own, the plate placards name them', async ({
  page,
}) => {
  await expect(control(page, 'lv.cowl_flap').locator('text')).toHaveCount(0);
  const power = await control(page, 'lv.power').locator('text').allTextContents();
  expect(power).not.toContain('THROTTLE');
  expect(power).not.toContain('POWER');
  const placards = await page.locator('[data-placard]').allTextContents();
  expect(placards).toEqual(expect.arrayContaining(['PARKING', 'BRAKE', 'THROTTLE', 'COWL FLAP']));
});
