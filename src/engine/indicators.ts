// Derived indicators (PNL-14, D-11): outputs computed from control state, never operated and
// never graded. They are deliberately NOT ControlDefs (PD-07): the store, the registry and every
// ControlDef consumer stay unchanged, and an "lt." id can never be dispatched. Phase 3 adds
// flags such as "gear.in_transit" through IndicatorInputs.flags.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { CONTROL_ID_PATTERN } from './registry';
import type { ControlId, Registry, StateId } from './registry';

export type IndicatorColour = 'green' | 'red' | 'white' | 'amber';

export interface IndicatorInputs {
  /** Only the controls named in the spec's reads. */
  readonly controls: Readonly<Record<ControlId, StateId>>;
  /** Named boolean inputs that are not controls (for example gear.in_transit); missing means false. */
  readonly flags: Readonly<Record<string, boolean>>;
}

export interface IndicatorSpec {
  /** Starts with "lt." and never equals a control id. */
  readonly id: string;
  /** Caption text, ALL CAPS. */
  readonly label: string;
  readonly region: string;
  /** Region-local centre of the lamp disc. */
  readonly x: number;
  readonly y: number;
  /** Radius of the lamp disc; the bezel is a little larger. */
  readonly r: number;
  readonly colour: IndicatorColour;
  /** Where the caption sits relative to the lamp; `none` for a lamp the original prints no name on. */
  readonly caption: 'above' | 'right' | 'none';
  /** The control ids this lamp reads; the lit function only ever sees these. */
  readonly reads: readonly ControlId[];
  /** Flag names this lamp reads (documentation for Phase 3; missing flags read as false). */
  readonly flags?: readonly string[];
  readonly lit: (inputs: IndicatorInputs) => boolean;
}

export type IndicatorDef = Readonly<IndicatorSpec> & { readonly kind: 'indicator' };

export interface IndicatorSet {
  readonly indicators: readonly IndicatorDef[];
  get(id: string): IndicatorDef | undefined;
  inRegion(regionId: string): readonly IndicatorDef[];
}

export class IndicatorError extends Error {}

/** Width of the dark bezel ring around the lamp disc. */
export const BEZEL_EXTRA = 2;

export const INDICATOR_PREFIX = 'lt.';

export function defineIndicators(
  registry: Registry,
  input: { readonly indicators: readonly IndicatorSpec[] },
): IndicatorSet {
  const seen = new Set<string>();
  const defs: IndicatorDef[] = [];
  for (const spec of input.indicators) {
    if (!spec.id.startsWith(INDICATOR_PREFIX)) {
      throw new IndicatorError(`indicator "${spec.id}" must start with "${INDICATOR_PREFIX}"`);
    }
    if (!CONTROL_ID_PATTERN.test(spec.id)) {
      throw new IndicatorError(
        `indicator id "${spec.id}" does not match ${CONTROL_ID_PATTERN.source}`,
      );
    }
    if (seen.has(spec.id)) throw new IndicatorError(`duplicate indicator id "${spec.id}"`);
    seen.add(spec.id);
    if (registry.get(spec.id) !== undefined) {
      throw new IndicatorError(`indicator id "${spec.id}" is also a control id`);
    }
    const region = registry.regions.find((r) => r.id === spec.region);
    if (region === undefined) {
      throw new IndicatorError(`indicator "${spec.id}" names unknown region "${spec.region}"`);
    }
    if (spec.reads.length === 0) {
      throw new IndicatorError(`indicator "${spec.id}" reads no control`);
    }
    for (const read of spec.reads) {
      if (registry.get(read) === undefined) {
        throw new IndicatorError(`indicator "${spec.id}" reads "${read}", which is not a control`);
      }
    }
    if (!(spec.r > 0)) {
      throw new IndicatorError(`indicator "${spec.id}" radius ${spec.r} must be positive`);
    }
    const reach = spec.r + BEZEL_EXTRA;
    const { w, h } = region.bounds;
    if (spec.x - reach < 0 || spec.y - reach < 0 || spec.x + reach > w || spec.y + reach > h) {
      throw new IndicatorError(
        `indicator "${spec.id}" lamp disc lies outside its region "${spec.region}"`,
      );
    }
    defs.push(Object.freeze({ ...spec, kind: 'indicator' as const }));
  }

  const byId = new Map<string, IndicatorDef>(defs.map((d) => [d.id, d]));
  return Object.freeze({
    indicators: Object.freeze(defs),
    get: (id: string) => byId.get(id),
    inRegion: (regionId: string) => defs.filter((d) => d.region === regionId),
  });
}

/**
 * Lit or not, from a snapshot of control states and the flags. The lit function is passed only
 * the controls named in reads, so an undeclared dependency cannot hide.
 */
export function evaluateIndicator(
  def: IndicatorDef,
  snapshot: Readonly<Record<ControlId, StateId>>,
  flags: Readonly<Record<string, boolean>> = {},
): boolean {
  const controls: Record<ControlId, StateId> = {};
  for (const id of def.reads) {
    const value = snapshot[id];
    if (value !== undefined) controls[id] = value;
  }
  return def.lit({ controls, flags });
}
