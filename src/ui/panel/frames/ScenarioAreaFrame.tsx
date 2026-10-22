import { SESSION_LAYOUT } from '../session-area';
import { SessionButton } from '../widgets/SessionButton';
import type { FrameProps } from './MfdFrame';

/**
 * The session area in the co-pilot legroom (D-14, region scenario_area): the NEW SITUATION button
 * at its SESSION_LAYOUT rectangle. CHOOSE SITUATION and the choose view arrive in plan 12. Trainer
 * content, not an aircraft control: it is drawn only when a session is passed, and nothing here
 * touches the store.
 */
export function ScenarioAreaFrame({ session }: FrameProps) {
  if (session === undefined) return <g data-session-area />;
  return (
    <g data-session-area>
      <SessionButton
        id="session.new"
        rect={SESSION_LAYOUT.main.new}
        label="NEW SITUATION"
        ariaLabel="New situation, random"
        onActivate={() => {
          void session.newSituation();
        }}
      />
    </g>
  );
}
