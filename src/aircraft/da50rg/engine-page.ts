// The layout of the MFD engine page as data (Phase 6, plan 02, E-01): three columns of boxes, each
// with an id, a kind and a rectangle in the local space of the MFD region (495 x 367; the content
// zone is x 4 to 491 and y 30 to 343, GLASS.content in avionics.ts). The frame draws exactly what is
// listed here and holds no page coordinate of its own; a box that moves is an edit of this table.
// Every rectangle is absolute (not relative to its parent box). Labels are static text on the glass
// in capitals (docs/PANEL-LABELS.md); only numbers, pointers and colours move (owner rule G-0).
// The geometry follows the layout of the real page and is an owner review item (PANEL-REVIEW.md).
// Data only: no AFM wording.

export interface PageRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Base {
  readonly id: string;
  readonly rect: PageRect;
}

/** An arc gauge: its centre and radius lie inside the cell rectangle. */
export interface ArcEntry extends Base {
  readonly kind: 'arc';
  readonly label: string;
  readonly quantity: string;
  readonly decimals: number;
  readonly centre: { readonly x: number; readonly y: number };
  readonly radius: number;
}

/** A one-pointer bar; `unit: false` prints the number alone, as every bar of the real page does. */
export interface BarEntry extends Base {
  readonly kind: 'bar';
  readonly label: string;
  readonly quantity: string;
  readonly decimals: number;
  readonly unit: boolean;
}

/** The two-pointer bar: pointer 1 above and pointer 2 below the bar, each with its own quantity. */
export interface DualEntry extends Base {
  readonly kind: 'dual';
  readonly label: string;
  readonly quantity: string;
  readonly second: string;
  readonly decimals: number;
  /** The marks inside the two pointers. */
  readonly marks: readonly [string, string];
  /** Numerals (with a tick each) under the bar; absent for none. */
  readonly scale?: readonly number[];
}

/** A framed box with its title cut into the top edge. */
export interface FrameEntry extends Base {
  readonly kind: 'frame';
  readonly title: string;
  readonly rows: readonly PageEntry[];
}

/** The fuel flow row: the label at the left, the number at the right. */
export interface FlowEntry extends Base {
  readonly kind: 'flow';
  readonly label: string;
  readonly quantity: string;
  readonly decimals: number;
}

/** The fuel calculator sub-box: remain, used, endurance and range. */
export interface CalculatorEntry extends Base {
  readonly kind: 'calculator';
  readonly title: string;
  readonly labels: readonly [string, string, string, string];
}

/** The rudder trim scale: ticks, a pointer from the quantity and the end marks. */
export interface TrimEntry extends Base {
  readonly kind: 'trim';
  readonly quantity: string;
  readonly marks: readonly [string, string];
}

/** The de-ice endurance sub-box: the Norm and the High endurance of the de-ice quantity. */
export interface EnduranceEntry extends Base {
  readonly kind: 'endurance';
  readonly title: string;
  readonly quantity: string;
  readonly labels: readonly [string, string];
}

/** The total service row: the number and its unit text. */
export interface ServiceEntry extends Base {
  readonly kind: 'service';
  readonly quantity: string;
  readonly decimals: number;
  readonly unit: string;
}

export type PageEntry =
  | ArcEntry
  | BarEntry
  | DualEntry
  | FrameEntry
  | FlowEntry
  | CalculatorEntry
  | TrimEntry
  | EnduranceEntry
  | ServiceEntry;

export interface PageColumn {
  readonly id: 'left' | 'middle' | 'right';
  readonly entries: readonly PageEntry[];
}

const ARC_CELL_H = 92;
/** The arc centre lies this far below the top of its cell (caption and number sit below the arc). */
const ARC_CENTRE_DY = 40;
const ARC_RADIUS = 34;
const BAR_H = 33;

const arc = (
  id: string,
  label: string,
  quantity: string,
  decimals: number,
  x: number,
  w: number,
): ArcEntry => ({
  id,
  kind: 'arc',
  label,
  quantity,
  decimals,
  rect: { x, y: 32, w, h: ARC_CELL_H },
  centre: { x: x + w / 2, y: 32 + ARC_CENTRE_DY },
  radius: ARC_RADIUS,
});

const bar = (
  id: string,
  label: string,
  quantity: string,
  decimals: number,
  rect: PageRect,
  unit = false,
): BarEntry => ({ id, kind: 'bar', label, quantity, decimals, unit, rect });

export const ENGINE_PAGE: readonly PageColumn[] = [
  {
    id: 'left',
    entries: [
      arc('load', 'Load', 'load_pct', 0, 10, 150),
      bar('oil_pres', 'Oil pres', 'oil_pressure_bar', 1, { x: 12, y: 128, w: 146, h: BAR_H }),
      bar('oil_temp', 'Oil temp', 'oil_temp_c', 0, { x: 12, y: 161, w: 146, h: BAR_H }),
      bar('coolant_temp', 'Coolant temp', 'coolant_temp_c', 0, {
        x: 12,
        y: 194,
        w: 146,
        h: BAR_H,
      }),
      bar('gearbox_temp', 'Gearbox temp', 'gearbox_temp_c', 0, {
        x: 12,
        y: 227,
        w: 146,
        h: BAR_H,
      }),
      {
        id: 'rudder_trim',
        kind: 'frame',
        title: 'RUDDER TRIM',
        rect: { x: 10, y: 266, w: 150, h: 50 },
        rows: [
          {
            id: 'trim',
            kind: 'trim',
            quantity: 'rudder_trim_pct',
            marks: ['L', 'R'],
            rect: { x: 16, y: 274, w: 138, h: 36 },
          },
        ],
      },
    ],
  },
  {
    id: 'middle',
    entries: [
      arc('rpm', 'RPM', 'rpm', 0, 170, 154),
      {
        id: 'fuel',
        kind: 'frame',
        title: 'FUEL',
        rect: { x: 170, y: 128, w: 154, h: 212 },
        rows: [
          {
            id: 'fuel_qty',
            kind: 'dual',
            label: 'Fuel qty',
            quantity: 'fuel_qty_lh_gal',
            second: 'fuel_qty_rh_gal',
            decimals: 0,
            marks: ['L', 'R'],
            scale: [0, 5, 10, 15, 20, 25],
            rect: { x: 176, y: 134, w: 142, h: 52 },
          },
          {
            id: 'fuel_temp',
            kind: 'dual',
            label: 'Fuel temp',
            quantity: 'fuel_temp_lh_c',
            second: 'fuel_temp_rh_c',
            decimals: 0,
            marks: ['L', 'R'],
            rect: { x: 176, y: 188, w: 142, h: 42 },
          },
          bar('fuel_press', 'Fuel press', 'fuel_pressure_bar', 1, {
            x: 176,
            y: 232,
            w: 142,
            h: BAR_H,
          }),
          {
            id: 'fuel_flow',
            kind: 'flow',
            label: 'FFlow GPH',
            quantity: 'fuel_flow_gph',
            decimals: 1,
            rect: { x: 176, y: 267, w: 142, h: 14 },
          },
          {
            id: 'fuel_calc',
            kind: 'calculator',
            title: 'FUEL CALCULATOR',
            labels: ['GALLONS REMAIN', 'GALLONS USED', 'ENDURANCE', 'RANGE NM'],
            rect: { x: 176, y: 284, w: 142, h: 54 },
          },
        ],
      },
    ],
  },
  {
    id: 'right',
    entries: [
      {
        id: 'electrical',
        kind: 'frame',
        title: 'ELECTRICAL',
        rect: { x: 332, y: 36, w: 154, h: 89 },
        rows: [
          {
            id: 'amps',
            kind: 'dual',
            label: 'Amps',
            quantity: 'alt1_amps',
            second: 'alt2_amps',
            decimals: 0,
            marks: ['1', '2'],
            rect: { x: 338, y: 46, w: 142, h: 42 },
          },
          bar('volts', 'Volts', 'bus_volts', 1, { x: 338, y: 88, w: 142, h: BAR_H }),
        ],
      },
      {
        id: 'oxygen',
        kind: 'frame',
        title: 'OXYGEN',
        rect: { x: 332, y: 131, w: 154, h: 50 },
        rows: [bar('oxygen_psi', 'Psi', 'oxygen_psi', 0, { x: 338, y: 137, w: 142, h: BAR_H })],
      },
      {
        id: 'deice',
        kind: 'frame',
        title: 'DE-ICE',
        rect: { x: 332, y: 187, w: 154, h: 96 },
        rows: [
          bar('deice_qty', 'Us gal', 'deice_qty_gal', 1, { x: 338, y: 193, w: 142, h: BAR_H }),
          {
            id: 'deice_endurance',
            kind: 'endurance',
            title: 'ENDURANCE',
            quantity: 'deice_qty_gal',
            labels: ['NORM:', 'HIGH:'],
            rect: { x: 338, y: 230, w: 142, h: 46 },
          },
        ],
      },
      {
        id: 'service',
        kind: 'frame',
        title: 'TOTAL SERVICE',
        rect: { x: 332, y: 289, w: 154, h: 34 },
        rows: [
          {
            id: 'service_hours',
            kind: 'service',
            quantity: 'service_hours',
            decimals: 1,
            unit: 'HRS',
            rect: { x: 338, y: 299, w: 142, h: 18 },
          },
        ],
      },
    ],
  },
];
