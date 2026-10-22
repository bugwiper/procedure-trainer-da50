import { expect } from 'vitest';

// Shared helpers of the scenario parser and lint tests: a minimal valid scenario, edited in one
// place per case. The expected line of an issue is the line of the edit, found in the edited text.

/** A small valid scenario: one group of two steps, one line, one forbidden item. */
export const MINIMAL = `format: 1
id: minimal
title: MINIMAL
source:
  document: "AFM DA 50 C, Doc 9.01.01-E"
  issue: "018"
  section: AFM 03-08
  verified: "2026-10-22"
disclaimer: training-aid
briefing:
  situation: "Short situation in own words."
initial:
  controls:
    lv.power: p75
    lv.cowl_flap: closed
  quantities:
    oil_temp_c: 128
annunciations[1]: eng_oil_temp
procedure[2]:
  - kind: group
    id: immediate
    ordered: false
    steps[2]:
      - id: reduce_power
        severity: critical
        text: Reduce power
        done:
          check: travel_rel
          control: lv.power
          op: lte
          delta: -10
      - id: open_cowl_flap
        severity: critical
        text: Open cowl flap
        done:
          check: state
          control: lv.cowl_flap
          is: open
  - kind: line
    text: Increase airspeed
forbidden[1]:
  - id: power_increased
    text: Increase power
    trigger:
      check: travel_rel
      control: lv.power
      op: gt
      delta: 0
`;

/** `text` with one place replaced; the place must exist exactly once. */
export function swap(text: string, from: string, to: string): string {
  expect(text.split(from).length - 1, `"${from}" occurs once`).toBe(1);
  return text.replace(from, () => to);
}

/** 1-based line of the first line that contains `needle`. */
export function lineOf(text: string, needle: string): number {
  const index = text.split('\n').findIndex((l) => l.includes(needle));
  expect(index, `a line containing "${needle}"`).toBeGreaterThanOrEqual(0);
  return index + 1;
}

/** 1-based column of `key` on the first line that contains `needle`. */
export function colOf(text: string, needle: string, key: string): number {
  const line = text.split('\n')[lineOf(text, needle) - 1] ?? '';
  return line.indexOf(key) + 1;
}

/**
 * A scenario whose procedure is `levels` nested standalone branches (each applies at the start)
 * around `innerBody`; `runAt` marks that level (1-based) as decided during the run, and `when`
 * replaces the condition of every branch.
 */
export function nested(levels: number, innerBody: string, runAt?: number, when = 'closed'): string {
  const head = MINIMAL.slice(0, MINIMAL.indexOf('procedure[2]:'));
  const lines = ['procedure[1]:'];
  let pad = '  ';
  for (let level = 1; level <= levels; level++) {
    lines.push(
      `${pad}- kind: branch`,
      `${pad}  label: "If level ${String(level)}:"`,
      ...(runAt === level ? [`${pad}  decided_at: run`] : []),
      `${pad}  when:`,
      `${pad}    check: state`,
      `${pad}    control: lv.cowl_flap`,
      `${pad}    is: ${when}`,
      `${pad}  nodes[1]:`,
    );
    pad += '    ';
  }
  lines.push(...innerBody.split('\n').map((l) => `${pad}${l}`));
  return `${head}${lines.join('\n')}\n`;
}
