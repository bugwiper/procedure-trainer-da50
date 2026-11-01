import type { BranchVerdict } from '../../engine/grading';
import type { Scenario } from '../../scenario/schema';
import { buildOutline, checklistHead } from '../outline';
import { ChecklistHeading, ChecklistOutline } from './ChecklistOutline';

/**
 * The checklist sheet of a Training run (Phase 7, SES-02, D-03, H-04): the printed heading and
 * message tag and the outline in its briefing form (the rows the Easy briefing shows, with the
 * branches decided at the start), docked to the side of the panel area. It is not a modal: it holds
 * no modal id, so the run clock keeps running and the panel stays operable beside it. It has its own
 * hide button (the CHECKLIST button of the pad can be under the sheet), Escape inside it hides it, it
 * scrolls and never reaches the footer. All scenario text is rendered as text children.
 */
export function RunChecklist({
  scenario,
  branches,
  onHide,
}: {
  readonly scenario: Scenario;
  readonly branches: readonly BranchVerdict[];
  readonly onHide: () => void;
}) {
  const outline = buildOutline(scenario, branches, 'briefing');
  const head = checklistHead(scenario);
  return (
    <section
      class="run-checklist"
      aria-labelledby="run-checklist-title"
      data-testid="run-checklist"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onHide();
      }}
    >
      <div class="run-checklist-bar">
        <h2 id="run-checklist-title" class="run-checklist-title">
          Checklist
        </h2>
        <button
          type="button"
          class="secondary-button run-checklist-hide"
          data-testid="run-checklist-hide"
          onClick={onHide}
        >
          Hide
        </button>
      </div>
      <div class="run-checklist-body" tabIndex={0} data-testid="run-checklist-body">
        <ChecklistHeading heading={head.heading} message={head.message} />
        <ChecklistOutline items={outline} form={head.form} />
      </div>
    </section>
  );
}
