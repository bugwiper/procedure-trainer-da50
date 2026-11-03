// The pack-level cross-check of the follow-on situations (Phase 9, plan 09-02, D-03, lint L34), run
// by `npm run validate` and by a unit test, never when a scenario is opened: a follow-on may lead
// into a pack the access policy denies (a paid pack needs no entry in the public data), and a
// missing target never throws at run time (the session shows the load-failure state). L34: every
// `further.follow_on` target names a manifest entry of a pack that was checked and is not the
// scenario that names it. A target in a pack that was not checked is not judged, so validating one
// folder alone does not report the others (the same rule as L29). The per-scenario part of the rule
// (the conduct is one the aircraft gives a follow-on and the scenario accepts it) is L33 in lint.ts.
// Pure TypeScript, no file system, no DOM, no clock.

import type { ShippedScenario } from './catalog-check';

/** One follow-on target of one checked scenario, with the place of its map key in the file. */
export interface FollowOnTarget {
  /** The conduct option id the target is declared for. */
  readonly conduct: string;
  readonly pack: string;
  readonly scenario: string;
  readonly line: number;
  readonly col: number;
}

/** A checked scenario that declares follow-on targets. */
export interface FollowOnSource {
  /** The pack and manifest entry id of the scenario that names the targets. */
  readonly pack: string;
  readonly id: string;
  /** Repo-relative scenario file. */
  readonly file: string;
  readonly targets: readonly FollowOnTarget[];
}

export interface FollowOnIssue {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
}

/**
 * L34 for the packs that were checked (`packs` lists their ids; `shipped` holds their manifest
 * entries). A target into a pack that was not checked is not judged.
 */
export function checkFollowOns(
  sources: readonly FollowOnSource[],
  shipped: readonly Pick<ShippedScenario, 'pack' | 'id'>[],
  packs: ReadonlySet<string>,
): FollowOnIssue[] {
  const names = new Set(shipped.map((s) => `${s.pack}/${s.id}`));
  const out: FollowOnIssue[] = [];
  for (const source of sources) {
    for (const target of source.targets) {
      const name = `${target.pack}/${target.scenario}`;
      const at = { file: source.file, line: target.line, col: target.col };
      if (target.pack === source.pack && target.scenario === source.id) {
        out.push({
          ...at,
          message: `L34: the follow-on for "${target.conduct}" names the scenario itself (${name})`,
        });
      } else if (packs.has(target.pack) && !names.has(name)) {
        out.push({
          ...at,
          message: `L34: the follow-on for "${target.conduct}" names "${name}", which is not a scenario of a checked pack`,
        });
      }
    }
  }
  return out;
}
