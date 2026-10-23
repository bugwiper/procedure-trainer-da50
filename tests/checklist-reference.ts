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
};

/** The scenario file of each reference entry, relative to the repository root. */
export const PRINTED_FILES: Readonly<Record<string, string>> = {
  'elec-altn1-fail': 'scenarios/electrical/elec-altn1-fail.toon',
};
