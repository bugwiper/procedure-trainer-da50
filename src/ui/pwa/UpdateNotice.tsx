import { applyUpdate, updateAvailable } from './register';
import { UPDATE_BUTTON_LABEL, UPDATE_NOTICE_TEXT, updateNoticeShown } from './update';
import type { Screen } from '../session';

/**
 * The calm update notice (D-05, L-04): a static sentence and one button over the windscreen at the
 * top centre of the panel area, only on the free panel. No animation, no timer, no sound; the tap
 * reloads once. The placement is in stage.css.
 */
export function UpdateNotice({ screen }: { readonly screen: Screen }) {
  if (!updateNoticeShown(updateAvailable.value, screen)) return null;
  return (
    <div class="update-notice" data-testid="update-notice" role="status">
      <span>{UPDATE_NOTICE_TEXT}</span>
      <button type="button" data-testid="update-apply" onClick={applyUpdate}>
        {UPDATE_BUTTON_LABEL}
      </button>
    </div>
  );
}
