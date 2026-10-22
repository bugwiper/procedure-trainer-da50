import { useLayoutEffect, useRef } from 'preact/hooks';
import type { GradeResult, Reason, StepVerdict } from '../../engine/grading';
import type { ProcedureNode, Scenario, Step } from '../../scenario/schema';

const TAGS = { critical: 'CRITICAL', standard: 'STANDARD', optional: 'OPTIONAL' } as const;

/** Every graded step of a scenario by id, depth first through decisions and branches. */
function stepsById(nodes: readonly ProcedureNode[], into: Map<string, Step>): Map<string, Step> {
  for (const node of nodes) {
    switch (node.kind) {
      case 'line':
        break;
      case 'group':
        for (const step of node.steps) into.set(step.id, step);
        break;
      case 'branch':
        stepsById(node.nodes, into);
        break;
      case 'decision':
        for (const branch of node.branches) stepsById(branch.nodes, into);
        break;
    }
  }
  return into;
}

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

/** The verdict word and its colour (UI-SPEC Debrief): colour never carries the verdict alone. */
function verdictOf(step: StepVerdict): { readonly word: string; readonly color: string } {
  if (step.credited) return { word: 'Done', color: '#2fd36f' };
  if (step.severity === 'critical') return { word: 'Missed', color: '#ff5a50' };
  if (step.severity === 'standard') return { word: 'Missed', color: '#f2c230' };
  return { word: 'Not done', color: '#aab3bd' };
}

/**
 * The debrief (SES-04, D-16): PASS or FAIL, one reason line per cause and one verdict row per
 * graded step in declared order. No score, no timeline. Escape is Back to panel; a tap on the
 * backdrop does nothing. Plan 09 moves this onto the shared modal shell, plan 13 completes it.
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
  const backRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    backRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const texts = stepsById(scenario.procedure, new Map());
  const passed = result.result === 'pass';
  const reasons = passed ? ['All critical steps done.'] : result.reasons.map(reasonLine);

  return (
    <div class="modal" data-testid="debrief-modal">
      <div
        class="modal-card debrief"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debrief-result"
        data-testid="debrief"
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
        <ul class="debrief-steps">
          {result.steps.map((step) => {
            const verdict = verdictOf(step);
            const text = texts.get(step.id)?.text ?? step.id;
            const tag = TAGS[step.severity];
            return (
              <li
                key={step.id}
                class="debrief-row"
                data-testid="debrief-row"
                data-step-id={step.id}
                data-verdict={verdict.word}
                aria-label={`${tag}, ${text}, ${verdict.word}`}
              >
                <span class="debrief-tag">{tag}</span>
                <span class="debrief-text">{text}</span>
                <span class="debrief-verdict" style={{ color: verdict.color }}>
                  {verdict.word}
                </span>
              </li>
            );
          })}
        </ul>
        <div class="modal-actions">
          <button
            ref={backRef}
            type="button"
            class="primary-button"
            data-testid="debrief-back"
            onClick={onClose}
          >
            Back to panel
          </button>
        </div>
      </div>
    </div>
  );
}
