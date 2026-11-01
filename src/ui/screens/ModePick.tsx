import { MODES, MODE_HINTS, MODE_NAMES } from '../session';
import type { Mode } from '../session';
import { Modal } from './Modal';

/**
 * The mode question (Phase 7, SES-02, D-02): the first card after a scenario is opened, before the
 * level card. Training offers a hint and the checklist during the run, Exam is silent. It is the card
 * of the level in the same shape; the choice is display state of the session and never reaches grade.
 * The card shows no scenario text.
 */
export function ModePick({
  onMode,
  onBack,
}: {
  readonly onMode: (mode: Mode) => void;
  readonly onBack: () => void;
}) {
  return (
    <Modal
      id="mode-pick"
      labelledBy="mode-pick-title"
      onEscape={onBack}
      testId="mode-pick-modal"
      cardTestId="mode-pick"
      cardClass="briefing"
      actions={
        <button
          type="button"
          class="secondary-button"
          data-testid="mode-pick-back"
          onClick={onBack}
        >
          Back to panel
        </button>
      }
    >
      <h2 id="mode-pick-title" class="modal-title">
        Choose a mode
      </h2>
      <div class="briefing-level" role="group" aria-labelledby="mode-pick-title">
        {MODES.map((entry) => (
          <button
            key={entry}
            type="button"
            class="secondary-button level-button"
            data-testid={`mode-pick-${entry}`}
            onClick={() => {
              onMode(entry);
            }}
          >
            <span>{MODE_NAMES[entry]}</span>
            <span class="level-hint" data-testid={`mode-pick-${entry}-hint`}>
              {MODE_HINTS[entry]}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
