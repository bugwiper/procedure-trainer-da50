// Scenario file format 1 (D-19, D-22, D-23, D-25, SCN-01, SCN-07). One Zod schema is the single
// source of the file contract and of the inferred types. Every object is strict, so a misspelled
// key is an error. Predicates and procedure nodes are closed unions: nothing in a scenario file
// is ever evaluated as a string. `parameters` names physics parameters of the aircraft (for
// example a degraded cooling) with finite values. Cross-references (control, state, quantity,
// band and parameter ids) are checked by lint.ts against the aircraft, not here.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { z } from 'zod';
import { DISCLAIMER_IDS } from './disclaimers';

export const FORMAT_VERSION = 1;

/** Whitespace-separated tokens; the one word counter of every limit below. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

const wordsBetween = (min: number, max: number) =>
  z.string().refine((s) => wordCount(s) >= min && wordCount(s) <= max, {
    message: min === max ? `must be ${min} words` : `must have ${min} to ${max} words`,
  });

const nonBlank = z.string().refine((s) => s.trim() !== '', { message: 'must not be empty' });

export const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
export const SCENARIO_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const nodeId = z.string().regex(ID_PATTERN, { message: 'must match ^[a-z][a-z0-9_]*$' });
const scenarioId = z
  .string()
  .regex(SCENARIO_ID_PATTERN, { message: 'must match ^[a-z0-9]+(-[a-z0-9]+)*$' });
const title = z.string().min(1).max(18);
const refId = z.string().min(1);

/** Table F3: predicate vocabulary. */
const Op = z.enum(['lt', 'lte', 'gt', 'gte']);

export const Predicate = z.discriminatedUnion('check', [
  z.strictObject({ check: z.literal('state'), control: refId, is: refId }),
  z.strictObject({
    check: z.literal('state_in'),
    control: refId,
    in: z.array(refId).min(1),
  }),
  z.strictObject({
    check: z.literal('travel'),
    control: refId,
    op: Op,
    value: z.number().min(0).max(100),
  }),
  z.strictObject({
    check: z.literal('travel_rel'),
    control: refId,
    op: Op,
    delta: z.number().min(-100).max(100),
  }),
  z.strictObject({
    check: z.literal('quantity'),
    quantity: refId,
    op: Op,
    value: z.number(),
  }),
  z.strictObject({
    check: z.literal('band'),
    quantity: refId,
    in: z.array(refId).min(1),
  }),
]);

/** Table F2: graded step. */
export const Step = z.strictObject({
  id: nodeId,
  severity: z.enum(['critical', 'standard', 'optional']),
  text: wordsBetween(1, 12),
  done: Predicate,
});

const Line = z.strictObject({ kind: z.literal('line'), text: wordsBetween(1, 12) });

const Group = z.strictObject({
  kind: z.literal('group'),
  id: nodeId,
  ordered: z.boolean(),
  order_critical: z.boolean().default(false),
  steps: z.array(Step).min(1),
});

const branchLabel = wordsBetween(1, 8).refine((s) => s.trim().endsWith(':'), {
  message: 'must end with a colon',
});
const decidedAt = z.enum(['start', 'run']).default('start');

/** A branch without `kind`, as written inside a decision. */
export const BranchObject = z.strictObject({
  label: branchLabel,
  when: Predicate,
  decided_at: decidedAt,
  get nodes() {
    return z.array(ProcedureNode).default([]);
  },
});

/** A standalone branch inside a node list. */
const BranchNode = z.strictObject({
  kind: z.literal('branch'),
  label: branchLabel,
  when: Predicate,
  decided_at: decidedAt,
  get nodes() {
    return z.array(ProcedureNode).default([]);
  },
});

const Decision = z.strictObject({
  kind: z.literal('decision'),
  text: wordsBetween(1, 12),
  get branches() {
    return z.array(BranchObject).min(1);
  },
});

export const ProcedureNode = z.discriminatedUnion('kind', [Line, Decision, BranchNode, Group]);

export const Forbidden = z.strictObject({
  id: nodeId,
  text: wordsBetween(1, 12),
  trigger: Predicate,
  fails_run: z.boolean().default(false),
  when: Predicate.optional(),
});

/** Table F1: scenario file, top level. */
export const Scenario = z.strictObject({
  format: z.literal(FORMAT_VERSION),
  id: scenarioId,
  title,
  source: z.strictObject({
    document: nonBlank,
    issue: nonBlank,
    section: nonBlank,
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'must be a date YYYY-MM-DD' }),
  }),
  disclaimer: z.enum(DISCLAIMER_IDS),
  briefing: z.strictObject({ situation: wordsBetween(1, 60) }),
  initial: z.strictObject({
    controls: z.record(z.string(), z.string()).default({}),
    quantities: z.record(z.string(), z.number()).default({}),
  }),
  /** Physics parameters this scenario sets (D-01); absent means the aircraft's normal values. */
  parameters: z.record(nodeId, z.number()).default({}),
  annunciations: z.array(z.string().min(1)),
  procedure: z.array(ProcedureNode).min(1),
  forbidden: z.array(Forbidden).default([]),
});

/** Table F4: pack manifest. */
export const Manifest = z.strictObject({
  format: z.literal(FORMAT_VERSION),
  title: nonBlank,
  free: z.boolean(),
  scenarios: z
    .array(
      z.strictObject({
        id: scenarioId,
        title,
        file: scenarioId,
      }),
    )
    .min(1),
});

export type Scenario = z.infer<typeof Scenario>;
export type ProcedureNode = z.infer<typeof ProcedureNode>;
export type BranchObject = z.infer<typeof BranchObject>;
export type Group = z.infer<typeof Group>;
export type Step = z.infer<typeof Step>;
export type Forbidden = z.infer<typeof Forbidden>;
export type Predicate = z.infer<typeof Predicate>;
export type Manifest = z.infer<typeof Manifest>;
