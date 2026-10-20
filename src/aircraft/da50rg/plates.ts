// Visible plates of the DA50 RG panel as data (owner finding G-0.5). A plate is the dark
// rounded rectangle a group of controls sits on; the shell draws every plate from this list
// and tests compare a region's art and hit footprints with the plate that carries it.
// Rectangles are in the 2000 x 1300 panel space. Pure data: no imports from the UI.

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
  { id: 'centre-stack', x: 880, y: 185, w: 360, h: 375, rx: 8, regions: ['light_knobs'] },
  { id: 'deice', x: 70, y: 265, w: 200, h: 205, rx: 8, regions: ['deice', 'deice_switches'] },
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
    regions: ['flaps', 'right_panel'],
  },
  { id: 'environmental', x: 962, y: 764, w: 201, h: 250, rx: 18, regions: ['env_control'] },
  // Parking brake, cowl flap with its two lamps and the throttle on one plate below the
  // environmental control plate, as in the owner's side-view photo (G-3).
  { id: 'pedestal', x: 962, y: 1046, w: 201, h: 242, rx: 18, regions: ['pedestal'] },
];

/**
 * Vertical order of the landing gear block (owner finding G-2): the heading LANDING GEAR, the
 * speed line VLE / VLO = 162 KIAS directly under it, then the lamps and the STALL TEST / GEAR
 * TEST toggle. Baselines in the 2000 x 1300 space; one source for the shell and the tests.
 */
export const GEAR_BLOCK = { headingY: 640, speedLineY: 654 } as const;
