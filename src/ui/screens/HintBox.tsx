import type { Scenario } from '../../scenario/schema';

/**
 * The hint box of a Realistic run (Phase 7, R-04): the situation name (the file's title) and the
 * situation text of the Medium briefing, in a box over the windscreen. It gives no step-by-step
 * guidance and names the file's own scenario, so the cause of a variant stays hidden. Not a modal and
 * no control: it takes no press (`pointer-events: none` in the stylesheet), so the run clock keeps
 * running and the panel stays operable underneath. All text is rendered as text children.
 */
export function HintBox({ scenario }: { readonly scenario: Scenario }) {
  return (
    <div class="hint-box" role="status" data-testid="hint-box">
      <span class="hint-box-title" data-testid="hint-box-title">
        {scenario.title}
      </span>
      <span class="hint-box-situation" data-testid="hint-box-situation">
        {scenario.briefing.situation}
      </span>
    </div>
  );
}
