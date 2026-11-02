import { useRef } from 'preact/hooks';
import { INPUT_SHIELD_MS } from '../../screens/Modal';
import { SESSION_LAYOUT, pageCount, pageSlice } from '../session-area';
import { SessionButton } from '../widgets/SessionButton';
import type { FrameProps } from './MfdFrame';

/**
 * The session area in the co-pilot legroom (D-14, region scenario_area). Main view: NEW SITUATION,
 * CHOOSE SITUATION and RESET at their SESSION_LAYOUT rectangles. Run view (state running, Phase 7,
 * D-05): the same three buttons at the SESSION_LAYOUT.run rectangles with the same ids and the same
 * leave-run confirm, FURTHER ACTIONS on top (Phase 7), CHECKLIST (CHOOSE CHECKLIST on Realistic; the pressed rim while the sheet is shown) and HINT (Realistic only; the pressed rim while the box is shown). Choose view (state choosing): CLOSE LIST
 * and one page of up to four rows, one per scenario of an allowed pack, titled from the pack
 * manifest; NEXT PAGE beside CLOSE LIST only when there are more rows than one page holds, and it
 * wraps to the first page (Phase 5.1). Trainer
 * content, not an aircraft control: it is drawn only when a session is passed, and nothing here
 * touches the store. The text follows the session state, never a control state (U-06).
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
    const { close, next: nextRect, rows } = SESSION_LAYOUT.choose;
    const ignoreUntil = shownAt.current + INPUT_SHIELD_MS;
    const choices = session.choices.value;
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
    // The label is fixed by the level when the run starts (G-0): it never follows a control state.
    const realistic = session.level.value === 'realistic';
    return (
      <g data-session-area data-session-view="run">
        <SessionButton
          key="session.further"
          id="session.further"
          rect={run.further}
          label="FURTHER ACTIONS"
          ariaLabel="Further actions: inform ATC, brief passengers, choose the flight conduct"
          held={session.furtherOpen.value}
          onActivate={() => {
            session.openFurther();
          }}
        />
        <SessionButton
          key="session.checklist"
          id="session.checklist"
          rect={run.checklist}
          label={realistic ? 'CHOOSE CHECKLIST' : 'CHECKLIST'}
          ariaLabel={
            realistic ? 'Choose a checklist: show or hide the list' : 'Show or hide the checklist'
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
          key="session.new"
          id="session.new"
          rect={run.new}
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
          rect={run.choose}
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
          rect={run.reset}
          label="RESET"
          ariaLabel="Reset the panel to its original state"
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
