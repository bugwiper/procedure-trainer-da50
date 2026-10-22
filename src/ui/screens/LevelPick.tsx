import { LEVELS, LEVEL_NAMES } from '../session';
import type { Level } from '../session';
import { Modal } from './Modal';

/**
 * The level question (phase 02.1): the first card after a scenario is opened, before any briefing.
 * Easy leads to the full briefing, Medium to the briefing without the checklist. Realistic starts the
 * run at once, with no briefing (D-05); its button is inactive when the opened scenario declares no
 * onset (`realistic` false). The card shows no scenario text.
 */
export function LevelPick({
  realistic,
  onLevel,
  onBack,
}: {
  /** True when the opened scenario declares an onset, so the Realistic button is active. */
  readonly realistic: boolean;
  readonly onLevel: (level: Level) => void;
  readonly onBack: () => void;
}) {
  return (
    <Modal
      id="level-pick"
      labelledBy="level-pick-title"
      onEscape={onBack}
      testId="level-pick-modal"
      cardTestId="level-pick"
      cardClass="briefing"
      actions={
        <button
          type="button"
          class="secondary-button"
          data-testid="level-pick-back"
          onClick={onBack}
        >
          Back to panel
        </button>
      }
    >
      <h2 id="level-pick-title" class="modal-title">
        Choose a level
      </h2>
      <div class="briefing-level" role="group" aria-labelledby="level-pick-title">
        {LEVELS.map((entry) => (
          <button
            key={entry}
            type="button"
            class="secondary-button level-button"
            disabled={entry === 'realistic' && !realistic}
            data-testid={`level-pick-${entry}`}
            onClick={() => {
              onLevel(entry);
            }}
          >
            {LEVEL_NAMES[entry]}
          </button>
        ))}
      </div>
    </Modal>
  );
}
