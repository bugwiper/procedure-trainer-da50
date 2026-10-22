import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { activate } from './zoom';

// Shared e2e helpers for starting one named scenario through CHOOSE SITUATION (plan 03-01). Test
// support, not a spec: the name does not end in .spec.ts, so Playwright never collects it.

/** Mirror of the quantities() read-only hook of the e2e build (src/ui/bridge.ts); no DOM lib here. */
interface QuantityHook {
  quantities(): Record<string, number>;
}
type HookHost = { __panel?: QuantityHook };

/** The 400 ms input shield of a freshly shown list or overlay (U-12) plus 100 ms of margin. */
const SHIELD_WAIT_MS = 500;

export type Level = 'easy' | 'medium';

/** Opens CHOOSE SITUATION, taps the row "pack.scenario" and waits for the level card. */
export async function chooseScenario(page: Page, hasTouch: boolean, row: string): Promise<void> {
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.locator(`[data-session-hit="session.row.${row}"]`), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
}

/**
 * Starts the scenario of the row "pack.scenario" at the given level (default easy): CHOOSE
 * SITUATION, the row, the level card, Start run; waits until Procedure complete is visible.
 */
export async function startScenario(
  page: Page,
  hasTouch: boolean,
  row: string,
  level: Level = 'easy',
): Promise<void> {
  await chooseScenario(page, hasTouch, row);
  await page.waitForTimeout(450);
  await activate(page.getByTestId(`level-pick-${level}`), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeHidden();
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
}

/**
 * Starts the scenario of the row "pack.scenario" at the level Realistic (D-05): CHOOSE SITUATION,
 * the row, the level card, then Realistic; no briefing follows. Waits until Procedure complete is
 * visible.
 */
export async function startRealistic(page: Page, hasTouch: boolean, row: string): Promise<void> {
  await chooseScenario(page, hasTouch, row);
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-realistic'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
}

/** The current value of one named quantity from the e2e window hook; NaN when it has none. */
export function quantityOf(page: Page, id: string): Promise<number> {
  return page.evaluate(
    (quantityId) => (globalThis as HookHost).__panel?.quantities()[quantityId] ?? Number.NaN,
    id,
  );
}
