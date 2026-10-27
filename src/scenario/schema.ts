// Scenario file format 1 (D-19, D-22, D-23, D-25, SCN-01, SCN-07). One Zod schema is the single
// source of the file contract and of the inferred types. Every object is strict, so a misspelled
// key is an error. Predicates and procedure nodes are closed unions: nothing in a scenario file
// is ever evaluated as a string. `parameters` names physics parameters of the aircraft (for
// example a degraded cooling) with finite values. Cross-references (control, state, quantity,
// band and parameter ids) are checked by lint.ts against the aircraft, not here. `outcomes` names
// the failures an ignored emergency escalates to (D-06): each ends the run when its predicate has
// held for its hold time; the list and the hold time are bounded (MAX_OUTCOMES, MAX_HOLD_S). `onset` is the optional window
// in seconds in which the failure begins by itself in the level Realistic (D-05, MAX_ONSET_S).
// A checklist can be written as printed (plan 03-13, owner decision 2026-10-23): the optional
// `checklist` block names the printed heading and message tag and the form, `table` (numbered rows
// with an item and a desired action, full-width comment rows between them) or `outline` (nested
// items; the default). `number` and `action` sit on a line or step, `comment` is a node kind of its
// own. All of it is additive and optional, the format stays 1, and nothing in it is graded. Checklist
// text is reproduced as printed, so its cap (MAX_LINE_WORDS) is a layout bound, not a style rule.
// `variants` (phase 3.1, SCN-09) are the several causes behind one failure message: each has a
// weight, the faulted control state and parameters of its cause, the ids of the steps and forbidden
// items that apply in it, and an own-wording cause line for the debrief. The checklist stays the one
// printed list; the engine resolves a drawn variant into a plain scenario (engine/variants.ts).
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

/** The longest checklist line in words: a layout bound, the printed wording is not shortened. */
export const MAX_LINE_WORDS = 20;

const lineWords = wordsBetween(1, MAX_LINE_WORDS);

/**
 * The longest WARNING or CAUTION block in words: a layout bound like the line cap (plan 05.1-02).
 * The block is reproduced as printed, so the bound only keeps one block from filling the screen.
 */
export const MAX_NOTE_WORDS = 70;

/** The style of a comment row: an italic sub-heading, or a WARNING or CAUTION block. */
export const COMMENT_STYLES = ['subheading', 'warning', 'caution'] as const;

/**
 * The printed marker in front of an outline item (plan 03-13): the arrow of a heading line, the
 * diamond variants of a condition, the double arrow of an action, the circle and the square of the
 * nested levels. A name only; the renderer draws it.
 */
export const MARKERS = [
  'arrow',
  'diamond',
  'diamond_arrow',
  'double_arrow',
  'circle',
  'square',
] as const;

const marker = z.enum(MARKERS).optional();

/**
 * The row mark printed at the left of a checklist table row: a whole number 1 to 99 or one capital
 * letter A to Z (the ground and take-off checklists print letters). One checklist uses one style.
 */
const rowNumber = z.union([
  z.number().int().min(1).max(99),
  z.string().regex(/^[A-Z]$/, { message: 'must be a whole number 1 to 99 or one capital letter' }),
]);

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
  text: lineWords,
  /** Printed row number (table form) and desired action (right-hand column). */
  number: rowNumber.optional(),
  action: lineWords.optional(),
  marker,
  done: Predicate,
});

const Line = z.strictObject({
  kind: z.literal('line'),
  text: lineWords,
  number: rowNumber.optional(),
  action: lineWords.optional(),
  marker,
});

/**
 * A full-width printed row between checklist rows; `action` is a right-hand reference such as a
 * page. `style` makes it an italic sub-heading or a WARNING or CAUTION block (the printed word is
 * drawn above the text); only those two may be longer than a line, up to MAX_NOTE_WORDS.
 */
const Comment = z
  .strictObject({
    kind: z.literal('comment'),
    text: wordsBetween(1, MAX_NOTE_WORDS),
    action: lineWords.optional(),
    boxed: z.boolean().optional(),
    style: z.enum(COMMENT_STYLES).optional(),
  })
  .refine(
    (node) =>
      node.style === 'warning' ||
      node.style === 'caution' ||
      wordCount(node.text) <= MAX_LINE_WORDS,
    { message: `must have 1 to ${String(MAX_LINE_WORDS)} words`, path: ['text'] },
  );

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
  marker,
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
  marker,
  when: Predicate,
  decided_at: decidedAt,
  get nodes() {
    return z.array(ProcedureNode).default([]);
  },
});

const Decision = z.strictObject({
  kind: z.literal('decision'),
  text: lineWords,
  marker,
  get branches() {
    return z.array(BranchObject).min(1);
  },
});

export const ProcedureNode = z.discriminatedUnion('kind', [
  Line,
  Comment,
  Decision,
  BranchNode,
  Group,
]);

export const Forbidden = z.strictObject({
  id: nodeId,
  text: wordsBetween(1, 12),
  trigger: Predicate,
  fails_run: z.boolean().default(false),
  when: Predicate.optional(),
});

/** The most outcomes one scenario declares, and the longest hold time of one (T-03-11). */
export const MAX_OUTCOMES = 4;
export const MAX_HOLD_S = 600;

/** A named outcome (D-06, C-24): the run ends as FAIL once `when` has held for `hold_s` seconds. */
export const Outcome = z.strictObject({
  id: nodeId,
  text: wordsBetween(1, 12),
  when: Predicate,
  hold_s: z.number().min(0).max(MAX_HOLD_S),
});

/** The longest second of an onset window (T-03-16): bounds the lint loop of the realistic level. */
export const MAX_ONSET_S = 120;

const onsetSecond = z.number().min(1).max(MAX_ONSET_S);

/** The most cue ids one onset lists. */
export const MAX_ONSET_CUES = 4;

/**
 * The onset of the failure in the level Realistic (D-05, C-29): the failure begins by itself at a
 * random time inside `window_s` seconds (first at most second). A scenario without it does not
 * offer Realistic. The block also carries the Realistic setup (C-58): `quantities` are the start
 * values of a Realistic run (laid over the aircraft's base values, in place of initial.quantities)
 * and `parameters` are physics parameters in force from the onset (laid over the top-level
 * parameters). Both are read only when an onset is declared and a run has one; Easy and Medium
 * never read them. `message_within_s` is the latest second after the onset by which every listed
 * annunciation must show in a Realistic run that does nothing; lint rule L15 checks it. It is
 * absent for a quick failure (the lint default applies). `cues` (Phase 5) are the visual cues of
 * the aircraft (the windscreen layer) that must show within the same bound; lint rules L23 and L24
 * check them, and an onset needs at least one annunciation or one cue.
 */
export const Onset = z.strictObject({
  window_s: z
    .tuple([onsetSecond, onsetSecond])
    .refine(([lo, hi]) => lo <= hi, { message: 'the first second must not exceed the second' }),
  quantities: z.record(z.string(), z.number()).default({}),
  parameters: z.record(nodeId, z.number()).default({}),
  /** Control state the simulation sets by itself at the onset (the faulted controls of a variant). */
  controls: z.record(z.string(), z.string()).default({}),
  message_within_s: onsetSecond.optional(),
  cues: z.array(nodeId).max(MAX_ONSET_CUES).default([]),
});

/** The most variants one scenario declares, and the highest weight of one. */
export const MAX_VARIANTS = 6;
export const MAX_WEIGHT = 100;

/**
 * One cause behind the failure (V-01): drawn by weight at the start of a run on every level and
 * recorded with it. `controls` and `parameters` are the faulted state of this cause (in force from
 * t 0 on Easy and Medium, set by the simulation at the onset on Realistic). `applies` names the
 * steps and forbidden items that apply in this variant; one named by no variant applies in all.
 * `debrief` is the cause line the debrief prints after the run.
 */
export const Variant = z.strictObject({
  id: nodeId,
  weight: z.number().int().min(1).max(MAX_WEIGHT),
  controls: z.record(z.string(), z.string()).default({}),
  parameters: z.record(nodeId, z.number()).default({}),
  applies: z.array(nodeId).default([]),
  debrief: wordsBetween(1, 30),
});

/** The printed form of a checklist and its heading and message tag (all optional, plan 03-13). */
export const CHECKLIST_FORMS = ['table', 'outline'] as const;

export const Checklist = z.strictObject({
  form: z.enum(CHECKLIST_FORMS).default('outline'),
  heading: lineWords.optional(),
  message: lineWords.optional(),
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
  /**
   * The view out of the windscreen (Phase 5, W-07); absent means the aircraft's default scene.
   * Whether the id exists is lint L22, the default is aircraft data.
   */
  scene: nodeId.optional(),
  briefing: z.strictObject({ situation: wordsBetween(1, 60) }),
  initial: z.strictObject({
    controls: z.record(z.string(), z.string()).default({}),
    quantities: z.record(z.string(), z.number()).default({}),
  }),
  /** Physics parameters this scenario sets (D-01); absent means the aircraft's normal values. */
  parameters: z.record(nodeId, z.number()).default({}),
  annunciations: z.array(z.string().min(1)),
  /** The printed form, heading and message tag of the checklist; absent means an unadorned outline. */
  checklist: Checklist.optional(),
  procedure: z.array(ProcedureNode).min(1),
  forbidden: z.array(Forbidden).default([]),
  outcomes: z.array(Outcome).max(MAX_OUTCOMES).default([]),
  /** The window in which the failure begins in the level Realistic; absent means no such level. */
  onset: Onset.optional(),
  /** The several causes behind the failure; empty means one cause, the file as written. */
  variants: z.array(Variant).max(MAX_VARIANTS).default([]),
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
export type Checklist = z.infer<typeof Checklist>;
export type CommentStyle = (typeof COMMENT_STYLES)[number];
/** The printed row mark of a line or step: a whole number or one capital letter. */
export type RowMark = z.infer<typeof rowNumber>;
export type Step = z.infer<typeof Step>;
export type Forbidden = z.infer<typeof Forbidden>;
export type Outcome = z.infer<typeof Outcome>;
export type Onset = z.infer<typeof Onset>;
export type Variant = z.infer<typeof Variant>;
export type Predicate = z.infer<typeof Predicate>;
export type Manifest = z.infer<typeof Manifest>;
