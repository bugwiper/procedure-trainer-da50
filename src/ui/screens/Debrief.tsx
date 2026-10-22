import type { GradeResult } from '../../engine/grading';
import type { Scenario } from '../../scenario/schema';
import { harmfulLine, reasonLines } from '../debrief-text';
import { buildOutline } from '../outline';
import { ChecklistOutline } from './ChecklistOutline';
import { LEVEL_NAMES } from '../session';
import type { Level } from '../session';
import { Modal } from './Modal';

/**
 * The debrief (SES-04, D-16, D-25): PASS or FAIL, one reason line per cause and the checklist
 * outline in its debrief form: decisions, branches with their condition labels, a severity tag and
 * a verdict word on every graded step, "Not graded" on the other lines, the branch that does not
 * apply muted, an order line under every ordered group and the harmful actions in log order
 * (no time). It names the level of the run ("Level: Easy") and, on a meta line before it, the scenario (D-05). No score, no timeline. It sits on the
 * shared modal shell: Escape is Back to panel, a tap on the backdrop does nothing.
 */
export function Debrief({
  scenario,
  result,
  level,
  onClose,
}: {
  readonly scenario: Scenario;
  readonly result: GradeResult;
  readonly level: Level;
  readonly onClose: () => void;
}) {
  const outline = buildOutline(scenario, result.branches, 'debrief', result);
  const passed = result.result === 'pass';
  const reasons = reasonLines(result);

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
      <p class="briefing-meta" data-testid="debrief-scenario">
        {scenario.title}
      </p>
      <p class="briefing-meta" data-testid="debrief-level">
        {`Level: ${LEVEL_NAMES[level]}`}
      </p>
      <h3 class="debrief-heading">Steps</h3>
      <ChecklistOutline items={outline} />
      <h3 class="debrief-heading" data-testid="debrief-harmful-heading">
        {`Harmful actions (${String(result.harmful.length)})`}
      </h3>
      {result.harmful.length === 0 ? (
        <p class="debrief-harmful-none" data-testid="debrief-harmful-none">
          None.
        </p>
      ) : (
        <ul class="outline-list debrief-harmful" data-testid="debrief-harmful">
          {result.harmful.map((entry) => (
            <li key={entry.seq} class="outline-item" data-testid="debrief-harmful-row">
              {harmfulLine(entry)}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
