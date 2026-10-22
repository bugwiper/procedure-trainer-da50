import { DISCLAIMERS } from '../../scenario/disclaimers';
import { Modal } from './Modal';

const NOTICE = DISCLAIMERS['training-aid'];

/**
 * The first-run training-aid acknowledgment (PLT-04, D-17): a blocking modal above everything.
 * Escape and a backdrop tap do nothing; only "I understand" closes it. The wording comes from
 * src/scenario/disclaimers.ts and is rendered as text children.
 */
export function Ack({ onAccept }: { readonly onAccept: () => void }) {
  return (
    <Modal
      id="ack"
      layer="ack"
      labelledBy="ack-title"
      onEscape={null}
      testId="ack-modal"
      cardTestId="ack"
      actions={
        <button type="button" class="primary-button" data-testid="ack-accept" onClick={onAccept}>
          I understand
        </button>
      }
    >
      <h2 id="ack-title" class="modal-title">
        {NOTICE.heading}
      </h2>
      {NOTICE.body.map((paragraph) => (
        <p key={paragraph} class="modal-body">
          {paragraph}
        </p>
      ))}
    </Modal>
  );
}
