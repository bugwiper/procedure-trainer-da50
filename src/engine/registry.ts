// Control registry: plain data describing every operable control (PNL-02).
// Pure TypeScript, no DOM and no framework (enforced by the ESLint boundary).

export type ControlId = string;
export type StateId = string;

// Stable id convention: kind family prefix, then dot-separated lowercase parts.
export const CONTROL_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

/** label is the small state text shown next to the control (D-13). */
export interface StateDef {
  readonly id: StateId;
  readonly label: string;
}
export interface Size {
  readonly w: number;
  readonly h: number;
}
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface ControlBase {
  readonly id: ControlId;
  /** ALL CAPS placard text (D-10). */
  readonly label: string;
  /** RegionDef.id */
  readonly region: string;
  /** Region-local centre of the control. */
  readonly x: number;
  readonly y: number;
  /** Footprint centred on (x, y); every interactive sub-target of the control lies inside it. */
  readonly hit: Size;
}

export interface ToggleDef extends ControlBase {
  readonly kind: 'toggle';
  readonly states: readonly [StateDef, StateDef];
  readonly default: StateId;
  readonly skin?: 'switch' | 'softkey';
}

export interface GuardedToggleDef extends ControlBase {
  readonly kind: 'guarded-toggle';
  readonly states: readonly [StateDef, StateDef];
  readonly default: StateId;
  /** Where the lifted guard can be tapped closed; x, y = top-left corner as an offset from the control centre. */
  readonly guardOpenHit: Rect;
}

/** Derived by defineRegistry, never authored. */
export interface GuardDef extends ControlBase {
  readonly kind: 'guard';
  /** [closed, open] */
  readonly states: readonly [StateDef, StateDef];
  readonly default: 'closed';
  readonly guards: ControlId;
  /** Copy of guardOpenHit, same offset convention. */
  readonly openHit: Rect;
}

export interface DetentDef {
  readonly id: StateId;
  readonly label: string;
  /** 0..1, strictly increasing. */
  readonly pos: number;
}

export interface DetentLeverDef extends ControlBase {
  readonly kind: 'detent-lever';
  readonly detents: readonly DetentDef[];
  readonly default: StateId;
  /** D-07c safety-consequence levers: no detent tap targets; only a deliberate drag of the handle actuates. */
  readonly dragOnly?: boolean;
  /** Detents that get a tap target; absent = every detent. */
  readonly markers?: readonly StateId[];
  /** Centred on (x, y); 'v': pos 0 = bottom, 'h': pos 0 = left. */
  readonly track: { readonly length: number; readonly axis: 'v' | 'h' };
}

export interface MomentaryButtonDef extends ControlBase {
  readonly kind: 'momentary-button';
  /** [released, pressed] */
  readonly states: readonly [StateDef, StateDef];
  /** Must be states[0].id. */
  readonly default: StateId;
}

export type ControlDef =
  ToggleDef | GuardedToggleDef | GuardDef | DetentLeverDef | MomentaryButtonDef;
export type ControlKind = ControlDef['kind'];
/** What aircraft data authors write. */
export type ControlSpec = Exclude<ControlDef, GuardDef>;

export interface RegionDef {
  readonly id: string;
  readonly name: string;
  readonly bounds: Rect;
}
export interface Region extends RegionDef {
  /** Derived from the controls in declaration order, never hand-maintained (D-03). */
  readonly controlIds: readonly ControlId[];
}

export interface Registry {
  readonly viewBox: Size;
  readonly regions: readonly Region[];
  /** Declaration order; each derived guard directly after its switch. */
  readonly controls: readonly ControlDef[];
  get(id: ControlId): ControlDef | undefined;
}

export class RegistryError extends Error {}

export function guardIdFor(switchId: ControlId): ControlId {
  return `${switchId}.guard`;
}

export function legalStates(def: ControlDef): readonly StateId[] {
  if (def.kind === 'detent-lever') return def.detents.map((d) => d.id);
  return def.states.map((s) => s.id);
}

function checkUniqueId(id: ControlId, seen: Set<ControlId>): void {
  if (seen.has(id)) throw new RegistryError(`duplicate control id "${id}"`);
  seen.add(id);
}

function checkIdPattern(id: ControlId): void {
  if (!CONTROL_ID_PATTERN.test(id)) {
    throw new RegistryError(`control id "${id}" does not match ${CONTROL_ID_PATTERN.source}`);
  }
}

// Kind family prefixes (toggle and guarded-toggle share "sw."; a derived guard is a switch part).
const KIND_PREFIX: Readonly<Record<ControlKind, string>> = {
  toggle: 'sw.',
  'guarded-toggle': 'sw.',
  guard: 'sw.',
  'detent-lever': 'lv.',
  'momentary-button': 'btn.',
};

function checkKindPrefix(def: ControlDef): void {
  const prefix = KIND_PREFIX[def.kind];
  if (!def.id.startsWith(prefix)) {
    throw new RegistryError(
      `control "${def.id}" of kind "${def.kind}" must start with "${prefix}"`,
    );
  }
}

function checkDefaultLegal(def: ControlDef): void {
  if (!legalStates(def).includes(def.default)) {
    throw new RegistryError(`control "${def.id}" default "${def.default}" is not a legal state`);
  }
}

function checkRegionExists(def: ControlDef, regionIds: ReadonlySet<string>): void {
  if (!regionIds.has(def.region)) {
    throw new RegistryError(`control "${def.id}" names unknown region "${def.region}"`);
  }
}

function deriveGuard(sw: GuardedToggleDef): GuardDef {
  return {
    kind: 'guard',
    id: guardIdFor(sw.id),
    label: `${sw.label} GUARD`,
    region: sw.region,
    x: sw.x,
    y: sw.y,
    hit: sw.hit,
    states: [
      { id: 'closed', label: 'CLOSED' },
      { id: 'open', label: 'OPEN' },
    ],
    default: 'closed',
    guards: sw.id,
    openHit: sw.guardOpenHit,
  };
}

export function defineRegistry(input: {
  viewBox: Size;
  regions: readonly RegionDef[];
  controls: readonly ControlSpec[];
}): Registry {
  const regionIds = new Set<string>();
  for (const r of input.regions) {
    if (regionIds.has(r.id)) throw new RegistryError(`duplicate region id "${r.id}"`);
    regionIds.add(r.id);
  }

  const seen = new Set<ControlId>();
  const controls: ControlDef[] = [];
  for (const spec of input.controls) {
    const def: ControlDef = Object.freeze({ ...spec });
    checkIdPattern(def.id);
    checkKindPrefix(def);
    checkUniqueId(def.id, seen);
    checkDefaultLegal(def);
    checkRegionExists(def, regionIds);
    controls.push(def);
    if (spec.kind === 'guarded-toggle') {
      const guard = Object.freeze(deriveGuard(spec));
      checkIdPattern(guard.id);
      checkUniqueId(guard.id, seen);
      controls.push(guard);
    }
  }

  const regions: Region[] = input.regions.map((r) =>
    Object.freeze({
      ...r,
      controlIds: Object.freeze(controls.filter((c) => c.region === r.id).map((c) => c.id)),
    }),
  );

  const byId = new Map<ControlId, ControlDef>(controls.map((c) => [c.id, c]));
  return Object.freeze({
    viewBox: Object.freeze({ ...input.viewBox }),
    regions: Object.freeze(regions),
    controls: Object.freeze(controls),
    get: (id: ControlId) => byId.get(id),
  });
}
