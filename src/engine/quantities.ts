// Named aircraft quantities (D-07, D-08): numeric readings such as oil temperature that
// scenarios set, predicates test and the MFD displays. A quantity is data: a unit, a range, an
// idle value and colour bands. Pure TypeScript, no DOM, no framework, no clock (enforced by the
// ESLint boundary).

export type QuantityId = string;
export type BandColour = 'green' | 'yellow' | 'red';

export const QUANTITY_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface BandDef {
  readonly id: string;
  readonly colour: BandColour;
  /** Inclusive upper bound; bands ascend contiguously from the quantity minimum. */
  readonly to: number;
}

export interface QuantityDef {
  readonly id: QuantityId;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  /** Value on the ground with nothing set (a scenario overlays its own initial values). */
  readonly idle: number;
  /** At least one; the last bound equals max. */
  readonly bands: readonly BandDef[];
}

export interface QuantitySet {
  readonly all: readonly QuantityDef[];
  get(id: QuantityId): QuantityDef | undefined;
  /**
   * Band id of a value: the first band whose bound is at least the value; below min it is the
   * first band, above max the last. Throws for an unknown quantity (a programmer error).
   */
  bandOf(id: QuantityId, value: number): string;
  /** Idle value of every quantity, keyed by id. */
  idleValues(): Readonly<Record<QuantityId, number>>;
}

export class QuantityError extends Error {}

function checkDef(def: QuantityDef): void {
  const fail = (what: string): never => {
    throw new QuantityError(`quantity "${def.id}" ${what}`);
  };
  if (!QUANTITY_ID_PATTERN.test(def.id)) {
    throw new QuantityError(`quantity id "${def.id}" does not match ${QUANTITY_ID_PATTERN.source}`);
  }
  if (![def.min, def.max, def.idle].every(Number.isFinite)) {
    fail('needs finite min, max and idle');
  }
  if (!(def.min < def.max)) fail(`has min ${String(def.min)} not below max ${String(def.max)}`);
  if (def.idle < def.min || def.idle > def.max) {
    fail(`has idle ${String(def.idle)} outside ${String(def.min)}..${String(def.max)}`);
  }
  if (def.bands.length === 0) fail('has no bands');
  const seen = new Set<string>();
  let previous = def.min;
  for (const band of def.bands) {
    if (band.id === '' || seen.has(band.id)) fail(`has an empty or duplicate band id "${band.id}"`);
    seen.add(band.id);
    if (!Number.isFinite(band.to) || !(band.to > previous)) {
      fail(
        `band "${band.id}" bound ${String(band.to)} is not above the previous bound ${String(previous)} (bands ascend contiguously from min)`,
      );
    }
    previous = band.to;
  }
  if (previous !== def.max) {
    fail(`last band bound ${String(previous)} does not equal max ${String(def.max)}`);
  }
}

export function defineQuantities(defs: readonly QuantityDef[]): QuantitySet {
  const seen = new Set<QuantityId>();
  const all: QuantityDef[] = [];
  for (const def of defs) {
    checkDef(def);
    if (seen.has(def.id)) throw new QuantityError(`duplicate quantity id "${def.id}"`);
    seen.add(def.id);
    all.push(
      Object.freeze({
        ...def,
        bands: Object.freeze(def.bands.map((b) => Object.freeze({ ...b }))),
      }),
    );
  }
  const byId = new Map<QuantityId, QuantityDef>(all.map((d) => [d.id, d]));
  const idle: Record<QuantityId, number> = {};
  for (const d of all) idle[d.id] = d.idle;
  Object.freeze(idle);

  return Object.freeze({
    all: Object.freeze(all),
    get: (id: QuantityId) => byId.get(id),
    bandOf: (id: QuantityId, value: number): string => {
      const def = byId.get(id);
      if (def === undefined) throw new QuantityError(`unknown quantity "${id}"`);
      const band = def.bands.find((b) => b.to >= value) ?? def.bands[def.bands.length - 1];
      // bands is never empty (checked above)
      return (band as BandDef).id;
    },
    idleValues: () => idle,
  });
}
