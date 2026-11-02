import { DA50RG_ENV } from '../../../aircraft/da50rg/aircraft';
import { FURTHER_PAD } from '../../../aircraft/da50rg/further-pad';
import { offersConduct } from '../../../engine/further';
import { SessionButton } from '../widgets/SessionButton';
import type { FrameProps } from './MfdFrame';

/**
 * The further actions of a run (Phase 7, plans 07-05 and 07-06, R-07 to R-11, R-21): nine toggle buttons in the pilot
 * footwell (region further_area, plate further-pad). Nothing is drawn unless a run is live, so the
 * plate stays empty on the free panel and in the briefing. The slots, the labels and the kind of each
 * option come from aircraft data (FURTHER_PAD, DA50RG_ENV.further); no option id is named here. A
 * press calls session.toggleDecision; the highlight is effectiveSelection of the recorded presses
 * (session.furtherSelection), so the button and the grade cannot disagree. The three conduct buttons
 * and the three Avoid buttons are left out when the scenario offers no conduct (ground, or no further
 * section, R-09, R-21). Trainer
 * content, not an aircraft control: it never touches the store and the label never changes (G-0).
 * On Realistic the buttons are drawn alike before the onset (a press is ignored there), so nothing
 * gives the failure away.
 */
export function FurtherAreaFrame({ session }: FrameProps) {
  if (session === undefined || session.screen.value !== 'running') return <g data-further-area />;
  const set = DA50RG_ENV.further;
  const conduct = offersConduct(session.scenario.value?.further);
  const selection = session.furtherSelection.value;
  return (
    <g data-further-area data-further-conduct={conduct ? 'true' : 'false'}>
      {FURTHER_PAD.slots.map((slot) => {
        const option = set.option(slot.id);
        if (option === undefined) return null;
        if ((option.kind === 'conduct' || option.avoid === true) && !conduct) return null;
        const selected =
          option.kind === 'conduct'
            ? selection.conduct === slot.id
            : selection.actions.has(slot.id);
        const id = `further.${slot.id}`;
        return (
          <SessionButton
            key={id}
            id={id}
            rect={slot}
            label={option.label ?? option.text}
            ariaLabel={option.text}
            selected={selected}
            onActivate={() => {
              session.toggleDecision(slot.id);
            }}
          />
        );
      })}
    </g>
  );
}
