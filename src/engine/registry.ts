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
  /**
   * The widget draws no name placard of its own because a plate placard (placards.ts) names the
   * control. Only the detent lever honours it today; absent keeps the drawn name.
   */
  readonly nameless?: boolean;
}

/** Skin vocabulary (UI-SPEC 8.1 to 8.5). Widgets pick their art by skin; absent means the first. */
export const TOGGLE_SKINS = ['bat', 'rocker', 'softkey'] as const;
export const ROCKER_SIZES = ['S', 'M', 'L', 'W', 'LIGHT'] as const;
export const ROCKER_COLOURS = ['white', 'red'] as const;
export const BUTTON_SKINS = ['chrome-round', 'blue-dome', 'small-black', 'spring-bat'] as const;
export const LEVER_SKINS = [
  'gear-knob',
  'flaps-block',
  'power-grip',
  'pull-t',
  'pull-tab',
  'pull-boot',
  'env-slider',
  'bat-small',
  'parking-lever',
  'cowl-slider',
] as const;

export type ToggleSkin = (typeof TOGGLE_SKINS)[number];
export type RockerSize = (typeof ROCKER_SIZES)[number];
export type RockerColour = (typeof ROCKER_COLOURS)[number];
export type ButtonSkin = (typeof BUTTON_SKINS)[number];
export type LeverSkin = (typeof LEVER_SKINS)[number];

/**
 * Drawn position of a toggle body. A two-state toggle draws its first state as `low` and its
 * second state as `high`; `mid` is never produced by a two-state toggle (the three-state toggle
 * adds it). Bats point up for `high` and down for `low`; rockers press the upper half for `high`.
 */
export type TogglePosition = 'low' | 'mid' | 'high';

/**
 * Two states, or three for the rocker and bat skins only. With three the order is bottom, middle,
 * top: the first state is drawn `low`, the second `mid`, the third `high` (plan 18, Table T2).
 */
export type ToggleStates = readonly [StateDef, StateDef] | readonly [StateDef, StateDef, StateDef];

export interface ToggleDef extends ControlBase {
  readonly kind: 'toggle';
  readonly states: ToggleStates;
  readonly default: StateId;
  /** Absent means 'bat'. */
  readonly skin?: ToggleSkin;
  /** Rocker only, and then required together with colour. */
  readonly size?: RockerSize;
  readonly colour?: RockerColour;
  /** Bat only: a ball tip on the handle (ENGINE MASTER). */
  readonly ball?: boolean;
}

export interface GuardedToggleDef extends ControlBase {
  readonly kind: 'guarded-toggle';
  readonly states: readonly [StateDef, StateDef];
  readonly default: StateId;
  /** Where the lifted guard can be tapped closed; x, y = top-left corner as an offset from the control centre. */
  readonly guardOpenHit: Rect;
  /** The rocker under the guard: both or neither. */
  readonly size?: RockerSize;
  readonly colour?: RockerColour;
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
  /**
   * Detents whose labels are printed beside the lever; absent = every tap marker (every detent
   * for a drag-only lever), an empty list prints none. Every id must be one of the detents.
   */
  readonly legends?: readonly StateId[];
  /** Centred on (x, y); 'v': pos 0 = bottom, 'h': pos 0 = left. */
  readonly track: { readonly length: number; readonly axis: 'v' | 'h' };
  readonly skin?: LeverSkin;
}

export interface MomentaryButtonDef extends ControlBase {
  readonly kind: 'momentary-button';
  /**
   * [rest, pressed] or, for the spring-bat skin only, [rest, first side, second side]: each side
   * is its own pressed position and the toggle springs back to states[0] on release.
   */
  readonly states: readonly [StateDef, StateDef, ...StateDef[]];
  /** Must be states[0].id. */
  readonly default: StateId;
  readonly skin?: ButtonSkin;
}

export interface RotaryStopDef {
  readonly id: StateId;
  readonly label: string;
  /** Degrees clockwise from 12 o'clock; strictly increasing, values above 180 may pass 6 o'clock. */
  readonly angle: number;
}

/** Round knob with 2 to 5 stops (D-07, D-09). Only the committed stop reaches the store. */
export interface RotaryDef extends ControlBase {
  readonly kind: 'rotary';
  /** In clockwise order. */
  readonly stops: readonly RotaryStopDef[];
  readonly default: StateId;
  /** Radius of the visible knob; the knob lies inside the hit footprint. */
  readonly r: number;
  /** Printed scale around the knob. */
  readonly scale?: 'arc' | 'dots' | 'none';
}

export type ControlDef =
  ToggleDef | GuardedToggleDef | GuardDef | DetentLeverDef | MomentaryButtonDef | RotaryDef;
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
  if (def.kind === 'rotary') return def.stops.map((s) => s.id);
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
  rotary: 'sw.',
};

function checkKindPrefix(def: ControlDef): void {
  const prefix = KIND_PREFIX[def.kind];
  if (!def.id.startsWith(prefix)) {
    throw new RegistryError(
      `control "${def.id}" of kind "${def.kind}" must start with "${prefix}"`,
    );
  }
}

function checkDistinctStates(def: ControlDef): void {
  const ids = legalStates(def);
  if (ids.length < 2) {
    throw new RegistryError(`control "${def.id}" needs at least two states (got ${ids.length})`);
  }
  const seenStates = new Set<StateId>();
  for (const sid of ids) {
    if (seenStates.has(sid)) {
      throw new RegistryError(`control "${def.id}" has duplicate state id "${sid}"`);
    }
    seenStates.add(sid);
  }
}

function checkDetents(def: DetentLeverDef): void {
  let previous = -Infinity;
  for (const d of def.detents) {
    if (!(d.pos >= 0 && d.pos <= 1)) {
      throw new RegistryError(`lever "${def.id}" detent "${d.id}" pos ${d.pos} is outside 0..1`);
    }
    if (d.pos <= previous) {
      throw new RegistryError(
        `lever "${def.id}" detent "${d.id}" pos ${d.pos} is not strictly greater than the previous detent`,
      );
    }
    previous = d.pos;
  }
  const markers = def.markers ?? [];
  if (def.dragOnly === true && markers.length > 0) {
    throw new RegistryError(`lever "${def.id}" is drag-only and cannot have tap markers`);
  }
  const seenMarkers = new Set<StateId>();
  for (const m of markers) {
    if (!def.detents.some((d) => d.id === m)) {
      throw new RegistryError(`lever "${def.id}" marker "${m}" is not one of its detents`);
    }
    if (seenMarkers.has(m)) {
      throw new RegistryError(`lever "${def.id}" has duplicate marker "${m}"`);
    }
    seenMarkers.add(m);
  }
  const seenLegends = new Set<StateId>();
  for (const l of def.legends ?? []) {
    if (!def.detents.some((d) => d.id === l)) {
      throw new RegistryError(`lever "${def.id}" legend "${l}" is not one of its detents`);
    }
    if (seenLegends.has(l)) {
      throw new RegistryError(`lever "${def.id}" has duplicate legend "${l}"`);
    }
    seenLegends.add(l);
  }
}

function checkMomentaryRest(def: MomentaryButtonDef): void {
  if (def.default !== def.states[0].id) {
    throw new RegistryError(
      `button "${def.id}" must rest in its first state "${def.states[0].id}" (default "${def.default}")`,
    );
  }
}

function checkRotary(def: RotaryDef): void {
  if (def.stops.length < 2 || def.stops.length > 5) {
    throw new RegistryError(`knob "${def.id}" needs 2 to 5 stops (got ${def.stops.length})`);
  }
  let previous = -Infinity;
  for (const stop of def.stops) {
    if (!Number.isFinite(stop.angle)) {
      throw new RegistryError(`knob "${def.id}" stop "${stop.id}" angle is not a finite number`);
    }
    if (stop.angle <= previous) {
      throw new RegistryError(
        `knob "${def.id}" stop "${stop.id}" angle ${stop.angle} is not strictly greater than the previous stop`,
      );
    }
    previous = stop.angle;
  }
  const first = def.stops[0];
  const last = def.stops[def.stops.length - 1];
  if (first !== undefined && last !== undefined && last.angle - first.angle >= 360) {
    throw new RegistryError(
      `knob "${def.id}" sweeps ${last.angle - first.angle} degrees, which must stay below 360`,
    );
  }
  if (!(def.r > 0) || 2 * def.r > Math.min(def.hit.w, def.hit.h)) {
    throw new RegistryError(
      `knob "${def.id}" radius ${def.r} does not fit inside its ${def.hit.w} x ${def.hit.h} hit footprint`,
    );
  }
}

function checkSkinFields(def: ToggleDef | GuardedToggleDef): void {
  if (def.kind === 'guarded-toggle') {
    const count = (def.states as readonly StateDef[]).length;
    if (count !== 2) {
      throw new RegistryError(
        `guarded toggle "${def.id}" has ${count} states (a guarded toggle has exactly two)`,
      );
    }
    if ((def.size === undefined) !== (def.colour === undefined)) {
      throw new RegistryError(
        `guarded toggle "${def.id}" needs both size and colour for its rocker, or neither`,
      );
    }
    checkRockerFields(def);
    return;
  }
  const skin = def.skin ?? 'bat';
  if (!(TOGGLE_SKINS as readonly string[]).includes(skin)) {
    throw new RegistryError(`toggle "${def.id}" has unknown skin "${skin}"`);
  }
  if (def.states.length > 3) {
    throw new RegistryError(`toggle "${def.id}" has ${def.states.length} states (2 or 3 allowed)`);
  }
  if (def.states.length === 3 && skin === 'softkey') {
    throw new RegistryError(
      `toggle "${def.id}" has three states but its skin is "softkey"; only the rocker and bat skins have a middle position`,
    );
  }
  if (skin === 'rocker') {
    if (def.size === undefined || def.colour === undefined) {
      throw new RegistryError(`rocker "${def.id}" needs both size and colour`);
    }
    if (def.ball !== undefined) {
      throw new RegistryError(`rocker "${def.id}" cannot have a ball tip (bat skin only)`);
    }
    checkRockerFields(def);
    return;
  }
  if (def.size !== undefined || def.colour !== undefined) {
    throw new RegistryError(`toggle "${def.id}" has size or colour but its skin is "${skin}"`);
  }
  if (def.ball !== undefined && skin !== 'bat') {
    throw new RegistryError(`toggle "${def.id}" has a ball tip but its skin is "${skin}"`);
  }
}

function checkRockerFields(def: { id: ControlId; size?: string; colour?: string }): void {
  if (def.size !== undefined && !(ROCKER_SIZES as readonly string[]).includes(def.size)) {
    throw new RegistryError(`control "${def.id}" has unknown rocker size "${def.size}"`);
  }
  if (def.colour !== undefined && !(ROCKER_COLOURS as readonly string[]).includes(def.colour)) {
    throw new RegistryError(`control "${def.id}" has unknown rocker colour "${def.colour}"`);
  }
}

function checkLeverSkin(def: DetentLeverDef): void {
  if (def.skin !== undefined && !(LEVER_SKINS as readonly string[]).includes(def.skin)) {
    throw new RegistryError(`lever "${def.id}" has unknown skin "${def.skin}"`);
  }
}

function checkMomentaryStates(def: MomentaryButtonDef): void {
  if (def.skin !== undefined && !(BUTTON_SKINS as readonly string[]).includes(def.skin)) {
    throw new RegistryError(`button "${def.id}" has unknown skin "${def.skin}"`);
  }
  if (def.states.length > 3) {
    throw new RegistryError(`button "${def.id}" has ${def.states.length} states (2 or 3 allowed)`);
  }
  if (def.states.length === 3 && def.skin !== 'spring-bat') {
    throw new RegistryError(
      `button "${def.id}" has three states but its skin is "${def.skin ?? 'none'}"; only spring-bat has a rest-first three-state form`,
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
    checkDistinctStates(def);
    if (spec.kind === 'detent-lever') checkDetents(spec);
    if (spec.kind === 'momentary-button') {
      checkMomentaryStates(spec);
      checkMomentaryRest(spec);
    }
    if (spec.kind === 'toggle' || spec.kind === 'guarded-toggle') checkSkinFields(spec);
    if (spec.kind === 'detent-lever') checkLeverSkin(spec);
    if (spec.kind === 'rotary') checkRotary(spec);
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
