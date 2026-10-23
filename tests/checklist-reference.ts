// The printed checklists as an independent reference table (plan 03-13, owner decision 2026-10-23:
// checklist text is reproduced 1:1). Source: DA50 C / RG Emergency Procedures checklist, Edition 4.1
// of 2022-10-05, pages compared with the owner's photos on 2026-10-23. Nothing here is read from the
// scenario files, so a later edit of a file cannot drift from the printed wording without failing
// tests/checklist-text.test.ts. The repeat of each number at the right edge of the printed page is
// not data (C-79).

/** One row of a printed table: the number at the left, the item and the desired action at the right. */
export interface PrintedRow {
  readonly kind: 'row';
  readonly number?: number;
  readonly item: string;
  readonly action?: string;
  /** True for the one row that is not printed (an own addition kept as a graded step). */
  readonly own?: true;
}

/** A full-width printed line between rows; `reference` is the right-hand text of a boxed line. */
export interface PrintedComment {
  readonly kind: 'comment';
  readonly text: string;
  readonly boxed?: true;
  readonly reference?: string;
}

export interface PrintedTable {
  readonly form: 'table';
  readonly heading: string;
  readonly message?: string;
  readonly rows: readonly PrintedItem[];
}

export type PrintedItem = PrintedRow | PrintedComment;

/** A line of a printed outline with its marker and the lines nested below it. */
export interface PrintedOutlineItem {
  readonly text: string;
  readonly marker?: string;
  readonly children?: readonly PrintedOutlineItem[];
}

export interface PrintedOutline {
  readonly form: 'outline';
  readonly heading: string;
  readonly message?: string;
  readonly items: readonly PrintedOutlineItem[];
}

export type PrintedChecklist = PrintedTable | PrintedOutline;

/** The printed checklists by scenario id. */
export const PRINTED: Readonly<Record<string, PrintedChecklist>> = {
  'elec-altn1-fail': {
    form: 'table',
    heading: 'ALTN 1 FAIL',
    message: 'ALTERNATOR 1 HAS FAILED',
    rows: [
      { kind: 'row', number: 1, item: 'Circuit breaker', action: 'check IN' },
      { kind: 'row', number: 2, item: 'Alternator 1', action: 'OFF' },
      { kind: 'row', number: 3, item: 'Essential bus', action: 'ON' },
      { kind: 'row', number: 4, item: 'Bus voltage', action: 'MONITOR' },
      {
        kind: 'comment',
        text: 'Terminate NVFR/IFR-flight and land at nearest suitable airfield.',
      },
      { kind: 'comment', text: 'Leave icing conditions.' },
    ],
  },
  'elec-altn2-fail': {
    form: 'table',
    heading: 'ALTN 2 FAIL',
    message: 'ALTERNATOR 2 HAS FAILED',
    rows: [
      { kind: 'row', number: 1, item: 'Circuit breaker', action: 'check IN' },
      { kind: 'row', number: 2, item: 'Alternator 2', action: 'OFF' },
      { kind: 'row', number: 3, item: 'Bus voltage', action: 'MONITOR' },
      {
        kind: 'comment',
        text: 'Terminate NVFR/IFR-flight and land at nearest suitable airfield.',
      },
      { kind: 'comment', text: 'Leave icing conditions.' },
    ],
  },
  'eng-fire-in-flight': {
    form: 'table',
    heading: 'ENGINE FIRE IN FLIGHT',
    rows: [
      { kind: 'row', number: 1, item: 'ECS circulating air', action: 'FRESH AIR' },
      { kind: 'row', number: 2, item: 'ECS shut-off', action: 'PULL' },
      { kind: 'comment', text: 'Select appropriate emergency landing area' },
      { kind: 'row', number: 3, item: 'Engine master', action: 'OFF' },
      { kind: 'row', number: 4, item: 'Fuel valve', action: 'OFF' },
      { kind: 'row', number: 5, item: 'Electric master', action: 'OFF' },
      { kind: 'row', number: 6, item: 'Airspeed', action: 'AS REQUIRED / CONSIDER HIGHER' },
      { kind: 'row', number: 7, item: 'Emergency front windows', action: 'OPEN as necessary' },
      { kind: 'comment', text: 'Carry Out:' },
      {
        kind: 'comment',
        text: 'EMERGENCY LANDING (ENGINE OFF)',
        boxed: true,
        reference: '(page 9)',
      },
      { kind: 'comment', text: 'After standstill and when engine stopped:' },
      { kind: 'row', number: 8, item: 'Doors', action: 'OPEN' },
      { kind: 'comment', text: 'Evacuate' },
      // The one row that is not printed: the optional squawk step stays graded (C-76).
      { kind: 'row', item: 'Transponder: squawk 7700', own: true },
    ],
  },
  'eng-oil-temp-green': {
    form: 'outline',
    heading: 'ENG OIL TEMP',
    message: 'OIL TEMPERATURE HIGH',
    items: [
      {
        text: 'Check oil pressure',
        marker: 'arrow',
        children: [
          {
            text: 'If too low:',
            marker: 'diamond_arrow',
            children: [
              { text: 'Reduce power', marker: 'double_arrow' },
              { text: 'Open cowl flap', marker: 'double_arrow' },
              { text: 'Be prepared for loss of oil and engine failure', marker: 'double_arrow' },
              // A continuation line of the printed page: no marker.
              { text: 'Be prepared for emergency landing' },
            ],
          },
          {
            text: 'If in green range:',
            marker: 'diamond',
            children: [
              { text: 'Reduce power', marker: 'double_arrow' },
              { text: 'Open cowl flap', marker: 'double_arrow' },
              { text: 'Increase airspeed', marker: 'double_arrow' },
              { text: 'Check oil temp in green range', marker: 'double_arrow' },
              {
                text: 'If not returning to green range:',
                marker: 'circle',
                // Lower case l, as printed.
                children: [{ text: 'land at nearest suitable airfield', marker: 'square' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** The scenario file of each reference entry, relative to the repository root. */
export const PRINTED_FILES: Readonly<Record<string, string>> = {
  'elec-altn1-fail': 'scenarios/electrical/elec-altn1-fail.toon',
  'elec-altn2-fail': 'scenarios/electrical/elec-altn2-fail.toon',
  'eng-fire-in-flight': 'scenarios/engine/eng-fire-in-flight.toon',
  'eng-oil-temp-green': 'scenarios/engine/eng-oil-temp-green.toon',
};
