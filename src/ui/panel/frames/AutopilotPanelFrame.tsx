import { AUTOPILOT_PANEL } from '../../../aircraft/da50rg/avionics';
import { ColumnPart } from './BezelColumnFrame';
import type { FrameProps } from './MfdFrame';
import { HousingRect, UnitGroup } from './UnitHousing';

// Autopilot panel art (phase 01.2 plan 08, D-05, T-01.2-13): the housing, four knobs with their
// static legends, the swap button and 12 keys in six rows, all drawn from AUTOPILOT_PANEL with the
// shared renderers. Hook-free and inert: no handler, no hit rectangle, no control id; a tap on it
// only zooms. Key sizes and spacing are proposals (U-17).

export function AutopilotPanelFrame({ region }: FrameProps) {
  const { w, h } = region.bounds;
  return (
    <UnitGroup id={region.id}>
      <HousingRect w={w} h={h} />
      {AUTOPILOT_PANEL.map((e, i) => (
        <ColumnPart key={i} e={e} />
      ))}
    </UnitGroup>
  );
}
