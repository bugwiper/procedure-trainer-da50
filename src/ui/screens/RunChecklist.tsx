import type { BranchVerdict, GradeResult } from '../../engine/grading';
import type { ScenarioRef } from '../../scenario/packs';
import type { Scenario } from '../../scenario/schema';
import { buildOutline, checklistHead } from '../outline';
import type { ChecklistList } from '../session';
import { ChecklistHeading, ChecklistOutline } from './ChecklistOutline';

/** What the sheet shows: one checklist (marked or plain), or the list of checklists (Realistic). */
export type SheetBody =
  | {
      readonly kind: 'checklist';
      readonly scenario: Scenario;
      readonly branches: readonly BranchVerdict[];
      /** The grade of the partial recording of the scenario's own checklist; null shows it plain. */
      readonly marks: GradeResult | null;
    }
  | {
      readonly kind: 'list';
      readonly list: ChecklistList;
      readonly onChoose: (ref: ScenarioRef) => void;
      readonly onRetry: () => void;
    };

/**
 * The checklist sheet of a run (Phase 7, SES-02, R-02, R-03): the printed heading and message tag and
 * the outline in its briefing form (the rows the Easy briefing shows, with the branches decided at the
 * start), docked to the side of the panel area. With `marks` (the grade of the partial recording)
 * the steps already done carry the word Done in green (the live outline form); steps not done carry
 * nothing. On Realistic the sheet can instead list the headings of all checklists, every one alike
 * (nothing marks the situation's own), and a shown checklist has a button back to that list
 * (`onBackToList`). It is not a modal: it holds
 * no modal id, so the run clock keeps running and the panel stays operable beside it. It has its own
 * hide button (the CHECKLIST button of the pad can be under the sheet), Escape inside it hides it, it
 * scrolls and never reaches the footer. All scenario text is rendered as text children.
 */
export function RunChecklist({
  body,
  onHide,
  onBackToList,
}: {
  readonly body: SheetBody;
  readonly onHide: () => void;
  /** Present on Realistic: from a shown checklist back to the list of checklists. */
  readonly onBackToList?: () => void;
}) {
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
          {body.kind === 'list' ? 'Checklists' : 'Checklist'}
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
        {body.kind === 'list' ? (
          <ChecklistChoices list={body.list} onChoose={body.onChoose} onRetry={body.onRetry} />
        ) : (
          <>
            {onBackToList === undefined ? null : (
              <button
                type="button"
                class="secondary-button run-checklist-back"
                data-testid="run-checklist-back"
                onClick={onBackToList}
              >
                All checklists
              </button>
            )}
            <SheetChecklist body={body} />
          </>
        )}
      </div>
    </section>
  );
}

function SheetChecklist({ body }: { readonly body: Extract<SheetBody, { kind: 'checklist' }> }) {
  const { scenario, branches, marks } = body;
  const outline =
    marks === null
      ? buildOutline(scenario, branches, 'briefing')
      : buildOutline(scenario, branches, 'live', marks);
  const head = checklistHead(scenario);
  return (
    <>
      <ChecklistHeading heading={head.heading} message={head.message} />
      <ChecklistOutline items={outline} form={head.form} />
    </>
  );
}

/** The list of the checklists by heading, in listing order; loading and failure in own words. */
function ChecklistChoices({
  list,
  onChoose,
  onRetry,
}: {
  readonly list: ChecklistList;
  readonly onChoose: (ref: ScenarioRef) => void;
  readonly onRetry: () => void;
}) {
  if (list.status === 'failed') {
    return (
      <div class="run-checklist-message" role="status" data-testid="run-checklist-failed">
        <p>The checklists could not be loaded. The run goes on.</p>
        <button
          type="button"
          class="secondary-button"
          data-testid="run-checklist-retry"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    );
  }
  if (list.status !== 'ready') {
    return (
      <p class="run-checklist-message" role="status" data-testid="run-checklist-loading">
        Loading the checklists.
      </p>
    );
  }
  return (
    <ul class="run-checklist-list" data-testid="run-checklist-list">
      {list.entries.map((entry) => (
        <li key={`${entry.ref.pack}.${entry.ref.scenario}`}>
          <button
            type="button"
            class="secondary-button run-checklist-entry"
            data-testid="run-checklist-entry"
            onClick={() => {
              onChoose(entry.ref);
            }}
          >
            {entry.heading}
          </button>
        </li>
      ))}
    </ul>
  );
}
