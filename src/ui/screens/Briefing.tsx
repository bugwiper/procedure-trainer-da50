import { DISCLAIMERS } from '../../scenario/disclaimers';
import { buildOutline } from '../outline';
import type { Briefed, Level } from '../session';
import { ChecklistOutline } from './ChecklistOutline';
import { Modal } from './Modal';

/**
 * The briefing (SES-01, SCN-07, PLT-04, D-04, D-14, D-24; UI-SPEC "Briefing"; phase 02.1): scenario
 * title, situation, the disclaimer line, the checklist, the exam
 * note and, last, the source and revision, over the unchanged panel. On Easy the checklist lists the
 * panel steps of the branches that apply as plain lines, without tag or verdict; a branch that does
 * not apply keeps its label and no children. On Medium no checklist is shown. The panel takes the
 * scenario's initial state only at Start run. It sits on the shared modal shell: Escape is Back to
 * panel, a backdrop tap does nothing. All scenario text is rendered as text children.
 */
export function Briefing({
  briefed,
  level,
  onStart,
  onBack,
}: {
  readonly briefed: Briefed;
  readonly level: Level;
  readonly onStart: () => void;
  readonly onBack: () => void;
}) {
  const { scenario } = briefed;
  const { source } = scenario;
  const outline = buildOutline(scenario, briefed.branches, 'briefing');

  return (
    <Modal
      id="briefing"
      labelledBy="briefing-title"
      onEscape={onBack}
      testId="briefing-modal"
      cardTestId="briefing"
      cardClass="briefing"
      actions={
        <>
          <button
            type="button"
            class="primary-button"
            data-testid="briefing-start"
            onClick={onStart}
          >
            Start run
          </button>
          <button
            type="button"
            class="secondary-button"
            data-testid="briefing-back"
            onClick={onBack}
          >
            Back to panel
          </button>
        </>
      }
    >
      <h2 id="briefing-title" class="modal-title">
        {scenario.title}
      </h2>
      <p class="modal-body" data-testid="briefing-situation">
        {scenario.briefing.situation}
      </p>
      <p class="briefing-meta" data-testid="briefing-disclaimer">
        {DISCLAIMERS[scenario.disclaimer].short}
      </p>
      {level !== 'easy' || outline.length === 0 ? null : (
        <section class="briefing-outline" data-testid="briefing-outline">
          <h3 class="briefing-label">Checklist</h3>
          <ChecklistOutline items={outline} />
        </section>
      )}
      <p class="briefing-meta briefing-exam" data-testid="briefing-exam">
        Exam mode: no hints. When you are done, press Procedure complete.
      </p>
      <div class="briefing-source" data-testid="briefing-source">
        <p class="briefing-meta">{`Source: ${source.section}, issue ${source.issue}`}</p>
        <p class="briefing-meta">{`${source.document}, checked ${source.verified}`}</p>
      </div>
    </Modal>
  );
}
