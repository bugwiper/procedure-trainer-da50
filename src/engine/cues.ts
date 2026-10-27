// Visual cues of a failure (Phase 5, W-05): a cue is a named quantity read as a level from 0 to 1.
// The aircraft owns the table (src/aircraft/da50rg/cues.ts); the windscreen layer draws a cue only
// from CUE_VISIBLE_LEVEL, so what a lint check sees is what the pilot sees. A level is a pure
// function of the quantities: + - * / and clamping only, so a live run and a replay agree.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { QuantityId, QuantitySet } from './quantities';

export const CUE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** A cue is drawn only from this level (0 to 1); below it the layer shows nothing of the cue. */
export const CUE_VISIBLE_LEVEL = 0.1;

export interface CueSpec {
  readonly id: string;
  /** The named quantity the cue reads. */
  readonly quantity: QuantityId;
  /** The reading at level 0. */
  readonly from: number;
  /** The reading at level 1; below `from` the level runs the other way. */
  readonly to: number;
}

export type Cue = Readonly<CueSpec>;

export interface CueSet {
  readonly cues: readonly Cue[];
  readonly ids: readonly string[];
  get(id: string): Cue | undefined;
  /** The level 0 to 1 of every cue for the given quantity values, keyed by cue id. */
  levels(quantities: Readonly<Record<QuantityId, number>>): Readonly<Record<string, number>>;
}

export class CueError extends Error {}

/** True when a level is high enough to be drawn. */
export function cueVisible(level: number): boolean {
  return level >= CUE_VISIBLE_LEVEL;
}

/** (value - from) / (to - from), clamped to 0..1. */
export function cueLevel(cue: Pick<Cue, 'from' | 'to'>, value: number): number {
  const level = (value - cue.from) / (cue.to - cue.from);
  return level > 0 ? (level < 1 ? level : 1) : 0;
}

export function defineCues(specs: readonly CueSpec[], quantities: QuantitySet): CueSet {
  const seen = new Set<string>();
  const cues: Cue[] = [];
  for (const spec of specs) {
    const fail = (what: string): never => {
      throw new CueError(`cue "${spec.id}" ${what}`);
    };
    if (!CUE_ID_PATTERN.test(spec.id)) {
      throw new CueError(`cue id "${spec.id}" does not match ${CUE_ID_PATTERN.source}`);
    }
    if (seen.has(spec.id)) fail('is defined twice');
    seen.add(spec.id);
    if (quantities.get(spec.quantity) === undefined) {
      fail(`reads the unknown quantity "${spec.quantity}"`);
    }
    if (!Number.isFinite(spec.from) || !Number.isFinite(spec.to) || spec.from === spec.to) {
      fail('needs a finite from and a to that differs from it');
    }
    cues.push(Object.freeze({ ...spec }));
  }
  const byId = new Map(cues.map((c) => [c.id, c]));
  return Object.freeze({
    cues: Object.freeze(cues),
    ids: Object.freeze(cues.map((c) => c.id)),
    get: (id: string) => byId.get(id),
    levels(values: Readonly<Record<QuantityId, number>>) {
      const out: Record<string, number> = {};
      for (const cue of cues) out[cue.id] = cueLevel(cue, values[cue.quantity] ?? cue.from);
      return out;
    },
  });
}
