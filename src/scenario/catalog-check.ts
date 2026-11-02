// The pack-level cross-check of the checklist catalog (Phase 7, plan 07-06, R-16, lint L29 and L30),
// run by `npm run validate` and by a unit test, never when a scenario is opened: a paid pack must
// not need an entry in the public catalog, and a missing entry never throws at run time (the
// application lists an unknown scenario after the entries of the last group). L29: every shipped
// scenario is the `ref` of an entry, and every `ref` names a manifest entry of a pack that was
// checked. L30: the tag of a linked entry equals the `checklist.heading` of its scenario (the
// scenario title when the file has no heading). The repeated use of one `ref` is already refused by
// defineCatalog. Pure TypeScript, no file system, no DOM, no clock.

import type { AircraftEnv } from '../engine/env';

/** One scenario of a checked pack as the catalog check needs it. */
export interface ShippedScenario {
  readonly pack: string;
  /** The scenario id of the manifest entry. */
  readonly id: string;
  /** The checklist heading (else the title) of the file; null when the file failed its own checks. */
  readonly heading: string | null;
  /** Repo-relative scenario file, and the place of its heading (else of its id). */
  readonly file: string;
  readonly line: number;
  readonly col: number;
}

export interface CatalogIssue {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
}

/**
 * L29 and L30 for the packs that were checked (`packs` lists their ids; a `ref` into a pack that
 * was not checked is not judged, so validating one folder alone does not report the others).
 */
export function checkCatalog(
  env: AircraftEnv,
  shipped: readonly ShippedScenario[],
  packs: ReadonlySet<string>,
): CatalogIssue[] {
  const out: CatalogIssue[] = [];
  const catalog = env.catalog;
  for (const s of shipped) {
    const place = catalog.entryOf({ pack: s.pack, scenario: s.id });
    if (place === undefined) {
      out.push({
        file: s.file,
        line: s.line,
        col: s.col,
        message: `L29: scenario "${s.pack}/${s.id}" is not the link of any entry of the checklist catalog (${catalog.source})`,
      });
      continue;
    }
    if (s.heading !== null && place.entry.tag !== s.heading) {
      out.push({
        file: s.file,
        line: s.line,
        col: s.col,
        message: `L30: the checklist heading "${s.heading}" differs from the tag "${place.entry.tag}" of its catalog entry (${catalog.source})`,
      });
    }
  }
  const names = new Set(shipped.map((s) => `${s.pack}/${s.id}`));
  for (const place of catalog.places()) {
    const ref = place.entry.ref;
    if (ref === undefined || !packs.has(ref.pack)) continue;
    if (!names.has(`${ref.pack}/${ref.scenario}`)) {
      out.push({
        file: catalog.source,
        line: 1,
        col: 1,
        message: `L29: the entry "${place.entry.tag}" links to "${ref.pack}/${ref.scenario}", which is not a scenario of a checked pack`,
      });
    }
  }
  return out;
}
