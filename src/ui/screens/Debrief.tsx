import type { FurtherSet } from '../../engine/further';
import type { GradeResult } from '../../engine/grading';
import type { Scenario } from '../../scenario/schema';
import {
  causeLine,
  furtherNote,
  furtherRows,
  harmfulLine,
  limitLine,
  reasonLines,
  timingLine,
} from '../debrief-text';
import { buildOutline, checklistHead } from '../outline';
import { ChecklistHeading, ChecklistOutline, TONE_COLORS } from './ChecklistOutline';
import { LEVEL_NAMES, MODE_NAMES } from '../session';
import type { Level, Mode } from '../session';
import { Modal } from './Modal';

/**
 * The debrief (SES-04, D-16, D-25): PASS or FAIL, one reason line per cause and the checklist
 * outline in its debrief form: decisions, branches with their condition labels, a severity tag and
 * a verdict word on every graded step, "Not graded" on the other lines, the branch that does not
 * apply muted (the table form and the printed heading follow the scenario, plan 03-14), an order line under every ordered group and the harmful actions in log order
 * (no time). It names the level of the run ("Level: Easy"), then the mode ("Mode: Training", Phase 7) and, on a meta line before it, the scenario (D-05); a scenario with variants adds one line naming the cause that was drawn (V-08); a run the 30-minute cap ended adds the limit line after the level line (V-14); a realistic run adds one line with the first action measured from the onset. No score, no timeline. It sits on the
 * shared modal shell: Escape is Back to panel, a tap on the backdrop does nothing.
 */
export function Debrief({
  further,
  scenario,
  result,
  level,
  mode,
  completedAt,
  onClose,
}: {
  /** The further actions of the aircraft: the texts of the rows (Phase 7). */
  readonly further: FurtherSet;
  readonly scenario: Scenario;
  readonly result: GradeResult;
  readonly level: Level;
  readonly mode: Mode;
  /** The run clock at the end of the run (the recording's completedAt). */
  readonly completedAt: number;
  readonly onClose: () => void;
}) {
  const outline = buildOutline(scenario, result.branches, 'debrief', result);
  const head = checklistHead(scenario);
  const passed = result.result === 'pass';
  const reasons = reasonLines(result);
  const cause = causeLine(scenario, result);
  const limit = limitLine(completedAt);
  const furtherList = furtherRows(result, further);
  const note = furtherNote(result, further);

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
      <p class="briefing-meta" data-testid="debrief-mode">
        {`Mode: ${MODE_NAMES[mode]}`}
      </p>
      {limit === null ? null : (
        <p class="briefing-meta" data-testid="debrief-limit">
          {limit}
        </p>
      )}
      {cause === null ? null : (
        <p class="briefing-meta" data-testid="debrief-variant">
          {cause}
        </p>
      )}
      {level === 'realistic' ? (
        <p class="briefing-meta" data-testid="debrief-timing">
          {timingLine(result)}
        </p>
      ) : null}
      <h3 class="debrief-heading">Steps</h3>
      <ChecklistHeading heading={head.heading} message={head.message} />
      <ChecklistOutline items={outline} form={head.form} />
      {furtherList.length === 0 ? null : (
        <>
          <h3 class="debrief-heading" data-testid="debrief-further-heading">
            Further actions
          </h3>
          <ul class="outline-list debrief-further" data-testid="debrief-further">
            {furtherList.map((entry) => (
              <li
                key={entry.id}
                class="further-row"
                data-testid="debrief-further-row"
                data-further-id={entry.id}
                data-verdict={entry.verdict}
              >
                <span class="further-label">{entry.label}</span>
                {entry.role === null ? null : <span class="outline-tag">{entry.role}</span>}
                <span class="outline-verdict" style={{ color: TONE_COLORS[entry.tone] }}>
                  {entry.verdict}
                </span>
                {entry.picks === null ? null : (
                  <span class="further-picks" data-testid="debrief-further-picks">
                    {entry.picks}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {note === null ? null : (
            <p class="briefing-meta" data-testid="debrief-further-note">
              {note}
            </p>
          )}
        </>
      )}
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
