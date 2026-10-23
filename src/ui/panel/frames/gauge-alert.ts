import type { BandColour, QuantityId, QuantitySet } from '../../../engine/quantities';

// The alert look of an MFD gauge (plan 03-12, C-66 to C-71). The real engine page marks a reading
// in a yellow or red band with a box behind the label and another behind the value, and a pointer
// in the band colour. This file holds the palette, the band colour of a live reading (through the
// quantity data's own band lookup, so the boundary rule exists once), the tone-to-style mapping and
// the box width estimate. Pure TypeScript; it imports only engine types, no frame.

export const GREEN = '#2fd36f';
export const YELLOW = '#f2c230';
export const RED = '#f0443c';
/** The dark glass colour: the screen fill and the text on a yellow box. */
export const GLASS_DARK = '#05080b';

const TEXT_WHITE = '#ffffff';
const LABEL_GREY = '#aab3bd';

/** The tone of a gauge is the colour of the band its live value is in. */
export type GaugeTone = BandColour;

export interface GaugeAlertStyle {
  /** Whether the label and the value get a box behind them. */
  readonly boxes: boolean;
  readonly boxFill: string;
  readonly labelFill: string;
  readonly valueFill: string;
  /** The needle of an arc gauge or the marker of a bar gauge. */
  readonly pointerFill: string;
}

const PLAIN: GaugeAlertStyle = Object.freeze({
  boxes: false,
  boxFill: 'none',
  labelFill: LABEL_GREY,
  valueFill: TEXT_WHITE,
  pointerFill: TEXT_WHITE,
});

const YELLOW_STYLE: GaugeAlertStyle = Object.freeze({
  boxes: true,
  boxFill: YELLOW,
  labelFill: GLASS_DARK,
  valueFill: GLASS_DARK,
  pointerFill: YELLOW,
});

const RED_STYLE: GaugeAlertStyle = Object.freeze({
  boxes: true,
  boxFill: RED,
  labelFill: TEXT_WHITE,
  valueFill: TEXT_WHITE,
  pointerFill: RED,
});

/** Green and an unmarked range keep today's look; yellow and red box the texts (C-66). */
export function gaugeAlertStyle(tone: GaugeTone): GaugeAlertStyle {
  if (tone === 'yellow') return YELLOW_STYLE;
  if (tone === 'red') return RED_STYLE;
  return PLAIN;
}

/**
 * The tone of a reading (C-67): the colour of the band the value falls in, by the quantity set's
 * own band lookup (a value on a bound belongs to the lower band, below the minimum the first band,
 * above the maximum the last). An unknown quantity reads as green: nothing is flagged.
 */
export function toneOf(quantities: QuantitySet, id: QuantityId, value: number): GaugeTone {
  const def = quantities.get(id);
  if (def === undefined) return 'green';
  const bandId = quantities.bandOf(id, value);
  return def.bands.find((b) => b.id === bandId)?.colour ?? 'green';
}

// Box geometry (C-69). A box is a rounded rectangle (radius BOX_RADIUS) behind its text: its
// height is the font size plus BOX_EXTRA_H and its width comes from textBoxWidth plus the side
// padding on both sides.
export const BOX_RADIUS = 2;
export const BOX_EXTRA_H = 4;
export const BOX_PAD = 3;

/**
 * Advance of one character in em, letter spacing of 0.06 em included, measured once in Chromium
 * with getBBox at font size 100 (plan 03-12, C-69). The label face is the placard font B612 bold
 * (every label and unit is upper case, so only capitals, digits and a few marks are listed); the
 * readout face B612 Mono has one advance for every character.
 */
const MONO_EM = 0.71;
const PLACARD_DEFAULT_EM = 0.76;
const PLACARD_EM: Readonly<Record<string, number>> = {
  A: 0.71,
  B: 0.71,
  C: 0.66,
  D: 0.71,
  E: 0.66,
  F: 0.61,
  G: 0.71,
  H: 0.76,
  I: 0.36,
  J: 0.54,
  K: 0.66,
  L: 0.61,
  M: 0.96,
  N: 0.81,
  O: 0.86,
  P: 0.66,
  Q: 0.86,
  R: 0.71,
  S: 0.61,
  T: 0.66,
  U: 0.76,
  V: 0.72,
  W: 1.01,
  X: 0.73,
  Y: 0.67,
  Z: 0.67,
  '0': 0.71,
  '1': 0.71,
  '2': 0.71,
  '3': 0.71,
  '4': 0.71,
  '5': 0.71,
  '6': 0.71,
  '7': 0.71,
  '8': 0.71,
  '9': 0.71,
  ' ': 0.41,
  '.': 0.36,
  '-': 0.51,
  '\u00B0': 0.36,
  '%': 0.96,
};
/** Slack on top of the measurement so another engine's hinting never clips a box. */
const WIDTH_MARGIN = 1.03;

/**
 * Estimated rendered width of a text at a font size, with no measurement at render time. The
 * label of a gauge is placard text; the readout is mono text (the glass-digits class).
 */
export function textBoxWidth(text: string, fontSize: number, mono = false): number {
  let em = 0;
  for (const ch of text) em += mono ? MONO_EM : (PLACARD_EM[ch] ?? PLACARD_DEFAULT_EM);
  return em * fontSize * WIDTH_MARGIN;
}

const TONE_RANK: Readonly<Record<GaugeTone, number>> = { none: 0, green: 0, yellow: 1, red: 2 };

/** The worse of two tones: red over yellow over green (the label of a two-pointer gauge). */
export function worseTone(a: GaugeTone, b: GaugeTone): GaugeTone {
  return TONE_RANK[b] > TONE_RANK[a] ? b : a;
}
