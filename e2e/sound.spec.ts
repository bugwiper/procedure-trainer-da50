import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { activate } from './support/zoom';
import { startScenario } from './support/session';

// The Sound control and the aural cues (Phase 5, plan 03). A headless browser may block or mute
// Web Audio, so these specs read what the app asked for through the e2e-only window hook
// (__panelAudio: enabled, tone count, last tone, engine pitch and level), never what is audible.

const OIL_TEMP = 'engine.eng-oil-temp-green';
const ALTN_1 = 'electrical.elec-altn1-fail';
const FIRE = 'engine.eng-fire-in-flight';

interface AudioHook {
  enabled(): boolean;
  tones(): number;
  lastTone(): string | null;
  engineHz(): number;
  engineGain(): number;
}
type Host = { __panelAudio?: AudioHook };

const toggle = (page: Page) => page.getByTestId('sound-toggle');
const tones = (page: Page) => page.evaluate(() => (globalThis as Host).__panelAudio?.tones() ?? -1);
const lastTone = (page: Page) =>
  page.evaluate(() => (globalThis as Host).__panelAudio?.lastTone() ?? null);
const enabled = (page: Page) =>
  page.evaluate(() => (globalThis as Host).__panelAudio?.enabled() ?? false);
const gain = (page: Page) =>
  page.evaluate(() => (globalThis as Host).__panelAudio?.engineGain() ?? -1);
const hz = (page: Page) => page.evaluate(() => (globalThis as Host).__panelAudio?.engineHz() ?? -1);

async function open(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
}

async function soundOn(page: Page, hasTouch: boolean): Promise<void> {
  await activate(toggle(page), hasTouch);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await enabled(page)).toBe(true);
}

test('@hooks Sound is off at first, and a tap turns it on and off', async ({ page, hasTouch }) => {
  await open(page);
  await expect(toggle(page)).toHaveText('Sound');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await enabled(page)).toBe(false);
  await soundOn(page, hasTouch);
  await activate(toggle(page), hasTouch);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await enabled(page)).toBe(false);
  await expect(toggle(page)).toHaveText('Sound');
});

test('@hooks a reload keeps the choice and the first press arms it', async ({ page, hasTouch }) => {
  await open(page);
  await soundOn(page, hasTouch);
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await enabled(page)).toBe(false);
  // Any press arms it: a press on the page, not on the control.
  await activate(page.getByTestId('training-aid-notice'), hasTouch);
  await expect.poll(() => enabled(page)).toBe(true);
});

test('@hooks the free panel makes no sound, even with Sound on', async ({ page, hasTouch }) => {
  await open(page);
  await soundOn(page, hasTouch);
  await page.waitForTimeout(500);
  expect(await tones(page)).toBe(0);
  expect(await gain(page)).toBe(0);
});

test('@hooks with Sound off a run asks for no sound', async ({ page, hasTouch }) => {
  test.setTimeout(60_000);
  await open(page);
  await startScenario(page, hasTouch, OIL_TEMP, 'easy');
  await page.waitForTimeout(500);
  expect(await tones(page)).toBe(0);
  expect(await gain(page)).toBe(0);
});

test('@hooks ENG OIL TEMP gives the warning tone, ALTN 1 FAIL the caution tone', async ({
  page,
  hasTouch,
}) => {
  test.setTimeout(90_000);
  await open(page);
  await soundOn(page, hasTouch);
  await startScenario(page, hasTouch, OIL_TEMP, 'easy');
  await expect.poll(() => lastTone(page), { timeout: 10_000 }).toBe('warning');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The choice is remembered; a press anywhere but on the control arms it again.
  await activate(page.getByTestId('training-aid-notice'), hasTouch);
  await expect.poll(() => enabled(page)).toBe(true);
  await startScenario(page, hasTouch, ALTN_1, 'easy');
  await expect.poll(() => lastTone(page), { timeout: 10_000 }).toBe('caution');
});

test('@hooks Engine Fire gives an engine pitch that falls to 0 after ENGINE MASTER off', async ({
  page,
  hasTouch,
}) => {
  test.setTimeout(90_000);
  await open(page);
  await soundOn(page, hasTouch);
  await startScenario(page, hasTouch, FIRE, 'easy');
  await expect.poll(() => gain(page), { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await hz(page)).toBeGreaterThan(0);
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect.poll(() => gain(page), { timeout: 20_000 }).toBe(0);
  expect(await hz(page)).toBe(0);
});

test('@hooks an open modal silences the run and closing it brings the sound back', async ({
  page,
  hasTouch,
}) => {
  test.setTimeout(60_000);
  await open(page);
  await soundOn(page, hasTouch);
  await startScenario(page, hasTouch, FIRE, 'easy');
  await expect.poll(() => gain(page), { timeout: 10_000 }).toBeGreaterThan(0);
  await activate(page.getByTestId('about-open'), hasTouch);
  await expect.poll(() => gain(page)).toBe(0);
  const before = await tones(page);
  await page.waitForTimeout(500);
  expect(await tones(page)).toBe(before);
  await page.keyboard.press('Escape');
  await expect.poll(() => gain(page), { timeout: 5_000 }).toBeGreaterThan(0);
});

test('the footer stays on one line in landscape with the Sound control, free and in a run', async ({
  page,
  hasTouch,
}) => {
  test.setTimeout(60_000);
  await open(page);
  const size = page.viewportSize();
  test.skip(size === null || size.width <= size.height, 'portrait phones wrap by design');
  const centres = () =>
    page.evaluate(() => {
      const ids = ['training-aid-notice', 'sound-toggle', 'about-open', 'procedure-complete'];
      return ids.flatMap((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return [];
        const b = el.getBoundingClientRect();
        return [{ id, mid: b.top + b.height / 2, right: b.right }];
      });
    });
  const oneLine = async () => {
    const found = await centres();
    const mids = found.map((f) => f.mid);
    expect(Math.max(...mids) - Math.min(...mids)).toBeLessThanOrEqual(2);
    expect(found.every((f) => f.right <= (size?.width ?? 0))).toBe(true);
  };
  await oneLine();
  await startScenario(page, hasTouch, FIRE, 'easy');
  expect((await centres()).map((f) => f.id)).toContain('procedure-complete');
  await oneLine();
});
