// The weighted draw of the follow-on target (Phase 9, R-06, P-03). On Realistic the debrief offers
// one button; the session draws a seed with its injected rng, this function turns the seed into one
// of the targets of the scenario's `follow_on` list, and the seed is recorded with the run
// (Recording.followOn) so the draw can be reproduced from the seed and the source file. The draw
// is pure integer arithmetic on mulberry32 like the variant draw (variants.ts, which stays as it
// is): only + - * / are used, so it agrees bit for bit in node and every browser.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { mulberry32 } from './sim';

/** The least a target needs for the draw: its weight (an integer, 0 for never drawn). */
export interface WeightedTarget {
  readonly weight: number;
}

/**
 * The target a seed draws: the first mulberry32 value times the weight total, taken cumulatively in
 * the order of the list. A rounding edge falls back to the last target of positive weight. Throws
 * RangeError for an empty list or a total of 0 (lint L33 prevents both in a shipped file; the
 * session shows its load failure of reason invalid and never a silent default).
 */
export function followOnFromSeed<T extends WeightedTarget>(seed: number, targets: readonly T[]): T {
  let total = 0;
  let last: T | undefined;
  for (const target of targets) {
    total += target.weight;
    if (target.weight > 0) last = target;
  }
  if (last === undefined) {
    throw new RangeError(
      targets.length === 0
        ? 'the follow-on lists no target'
        : 'the follow-on weights add up to 0, so no target can be drawn',
    );
  }
  const x = mulberry32(seed)() * total;
  let upTo = 0;
  for (const target of targets) {
    upTo += target.weight;
    if (target.weight > 0 && x < upTo) return target;
  }
  return last;
}
