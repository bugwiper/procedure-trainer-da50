import type { ComponentChildren } from 'preact';
import type { FrameProps } from './MfdFrame';

// Region-owned housing of the inert avionics units (phase 01.2 plan 06, D-05, D-06, T-01.2-11).
// A unit is art only: no control, no key, no handler, no hit rectangle. The group announces
// itself to assistive technology as one not-operable image and hides its children, so a screen
// reader never offers a button that does not exist. Because the art lives inside the region
// group it is measured by the art-fit and text-overlap gates like every other region.

/** Name read out for each unit region, upper case as the printed panel. */
export const UNIT_NAMES: Readonly<Record<string, string>> = {
  audio_panel: 'AUDIO PANEL',
  standby_efis: 'BACKUP EFIS',
  autopilot_panel: 'AUTOPILOT PANEL',
  pfd_bezel_left: 'PFD KNOB COLUMN LEFT',
  pfd_bezel_right: 'PFD KNOB COLUMN RIGHT',
  mfd_bezel_right: 'MFD KNOB COLUMN RIGHT',
};

/** Regions whose unit draws its own housing; the bezel columns sit on a unit plate instead. */
const HOUSED: readonly string[] = ['audio_panel', 'standby_efis', 'autopilot_panel'];

const HOUSING_FILL = '#0c0d0f';
const HOUSING_RIM = '#2d3138';

/** The not-operable group of one unit; later plans draw the unit's art as children. */
export function UnitGroup({ id, children }: { id: string; children?: ComponentChildren }) {
  return (
    <g
      role="img"
      aria-label={`${UNIT_NAMES[id] ?? id} (NOT OPERABLE)`}
      data-unit={id}
      pointer-events="none"
    >
      <g data-unit-art aria-hidden="true" pointer-events="none">
        {children}
      </g>
    </g>
  );
}

/** The housing rectangle: equal to the region frame, drawn first so the unit's art lies on it. */
export function HousingRect({ w, h }: { w: number; h: number }) {
  return (
    <rect
      data-unit-housing
      x={0}
      y={0}
      width={w}
      height={h}
      rx={4}
      fill={HOUSING_FILL}
      stroke={HOUSING_RIM}
      stroke-width={1}
    />
  );
}

/** Housing frame of one unit region: a rounded rectangle equal to the region frame, or nothing. */
export function UnitHousing({ region }: FrameProps) {
  const { w, h } = region.bounds;
  return (
    <UnitGroup id={region.id}>
      {HOUSED.includes(region.id) ? <HousingRect w={w} h={h} /> : null}
    </UnitGroup>
  );
}
