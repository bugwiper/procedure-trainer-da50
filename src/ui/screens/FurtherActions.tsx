import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FurtherOption, FurtherSet } from '../../engine/further';
import { Modal } from './Modal';

/** The views of the modal: the list, the calls of one group, or the flight conduct. */
type View =
  | { readonly kind: 'main' }
  | { readonly kind: 'group'; readonly id: string }
  | { readonly kind: 'conduct' };

/**
 * The Further actions modal (Phase 7, SES-05, D-06, D-07): the decisions of a situation that are not
 * panel actions. The main view lists the groups (Inform ATC), the actions that have no group (Brief
 * passengers) and, only when the scenario declares a conduct, the flight conduct; a group and the
 * conduct open a second step with their options and a Back button. Any combination can be picked
 * before closing; a picked option shows the pressed rim and the mark, an action cannot be undone and
 * a conduct can be picked again (the last pick counts). The modal shows no role and no verdict: the
 * debrief does. Texts come from aircraft data and render as text children (T-07-05). It sits on the
 * shared shell, so the run clock waits while it is open.
 */
export function FurtherActions({
  set,
  conduct,
  picked,
  onPick,
  onClose,
}: {
  readonly set: FurtherSet;
  /** True when the scenario declares a flight conduct (accept); false hides the conduct item. */
  readonly conduct: boolean;
  /** The option ids logged so far in the run, in the order picked. */
  readonly picked: readonly string[];
  readonly onPick: (id: string) => void;
  readonly onClose: () => void;
}) {
  const [view, setView] = useState<View>({ kind: 'main' });
  // A second step replaces the button that was pressed: focus moves to the first button of the new
  // view (the shell only focuses once, at mount).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>('[data-testid="further"] .briefing-level button')?.focus();
  }, [view.kind, view.kind === 'group' ? view.id : '']);
  const done = (id: string): boolean => picked.includes(id);
  const lastConduct = set
    .ids('conduct')
    .filter((id) => picked.includes(id))
    .reduce<string | null>((last, id) => {
      const at = picked.lastIndexOf(id);
      return last === null || at > picked.lastIndexOf(last) ? id : last;
    }, null);

  const option = (entry: FurtherOption, current: boolean) => (
    <button
      key={entry.id}
      type="button"
      class="secondary-button level-button"
      data-testid={`further-opt-${entry.id}`}
      data-done={current ? 'true' : undefined}
      aria-pressed={current}
      onClick={() => {
        onPick(entry.id);
      }}
    >
      <span>{entry.text}</span>
      {current ? <span class="level-hint">Picked</span> : null}
    </button>
  );

  const step = (title: string, body: ComponentChildren) => (
    <div class="briefing-level" role="group" aria-labelledby="further-title">
      <p class="briefing-label" data-testid="further-step-title">
        {title}
      </p>
      {body}
    </div>
  );

  let body: ComponentChildren;
  if (view.kind === 'group') {
    const group = set.groups.find((entry) => entry.id === view.id);
    body = step(
      group?.text ?? view.id,
      set.options
        .filter((entry) => entry.kind === 'action' && entry.group === view.id)
        .map((entry) => option(entry, done(entry.id))),
    );
  } else if (view.kind === 'conduct') {
    body = step(
      set.conductTitle,
      set.options
        .filter((entry) => entry.kind === 'conduct')
        .map((entry) => option(entry, lastConduct === entry.id)),
    );
  } else {
    body = (
      <div class="briefing-level" role="group" aria-labelledby="further-title">
        {set.groups.map((group) => {
          const inGroup = set.options.filter((entry) => entry.group === group.id);
          const current = inGroup.some((entry) => done(entry.id));
          return (
            <button
              key={group.id}
              type="button"
              class="secondary-button level-button"
              data-testid={`further-group-${group.id}`}
              data-done={current ? 'true' : undefined}
              aria-pressed={current}
              onClick={() => {
                setView({ kind: 'group', id: group.id });
              }}
            >
              <span>{group.text}</span>
              {current ? <span class="level-hint">Picked</span> : null}
            </button>
          );
        })}
        {set.options
          .filter((entry) => entry.kind === 'action' && entry.group === undefined)
          .map((entry) => option(entry, done(entry.id)))}
        {conduct ? (
          <button
            type="button"
            class="secondary-button level-button"
            data-testid="further-conduct"
            data-done={lastConduct === null ? undefined : 'true'}
            aria-pressed={lastConduct !== null}
            onClick={() => {
              setView({ kind: 'conduct' });
            }}
          >
            <span>{set.conductTitle}</span>
            {lastConduct === null ? null : (
              <span class="level-hint">{set.option(lastConduct)?.text}</span>
            )}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Modal
      id="further"
      labelledBy="further-title"
      onEscape={
        view.kind === 'main'
          ? onClose
          : () => {
              setView({ kind: 'main' });
            }
      }
      testId="further-modal"
      cardTestId="further"
      cardClass="briefing"
      actions={
        <>
          {view.kind === 'main' ? null : (
            <button
              type="button"
              class="secondary-button"
              data-testid="further-back"
              onClick={() => {
                setView({ kind: 'main' });
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            class="primary-button"
            data-testid="further-close"
            onClick={onClose}
          >
            Close
          </button>
        </>
      }
    >
      <h2 id="further-title" class="modal-title">
        Further actions
      </h2>
      {body}
    </Modal>
  );
}
