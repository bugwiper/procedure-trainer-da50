import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_REGION_IDS,
  CB_REFERENCE,
  INDICATOR_POSITIONS,
  REFERENCE_POSITIONS,
} from './layout-reference';
import { MOMENTARY_HOLD_MS } from '../src/ui/panel/press-arbiter';
import { MOUSE_SLOP_PX, TOUCH_SLOP_PX } from '../src/ui/panel/tap-intent';

// D-03, D-06, T-01.1-21: the owner review list exists, is linked from the README and carries
// no private photo content.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const review = read('docs/PANEL-REVIEW.md');

const UI_SPEC_PATH =
  '.planning/phases/01.1-panel-shape-controls-and-indicator-lights/01.1-UI-SPEC.md';
const uiSpecExists = existsSync(join(root, UI_SPEC_PATH));

/**
 * Ids of UI-SPEC section 13.1 rows whose confidence cell contains "unconfirmed" or reads
 * "same". Rows look like "| 7 | `sw.deice_mode` | ... | confidence |".
 */
function uiSpecUnconfirmedIds(): string[] {
  const ids: string[] = [];
  for (const line of read(UI_SPEC_PATH).split('\n')) {
    const match = /^\|\s*\d+\s*\|\s*`([a-z_.0-9]+)`/.exec(line);
    if (!match?.[1]) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const confidence = cells[cells.length - 2] ?? '';
    if (/unconfirmed/i.test(confidence) || confidence.toLowerCase() === 'same') ids.push(match[1]);
  }
  return ids;
}

describe('panel review document basics', () => {
  it.each(['sw.light_landing', 'sw.light_taxi', 'sw.light_position', 'sw.light_strobe'])(
    'names the glareshield light switch %s',
    (id) => {
      expect(review).toContain(id);
    },
  );

  it('is linked from the README', () => {
    expect(read('README.md')).toContain('](docs/PANEL-REVIEW.md)');
  });

  it('links the label table from the README and states the final counts', () => {
    const readme = read('README.md');
    expect(readme).toContain('](docs/PANEL-LABELS.md)');
    // The sentence is built from the independent reference tables, not from literals.
    const controls = REFERENCE_POSITIONS.length + CB_REFERENCE.length;
    expect(readme).toContain(
      `${controls} controls and ${INDICATOR_POSITIONS.length} indicator lamps in ${ALL_REGION_IDS.length} regions`,
    );
  });
});

describe('panel review hygiene (D-06)', () => {
  it('embeds no image (markdown syntax or html tag)', () => {
    expect(review).not.toMatch(/!\[[^\]]*\]\(/);
    expect(review).not.toMatch(/<img\b/i);
  });

  it('links nowhere into the private input folder', () => {
    expect(review).not.toMatch(/\]\(\s*<?\.?\/?\.input/);
    expect(review).not.toMatch(/\bhref\s*=\s*["']?\.?\/?\.input/i);
  });

  it('does not name a real maker brand', () => {
    expect(review).not.toMatch(/garmin|diamond/i);
  });
});

describe('panel review completeness (D-03, D-10)', () => {
  const flagged = [...REFERENCE_POSITIONS, ...CB_REFERENCE, ...INDICATOR_POSITIONS]
    .filter((row) => row.review)
    .map((row) => row.id);

  it.each(flagged)('names the review-flagged row %s', (id) => {
    expect(review).toContain(`\`${id}\``);
  });

  it.skipIf(!uiSpecExists)('names every UI-SPEC unconfirmed inventory id', () => {
    const ids = uiSpecUnconfirmedIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !review.includes(`\`${id}\``))).toEqual([]);
  });

  it('records both registry ids that differ from the UI-SPEC (PD-03, PD-04)', () => {
    for (const id of [
      'sw.deice_mode',
      'lv.deice_mode',
      'sw.stall_gear_test',
      'btn.stall_gear_test',
    ]) {
      expect(review).toContain(id);
    }
  });

  it.each(Array.from({ length: 15 }, (_, i) => `U-${String(i + 1).padStart(2, '0')}`))(
    'has the unconfirmed item %s',
    (label) => {
      expect(review).toContain(`**${label}**`);
    },
  );

  it.each(Array.from({ length: 8 }, (_, i) => `PD-0${i + 1}`))(
    'has the planner decision %s',
    (label) => {
      expect(review).toContain(`**${label}**`);
    },
  );

  it.each([
    ['rudder trim', /rudder trim/i],
    ['rudder pedals adjustment', /rudder pedals adjustment/i],
    ['left far panel strip', /left far panel strip/i],
  ])('has the open item %s', (_name, pattern) => {
    expect(review).toMatch(pattern);
  });

  it('records the cowl-flap lamps and the ELT lamp as drawn', () => {
    for (const id of ['lt.cowl_open', 'lt.cowl_closed', 'lt.elt']) {
      expect(review, id).toContain(`\`${id}\``);
    }
    const entry = review.split('\n').find((line) => line.includes('**U-13**')) ?? '';
    expect(entry).toMatch(/drawn/i);
    expect(entry).toContain('RESOLVED');
  });

  it('has the Round 2 morning-review section and the superseded-ids section', () => {
    expect(review).toMatch(/^## .*Round 2/m);
    expect(review).toContain('## Superseded by the owner findings');
    for (const id of [
      'lv.deice_mode',
      'sw.deice_windshield',
      'sw.deice_pump1',
      'sw.deice_pump2',
      'btn.deice_annun_test',
    ]) {
      const at = review.indexOf('## Superseded by the owner findings');
      expect(review.slice(at), id).toContain(`\`${id}\``);
    }
  });

  it('marks the owner-resolved items U-06, U-08, U-09 and U-10 as RESOLVED', () => {
    for (const label of ['U-06', 'U-08', 'U-09', 'U-10']) {
      const entry = review.split('\n').find((line) => line.includes(`**${label}**`)) ?? '';
      expect(entry, label).toContain('RESOLVED');
    }
  });

  it('keeps U-01 as a RESOLVED entry naming white', () => {
    const entry = review.split('\n').find((line) => line.includes('**U-01**')) ?? '';
    expect(entry).toContain('RESOLVED');
    expect(entry.toLowerCase()).toContain('white');
  });
});

// Phase 01.2 owner decision U-01: the panel space was widened to 2180 x 1300. The UI-SPEC section
// is the contract the later plans build on; the review document records the decision.
const UI_SPEC_012_PATH =
  '.planning/phases/01.2-circuit-breakers-g1000-nxi-shapes-and-avionics-panels/01.2-UI-SPEC.md';
const uiSpec012Exists = existsSync(join(root, UI_SPEC_012_PATH));

describe('phase 01.2 owner decision U-01 (widened to 2180)', () => {
  it.skipIf(!uiSpec012Exists)(
    'the UI-SPEC holds the owner decision section and its numbers',
    () => {
      const spec = read(UI_SPEC_012_PATH);
      expect(spec).toContain('Owner decision U-01: widened to 2180');
      for (const needle of ['2180', '1874', 'cb_essential', 'cb_strip']) {
        expect(spec, needle).toContain(needle);
      }
      expect(
        (spec.match(/Superseded by Owner decision U-01/g) ?? []).length,
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it('the review document names the new space, the heading and the decisions P2-01 to P2-05', () => {
    expect(review).toContain('Phase 01.2');
    expect(review).toContain('P2-01');
    expect(review).toContain('P2-02');
    expect(review).toContain('P2-03');
    expect(review).toContain('P2-04');
    expect(review).toContain('P2-05');
    expect(review).toContain('1874');
    expect(review).toContain('2180');
    expect(review).not.toContain('2000 x 1300');
  });
});

// Phase 01.2 plan 09: the morning-review entry point. Every research question, every UI-SPEC item
// and every decision of the phase is listed with its default, then the Round 3 list.
describe('phase 01.2 review list (Q2, U2, P2, Round 3)', () => {
  const lineOf = (label: string): string =>
    review.split('\n').find((line) => line.includes(`**${label}**`)) ?? '';
  const pad = (n: number): string => String(n).padStart(2, '0');

  it.each(Array.from({ length: 10 }, (_, i) => `Q2-${pad(i + 1)}`))(
    'has the research question %s with its default',
    (label) => {
      expect(lineOf(label), `${label} missing`).not.toBe('');
      expect(lineOf(label)).toContain('Default taken:');
    },
  );

  it.each(Array.from({ length: 37 }, (_, i) => `U2-${pad(i + 1)}`))(
    'has the UI-SPEC item %s with its default and a status',
    (label) => {
      const line = lineOf(label);
      expect(line, `${label} missing`).not.toBe('');
      expect(line).toContain('Default taken:');
      expect(line).toMatch(/BUILT AS SPECIFIED|BUILT WITH CHANGE|NOT DRAWN/);
    },
  );

  it.each(Array.from({ length: 6 }, (_, i) => `P2-${pad(i + 1)}`))(
    'has the decision %s',
    (label) => {
      expect(lineOf(label), `${label} missing`).not.toBe('');
    },
  );

  it('records the width decision Q2-01 as resolved by the owner', () => {
    expect(lineOf('Q2-01')).toContain('RESOLVED');
    expect(lineOf('Q2-01')).toContain('2180');
  });

  it('has the Round 3 section present, starting with the width decision', () => {
    const headings = [...review.matchAll(/^## .*$/gm)].map((m) => m[0]);
    expect(headings.some((h) => /Round 3: morning review/.test(h))).toBe(true);
    const at = review.search(/^## .*Round 3/m);
    const rest = review.slice(at);
    const next = rest.slice(3).search(/^## /m);
    const round3 = next === -1 ? rest : rest.slice(0, next + 3);
    const items = round3.split('\n').filter((line) => /^\d+\. /.test(line));
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items[0]).toContain('Q2-01');
    expect(items[0]).toMatch(/tablet/);
    expect(items[0]).toMatch(/portrait phone/);
  });

  it('gives the owner the live check command in the Round 3 section', () => {
    const at = review.search(/^## .*Round 3/m);
    const round3 = review.slice(at, review.search(/^## .*Round 4/m));
    expect(round3).toContain('e2e/breaker.spec.ts e2e/glass.spec.ts e2e/avionics.spec.ts');
    expect(round3).toContain('PW_BASE_URL=');
    expect(round3).toMatch(/nothing was pushed/i);
  });

  it.each(ALL_REGION_IDS)('names the region %s in backticks', (id) => {
    expect(review).toContain(`\`${id}\``);
  });

  it.each([
    'cb_essential',
    'cb_main',
    'cb_low',
    'cb_strip',
    'pfd_softkeys',
    'pfd_bezel_left',
    'pfd_bezel_right',
    'mfd_bezel_right',
    'audio_panel',
    'standby_efis',
    'autopilot_panel',
  ])('names the new region %s that phase 01.2 added', (id) => {
    expect(review).toContain(`\`${id}\``);
    expect(ALL_REGION_IDS).toContain(id);
  });

  it('names every one of the 51 breakers', () => {
    expect(CB_REFERENCE).toHaveLength(51);
    expect(
      CB_REFERENCE.filter((row) => !review.includes(`\`${row.id}\``)).map((r) => r.id),
    ).toEqual([]);
  });

  it('states the final counts in the README and describes the new areas', () => {
    const readme = read('README.md');
    expect(readme).toContain('92 controls and 13 indicator lamps in 30 regions');
    for (const needle of [
      'CIRCUIT BREAKERS',
      'ESSENTIAL',
      'MAIN',
      'AVIONICS',
      'lower row',
      'flap strip',
      'softkeys',
      'AUDIO PANEL',
      'BACKUP EFIS',
      'AUTOPILOT PANEL',
      'DISPLAY BACKUP',
    ]) {
      expect(readme, needle).toContain(needle);
    }
    expect(readme).toMatch(/raised cap and a white ring/);
  });

  it('keeps the deferred behaviour in a todo with its reason', () => {
    const path = '.planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md';
    expect(existsSync(join(root, path))).toBe(true);
    const todo = read(path);
    for (const needle of [
      'breaker effects',
      'DISPLAY BACKUP',
      'audio panel',
      'autopilot',
      'arming gate',
      'Q2-01',
      'Q2-05',
    ]) {
      expect(todo, needle).toContain(needle);
    }
  });
});

// Plan 31 (R2-Z1): the owner superseded the single-tap zoom. The wording is current everywhere
// it is stated: README, REQUIREMENTS PNL-15 and PNL-09, the ROADMAP criterion 4 of phase 01.1.
describe('zoom wording (R2-Z1 plan 31, R3-Z3 plan 40)', () => {
  const lineOf = (text: string, needle: string): string =>
    text.split('\n').find((line) => line.includes(needle)) ?? '';
  const requirements = read('.planning/REQUIREMENTS.md');
  const roadmap = read('.planning/ROADMAP.md');
  const readme = read('README.md');

  it('the README says a single click or tap never zooms and a double one zooms on the background and on a switch', () => {
    expect(readme).toMatch(/single click or tap never zooms/);
    expect(readme).toMatch(
      /double click or double tap zooms on the (panel )?background and on a switch/,
    );
    expect(readme).toMatch(/first tap actuates/);
    expect(readme).toMatch(/retracts it/);
    expect(readme).toMatch(/stays unchanged/);
    expect(readme).toMatch(/two quick taps on one switch are therefore a zoom/);
    expect(readme).toMatch(/momentary[^.]*drag[^.]*stay two presses/i);
    expect(readme).toMatch(/moves or gains a second finger pans or pinches/);
    expect(readme).not.toMatch(/two (control )?taps/);
    expect(readme).not.toContain('never on a control');
    expect(readme).not.toContain("a tap or click on a region's background zooms into it");
  });

  it('the README says a single tap on an inert part does nothing and a double tap only zooms', () => {
    expect(readme).toMatch(/a single tap on them does nothing/);
    expect(readme).toMatch(/a double tap only zooms/);
  });

  it('the README names the Full panel button corners', () => {
    expect(readme).toMatch(/Full panel.{0,80}three corners/);
  });

  it.each(['PNL-15', 'PNL-09'])('REQUIREMENTS %s carries the double-tap wording', (id) => {
    const line = lineOf(requirements, `**${id}**`);
    expect(line, `${id} missing`).not.toBe('');
    expect(line).toMatch(/double (click|tap)/);
    expect(line).not.toMatch(/single tap on the panel background/);
    expect(line).not.toMatch(/pinch or region tap/);
  });

  it('REQUIREMENTS PNL-15 states the single click rule, the latching pair with its retraction, the exceptions, the press arbitration and the button', () => {
    const line = lineOf(requirements, '**PNL-15**');
    expect(line).toMatch(/single click or tap never zooms/);
    expect(line).toMatch(/on the panel background and on a latching control/);
    expect(line).toMatch(/first tap actuates at once/);
    expect(line).toMatch(/recognised pair retracts it from the action log/);
    expect(line).toMatch(/pair across two different controls is not a double tap/);
    expect(line).toMatch(/double press on a momentary or drag control stays two presses/);
    expect(line).toContain(`${TOUCH_SLOP_PX} px (touch)`);
    expect(line).toContain(`${MOUSE_SLOP_PX} px (mouse)`);
    expect(line).toMatch(/second finger pans or pinches the view instead of operating the control/);
    expect(line).toMatch(/never covers a control/);
    expect(line).not.toMatch(/double tap on a control stays two control taps/);
  });

  it('no line of REQUIREMENTS says a single tap zooms', () => {
    expect(requirements).not.toContain('single tap on the panel background while zoomed');
    expect(requirements).not.toContain('pinch or region tap');
  });

  it('ROADMAP criterion 4 of phase 01.1 carries the new contract and not the old sentence', () => {
    expect(roadmap).not.toContain('A single tap on the panel background while zoomed');
    const at = roadmap.indexOf('### Phase 01.1');
    expect(at).toBeGreaterThan(-1);
    const block = roadmap.slice(roadmap.indexOf('**Success Criteria**', at));
    const line = block.split('\n').find((l) => /^\s*4\. /.test(l)) ?? '';
    expect(line).toMatch(/single click or tap never zooms/);
    expect(line).toMatch(/double click or double tap/);
    expect(line).toMatch(/Full panel/);
    expect(line).toMatch(/latching control/);
    expect(line).not.toMatch(/stays two control taps/);
  });

  it('the supersession notes stand under D-12 and under the gesture table', () => {
    const context = read(
      '.planning/phases/01.1-panel-shape-controls-and-indicator-lights/01.1-CONTEXT.md',
    );
    expect(context).toContain('R2-Z1');
    expect(context).toContain('R3-Z3');
    expect(context).toContain('R3-Z2');
    if (uiSpecExists) {
      const spec = read(UI_SPEC_PATH);
      expect(spec).toContain('R2-Z1');
      expect(spec).toContain('R3-Z3');
      expect(spec).toContain('R3-Z2');
    }
  });

  it('the README states the press arbitration, the momentary hold and the single click rule', () => {
    expect(readme).toMatch(/acts when you lift/);
    expect(readme).toContain(`${TOUCH_SLOP_PX} px`);
    expect(readme).toContain(`mouse ${MOUSE_SLOP_PX} px`);
    expect(readme).toMatch(/second finger turns it into a pan or a pinch/);
    expect(readme).toMatch(/drag controls[^.]*keep their gesture/);
    expect(readme).toContain(`about ${MOMENTARY_HOLD_MS / 1000} s`);
    expect(readme).toMatch(/a quick tap is a press and a release/);
    expect(readme).toMatch(/single click or tap never zooms/);
    expect(readme).not.toContain('they act while held and return when you let go');
  });

  it('the label table no longer describes the pulled brake as a wedge', () => {
    const labels = read('docs/PANEL-LABELS.md');
    expect(labels).not.toMatch(/wedge/i);
    const row = labels.split('\n').find((line) => line.includes('`lv.parking_brake`')) ?? '';
    expect(row).toMatch(/tilted plate/);
    expect(row).toMatch(/hinged at the bottom|hinged flap/);
  });
});

// Plan 31: the Round 4 section is the owner's one entry point for the gap-closure round 2.
describe('round 2 gap-closure review (R2 findings, plan 31)', () => {
  const lineOf = (label: string): string =>
    review.split('\n').find((line) => line.includes(`**${label}**`)) ?? '';
  const round4 = (): string => {
    const at = review.search(/^## .*Round 4/m);
    expect(at, 'Round 4 section missing').toBeGreaterThan(-1);
    const rest = review.slice(at);
    const next = rest.slice(3).search(/^## /m);
    return next === -1 ? rest : rest.slice(0, next + 3);
  };

  it('keeps Round 4: morning review for the record (it is no longer the last section)', () => {
    const headings = [...review.matchAll(/^## .*$/gm)].map((m) => m[0]);
    expect(headings).toContain('## Round 4: morning review');
    expect(headings[headings.length - 1]).not.toBe('## Round 4: morning review');
  });

  it('lists at least 9 numbered items and names every R2 finding', () => {
    const items = round4()
      .split('\n')
      .filter((line) => /^\d+\. /.test(line));
    expect(items.length).toBeGreaterThanOrEqual(9);
    for (const id of ['R2-1.1', 'R2-4.1', 'R2-4.2', 'R2-5.1', 'R2-5.2', 'R2-Z1', 'R2-T1']) {
      expect(round4(), id).toContain(id);
    }
    expect(round4()).toMatch(/R2-3\.1[^\n]*withdrawn/i);
  });

  it('gives the live check command and says nothing was pushed', () => {
    expect(round4()).toContain('PW_BASE_URL=');
    expect(round4()).toMatch(/nothing was pushed/i);
  });

  it('has no unfilled item: the tablet project and the WebKit outcome are recorded', () => {
    const text = round4();
    expect(text).toMatch(/tablet-chromium/);
    expect(text).toMatch(/WebKit/);
    expect(text).not.toMatch(/\b(TBD|TODO|to be filled|placeholder)\b/i);
  });

  it.each(Array.from({ length: 7 }, (_, i) => `R2-D${String(i + 1)}`))(
    'records the decision %s with the cost of undoing it',
    (label) => {
      const line = lineOf(label);
      expect(line, `${label} missing`).not.toBe('');
      expect(line).toMatch(/Cost of undoing:/);
    },
  );

  it('states the double-tap contract and no stale zoom or tablet sentence', () => {
    expect(review).not.toContain('a single tap on the background zooms out');
    expect(review).not.toContain('not fixed, because phase 01.2 plan 09 changes no source');
    expect(review).toMatch(/single click or tap never zooms/);
    expect(review).toMatch(/resolved by plan 26/i);
  });

  it('describes the round 2 build in the area sections', () => {
    for (const needle of [
      'FORCE B',
      'ALTERNATOR',
      'hinged flap',
      'click spots',
      'Full panel button',
      'tablet-chromium',
      'lights.left_on',
    ]) {
      expect(review, needle).toContain(needle);
    }
  });
});

// Plan 41: the Round 5 section is the owner's one entry point for the third gap-closure round
// (plans 33 to 40, owner findings R3-1.1, R3-4.1, R3-Z2 and R3-Z3).
describe('round 3 gap-closure review (R3 findings, plan 41)', () => {
  const lineOf = (label: string): string =>
    review.split('\n').find((line) => line.includes(`**${label}**`)) ?? '';
  const sectionFrom = (heading: RegExp): string => {
    const at = review.search(heading);
    expect(at, `${String(heading)} section missing`).toBeGreaterThan(-1);
    const rest = review.slice(at);
    const next = rest.slice(3).search(/^## /m);
    return next === -1 ? rest : rest.slice(0, next + 3);
  };
  const round5 = (): string => sectionFrom(/^## Round 5: morning review/m);

  it('has Round 5: morning review as the last section and keeps Round 4', () => {
    const headings = [...review.matchAll(/^## .*$/gm)].map((m) => m[0]);
    expect(headings[headings.length - 1]).toBe('## Round 5: morning review');
    expect(headings).toContain('## Round 4: morning review');
  });

  it('the opening is a dated status line that keeps Round 5 as a historical entry point', () => {
    const opening = review.split('\n')[2] ?? '';
    expect(opening).toMatch(/^> Status \d{4}-\d{2}-\d{2}/);
    expect(opening).toMatch(/"Round 5"/);
    expect(opening).toMatch(/historical entry points/);
    expect(opening).not.toMatch(/Start the morning review at the section "Round 4/);
  });

  it('lists at least ten numbered items and names every R3 finding', () => {
    const text = round5();
    const items = text.split('\n').filter((line) => /^\d+\. /.test(line));
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const id of ['R3-1.1', 'R3-4.1', 'R3-Z2', 'R3-Z3']) {
      expect(text, id).toContain(id);
    }
  });

  it('gives the live check command and says nothing was pushed', () => {
    expect(round5()).toContain('PW_BASE_URL=');
    expect(round5()).toMatch(/nothing was pushed/i);
  });

  it('has no unfilled item: the tablet project, the rehearsal and the WebKit outcome are recorded', () => {
    const text = round5();
    expect(text).toMatch(/tablet-chromium/);
    expect(text).toMatch(/WebKit/);
    expect(text).toMatch(/live-conditions rehearsal/);
    expect(text).not.toMatch(/\b(TBD|TODO|to be filled|placeholder)\b/i);
  });

  it('has the decisions section R3-D1 to R3-D8, each with the cost of undoing it', () => {
    const decisions = sectionFrom(/^## Gap-closure round 3 decisions/m);
    expect(decisions.length).toBeGreaterThan(0);
    for (let i = 1; i <= 8; i++) {
      const label = `R3-D${String(i)}`;
      const line = decisions.split('\n').find((l) => l.includes(`**${label}**`)) ?? '';
      expect(line, `${label} missing`).not.toBe('');
      expect(line, label).toMatch(/Cost of undoing:\s*\S+/);
      expect(lineOf(label), label).toBe(line);
    }
  });

  it('the decisions name the constants and files they depend on', () => {
    const decisions = sectionFrom(/^## Gap-closure round 3 decisions/m);
    for (const needle of [
      'busTitleCut',
      'flapPlate',
      'topFraction',
      'retract',
      'markConsumed',
      'createPressArbiter',
      `${String(TOUCH_SLOP_PX)} px`,
      `${String(MOUSE_SLOP_PX)} px`,
      `${String(MOMENTARY_HOLD_MS)} ms`,
      'resolveControlTap',
      'nextDeadline',
    ]) {
      expect(decisions, needle).toContain(needle);
    }
  });

  it('no line calls the pulled brake a wedge unless R3-D2 stands on the same line', () => {
    const wedgeLines = review.split('\n').filter((line) => /wedge/i.test(line));
    expect(wedgeLines.length).toBeLessThanOrEqual(3);
    for (const line of wedgeLines) expect(line).toContain('R3-D2');
  });

  it('every line that keeps the old double tap on a control sentence points to R3-Z3', () => {
    const lines = review.split('\n').filter((line) => /two control taps/.test(line));
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      expect(line).toContain('R3-Z3');
      expect(line).toContain('R3-D7');
    }
  });

  it('the shell section says the bus titles are unstroked text over a plate-coloured rectangle', () => {
    expect(review).not.toContain('cut the shared edges they sit on;');
    expect(review).toMatch(/unstroked text over a plate-coloured rectangle/);
  });

  it('describes the pulled brake as a hinged plate', () => {
    const row = review.split('\n').find((l) => l.startsWith('| `lv.parking_brake`')) ?? '';
    expect(row).toMatch(/plate/);
    expect(row).not.toMatch(/wedge/i);
  });

  it('keeps the hygiene rules in the new sections', () => {
    const text = `${sectionFrom(/^## Gap-closure round 3 decisions/m)}\n${round5()}`;
    expect(text).not.toMatch(/!\[[^\]]*\]\(/);
    expect(text).not.toMatch(/\.input/);
    expect(text).not.toMatch(/garmin|diamond/i);
  });
});
