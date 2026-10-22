import type { GradeResult, Reason } from '../../engine/grading';
import type { Scenario } from '../../scenario/schema';
import { buildOutline } from '../outline';
import { ChecklistOutline } from './ChecklistOutline';
import { Modal } from './Modal';

function reasonLine(reason: Reason): string {
  switch (reason.kind) {
    case 'critical_missed':
      return reason.count === 1
        ? '1 critical step was missed.'
        : `${String(reason.count)} critical steps were missed.`;
    case 'order':
      return 'Steps were done in the wrong order.';
    case 'forbidden':
      return 'A harmful action counts as a fail in this scenario.';
  }
}

/**
 * The debrief (SES-04, D-16, D-25): PASS or FAIL, one reason line per cause and the checklist
 * outline in its debrief form: decisions, branches with their condition labels, a severity tag and
 * a verdict word on every graded step, "Not graded" on the other lines, the branch that does not
 * apply muted. No score, no timeline. It sits on the shared modal shell: Escape is Back to panel,
 * a tap on the backdrop does nothing. Plan 13 completes it.
 */
export function Debrief({
  scenario,
  result,
  onClose,
}: {
  readonly scenario: Scenario;
  readonly result: GradeResult;
  readonly onClose: () => void;
}) {
  const outline = buildOutline(scenario, result.branches, 'debrief', result);
  const passed = result.result === 'pass';
  const reasons = passed ? ['All critical steps done.'] : result.reasons.map(reasonLine);

  return (
    <Modal
      id="debrief"
      labelledBy="debrief-result"
      onEscape={onClose}
      testId="debrief-modal"
      cardTestId="debrief"
      cardClass="debrief"
      actions={
        <button type="button" class="primary-button" data-testid="debrief-back" onClick={onClose}>
          Back to panel
        </button>
      }
    >
      <h2
        id="debrief-result"
        class="debrief-result"
        data-testid="debrief-result"
        data-result={result.result}
        style={{ color: passed ? '#2fd36f' : '#ff5a50' }}
      >
        {passed ? 'PASS' : 'FAIL'}
      </h2>
      {reasons.map((line) => (
        <p key={line} class="debrief-reason" data-testid="debrief-reason">
          {line}
        </p>
      ))}
      <h3 class="debrief-heading">Steps</h3>
      <ChecklistOutline items={outline} />
    </Modal>
  );
}
