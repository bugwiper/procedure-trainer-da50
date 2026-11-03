// CAS rule table engine (D-06, D-06a, D-07a, D-08): an annunciation is derived, never set. A rule
// is data: an id, the message text, a level and a predicate of the scenario vocabulary over the
// control states and the named quantities. `active` evaluates the rules for a context and returns
// the messages in display order (warnings first, then cautions, then advisories, each in table
// order), at most one per message text: two rules with the same text never show two chips, whatever
// instant of the inputs they read. The aircraft
// owns the table (src/aircraft/da50rg/cas.ts); nothing here knows a message or a threshold.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { Predicate } from '../scenario/schema';
import { evaluatePredicate, predicateProblems } from './predicates';
import type { PredicateContext, PredicateEnv } from './predicates';

/** Advisory (Phase 6): a white message such as the one of the transfer pump; it never sounds a tone. */
export type CasLevel = 'warning' | 'caution' | 'advisory';

/** The levels in display order. */
const CAS_LEVELS: readonly CasLevel[] = ['warning', 'caution', 'advisory'];

export const CAS_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
export const CAS_TEXT_PATTERN = /^[A-Z0-9/ ]{1,12}$/;
/** Most messages the PFD column draws (6 rows); a scenario that fires more is a lint error. */
export const MAX_CAS_CHIPS = 6;

export interface CasRuleSpec {
  readonly id: string;
  /** Upper case letters, digits, space and slash, 1 to 12 characters. */
  readonly text: string;
  readonly level: CasLevel;
  readonly when: Predicate;
  /**
   * True for a message of the situation, not of a failure (the stall heat cut-out on the ground with
   * the switch on): it may show before the onset of the level Realistic, so lint L14 does not count
   * it as a failure cue at the Realistic start and L24 does not count it as something the onset
   * reveals. A message that reveals a failure is never ambient.
   */
  readonly ambient?: boolean;
}

export type CasRule = Readonly<CasRuleSpec>;

/** One active message, in display order. */
export interface ActiveCas {
  readonly id: string;
  readonly text: string;
  readonly level: CasLevel;
}

export interface CasRuleSet {
  readonly rules: readonly CasRule[];
  get(id: string): CasRule | undefined;
  /** Ids of the controls the rules read, so a caller can supply exactly those states. */
  readonly controlsRead: readonly string[];
  /**
   * The messages whose rule holds, warnings first, then cautions, then advisories, each in table
   * order. A text shows once: when several rules with the same text hold, the first in display
   * order stands for all of them.
   */
  active(ctx: PredicateContext, env: CasEnv): ActiveCas[];
}

/** What a rule table is checked and evaluated against. */
export type CasEnv = PredicateEnv;

export class CasError extends Error {}

export function defineCasRules(specs: readonly CasRuleSpec[], env: CasEnv): CasRuleSet {
  const seen = new Set<string>();
  const rules: CasRule[] = [];
  const reads = new Set<string>();
  for (const spec of specs) {
    const fail = (what: string): never => {
      throw new CasError(`CAS rule "${spec.id}" ${what}`);
    };
    if (!CAS_ID_PATTERN.test(spec.id)) {
      throw new CasError(`CAS rule id "${spec.id}" does not match ${CAS_ID_PATTERN.source}`);
    }
    if (seen.has(spec.id)) fail('is defined twice');
    seen.add(spec.id);
    if (!CAS_TEXT_PATTERN.test(spec.text)) {
      fail(`has text "${spec.text}"; 1 to 12 upper case letters, digits, spaces or slashes`);
    }
    if (!CAS_LEVELS.includes(spec.level)) {
      fail(`has unknown level "${String(spec.level)}"`);
    }
    for (const problem of predicateProblems(spec.when, env)) {
      fail(`has a predicate that does not resolve: ${problem.message}`);
    }
    if ('control' in spec.when) reads.add(spec.when.control);
    rules.push(Object.freeze({ ...spec }));
  }

  const byId = new Map<string, CasRule>(rules.map((r) => [r.id, r]));
  const ordered = (level: CasLevel) => rules.filter((r) => r.level === level);
  return Object.freeze({
    rules: Object.freeze(rules),
    get: (id: string) => byId.get(id),
    controlsRead: Object.freeze([...reads]),
    active(ctx: PredicateContext, activeEnv: CasEnv): ActiveCas[] {
      const holds = (rule: CasRule): boolean => evaluatePredicate(rule.when, ctx, activeEnv);
      const shown = new Set<string>();
      return CAS_LEVELS.flatMap(ordered)
        .filter(holds)
        .filter(({ text }) => {
          if (shown.has(text)) return false;
          shown.add(text);
          return true;
        })
        .map(({ id, text, level }) => ({ id, text, level }));
    },
  });
}
