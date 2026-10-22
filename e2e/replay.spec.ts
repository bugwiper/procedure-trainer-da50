import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { grade } from '../src/engine/grading';
import type { GradeResult, Recording } from '../src/engine/grading';
import { checkScenario } from '../src/scenario/lint';
import {
  FULL_VIEWBOX,
  activate,
  afterPairWindow,
  doubleActivateAt,
  leaveZoom,
} from './support/zoom';

// SES-03, SCN-08, D-13 (phase 02): the verdicts of the debrief are exactly the verdicts of a node
// replay of the recorded log, and nothing reflects correctness while the exam runs. Every case
// reads an e2e-only window hook, so all titles carry @hooks.

interface RecordedHook {
  events(): { t: number; id: string; value: string }[];
}
interface SessionHook {
  screen(): string;
  scenarioId(): string | null;
  result(): GradeResult | null;
  now(): number | null;
}
type HookHost = { __panel?: RecordedHook; __panelSession?: SessionHook };

const BLUEPRINT_FILE = join(
  fileURLToPath(new URL('../', import.meta.url)),
  'scenarios/engine/eng-oil-temp-green.toon',
);

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);

async function startRun(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-session-hit="session.new"]'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeHidden();
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
}

async function goldenTaps(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  await activate(page.locator('[data-detent="lv.cowl_flap:open"]'), hasTouch);
  await expect(control(page, 'lv.cowl_flap')).toHaveAttribute('data-state', 'open');
}

function loggedEvents(page: Page): Promise<{ t: number; id: string; value: string }[]> {
  return page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('@hooks the UI verdicts equal a node replay of the recorded log', async ({
  page,
  hasTouch,
}) => {
  await startRun(page, hasTouch);

  // An increase first (a harmful action in the log), then a latching control double-tapped once:
  // the first tap actuates, the recognised pair zooms and retracts it from the log (D-13).
  await activate(page.locator('[data-detent="lv.power:p100"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p100');
  const hit = page.locator('[data-hit="sw.engine_master"]');
  const before = await control(page, 'sw.engine_master').getAttribute('data-state');
  const box = await hit.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  await doubleActivateAt(
    page,
    { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) },
    hasTouch,
  );
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', before ?? '');
  // The pair zoomed into the region.
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await afterPairWindow(page);
  await leaveZoom(page, hasTouch);
  await goldenTaps(page, hasTouch);

  // The retracted tap is not in the log, the three real actuations are.
  const log = await loggedEvents(page);
  expect(log.map((e) => [e.id, e.value])).toEqual([
    ['lv.power', 'p100'],
    ['lv.power', 'p50'],
    ['lv.cowl_flap', 'open'],
  ]);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  const shown = await page.evaluate(
    () => (globalThis as HookHost).__panelSession?.result() ?? null,
  );
  const completedAt = await page.evaluate(
    () => (globalThis as HookHost).__panelSession?.now() ?? 0,
  );
  expect(shown).not.toBeNull();

  // The replay in node: the blueprint text from the repository, the same environment, the log.
  const checked = checkScenario(readFileSync(BLUEPRINT_FILE, 'utf8'), DA50RG_ENV);
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  const recording: Recording = {
    scenarioId: checked.scenario.id,
    completedAt,
    events: log.map((e) => ({ t: e.t, id: e.id, value: e.value })),
  };
  const replayed = grade(checked.scenario, DA50RG_ENV, recording);
  expect(replayed).toEqual(shown);
  // The harmful action is part of what both sides agree on.
  expect(replayed.harmful.map((h) => h.id)).toEqual(['power_increased']);
  expect(replayed.result).toBe('fail');
  expect(replayed.reasons).toEqual([{ kind: 'forbidden', id: 'power_increased' }]);
});

test('@hooks the exam stays silent during a run', async ({ page, hasTouch }) => {
  const footerText = () =>
    page.evaluate(() => {
      const footer = document.querySelector('footer');
      if (footer === null) return '';
      const clone = footer.cloneNode(true) as HTMLElement;
      clone.querySelector('[data-testid="procedure-complete"]')?.remove();
      return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
    });
  const idleFooter = await footerText();

  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  expect((await loggedEvents(page)).length).toBe(3);

  const reflecting = page.locator(
    '[aria-live], [role="alert"], [role="alertdialog"], [role="status"]:not([data-testid="rotate-hint"])',
  );
  await expect(reflecting).toHaveCount(0);
  await expect(page.locator('[role="dialog"], dialog[open]')).toHaveCount(0);
  await expect(page.getByTestId('debrief')).toHaveCount(0);
  expect(await page.evaluate(() => (globalThis as HookHost).__panelSession?.result() ?? null)).toBe(
    null,
  );
  expect(await page.evaluate(() => (globalThis as HookHost).__panelSession?.screen())).toBe(
    'running',
  );
  expect(await footerText()).toBe(idleFooter);

  // Procedure complete is the one moment a result appears.
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
});
