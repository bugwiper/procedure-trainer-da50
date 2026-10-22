import { Modal } from './Modal';

/**
 * The leave-run confirm (U-03, UI-SPEC "Leave-run confirm"): NEW SITUATION or CHOOSE SITUATION
 * pressed during a run. Keep going is the primary action, has the focus and is the Escape action;
 * Leave run is the destructive outline button. A backdrop tap does nothing.
 */
export function LeaveConfirm({
  onKeep,
  onLeave,
}: {
  readonly onKeep: () => void;
  readonly onLeave: () => void;
}) {
  return (
    <Modal
      id="leave-run"
      labelledBy="leave-run-title"
      onEscape={onKeep}
      testId="leave-run-modal"
      cardTestId="leave-run"
      actions={
        <>
          <button type="button" class="primary-button" data-testid="leave-keep" onClick={onKeep}>
            Keep going
          </button>
          <button type="button" class="danger-button" data-testid="leave-leave" onClick={onLeave}>
            Leave run
          </button>
        </>
      }
    >
      <h2 id="leave-run-title" class="modal-title">
        Leave this run?
      </h2>
      <p class="modal-body">The current run ends without a result.</p>
    </Modal>
  );
}

/**
 * The load error (U-16, U-18): a pack or scenario file that could not be loaded. Try again repeats
 * the same request; Back to panel (also Escape) returns to the free panel.
 */
export function LoadError({
  onRetry,
  onBack,
}: {
  readonly onRetry: () => void;
  readonly onBack: () => void;
}) {
  return (
    <Modal
      id="load-error"
      labelledBy="load-error-title"
      role="alertdialog"
      onEscape={onBack}
      testId="load-error-modal"
      cardTestId="load-error"
      actions={
        <>
          <button
            type="button"
            class="primary-button"
            data-testid="load-error-retry"
            onClick={onRetry}
          >
            Try again
          </button>
          <button
            type="button"
            class="secondary-button"
            data-testid="load-error-back"
            onClick={onBack}
          >
            Back to panel
          </button>
        </>
      }
    >
      <h2 id="load-error-title" class="modal-title modal-title-error">
        This situation could not be loaded.
      </h2>
      <p class="modal-body">Check your connection, then try again.</p>
    </Modal>
  );
}

/**
 * No situation is available (U-16): the build holds no scenario the policy allows, so a list would
 * be empty. Back to panel (also Escape) closes the message.
 */
export function EmptyNotice({ onBack }: { readonly onBack: () => void }) {
  return (
    <Modal
      id="no-situations"
      labelledBy="no-situations-title"
      onEscape={onBack}
      testId="no-situations-modal"
      cardTestId="no-situations"
      actions={
        <button
          type="button"
          class="primary-button"
          data-testid="no-situations-back"
          onClick={onBack}
        >
          Back to panel
        </button>
      }
    >
      <h2 id="no-situations-title" class="modal-title">
        No situations available
      </h2>
      <p class="modal-body">
        Reload the page. If this stays, the scenario files are missing from this build.
      </p>
    </Modal>
  );
}
