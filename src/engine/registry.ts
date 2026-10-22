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
   * control. The detent lever, the rotary knob, the bat toggle and the round push button honour it;
   * absent keeps the drawn name.
   */
  readonly nameless?: boolean;
}

/** Skin vocabulary (UI-SPEC 8.1 to 8.5). Widgets pick their art by skin; absent means the first. */
export const TOGGLE_SKINS = ['bat', 'rocker', 'softkey'] as const;
export const ROCKER_SIZES = ['S', 'M', 'L', 'W', 'LIGHT'] as const;
export const ROCKER_COLOURS = ['white', 'red'] as const;
export const BUTTON_SKINS = [
  'chrome-round',
  'blue-dome',
  'small-black',
  'black-dome',
  'spring-bat',
] as const;
export const LEVER_SKINS = [
  'gear-knob',
  'flaps-block',
  'power-grip',
  'pull-t',
  'pull-tab',
  'pull-boot',
  'env-slider',
  'parking-flap',
  'cowl-slider',
  'pull-ecs',
] as const;
/**
 * Looks of a rotary knob. Absent means `round` (the black disc with a pointer line); `selector-bar`
 * is the elongated red selector knob of the FUEL valve (owner decision 2026-10-22).
 */
export const ROTARY_SKINS = ['round', 'selector-bar'] as const;

export type ToggleSkin = (typeof TOGGLE_SKINS)[number];
export type RockerSize = (typeof ROCKER_SIZES)[number];
export type RockerColour = (typeof ROCKER_COLOURS)[number];
export type ButtonSkin = (typeof BUTTON_SKINS)[number];
export type LeverSkin = (typeof LEVER_SKINS)[number];
export type RotarySkin = (typeof ROTARY_SKINS)[number];

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
  /**
   * A tap anywhere on the footprint toggles between the two detents; no dragging, no markers, no
   * track (R2-4.2). Goes with the parking-flap skin, both or neither; exactly two detents.
   */
  readonly tapToggle?: true;
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

/**
 * Direct click spot of one rotary stop (R2-4.1): a knob-local rectangle, centre (x, y) and size
 * (w, h) in units, centre of the knob at (0, 0). A tap inside it sets the stop at once.
 */
export interface RotarySpotDef {
  readonly stop: StateId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Round knob with 2 to 5 stops (D-07, D-09). Only the committed stop reaches the store. */
export interface RotaryDef extends ControlBase {
  readonly kind: 'rotary';
  /** In clockwise order. */
  readonly stops: readonly RotaryStopDef[];
  readonly default: StateId;
  /** Radius of the visible knob; the knob lies inside the hit footprint. */
  readonly r: number;
  /**
   * Printed scale around the knob: `arc` ticks and labels, `fan` (the first stop's label and one
   * propeller glyph per further stop, growing small to large, no dots, no numbers), or `none`.
   */
  readonly scale?: 'arc' | 'fan' | 'none';
  /**
   * Direct click spots, one per stop (R2-4.1). Present: a tap on a spot sets its stop at once and
   * the half-stepping is gone; absent: the knob steps by halves. Validated at load.
   */
  readonly spots?: readonly RotarySpotDef[];
  /** Absent means `round`; `selector-bar` is the elongated selector knob. Validated at load. */
  readonly skin?: RotarySkin;
}

/** Bus groups of the circuit breakers (UI-SPEC 01.2, Table A1). Re-checked at run time. */
export const BREAKER_GROUPS = ['essential', 'main', 'avionics', 'lower', 'strip'] as const;
export type BreakerGroup = (typeof BREAKER_GROUPS)[number];

/**
 * Circuit breaker (PNL-12, D-02, D-03). Two states, `in` (pushed in, the default) and `out`
 * (pulled). A single tap toggles. The state labels IN and OUT are accessible names only: the
 * breaker prints its static label lines and its rating, identical in both states (G-0.1).
 */
export interface CircuitBreakerDef extends ControlBase {
  readonly kind: 'circuit-breaker';
  /** Exactly [in, out]. */
  readonly states: readonly [StateDef, StateDef];
  /** Must be 'in'. */
  readonly default: StateId;
  /** Printed amp rating on the cap, for example "5" or "7½". */
  readonly rating: string;
  /** Printed label lines above the breaker; data, never computed. */
  readonly labelLines: readonly string[];
  readonly group: BreakerGroup;
  /** True only for the 24 wide hits of the lower row. */
  readonly compact?: boolean;
  /** Shifts the label centre in units (a label that would touch an outline edge). */
  readonly labelDx?: number;
}

/**
 * One key of a code-entry unit (D-11): a control-local rectangle, centre (x, y) and size (w, h),
 * centre of the control at (0, 0). `key` is one alphabet character, or 'clr' for the clear key.
 */
export interface CodeEntryKeyDef {
  readonly key: string;
  /** Static legend printed on the key (G-0.1). */
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A control-local rectangle given by its centre (x, y) and size (w, h), control centre at 0, 0. */
export interface CentredRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Upper bound of the code space of one code-entry control (RESEARCH Pitfall 7). */
export const MAX_CODE_SPACE = 4096;
/** The key id of the clear key of a code-entry control. */
export const CODE_ENTRY_CLEAR_KEY = 'clr';

/**
 * Code-entry unit (D-11, PNL-07): a keypad whose state is the whole committed code, a string of
 * `digits` characters over `alphabet`. The simplified transponder is the only user. A momentary
 * button cannot carry a digit and a rotary has at most five stops, so the code is one control:
 * the store sees only complete codes (the partial entry lives in the widget, never in the store),
 * and the legal states are every string of the right length over the alphabet, enumerated once
 * per definition and bounded by MAX_CODE_SPACE. The unit has no `states` list.
 */
export interface CodeEntryDef extends ControlBase {
  readonly kind: 'code-entry';
  /** Length of a code, 1 to 4. */
  readonly digits: number;
  /** The characters a code may use, each once. */
  readonly alphabet: string;
  /** The code at rest: `digits` characters of the alphabet. */
  readonly default: StateId;
  /** One key per alphabet character plus the clear key (CODE_ENTRY_CLEAR_KEY). */
  readonly keys: readonly CodeEntryKeyDef[];
  /** Where the readout of the code is drawn. */
  readonly display: CentredRect;
}

export type ControlDef =
  | ToggleDef
  | GuardedToggleDef
  | GuardDef
  | DetentLeverDef
  | MomentaryButtonDef
  | RotaryDef
  | CircuitBreakerDef
  | CodeEntryDef;
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

/** size to the power of digits by repeated multiplication (pure code uses no power operator). */
function codeSpace(size: number, digits: number): number {
  let space = 1;
  for (let i = 0; i < digits && space <= MAX_CODE_SPACE; i++) space *= size;
  return space;
}

/** Legal codes per code-entry definition, built once (a WeakMap keyed by the definition object). */
const CODE_STATES = new WeakMap<CodeEntryDef, readonly StateId[]>();

/**
 * Every string of `digits` characters over the alphabet, in counting order. Bounded: a definition
 * whose code space exceeds MAX_CODE_SPACE is refused before anything is built (D-11, T-03-07).
 */
function codeStates(def: CodeEntryDef): readonly StateId[] {
  const known = CODE_STATES.get(def);
  if (known !== undefined) return known;
  const chars = [...def.alphabet];
  const space = codeSpace(chars.length, def.digits);
  if (!(def.digits >= 1) || !Number.isInteger(def.digits) || !(space <= MAX_CODE_SPACE)) {
    throw new RegistryError(
      `code entry "${def.id}" has a code space of ${chars.length}^${def.digits}, above ${MAX_CODE_SPACE}`,
    );
  }
  let codes: string[] = [''];
  for (let i = 0; i < def.digits; i++) {
    codes = codes.flatMap((prefix) => chars.map((c) => prefix + c));
  }
  Object.freeze(codes);
  CODE_STATES.set(def, codes);
  return codes;
}

export function legalStates(def: ControlDef): readonly StateId[] {
  if (def.kind === 'detent-lever') return def.detents.map((d) => d.id);
  if (def.kind === 'rotary') return def.stops.map((s) => s.id);
  if (def.kind === 'code-entry') return codeStates(def);
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
  'circuit-breaker': 'cb.',
  // Keypad of the simplified transponder (D-11); cb.xpdr is the breaker of the real unit.
  'code-entry': 'kp.',
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
  if (def.skin !== undefined && !(ROTARY_SKINS as readonly string[]).includes(def.skin)) {
    throw new RegistryError(`knob "${def.id}" has unknown skin "${def.skin}"`);
  }
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
  if (def.spots !== undefined) checkRotarySpots(def, def.spots);
}

/** Spot rules (R2-4.1): one spot per stop, positive sides, inside the footprint, disjoint. */
function checkRotarySpots(def: RotaryDef, spots: readonly RotarySpotDef[]): void {
  const stopIds = new Set(def.stops.map((s) => s.id));
  const seen = new Set<StateId>();
  for (const spot of spots) {
    if (!stopIds.has(spot.stop)) {
      throw new RegistryError(`knob "${def.id}" spot names unknown stop "${spot.stop}"`);
    }
    if (seen.has(spot.stop)) {
      throw new RegistryError(`knob "${def.id}" has two spots for stop "${spot.stop}"`);
    }
    seen.add(spot.stop);
    if (![spot.x, spot.y, spot.w, spot.h].every(Number.isFinite) || !(spot.w > 0 && spot.h > 0)) {
      throw new RegistryError(
        `knob "${def.id}" spot "${spot.stop}" needs finite coordinates and positive sides`,
      );
    }
    if (
      Math.abs(spot.x) + spot.w / 2 > def.hit.w / 2 ||
      Math.abs(spot.y) + spot.h / 2 > def.hit.h / 2
    ) {
      throw new RegistryError(
        `knob "${def.id}" spot "${spot.stop}" leaves the ${def.hit.w} x ${def.hit.h} hit footprint`,
      );
    }
  }
  for (const stop of def.stops) {
    if (!seen.has(stop.id)) {
      throw new RegistryError(`knob "${def.id}" stop "${stop.id}" has no spot`);
    }
  }
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i];
      const b = spots[j];
      if (a === undefined || b === undefined) continue;
      const overlapX =
        Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const overlapY =
        Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
      if (overlapX > 1e-9 && overlapY > 1e-9) {
        throw new RegistryError(`knob "${def.id}" spots "${a.stop}" and "${b.stop}" overlap`);
      }
    }
  }
}

/**
 * Load-time rules of a code-entry unit (C-19, D-11): 1 to 4 digits, a distinct alphabet, a code
 * space of at most MAX_CODE_SPACE, a legal default, one key per alphabet character plus the clear
 * key, and keys and readout inside the hit footprint without overlapping. Runs before any legal
 * state is enumerated, so an oversized definition never allocates.
 */
function checkCodeEntry(def: CodeEntryDef): void {
  if (!Number.isInteger(def.digits) || def.digits < 1 || def.digits > 4) {
    throw new RegistryError(`code entry "${def.id}" needs 1 to 4 digits (got ${def.digits})`);
  }
  const chars = [...def.alphabet];
  if (chars.length < 2) {
    throw new RegistryError(`code entry "${def.id}" needs an alphabet of at least two characters`);
  }
  if (new Set(chars).size !== chars.length) {
    throw new RegistryError(
      `code entry "${def.id}" alphabet "${def.alphabet}" repeats a character`,
    );
  }
  const space = codeSpace(chars.length, def.digits);
  if (space > MAX_CODE_SPACE) {
    throw new RegistryError(
      `code entry "${def.id}" has a code space of ${space} (${chars.length}^${def.digits}), above ${MAX_CODE_SPACE}`,
    );
  }
  const defaultChars = [...def.default];
  if (defaultChars.length !== def.digits || !defaultChars.every((c) => chars.includes(c))) {
    throw new RegistryError(
      `code entry "${def.id}" default "${def.default}" is not a legal code of ${def.digits} characters of "${def.alphabet}"`,
    );
  }
  if (def.keys.length !== chars.length + 1) {
    throw new RegistryError(
      `code entry "${def.id}" needs ${chars.length + 1} keys (one per alphabet character and "${CODE_ENTRY_CLEAR_KEY}"), got ${def.keys.length}`,
    );
  }
  const wanted = new Set<string>([...chars, CODE_ENTRY_CLEAR_KEY]);
  const seenKeys = new Set<string>();
  for (const key of def.keys) {
    if (!wanted.has(key.key)) {
      throw new RegistryError(`code entry "${def.id}" has a key "${key.key}" outside its alphabet`);
    }
    if (seenKeys.has(key.key)) {
      throw new RegistryError(`code entry "${def.id}" has two keys "${key.key}"`);
    }
    seenKeys.add(key.key);
  }
  for (const w of wanted) {
    if (!seenKeys.has(w)) throw new RegistryError(`code entry "${def.id}" has no key "${w}"`);
  }
  const parts: { name: string; rect: CentredRect }[] = [
    ...def.keys.map((k) => ({ name: `key "${k.key}"`, rect: k })),
    { name: 'readout', rect: def.display },
  ];
  for (const { name, rect } of parts) {
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || !(rect.w > 0 && rect.h > 0)) {
      throw new RegistryError(
        `code entry "${def.id}" ${name} needs finite coordinates and positive sides`,
      );
    }
    if (
      Math.abs(rect.x) + rect.w / 2 > def.hit.w / 2 ||
      Math.abs(rect.y) + rect.h / 2 > def.hit.h / 2
    ) {
      throw new RegistryError(
        `code entry "${def.id}" ${name} leaves the ${def.hit.w} x ${def.hit.h} hit footprint`,
      );
    }
  }
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i];
      const b = parts[j];
      if (a === undefined || b === undefined) continue;
      const overlapX =
        Math.min(a.rect.x + a.rect.w / 2, b.rect.x + b.rect.w / 2) -
        Math.max(a.rect.x - a.rect.w / 2, b.rect.x - b.rect.w / 2);
      const overlapY =
        Math.min(a.rect.y + a.rect.h / 2, b.rect.y + b.rect.h / 2) -
        Math.max(a.rect.y - a.rect.h / 2, b.rect.y - b.rect.h / 2);
      if (overlapX > 1e-9 && overlapY > 1e-9) {
        throw new RegistryError(`code entry "${def.id}" ${a.name} and ${b.name} overlap`);
      }
    }
  }
}

const stripSpaces = (text: string): string => text.replace(/\s+/g, '');

function checkCircuitBreaker(def: CircuitBreakerDef): void {
  const states = def.states as readonly StateDef[];
  if (states.length !== 2 || states[0]?.id !== 'in' || states[1]?.id !== 'out') {
    throw new RegistryError(
      `breaker "${def.id}" must have exactly the states "in" then "out" (got ${states.map((s) => s.id).join(', ')})`,
    );
  }
  if (def.default !== 'in') {
    throw new RegistryError(`breaker "${def.id}" must start pushed in (default "${def.default}")`);
  }
  if (def.rating.trim() === '') {
    throw new RegistryError(`breaker "${def.id}" needs a printed rating`);
  }
  if (def.labelLines.length === 0 || def.labelLines.some((line) => line.trim() === '')) {
    throw new RegistryError(`breaker "${def.id}" needs non-empty label lines`);
  }
  if (stripSpaces(def.labelLines.join('')) !== stripSpaces(def.label)) {
    throw new RegistryError(
      `breaker "${def.id}" label lines "${def.labelLines.join(' ')}" do not match its label "${def.label}"`,
    );
  }
  if (!(BREAKER_GROUPS as readonly string[]).includes(def.group)) {
    throw new RegistryError(`breaker "${def.id}" has unknown group "${def.group}"`);
  }
  if (!(def.hit.w > 0) || !(def.hit.h > 0)) {
    throw new RegistryError(
      `breaker "${def.id}" hit ${def.hit.w} x ${def.hit.h} needs positive sides`,
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
  const flapSkin = def.skin === 'parking-flap';
  if (def.tapToggle === true && !flapSkin) {
    throw new RegistryError(`lever "${def.id}" has tapToggle but its skin is not "parking-flap"`);
  }
  if (flapSkin && def.tapToggle !== true) {
    throw new RegistryError(`lever "${def.id}" has the "parking-flap" skin but not tapToggle`);
  }
  if (def.tapToggle === true) {
    if (def.detents.length !== 2) {
      throw new RegistryError(
        `lever "${def.id}" has tapToggle and ${def.detents.length} detents (exactly 2 required)`,
      );
    }
    if (def.dragOnly === true) {
      throw new RegistryError(`lever "${def.id}" has tapToggle and is drag-only`);
    }
    if (def.markers !== undefined && def.markers.length > 0) {
      throw new RegistryError(`lever "${def.id}" has tapToggle and cannot have tap markers`);
    }
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
    // Bounded before anything enumerates the code space (C-19, T-03-07).
    if (spec.kind === 'code-entry') checkCodeEntry(spec);
    checkDistinctStates(def);
    if (spec.kind === 'detent-lever') checkDetents(spec);
    if (spec.kind === 'momentary-button') {
      checkMomentaryStates(spec);
      checkMomentaryRest(spec);
    }
    if (spec.kind === 'toggle' || spec.kind === 'guarded-toggle') checkSkinFields(spec);
    if (spec.kind === 'detent-lever') checkLeverSkin(spec);
    if (spec.kind === 'rotary') checkRotary(spec);
    if (spec.kind === 'circuit-breaker') checkCircuitBreaker(spec);
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
