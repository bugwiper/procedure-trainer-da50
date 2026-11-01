import type { Recording } from '../src/engine/grading';
import type { Scenario } from '../src/scenario/schema';

// Shared by the tests that grade a shipped scenario with a built solution (Phase 7, plan 07-02):
// the decisions a right run makes, so the panel verdict of such a test stands alone. The solution
// is the required actions of the scenario's further section, then the first accepted conduct; a
// scenario without a section (or with conduct none and no required action) needs none.

/** The time the decisions of a built solution are made at: early, before any outcome can fire. */
export const DECISION_AT_MS = 1000;

export function solutionDecisions(scenario: Scenario): NonNullable<Recording['decisions']> {
  const section = scenario.further;
  if (section === undefined) return [];
  const ids = [
    ...section.actions.filter((entry) => entry.role === 'required').map((entry) => entry.id),
    ...(section.conduct === 'none' ? [] : section.conduct.accept.slice(0, 1)),
  ];
  return ids.map((id) => ({ t: DECISION_AT_MS, id }));
}

/** The one decision of the shipped in-flight scenarios whose conduct is the precautionary landing. */
export const PRECAUTION: NonNullable<Recording['decisions']> = [
  { t: DECISION_AT_MS, id: 'conduct_precautionary' },
];
