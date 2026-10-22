// CAS rule table engine (D-06, D-06a, D-07a, D-08): an annunciation is derived, never set. A rule
// is data: an id, the message text, a level and a predicate of the scenario vocabulary over the
// control states and the named quantities. `active` evaluates the rules for a context and returns
// the messages in display order (warnings first, then cautions, each in table order). The aircraft
// owns the table (src/aircraft/da50rg/cas.ts); nothing here knows a message or a threshold.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { Predicate } from '../scenario/schema';
import { evaluatePredicate, predicateProblems } from './predicates';
import type { PredicateContext, PredicateEnv } from './predicates';

export type CasLevel = 'warning' | 'caution';

export const CAS_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
export const CAS_TEXT_PATTERN = /^[A-Z0-9/ ]{1,12}$/;
/** Most chips the PFD draws (3 rows of 2); a scenario that fires more is a lint error. */
export const MAX_CAS_CHIPS = 6;

export interface CasRuleSpec {
  readonly id: string;
  /** Upper case letters, digits, space and slash, 1 to 12 characters. */
  readonly text: string;
  readonly level: CasLevel;
  readonly when: Predicate;
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
  /** The messages whose rule holds, warnings first, then cautions, each in table order. */
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
    if (spec.level !== 'warning' && spec.level !== 'caution') {
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
      return [...ordered('warning'), ...ordered('caution')]
        .filter(holds)
        .map(({ id, text, level }) => ({ id, text, level }));
    },
  });
}
