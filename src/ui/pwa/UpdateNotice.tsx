import { applyUpdate, updateAvailable } from './register';
import { UPDATE_BUTTON_LABEL, UPDATE_NOTICE_TEXT, updateNoticeShown } from './update';
import type { Screen } from '../session';

/**
 * The calm update notice (D-05, L-04): a static sentence and one button, at the bottom edge of the
 * panel area, only on the free panel. No animation, no timer, no sound; the tap reloads once.
 * `lifted` keeps it above the Full panel button, which can sit in the bottom corners.
 */
export function UpdateNotice({
  screen,
  lifted,
}: {
  readonly screen: Screen;
  readonly lifted: boolean;
}) {
  if (!updateNoticeShown(updateAvailable.value, screen)) return null;
  return (
    <div
      class="update-notice"
      data-testid="update-notice"
      data-lifted={lifted ? 'true' : undefined}
      role="status"
    >
      <span>{UPDATE_NOTICE_TEXT}</span>
      <button type="button" data-testid="update-apply" onClick={applyUpdate}>
        {UPDATE_BUTTON_LABEL}
      </button>
    </div>
  );
}
