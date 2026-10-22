import { DISCLAIMERS } from '../../scenario/disclaimers';
import { buildOutline } from '../outline';
import { LEVELS, LEVEL_NAMES } from '../session';
import type { Briefed, Level } from '../session';
import { ChecklistOutline } from './ChecklistOutline';
import { Modal } from './Modal';

/**
 * The briefing (SES-01, SCN-07, PLT-04, D-04, D-14, D-24; UI-SPEC "Briefing"): scenario title,
 * situation, source and revision, the disclaimer line, the non-graded checklist outline and the
 * exam note, over the unchanged panel. The panel takes the scenario's initial state only at
 * Start run. The level group (Easy, Medium) sits after the disclaimer; the checklist outline shows on
 * Easy only. Panel steps and the children of a branch that does not apply are never shown (exam).
 * It sits on the shared modal shell: Escape is Back to panel, a backdrop tap does nothing. All
 * scenario text is rendered as text children.
 */
export function Briefing({
  briefed,
  level,
  onLevel,
  onStart,
  onBack,
}: {
  readonly briefed: Briefed;
  readonly level: Level;
  readonly onLevel: (level: Level) => void;
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
      <div class="briefing-source" data-testid="briefing-source">
        <p class="briefing-meta">{`Source: ${source.section}, issue ${source.issue}`}</p>
        <p class="briefing-meta">{`${source.document}, checked ${source.verified}`}</p>
      </div>
      <p class="briefing-meta" data-testid="briefing-disclaimer">
        {DISCLAIMERS[scenario.disclaimer].short}
      </p>
      <div
        class="briefing-level"
        role="group"
        aria-labelledby="briefing-level-label"
        data-testid="briefing-level"
      >
        <p id="briefing-level-label" class="briefing-label">
          Level
        </p>
        {LEVELS.map((entry) => (
          <button
            key={entry}
            type="button"
            class="secondary-button level-button"
            aria-pressed={entry === level}
            data-testid={`briefing-level-${entry}`}
            onClick={() => {
              onLevel(entry);
            }}
          >
            {LEVEL_NAMES[entry]}
          </button>
        ))}
      </div>
      {level !== 'easy' || outline.length === 0 ? null : (
        <section class="briefing-outline" data-testid="briefing-outline">
          <h3 class="briefing-label">Steps outside the panel (not graded in this version)</h3>
          <ChecklistOutline items={outline} />
        </section>
      )}
      <p class="briefing-meta briefing-exam" data-testid="briefing-exam">
        Exam mode: no hints. When you are done, press Procedure complete.
      </p>
    </Modal>
  );
}
