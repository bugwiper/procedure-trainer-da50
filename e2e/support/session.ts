import { readFileSync, readdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../../src/aircraft/da50rg/aircraft';
import { variantFromSeed } from '../../src/engine/variants';
import { parseManifest, parseScenario } from '../../src/scenario/parse';
import { pageCount } from '../../src/ui/panel/session-area';
import {
  CATALOG_LISTING_ORDER,
  CATALOG_REFERENCE,
  referenceGroupOf,
} from '../../tests/checklist-catalog-reference';
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
  /** The id of the catalog group (tab) the scenario stands in, from the independent reference. */
  readonly group: string;
}

const SCENARIO_DIR = new URL('../../scenarios/', import.meta.url);

/**
 * Every shipped scenario, read in node from the pack manifests of scenarios/ in the order of the
 * application's listing (plan 07-06, R-16): the catalog order of the independent reference, group by
 * group, a scenario the reference does not know after them. Counts and titles of the specs come
 * from here, never from literals.
 */
export function shippedScenarios(): readonly ShippedScenario[] {
  const read = manifestScenarios();
  const rank = (entry: { pack: string; id: string }): number => {
    const at = CATALOG_LISTING_ORDER.findIndex(
      ([pack, id]) => pack === entry.pack && id === entry.id,
    );
    return at < 0 ? CATALOG_LISTING_ORDER.length : at;
  };
  return read
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
    .map(({ entry }) => entry);
}

/** The scenarios of the shipped pack manifests, packs by name, then the manifest order. */
function manifestScenarios(): readonly ShippedScenario[] {
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
      group: referenceGroupOf(`${pack}/${entry.id}`) ?? lastGroup(),
    }));
  });
}

/** The id of the last catalog group, where a scenario the reference does not know stands. */
function lastGroup(): string {
  const last = CATALOG_REFERENCE[CATALOG_REFERENCE.length - 1];
  if (last === undefined) throw new Error('the catalog reference has no group');
  return last.id;
}

/** The scenarios of one catalog group (tab) in listing order. */
export function scenariosOfGroup(group: string): readonly ShippedScenario[] {
  return shippedScenarios().filter((entry) => entry.group === group);
}

/** The id of the catalog group (tab) that CHOOSE SITUATION shows first: the first that has a situation. */
export function firstShownGroup(): string {
  const found = CATALOG_REFERENCE.find((group) =>
    shippedScenarios().some((entry) => entry.group === group.id),
  );
  if (found === undefined) throw new Error('no catalog group has a shipped scenario');
  return found.id;
}

/** Presses the tab of a catalog group in the open choose view and waits for the pair window. */
export async function pressChooseTab(page: Page, hasTouch: boolean, group: string): Promise<void> {
  await activate(page.locator(`[data-session-hit="session.tab.${group}"]`), hasTouch);
  await expect(page.locator(`[data-session-button="session.tab.${group}"]`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await afterPairWindow(page);
}

/**
 * In the open choose view: shows the tab of a group, pages through all its pages and returns the row
 * ids per page (the "session.row." suffix, "pack.scenario") and the printed titles. Checks that NEXT
 * PAGE exists exactly when the group has more rows than a page, and that the page after the last is
 * the first again.
 */
export async function walkGroupPages(
  page: Page,
  hasTouch: boolean,
  group: string,
): Promise<{ rows: string[]; titles: string[] }[]> {
  await pressChooseTab(page, hasTouch, group);
  const listed = page.locator('[data-session-hit^="session.row."]');
  const next = page.locator('[data-session-hit="session.next"]');
  const total = scenariosOfGroup(group).length;
  const pages = pageCount(total);
  await expect(next).toHaveCount(pages > 1 ? 1 : 0);
  const seen: { rows: string[]; titles: string[] }[] = [];
  for (let turned = 0; turned < pages; turned++) {
    const rows = await listed.evaluateAll((els) =>
      els.map((el) => (el.getAttribute('data-session-hit') ?? '').replace('session.row.', '')),
    );
    const titles = await page
      .locator('[data-session-button^="session.row."]')
      .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
    seen.push({ rows, titles });
    if (pages > 1) {
      await activate(next, hasTouch);
      await afterPairWindow(page);
    }
  }
  // The page after the last is the first again (a group of one page stays on it).
  await expect(listed).toHaveCount(seen[0]?.rows.length ?? 0);
  return seen;
}

/**
 * Opens CHOOSE SITUATION, presses the tab of the row's catalog group (plan 07-06, R-18; the first
 * tab that has a situation is shown first, so the press is skipped when it is the one wanted), taps
 * the row "pack.scenario" and waits for the level card.
 */
export async function chooseScenario(page: Page, hasTouch: boolean, row: string): Promise<void> {
  const wanted = shippedScenarios().find((entry) => entry.row === row);
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  if (wanted !== undefined) {
    const firstShown = CATALOG_REFERENCE.find((group) =>
      shippedScenarios().some((entry) => entry.group === group.id),
    )?.id;
    if (wanted.group !== firstShown) {
      await activate(page.locator(`[data-session-hit="session.tab.${wanted.group}"]`), hasTouch);
      await afterPairWindow(page);
    }
  }
  const target = page.locator(`[data-session-hit="session.row.${row}"]`);
  // The list pages (plan 05.1-01): NEXT PAGE until the row is on screen, at most once per page.
  const next = page.locator('[data-session-hit="session.next"]');
  const inGroup =
    wanted === undefined ? shippedScenarios().length : scenariosOfGroup(wanted.group).length;
  for (let turned = 1; turned < pageCount(inGroup); turned++) {
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

/** The hit rectangle of the footwell button of a further option (Phase 7, plan 07-05). */
export const furtherHit = (page: Page, id: string) =>
  page.locator(`[data-session-hit="further.${id}"]`);

/** The group of the footwell button, which carries data-selected and aria-pressed. */
export const furtherButton = (page: Page, id: string) =>
  page.locator(`[data-session-button="further.${id}"]`);

/** Presses the footwell button of an option once, with no expectation (Phase 7, plan 07-05, S-06). */
export async function toggleFurther(page: Page, hasTouch: boolean, id: string): Promise<void> {
  await activate(furtherHit(page, id), hasTouch);
}

/**
 * Presses the footwell button of each option in `ids` once, in order, and expects it selected
 * afterwards (an option that was selected before must be named once more by the caller through
 * toggleFurther). Every spec that finishes a scenario with the right decisions uses it.
 */
export async function pickFurther(
  page: Page,
  hasTouch: boolean,
  ids: readonly string[],
): Promise<void> {
  for (const id of ids) {
    if (DA50RG_ENV.further.option(id) === undefined) throw new Error(`no further option "${id}"`);
    await toggleFurther(page, hasTouch, id);
    await expect(furtherButton(page, id)).toHaveAttribute('data-selected', 'true');
  }
}
