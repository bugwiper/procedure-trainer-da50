// Preview flags of the free panel (Phase 5, C-03): ?q=id:value,... sets start quantities and
// ?flags=name,... sets flags, so the owner and the e2e see a smoke, an ice or a spray cue before a
// scenario uses it. Pure: the parsers read a query string against the aircraft data and never
// throw; an entry that does not name a known id, or a value outside its range, is ignored. A RESET
// clears the result like any run state.

import type { QuantitySet } from '../engine/quantities';

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/** The quantities of `?q=id:value,...`: known ids with a number inside their range, the rest ignored. */
export function parsePreviewQuantities(
  search: string,
  quantities: QuantitySet,
): Readonly<Record<string, number>> {
  const raw = new URLSearchParams(search).get('q');
  const found: Record<string, number> = {};
  if (raw === null) return found;
  for (const entry of raw.split(',')) {
    const parts = entry.split(':');
    const [id, text] = parts;
    if (parts.length !== 2 || id === undefined || text === undefined) continue;
    const def = quantities.get(id);
    if (def === undefined || !NUMBER_PATTERN.test(text)) continue;
    const value = Number(text);
    if (value < def.min || value > def.max) continue;
    found[id] = value;
  }
  return found;
}

/** The flags of `?flags=name,...`: names in `known` only, each true. */
export function parsePreviewFlags(
  search: string,
  known: readonly string[],
): Readonly<Record<string, boolean>> {
  const raw = new URLSearchParams(search).get('flags');
  const found: Record<string, boolean> = {};
  if (raw === null) return found;
  for (const name of raw.split(',')) {
    if (known.includes(name)) found[name] = true;
  }
  return found;
}
