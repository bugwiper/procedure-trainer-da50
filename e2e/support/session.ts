import { readFileSync, readdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { variantFromSeed } from '../../src/engine/variants';
import { parseManifest, parseScenario } from '../../src/scenario/parse';
import { pageCount } from '../../src/ui/panel/session-area';
import { activate, afterPairWindow } from './zoom';

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

/** One shipped scenario as CHOOSE SITUATION lists it. */
export interface ShippedScenario {
  /** The row key "pack.scenario" that chooseScenario and startScenario take. */
  readonly row: string;
  readonly pack: string;
  readonly id: string;
  readonly title: string;
  /** The scenario file under scenarios/<pack>/, without `.toon`. */
  readonly file: string;
}

const SCENARIO_DIR = new URL('../../scenarios/', import.meta.url);

/**
 * Every shipped scenario, read in node from the pack manifests of scenarios/ in the order the
 * choose view lists them: pack folders by name, then the manifest order. Counts and titles of the
 * specs come from here, never from literals.
 */
export function shippedScenarios(): readonly ShippedScenario[] {
  const folders = readdirSync(SCENARIO_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  return folders.flatMap((pack) => {
    const text = readFileSync(new URL(`${pack}/pack.toon`, SCENARIO_DIR), 'utf8');
    const parsed = parseManifest(text);
    if (!parsed.ok) throw new Error(`the manifest of the pack "${pack}" does not parse`);
    return parsed.value.scenarios.map((entry) => ({
      row: `${pack}.${entry.id}`,
      pack,
      id: entry.id,
      title: entry.title,
      file: entry.file,
    }));
  });
}

/** Opens CHOOSE SITUATION, taps the row "pack.scenario" and waits for the level card. */
export async function chooseScenario(page: Page, hasTouch: boolean, row: string): Promise<void> {
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  const target = page.locator(`[data-session-hit="session.row.${row}"]`);
  // The list pages (plan 05.1-01): NEXT PAGE until the row is on screen, at most once per page.
  const next = page.locator('[data-session-hit="session.next"]');
  for (let turned = 1; turned < pageCount(shippedScenarios().length); turned++) {
    if ((await target.count()) > 0) break;
    await afterPairWindow(page);
    await activate(next, hasTouch);
  }
  await activate(target, hasTouch);
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

/**
 * Forces the cause a scenario with variants draws (phase 3.1): reads the shipped file `file`
 * (under scenarios/, without `.toon`, for example "pack/scenario") in node, searches the first
 * integer seed for which `variantFromSeed` gives `id`, stubs `Math.random` with that seed
 * before any page script runs and reloads. Call it once per test, after the first `goto`, before
 * the scenario is started. The same value feeds every draw of the session (pick, onset, cause).
 */
export async function forceVariant(page: Page, file: string, id: string): Promise<void> {
  const parsed = parseScenario(readFileSync(new URL(`${file}.toon`, SCENARIO_DIR), 'utf8'));
  if (!parsed.ok) throw new Error(`${file} does not parse`);
  let seed = 0;
  while (variantFromSeed(seed, parsed.value.variants) !== id) {
    seed += 1;
    if (seed > 100_000) throw new Error(`no seed draws the variant "${id}" in ${file}`);
  }
  await page.addInitScript((value: number) => {
    Math.random = () => value / 4_294_967_296;
  }, seed);
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
}
