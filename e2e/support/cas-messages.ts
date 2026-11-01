import { DA50RG_QUANTITIES } from '../../src/aircraft/da50rg/quantities';
import { DA50RG_CAS } from '../../src/aircraft/da50rg/cas';
import type { Predicate } from '../../src/scenario/schema';

// Free-panel preview values that fire CAS messages, taken from the aircraft data in node and never
// typed in (Phase 6.1, plan 01): a value inside a named band of a quantity, and the value just
// above the threshold of the ENG OIL TEMP rule. The PITOT HEAT and STALL HEAT messages come from the
// PITOT/STALL HEAT rocker, so they have no preview value.

/** A value in the middle of the named band of a quantity. */
export function insideBand(quantity: string, band: string): number {
  const def = DA50RG_QUANTITIES.get(quantity);
  if (def === undefined) throw new Error(`no quantity ${quantity}`);
  let lower = def.min;
  for (const b of def.bands) {
    if (b.id === band) return (lower + b.to) / 2;
    lower = b.to;
  }
  throw new Error(`no band ${band} on ${quantity}`);
}

/** A value just above the `gt` threshold of the quantity rule of the message. */
export function pastThreshold(messageId: string): { quantity: string; value: number } {
  const when: Predicate | undefined = DA50RG_CAS.get(messageId)?.when;
  if (when?.check !== 'quantity' || when.op !== 'gt') {
    throw new Error(`message ${messageId} is not a plain greater-than rule`);
  }
  const def = DA50RG_QUANTITIES.get(when.quantity);
  if (def === undefined) throw new Error(`no quantity ${when.quantity}`);
  return { quantity: when.quantity, value: when.value + (def.max - when.value) / 2 };
}

/** A preview query that fires the quantity-driven message ENG OIL TEMP (a warning) only. */
export function warningQuery(): string {
  const oil = pastThreshold('eng_oil_temp');
  return `${oil.quantity}:${String(oil.value)}`;
}

/** A preview query that fires the advisory FUEL TRANS only. */
export function advisoryQuery(): string {
  return `fuel_trans_active:${String(insideBand('fuel_trans_active', 'active'))}`;
}

/**
 * Preview query of the free panel that fires ENG OIL TEMP and OIL PRES (warnings), ALTN 1 FAIL
 * (caution) and FUEL TRANS (advisory). With the heat rocker turned off the PITOT HEAT and STALL
 * HEAT cautions make six messages (never ALTN 2 FAIL: a seventh would not be drawn).
 */
export function messagesQuery(): string {
  const oil = pastThreshold('eng_oil_temp');
  const entries: [string, number][] = [
    [oil.quantity, oil.value],
    ['oil_pressure_bar', insideBand('oil_pressure_bar', 'low_red')],
    ['alt1_fault', insideBand('alt1_fault', 'fault')],
    ['fuel_trans_active', insideBand('fuel_trans_active', 'active')],
  ];
  return entries.map(([id, value]) => `${id}:${String(value)}`).join(',');
}
