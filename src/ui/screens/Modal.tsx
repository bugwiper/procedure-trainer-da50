import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { holdModal, releaseModal } from '../modals';

/** After mount, pointer and click events inside the modal are swallowed for this long (U-12). */
export const INPUT_SHIELD_MS = 400;

/** True while an event at `at` still falls inside the input shield of a modal opened at `openedAt`. */
export function isShielded(openedAt: number, at: number): boolean {
  return at - openedAt < INPUT_SHIELD_MS;
}

/**
 * The index Tab or Shift+Tab moves focus to inside a card with `count` focusable elements.
 * `current` is the index of the focused one, or -1 when focus is outside the list. The cycle wraps
 * at both ends; an empty card has no target (-1).
 */
export function nextFocusIndex(current: number, count: number, backward: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return backward ? count - 1 : 0;
  if (backward) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  /** The modal id the clock driver sees while this modal is mounted. */
  readonly id: string;
  readonly labelledBy: string;
  readonly role?: 'dialog' | 'alertdialog';
  /** z-index 50 for `modal`, 60 for the first-run acknowledgment (`ack`). */
  readonly layer?: 'modal' | 'ack';
  /** Called on Escape; null means Escape does nothing. */
  readonly onEscape: (() => void) | null;
  /** The sticky action row; its first button is the primary action and gets focus on mount. */
  readonly actions: ComponentChildren;
  readonly testId?: string;
  readonly cardTestId?: string;
  readonly cardClass?: string;
  readonly children: ComponentChildren;
}

/**
 * The one shell of every blocking overlay (UI-SPEC Overlay mechanics). A full-viewport scrim covers
 * the panel's hit area, a backdrop tap does nothing, focus starts on the primary action, cycles
 * inside the card and returns to the opener, and for the first 400 ms no pointer or click event
 * reaches the card (the tap that opened the modal must not press its primary button). While
 * mounted it holds its id in the modal registry, which pauses the run clock. No animation.
 */
export function Modal({
  id,
  labelledBy,
  role = 'dialog',
  layer = 'modal',
  onEscape,
  actions,
  testId,
  cardTestId,
  cardClass,
  children,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useLayoutEffect(() => {
    holdModal(id);
    const container = containerRef.current;
    const card = cardRef.current;
    const opener = document.activeElement;
    const openedAt = performance.now();

    const focusPrimary = () => {
      actionsRef.current?.querySelector<HTMLElement>('button')?.focus();
    };
    focusPrimary();

    // The shield: a capture listener on the container stops the event before it reaches the card.
    // mousedown is shielded as well: after a touch release that opened the modal, the browser's
    // compatibility mousedown would otherwise move the focus off the primary action.
    const shield = (e: Event) => {
      if (isShielded(openedAt, e.timeStamp)) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const shieldEvents = ['pointerdown', 'pointerup', 'mousedown', 'click'] as const;
    for (const type of shieldEvents) container?.addEventListener(type, shield, true);
    // A data attribute (not state) lets the e2e specs wait for the shield to end.
    container?.setAttribute('data-shield', 'on');
    const timer = setTimeout(() => {
      container?.removeAttribute('data-shield');
    }, INPUT_SHIELD_MS);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const handler = escapeRef.current;
        if (handler !== null) {
          e.preventDefault();
          handler();
        }
        return;
      }
      if (e.key !== 'Tab' || card === null) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      const target = nextFocusIndex(
        items.indexOf(document.activeElement as HTMLElement),
        items.length,
        e.shiftKey,
      );
      e.preventDefault();
      if (target >= 0) items[target]?.focus();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (container !== null && e.target instanceof Node && !container.contains(e.target)) {
        focusPrimary();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      for (const type of shieldEvents) container?.removeEventListener(type, shield, true);
      clearTimeout(timer);
      releaseModal(id);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [id]);

  return (
    <div ref={containerRef} class={`modal modal-${layer}`} data-testid={testId} data-modal-id={id}>
      <div
        ref={cardRef}
        class={cardClass === undefined ? 'modal-card' : `modal-card ${cardClass}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid={cardTestId}
      >
        {children}
        <div ref={actionsRef} class="modal-actions">
          {actions}
        </div>
      </div>
    </div>
  );
}
