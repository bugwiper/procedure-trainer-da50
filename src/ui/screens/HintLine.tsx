import { hintNoneText } from '../session';
import type { HintState } from '../session';

/**
 * The hint line of a Training run (Phase 7, D-04, H-04): one strip over the windscreen that names the
 * next open checklist step as printed (row mark, text, desired action), or one fixed sentence when no
 * required step is open. Not a modal and no control: it takes no press (`pointer-events: none` in
 * the stylesheet), so the run clock keeps running and the panel stays operable underneath. All text
 * is rendered as text children.
 */
export function HintLine({ hint }: { readonly hint: HintState }) {
  return (
    <div class="hint-line" role="status" data-testid="hint-line">
      {hint.kind === 'none' ? (
        <span class="hint-text" data-testid="hint-text">
          {hintNoneText(hint)}
        </span>
      ) : (
        <>
          {hint.step.number === undefined ? null : (
            <span class="hint-mark" data-testid="hint-mark">
              {String(hint.step.number)}
            </span>
          )}
          <span class="hint-text" data-testid="hint-text">
            {hint.step.text}
          </span>
          {hint.step.action === undefined ? null : (
            <span class="hint-action" data-testid="hint-action">
              {hint.step.action}
            </span>
          )}
        </>
      )}
    </div>
  );
}
