// The printed checklists as an independent reference table (plan 03-13, owner decision 2026-10-23:
// checklist text is reproduced 1:1). Source: DA50 C / RG Emergency Procedures checklist, Edition 4.1
// of 2022-10-05, pages compared with the owner's photos on 2026-10-23. Nothing here is read from the
// scenario files, so a later edit of a file cannot drift from the printed wording without failing
// tests/checklist-text.test.ts. The repeat of each number at the right edge of the printed page is
// not data (C-79).

/** One row of a printed table: the number at the left, the item and the desired action at the right. */
export interface PrintedRow {
  readonly kind: 'row';
  /** A whole number, or one capital letter on the ground and take-off checklists. */
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
    heading: 'Engine Fire on Ground',
    rows: [
      { kind: 'row', number: 'A', item: 'ENGINE MASTER', action: 'OFF' },
      { kind: 'row', number: 'B', item: 'FUEL valve', action: 'OFF' },
      { kind: 'row', number: 'C', item: 'ELECT. MASTER', action: 'OFF' },
      { kind: 'comment', style: 'subheading', text: 'After Standstill' },
      { kind: 'row', number: 'D', item: 'Door', action: 'open' },
      { kind: 'row', number: 'E', item: 'Airplane', action: 'evacuate immediately' },
    ],
  },
  'elec-fire-ground': {
    form: 'table',
    heading: 'Electrical Fire with Smoke on Ground',
    rows: [
      { kind: 'row', number: 'A', item: 'ELECT. MASTER', action: 'OFF' },
      { kind: 'comment', style: 'subheading', text: 'If the Engine Is Running' },
      { kind: 'row', number: 'B', item: 'POWER lever', action: 'Ground Idle (GI)' },
      { kind: 'row', number: 'C', item: 'ENGINE MASTER', action: 'OFF' },
      { kind: 'row', number: 'D', item: 'FUEL valve', action: 'OFF (lift and turn)' },
      { kind: 'comment', style: 'subheading', text: 'When the Engine Has Stopped' },
      { kind: 'row', number: 'E', item: 'Door', action: 'open' },
      { kind: 'row', number: 'F', item: 'Airplane', action: 'evacuate immediately' },
    ],
  },
  'elec-fire-flight': {
    form: 'table',
    heading: 'Electrical Fire in Flight',
    rows: [
      {
        kind: 'comment',
        style: 'warning',
        text: 'IN THE EVENT OF SMOKE OR FIRE, PREPARE TO LAND THE AIRPLANE WITHOUT DELAY WHILE COMPLETING FIRE SUPPRESSION AND/OR SMOKE EVACUATION PROCEDURES. IF IT CANNOT BE VISUALLY VERIFIED THAT THE FIRE HAS BEEN COMPLETELY EXTINGUISHED, WHETHER THE SMOKE HAS CLEARED OR NOT, LAND IMMEDIATELY.',
      },
      { kind: 'row', number: 'A', item: 'AVIONIC MASTER', action: 'OFF' },
      {
        kind: 'comment',
        style: 'warning',
        text: 'SWITCHING OFF THE ELECT. MASTER WILL LEAD TO TOTAL FAILURE OF ALL ELECTRONIC AND ELECTRIC EQUIPMENT.',
      },
      { kind: 'row', number: 'B', item: 'ELECT. MASTER', action: 'OFF' },
      { kind: 'row', number: 'C', item: 'CIRCULATING AIR', action: 'FRESH AIR' },
      { kind: 'row', number: 'D', item: 'ECS shut-off', action: 'PULL' },
      { kind: 'row', number: 'E', item: 'Emergency Windows', action: 'OPEN if required' },
      {
        kind: 'row',
        number: 'F',
        item: 'Perform a precautionary landing on the nearest airfield.',
      },
      { kind: 'comment', style: 'subheading', text: 'When Airplane Has Stopped' },
      { kind: 'row', number: 'G', item: 'Doors', action: 'open' },
      { kind: 'row', number: 'H', item: 'Airplane', action: 'evacuate immediately' },
    ],
  },
  'icing-unintentional': {
    form: 'table',
    heading: 'Unintentional Flight Into Icing Conditions',
    rows: [
      { kind: 'comment', style: 'subheading', text: 'Unintentional Flight Into Icing Conditions' },
      {
        kind: 'row',
        number: 'A',
        item: 'Leave the icing area (by changing altitude or turning back in order to reach zones with a higher ambient temperature).',
      },
      { kind: 'row', number: 'B', item: 'PITOT/STALL HEAT', action: 'ON' },
      { kind: 'row', number: 'C', item: 'Cabin heat', action: 'ON' },
      { kind: 'row', number: 'D', item: 'Cabin air', action: 'DEFROST' },
      {
        kind: 'row',
        number: 'E',
        item: 'POWER lever',
        action:
          'increase power, in order to prevent ice build-up on the propeller blades apply power changes periodically',
      },
      { kind: 'row', number: 'F', item: 'ALTERNATE AIR', action: 'OPEN' },
      { kind: 'row', number: 'G', item: 'Alternate static', action: 'OPEN' },
      { kind: 'row', number: 'H', item: 'Emergency windows', action: 'open if required' },
      { kind: 'comment', style: 'caution', text: 'ICE BUILD-UP INCREASES THE STALLING SPEED.' },
      {
        kind: 'comment',
        style: 'caution',
        text: 'WHEN THE PITOT HEATING FAILS EXPECT LOSS OF AIRSPEED INDICATION.',
      },
      { kind: 'row', number: 'I', item: 'ATC', action: 'advise if an emergency is expected' },
    ],
  },
  'takeoff-fire-abort': {
    form: 'table',
    heading: 'Smoke and Fire During Take-Off',
    rows: [
      { kind: 'comment', style: 'subheading', text: 'If Take-Off Can Still Be Aborted' },
      { kind: 'row', number: 'A', item: 'POWER lever', action: 'Ground Idle (GI)' },
      { kind: 'row', number: 'B', item: 'ECS shut-off', action: 'PULL' },
      { kind: 'row', number: 'C', item: 'Brakes', action: 'apply - bring the airplane to a stop' },
      { kind: 'row', number: 'D', item: 'ENGINE MASTER', action: 'OFF' },
      { kind: 'row', number: 'E', item: 'FUEL valve', action: 'OFF (lift and turn)' },
      { kind: 'row', number: 'F', item: 'ELECT. MASTER', action: 'OFF' },
      { kind: 'comment', style: 'subheading', text: 'After Standstill' },
      { kind: 'row', number: 'G', item: 'Door', action: 'open' },
      { kind: 'row', number: 'H', item: 'Airplane', action: 'evacuate immediately' },
    ],
  },
  'takeoff-fire-no-abort': {
    form: 'table',
    heading: 'Smoke and Fire During Take-Off',
    rows: [
      { kind: 'comment', style: 'subheading', text: 'If Take-Off CANNOT Be Aborted' },
      {
        kind: 'comment',
        style: 'warning',
        text: 'IF, IN THE EVENT OF AN ENGINE PROBLEM OCCURRING DURING TAKE-OFF, THE TAKE-OFF CAN NO LONGER BE ABORTED AND A SAFE HEIGHT HAS NOT BEEN REACHED, THEN A STRAIGHT-AHEAD EMERGENCY LANDING SHOULD BE CARRIED OUT. DO NOT ATTEMPT TO TURN BACK TO THE AIRFIELD. TURNING BACK CAN BE FATAL. REFER TO 03-16 - ENGINE FAILURE DURING TAKE-OFF - EMERGENCY OPERATION PROCEDURE.',
      },
      { kind: 'row', number: 'A', item: 'ECS shut-off', action: 'PULL' },
      {
        kind: 'row',
        number: 'B',
        item: 'If possible, fly along a short-cut traffic circuit and land on the airfield.',
      },
      {
        kind: 'comment',
        style: 'subheading',
        text: 'After Climbing to a Height From Which the Selected Landing Area Can Be Reached Safely',
      },
      { kind: 'row', number: 'C', item: 'ENGINE MASTER', action: 'OFF' },
      { kind: 'row', number: 'D', item: 'FUEL valve', action: 'OFF' },
      { kind: 'row', number: 'E', item: 'ELECT. MASTER', action: 'OFF' },
      { kind: 'row', number: 'F', item: 'Emergency windows', action: 'open if necessary' },
      {
        kind: 'row',
        number: 'G',
        item: 'Perform an emergency landing with engine off. Allow for increased landing distance due to the flap position.',
      },
      {
        kind: 'comment',
        text: 'Refer to 03-41 - Emergency Landing with Engine Off - Emergency operation procedure.',
      },
      { kind: 'comment', style: 'subheading', text: 'When Airplane Has Stopped' },
      { kind: 'row', number: 'H', item: 'Doors', action: 'open' },
      { kind: 'row', number: 'I', item: 'Airplane', action: 'evacuate immediately' },
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
