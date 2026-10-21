// Visible plates of the DA50 RG panel as data (owner finding G-0.5). A plate is the dark
// rounded rectangle a group of controls sits on; the shell draws every plate from this list
// and tests compare a region's art and hit footprints with the plate that carries it.
// Rectangles are in the 2180 x 1300 panel space (phase 01.1 rectangles lie left of x 1980).
// Pure data: no imports from the UI.

export interface PlateDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
  /** Ids of the zoom regions whose art must lie on this plate. */
  readonly regions: readonly string[];
}

export const PLATES: readonly PlateDef[] = [
  { id: 'lights-recess', x: 940, y: 36, w: 360, h: 134, rx: 12, regions: ['lights'] },
  // Centre stack (phase 01.2 plan 06): dimmer knobs, the PFD right knob column, the audio panel and
  // the backup EFIS. Ends x 1160 (the autopilot unit plate starts at 1162) and y 575 (the gear
  // plate starts at 580).
  {
    id: 'centre-stack',
    x: 875,
    y: 185,
    w: 285,
    h: 390,
    rx: 8,
    regions: ['light_knobs', 'pfd_bezel_right', 'audio_panel', 'standby_efis'],
  },
  // Autopilot unit right of the centre stack: starts 2 units after it (x 1162) and ends y 606, two
  // units above the flap strip plate (608).
  { id: 'ap-unit', x: 1162, y: 185, w: 89, h: 421, rx: 8, regions: ['autopilot_panel'] },
  // Knob column left of the PFD bezel (346), 2 units clear of it; the bezel colour is its fill.
  { id: 'pfd-left-unit', x: 272, y: 185, w: 72, h: 421, rx: 8, regions: ['pfd_bezel_left'] },
  // Knob column right of the MFD bezel (ends 1780), left of the bus plate (1874).
  { id: 'mfd-right-unit', x: 1782, y: 185, w: 84, h: 421, rx: 8, regions: ['mfd_bezel_right'] },
  // De-ice unit (plan 21, owner finding G-1): taller than before, the upper block (MAX, mode toggle,
  // lamps, ALTERNATE) sits above the switch rows. The engine plate below starts at 474.
  { id: 'deice', x: 80, y: 205, w: 180, h: 265, rx: 8, regions: ['deice', 'deice_switches'] },
  // Enlarged upward from y 485 (G-5): FADEC and its label sit higher than the old plate top.
  { id: 'engine', x: 70, y: 474, w: 200, h: 141, rx: 8, regions: ['engine_controls'] },
  { id: 'strip-switch-row', x: 40, y: 620, w: 796, h: 125, rx: 8, regions: ['switch_bank'] },
  // Raised to 580 so the gear lever footprint (top 581) and the GEAR name above the knob lie on
  // it (G-2). The top left corner (x 836 to 873) then runs under the PFD bezel, which ends at
  // 583: the shell draws this plate below the bezels so the bezel stays whole. LEVEL (centre
  // x 1099) lies fully on this plate and no seam crosses it (G-4, G-6).
  {
    id: 'strip-gear',
    x: 836,
    y: 580,
    w: 314,
    h: 165,
    rx: 8,
    regions: ['landing_gear', 'level'],
  },
  // Raised to the top of the flap art, 608 where the softkey region ends (G-4). The seam at
  // 1150 is clear of LEVEL and of the RUBIN mark at x 1232.
  {
    id: 'strip-flaps',
    x: 1150,
    y: 608,
    w: 680,
    h: 137,
    rx: 8,
    regions: ['flaps', 'right_panel', 'cb_strip'],
  },
  // Bus panel at the far right of the widened space (phase 01.2, Table B2): the three bus regions
  // sit on it; the lower row breakers and the flap strip breakers have their own regions. It keeps
  // 6 units to the face plate edge (x 2160). cb_strip lies on the flap strip plate above.
  {
    id: 'bus-panel',
    x: 1874,
    y: 205,
    w: 280,
    h: 540,
    rx: 8,
    regions: ['cb_essential', 'cb_main', 'cb_low'],
  },
  // Environmental control plate as in the owner's side-view photo (G-3): DIRECTION and
  // TEMPERATURE side by side, FAN under DIRECTION, CIRCULATING AIR across the bottom. The plate
  // ends at 1036, ten units above the pedestal plate.
  {
    id: 'environmental',
    x: 962,
    y: 752,
    w: 201,
    h: 284,
    rx: 18,
    regions: ['env_control', 'env_circ'],
  },
  // Parking brake, cowl flap with its two lamps and the throttle on one plate below the
  // environmental control plate, as in the owner's side-view photo (G-3).
  { id: 'pedestal', x: 962, y: 1046, w: 201, h: 242, rx: 18, regions: ['pedestal'] },
];

/** One outlined group box of a plate; its title cuts the top edge (static shell art). */
export interface GroupBoxDef {
  readonly id: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The four group boxes of the environmental control plate (owner finding G-3), global units. */
export const ENV_BOXES: readonly GroupBoxDef[] = [
  { id: 'direction', title: 'DIRECTION', x: 970, y: 776, w: 98, h: 108 },
  { id: 'temperature', title: 'TEMPERATURE', x: 1076, y: 776, w: 80, h: 206 },
  { id: 'fan', title: 'FAN', x: 970, y: 892, w: 98, h: 90 },
  { id: 'circulating-air', title: 'CIRCULATING AIR', x: 970, y: 990, w: 186, h: 40 },
];

/** Title of the whole environmental control plate and its centre, above the group boxes. */
export const ENV_TITLE = { text: 'ENVIRONMENTAL CONTROL', x: 1062, y: 766 } as const;

/**
 * Vertical order of the landing gear block (owner finding G-2): the heading LANDING GEAR, the
 * speed line VLE / VLO = 162 KIAS directly under it, then the lamps and the STALL TEST / GEAR
 * TEST toggle. Baselines in the 2180 x 1300 space; one source for the shell and the tests.
 */
export const GEAR_BLOCK = { headingY: 640, speedLineY: 654 } as const;

/** One heading printed on a plate inside a white outline frame (static shell art). */
export interface PlateHeadingDef {
  readonly id: string;
  /** Id of the plate the heading sits on. */
  readonly plate: string;
  readonly text: string;
  /** The outline frame, global units. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
  /** Font size on the panel scale; the text is centred in the frame. */
  readonly size: 6 | 8;
}

/**
 * A curved bracket line over a group of controls with the heading in a gap of the line (plan 29,
 * R2-5.2): the line runs at `y` from `x1` to `x2` with rounded corners of `radius`, a stub of
 * length `drop` goes down at each end, and the centred `title` interrupts the line. Global units.
 */
export interface BracketGroupDef {
  readonly id: string;
  /** Id of the plate the group sits on. */
  readonly plate: string;
  readonly title: string;
  /** Font size of the title on the panel scale. */
  readonly size: 6 | 8;
  readonly x1: number;
  readonly x2: number;
  /** Height of the horizontal line. */
  readonly y: number;
  /** Length of the two stubs going down from the line. */
  readonly drop: number;
  /** Radius of the two rounded corners. */
  readonly radius: number;
}

/** Baseline of a bracket title below its line: the line runs through the middle of the glyphs. */
export const BRACKET_TITLE_DROP = 3;

/** The bracket groups of the engine strip (plan 29): FADEC over its switch and button. */
export const BRACKET_GROUPS: readonly BracketGroupDef[] = [
  {
    id: 'fadec',
    plate: 'engine',
    title: 'FADEC',
    size: 8,
    x1: 100,
    x2: 236,
    y: 479,
    drop: 6,
    radius: 3,
  },
];

/** Outline colour and width of a heading frame. */
export const HEADING_FRAME = { stroke: '#e6e9ed', width: 1.2 } as const;

/**
 * Headings of plates. The de-ice unit reads DE ICE (no hyphen) in a white outlined frame between
 * the MAX label and the top of the plate (owner finding G-1, plan 22).
 */
export const PLATE_HEADINGS: readonly PlateHeadingDef[] = [
  { id: 'deice', plate: 'deice', text: 'DE ICE', x: 118, y: 209, w: 64, h: 16, rx: 5, size: 8 },
];
