// The one source of the app-level disclaimer text and its version (D-17, PLT-04). Scenario files
// name a disclaimer by id; the acknowledgment dialog and the briefing print this text. A change of
// wording that matters bumps `version`, which asks every user to acknowledge again.
// Maker and avionics names appear in this text and in About only, never on the panel (brand test).
// Pure data, no DOM, no framework, no clock.

export const DISCLAIMER_IDS = ['training-aid'] as const;
export type DisclaimerId = (typeof DISCLAIMER_IDS)[number];

export interface Disclaimer {
  readonly version: number;
  readonly heading: string;
  /** Acknowledgment dialog body, one entry per paragraph. */
  readonly body: readonly string[];
  /** One line printed in the briefing. */
  readonly short: string;
}

export const DISCLAIMERS: Readonly<Record<DisclaimerId, Disclaimer>> = {
  'training-aid': {
    version: 1,
    heading: 'Training aid only',
    body: [
      'This trainer lets you rehearse emergency procedures on a 2D panel. It is not the AFM, not an approved or certified training device and not a substitute for instruction.',
      'Always fly by the AFM of your aircraft. This trainer is not affiliated with or endorsed by Diamond Aircraft Industries or Garmin.',
    ],
    short: 'Training aid only. Not a replacement for the AFM or for instruction.',
  },
};
