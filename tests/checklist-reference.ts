// The printed checklists as an independent reference table (plan 03-13, owner decision 2026-10-23:
// checklist text is reproduced 1:1). Source: DA50 C / RG Emergency Procedures checklist booklet,
// Edition 4.1 of 2022-10-05, pages compared with the owner's photos on 2026-10-23 and 2026-10-28
// (the fire, take-off and icing pages 16, 17, 18 and 23 follow the booklet: numbers, not the
// letters of the AFM pages). Nothing here is read from the
// scenario files, so a later edit of a file cannot drift from the printed wording without failing
// tests/checklist-text.test.ts. The repeat of each number at the right edge of the printed page is
// not data (C-79).

/** One row of a printed table: the number at the left, the item and the desired action at the right. */
export interface PrintedRow {
  readonly kind: 'row';
  /** A whole number (the booklet counts with numbers; the type still allows one capital letter). */
  readonly number?: number | string;
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
  /** An italic sub-heading, or a WARNING or CAUTION block with its printed word. */
  readonly style?: 'subheading' | 'warning' | 'caution';
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
  'eng-fire-ground': {
    form: 'table',
    heading: 'ENGINE FIRE ON GROUND',
    rows: [
      { kind: 'row', number: 1, item: 'Engine master', action: 'OFF' },
      { kind: 'row', number: 2, item: 'Fuel valve', action: 'OFF' },
      { kind: 'row', number: 3, item: 'Electric master', action: 'OFF' },
      { kind: 'comment', text: 'After standstill and when engine stopped:' },
      { kind: 'row', number: 4, item: 'Doors', action: 'OPEN' },
      { kind: 'comment', text: 'Evacuate' },
    ],
  },
  'elec-fire-ground': {
    form: 'table',
    heading: 'ELECTRIC FIRE / SMOKE ON GROUND',
    rows: [
      { kind: 'row', number: 1, item: 'Electric master', action: 'OFF' },
      { kind: 'row', number: 2, item: 'Power lever', action: 'GROUND IDLE (GI)' },
      { kind: 'row', number: 3, item: 'Fuel valve', action: 'OFF' },
      { kind: 'row', number: 4, item: 'Engine master', action: 'OFF' },
      { kind: 'comment', text: 'After standstill and when engine stopped:' },
      { kind: 'row', number: 5, item: 'Doors', action: 'OPEN' },
      { kind: 'comment', text: 'Evacuate' },
    ],
  },
  'takeoff-fire-abort': {
    form: 'table',
    heading: 'FIRE / SMOKE DURING ABORTED TKOF',
    rows: [
      { kind: 'row', number: 1, item: 'Power lever', action: 'GROUND IDLE (GI)' },
      { kind: 'row', number: 2, item: 'ECS shut-off', action: 'PULL' },
      { kind: 'row', number: 3, item: 'Brakes', action: 'APPLY' },
      { kind: 'row', number: 4, item: 'Fuel valve', action: 'OFF' },
      { kind: 'row', number: 5, item: 'Engine master', action: 'OFF' },
      { kind: 'row', number: 6, item: 'Electric master', action: 'OFF' },
      { kind: 'comment', text: 'After standstill and when engine stopped:' },
      { kind: 'row', number: 7, item: 'Doors', action: 'OPEN' },
      { kind: 'comment', text: 'Evacuate' },
    ],
  },
  'takeoff-fire-no-abort': {
    form: 'table',
    heading: 'FIRE / SMOKE DURING CONTINUED TKOF',
    rows: [
      { kind: 'row', number: 1, item: 'ECS shut-off', action: 'PULL' },
      { kind: 'comment', text: 'If possible climb to safe height and land ASAP' },
      { kind: 'comment', text: 'When landing assured:' },
      { kind: 'row', number: 2, item: 'Engine master', action: 'OFF' },
      { kind: 'row', number: 3, item: 'Fuel valve', action: 'OFF' },
      { kind: 'row', number: 4, item: 'Electric master', action: 'OFF' },
      { kind: 'row', number: 5, item: 'Emergency front windows', action: 'OPEN as necessary' },
      { kind: 'comment', text: 'Carry out:' },
      {
        kind: 'comment',
        text: 'EMERGENCY LANDING (ENGINE OFF)',
        boxed: true,
        reference: '(page 9)',
      },
      { kind: 'comment', text: 'After standstill and when engine stopped:' },
      { kind: 'row', number: 6, item: 'Doors', action: 'OPEN' },
      { kind: 'comment', text: 'Evacuate' },
    ],
  },
  'elec-fire-flight': {
    form: 'table',
    heading: 'ELECTRIC FIRE WITH SMOKE IN FLIGHT',
    rows: [
      {
        kind: 'comment',
        text: 'If Oxygen System is installed and flight performed above 10,000ft:',
      },
      { kind: 'row', number: 1, item: '** Oxygen System', action: 'OFF' },
      { kind: 'row', number: 2, item: '** Emergency Descent', action: 'INITIATE' },
      { kind: 'comment', text: 'Continue:' },
      { kind: 'row', number: 3, item: 'Avionic master', action: 'OFF' },
      { kind: 'row', number: 4, item: 'Electric master', action: 'OFF' },
      { kind: 'row', number: 5, item: 'ECS - circulating air', action: 'FRESH AIR' },
      { kind: 'row', number: 6, item: 'ECS shut-off', action: 'PULL' },
      { kind: 'row', number: 7, item: 'Emergency front windows', action: 'OPEN as necessary' },
      { kind: 'comment', text: 'Land immediately' },
      { kind: 'comment', text: 'Consider and be prepared for:' },
      {
        kind: 'comment',
        text: 'EMERGENCY LANDING (ENGINE OFF)',
        boxed: true,
        reference: '(page 9)',
      },
      { kind: 'comment', text: 'After standstill and when engine stopped:' },
      { kind: 'row', number: 8, item: 'Doors', action: 'OPEN' },
      { kind: 'comment', text: 'Evacuate' },
    ],
  },
  'icing-unintentional': {
    form: 'table',
    heading: 'UNINTENTIONAL FLIGHT INTO ICING',
    rows: [
      { kind: 'comment', text: 'Leave icing area, inform ATC, continue with item 1' },
      {
        kind: 'comment',
        text: '* INADVERTENT ICING ENCOUNTER & * EXCESSIVE ICE ACCUMULATION',
      },
      { kind: 'row', number: 1, item: '* Ice-protection system', action: 'HI + MAX' },
      { kind: 'row', number: 2, item: '* Prop De-Ice', action: 'ON' },
      { kind: 'row', number: 3, item: 'Pitot/Stall heat', action: 'ON' },
      { kind: 'row', number: 4, item: '* Ice light', action: 'ON as required' },
      { kind: 'row', number: 5, item: 'ECS - Cabin heat', action: 'ON' },
      { kind: 'row', number: 6, item: 'ECS - Cabin air', action: 'DEFROST' },
      { kind: 'row', number: 7, item: 'Power lever', action: 'INCREASE, change periodically' },
      { kind: 'row', number: 8, item: 'Alternate air', action: 'OPEN' },
      { kind: 'row', number: 9, item: '* Windshield de-ice', action: 'USE AS APPROPRIATE' },
      { kind: 'row', number: 10, item: 'Emergency front windows', action: 'OPEN as required' },
      { kind: 'comment', text: '* If ice-protection does not work properly:' },
      { kind: 'comment', text: 'Continue with ICE PROTECTION FAILURE' },
      { kind: 'comment', text: '* ICE PROTECTION FAILURE' },
      { kind: 'comment', text: 'Leave icing conditions' },
      { kind: 'row', number: 1, item: 'Airplane control stick', action: 'Grasp firmly' },
      { kind: 'row', number: 2, item: 'AP DISC switch', action: 'PRESS' },
      { kind: 'row', number: 3, item: 'Airspeed', action: '94 to 152 KIAS (172 KTAS) until final' },
      { kind: 'row', number: 4, item: 'Flaps', action: 'UP for landing' },
      { kind: 'row', number: 5, item: 'Approach speed', action: 'per table' },
      { kind: 'comment', text: 'Flaps | < 1600 kg | < 1800 kg | > 1800 kg' },
      { kind: 'comment', text: 'UP | 86 | 92 | 96' },
      { kind: 'row', number: 6, item: 'Landing distance', action: 'according AFM abnormal flaps' },
    ],
  },
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
  'eng-fire-ground': 'scenarios/fire/eng-fire-ground.toon',
  'elec-fire-ground': 'scenarios/fire/elec-fire-ground.toon',
  'elec-fire-flight': 'scenarios/fire/elec-fire-flight.toon',
  'icing-unintentional': 'scenarios/icing/icing-unintentional.toon',
  'takeoff-fire-abort': 'scenarios/fire/takeoff-fire-abort.toon',
  'takeoff-fire-no-abort': 'scenarios/fire/takeoff-fire-no-abort.toon',
  'elec-altn1-fail': 'scenarios/electrical/elec-altn1-fail.toon',
  'elec-altn2-fail': 'scenarios/electrical/elec-altn2-fail.toon',
  'eng-fire-in-flight': 'scenarios/engine/eng-fire-in-flight.toon',
  'eng-oil-temp-green': 'scenarios/engine/eng-oil-temp-green.toon',
};
