import { useRef } from 'preact/hooks';
import { INPUT_SHIELD_MS } from '../../screens/Modal';
import { SESSION_LAYOUT, pageCount, pageSlice } from '../session-area';
import { SessionButton } from '../widgets/SessionButton';
import type { FrameProps } from './MfdFrame';

/**
 * The session area in the co-pilot legroom (D-14, region scenario_area). Main view (the free panel,
 * 07-04 R-06): NEW SITUATION, CHOOSE SITUATION and RESET at their SESSION_LAYOUT rectangles. Run view
 * (state running): only what the run needs, at the SESSION_LAYOUT.run rectangles: SHOW CHECKLIST (the
 * same static label on every level; on Realistic the first press opens the list of checklists to
 * choose from, afterwards the button shows or hides the chosen one; the pressed rim while the sheet is
 * shown), HINT (Realistic only; the pressed rim while the box is shown) and LEAVE, which asks through
 * the leave-run confirm. NEW
 * SITUATION, CHOOSE SITUATION and RESET are not drawn during a run. Choose view (state choosing):
 * CLOSE LIST, one tab per catalog group (plan 07-06, R-18) and one page of up to three rows, one per
 * scenario of an allowed pack in the selected group, titled from the pack manifest; NEXT PAGE beside
 * CLOSE LIST only when the group has more rows than one page holds, and it wraps to the first page
 * of the group (Phase 5.1). Trainer content, not an aircraft control: it is drawn only
 * when a session is passed, and nothing here touches the store. The text follows the session state,
 * never a control state (U-06).
 *
 * While a load runs, the button that started it keeps its pressed rim and every other press on the
 * area is ignored. The rows and CLOSE LIST ignore presses for the first 400 ms after the view
 * appears, so the second tap of a double tap on CHOOSE SITUATION cannot pick a row (U-12).
 */
export function ScenarioAreaFrame({ session }: FrameProps) {
  // The time the choose view last appeared; set while rendering the view change.
  const view = useRef<'main' | 'choose' | 'run'>('main');
  const shownAt = useRef(0);
  if (session === undefined) return <g data-session-area />;

  const choosing = session.screen.value === 'choosing';
  const running = session.screen.value === 'running';
  const next = choosing ? 'choose' : running ? 'run' : 'main';
  if (view.current !== next) {
    view.current = next;
    shownAt.current = performance.now();
  }
  const busyKey = session.busyKey.value;
  // A press while a load runs is ignored (the session ignores it as well).
  const idle = (act: () => void) => () => {
    if (!session.busy.peek()) act();
  };

  if (choosing) {
    const { close, next: nextRect, rows, tabs } = SESSION_LAYOUT.choose;
    const ignoreUntil = shownAt.current + INPUT_SHIELD_MS;
    // The rows of the selected group (tab), in catalog order (R-18).
    const choices = session.groupChoices.value;
    const group = session.chooseGroup.value;
    const pages = pageCount(choices.length);
    return (
      <g data-session-area data-session-view="choose">
        <SessionButton
          key="session.close"
          id="session.close"
          rect={close}
          label="CLOSE LIST"
          ariaLabel="Close list"
          ignoreUntil={ignoreUntil}
          onActivate={idle(() => {
            session.closeChooser();
          })}
        />
        {pages > 1 ? (
          <SessionButton
            key="session.next"
            id="session.next"
            rect={nextRect}
            label="NEXT PAGE"
            ariaLabel="Next page of situations"
            ignoreUntil={ignoreUntil}
            onActivate={idle(() => {
              session.nextPage();
            })}
          />
        ) : null}
        {session.catalog.groups.map((entry, index) => {
          const rect = tabs[index];
          if (rect === undefined) return null;
          const id = `session.tab.${entry.id}`;
          return (
            <SessionButton
              key={id}
              id={id}
              rect={rect}
              label={entry.tab}
              labelSize={SESSION_LAYOUT.choose.tabLabelSize}
              ariaLabel={entry.heading}
              selected={group === entry.id}
              ignoreUntil={ignoreUntil}
              onActivate={idle(() => {
                session.chooseTab(entry.id);
              })}
            />
          );
        })}
        {pageSlice(choices, session.choosePage.value).map((choice, index) => {
          const rect = rows[index];
          if (rect === undefined) return null;
          const id = `session.row.${choice.pack}.${choice.scenario}`;
          return (
            <SessionButton
              key={id}
              id={id}
              rect={rect}
              label={choice.title}
              ariaLabel={`Open briefing: ${choice.title}`}
              held={busyKey === id}
              ignoreUntil={ignoreUntil}
              onActivate={idle(() => {
                void session.chooseScenario(choice, id);
              })}
            />
          );
        })}
      </g>
    );
  }

  if (running) {
    const { run } = SESSION_LAYOUT;
    const realistic = session.level.value === 'realistic';
    return (
      <g data-session-area data-session-view="run">
        <SessionButton
          key="session.checklist"
          id="session.checklist"
          rect={run.checklist}
          label="SHOW CHECKLIST"
          ariaLabel={
            realistic
              ? 'Show or hide the checklist; the first press lists the checklists to choose from'
              : 'Show or hide the checklist'
          }
          held={session.checklistShown.value}
          onActivate={() => {
            session.toggleChecklist();
          }}
        />
        {realistic ? (
          <SessionButton
            key="session.hint"
            id="session.hint"
            rect={run.hint}
            label="HINT"
            ariaLabel="Hint: show or hide the situation"
            held={session.hintShown.value}
            onActivate={() => {
              session.toggleHint();
            }}
          />
        ) : null}
        <SessionButton
          key="session.leave"
          id="session.leave"
          rect={run.leave}
          label="LEAVE"
          ariaLabel="Leave the run"
          onActivate={idle(() => {
            session.resetPanel();
          })}
        />
      </g>
    );
  }

  return (
    <g data-session-area data-session-view="main">
      <SessionButton
        key="session.new"
        id="session.new"
        rect={SESSION_LAYOUT.main.new}
        label="NEW SITUATION"
        ariaLabel="New situation, random"
        held={busyKey === 'session.new'}
        onActivate={idle(() => {
          void session.newSituation();
        })}
      />
      <SessionButton
        key="session.choose"
        id="session.choose"
        rect={SESSION_LAYOUT.main.choose}
        label="CHOOSE SITUATION"
        ariaLabel="Choose situation"
        held={busyKey === 'session.choose'}
        onActivate={idle(() => {
          void session.openChooser();
        })}
      />
      <SessionButton
        key="session.reset"
        id="session.reset"
        rect={SESSION_LAYOUT.main.reset}
        label="RESET"
        ariaLabel="Reset the panel to its original state"
        onActivate={idle(() => {
          session.resetPanel();
        })}
      />
    </g>
  );
}
