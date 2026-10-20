import { useLayoutEffect, useRef } from 'preact/hooks';
import policy from '../../../docs/CONTENT-POLICY.md?raw';

/**
 * About dialog (D-16): training-aid notice, not-affiliated statement and the full content
 * policy. The policy is rendered as a text child of a pre element, never as markup (T-01-15).
 */
export function About({ onClose }: { readonly onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      class="about"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      data-testid="about"
    >
      <h2 id="about-title">About this trainer</h2>
      <p>
        Training aid only, not the AFM. Not an approved or certified training device, and not
        affiliated with or endorsed by Diamond Aircraft Industries or Garmin.
      </p>
      <p>
        The names DA50 and Diamond belong to Diamond Aircraft Industries, and the names Garmin and
        G1000 NXi belong to Garmin Ltd. or its subsidiaries. They are used here only to say which
        aircraft and equipment this panel imitates; every trademark stays with its owner.
      </p>
      <button
        ref={closeRef}
        type="button"
        class="about-close"
        data-testid="about-close"
        onClick={onClose}
      >
        Close
      </button>
      <h3>Content policy</h3>
      <pre class="policy-text" data-testid="policy-text">
        {policy}
      </pre>
    </div>
  );
}
