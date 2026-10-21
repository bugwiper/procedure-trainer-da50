import { AUDIO_PANEL } from '../../../aircraft/da50rg/avionics';
import { ColumnPart } from './BezelColumnFrame';
import type { FrameProps } from './MfdFrame';
import { HousingRect, UnitGroup } from './UnitHousing';

// Audio panel art (phase 01.2 plan 08, D-05, T-01.2-13): the housing, 21 keys with their legends
// and lamp slivers, a volume knob and the red DISPLAY BACKUP button, all drawn from AUDIO_PANEL.
// Hook-free and inert: no handler, no hit rectangle, no control id; the surrounding UnitGroup hides
// it from assistive technology and turns pointer events off, so a tap on it only zooms.

export function AudioPanelFrame({ region }: FrameProps) {
  const { w, h } = region.bounds;
  return (
    <UnitGroup id={region.id}>
      <HousingRect w={w} h={h} />
      {AUDIO_PANEL.map((e, i) => (
        <ColumnPart key={i} e={e} />
      ))}
    </UnitGroup>
  );
}
