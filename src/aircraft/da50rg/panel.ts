// DA50 RG panel layout: viewBox, device profiles, regions and the control registry.
//
// Layout facts (D-19, D-21, PNL-08) come from two private reference photos that are
// git-ignored and viewed as layout facts only, never copied or traced (D-04b): IMG_0650
// for the front panel and DA50_virtual for the left panel and the under-panel. Method:
// front-panel positions in IMG_0650 photo pixels, with horizontal perspective corrected
// so the PFD and MFD come out the same width (they are the same display) and the
// lower-panel slope flattened so the straight switch row is horizontal; the left column
// and switch row averaged with DA50_virtual normalised to the PFD (opposite-seat
// perspectives cancel); vertical scale set by the display aspect 1.35; the under-panel
// and pedestal from DA50_virtual. Nothing is widened or enlarged for touch size.

import { defineRegistry } from '../../engine/registry';
import type { RegionDef, Size } from '../../engine/registry';
import { ENGINE_CONTROLS } from './controls/engine';
import { MFD_CONTROLS } from './controls/mfd';
import { GEAR_FLAPS_CONTROLS } from './controls/gear-flaps';
import { PEDESTAL_CONTROLS } from './controls/pedestal';
import { SWITCH_BANK_CONTROLS } from './controls/switch-bank';
import { UNDER_PANEL_CONTROLS } from './controls/under-panel';

/** True panel proportions with the under-panel area below (D-19, D-21). */
export const VIEWBOX: Size = { w: 2000, h: 1010 };

/**
 * Svg area in CSS px per device class: the Playwright landscape viewports minus the
 * 28 px footer. Plan 09 uses them for the zoomed-view tap-size guarantee.
 */
export const VIEW_PROFILES: {
  readonly desktop: Size;
  readonly tablet: Size;
  readonly phone: Size;
} = {
  desktop: { w: 1280, h: 692 },
  tablet: { w: 944, h: 628 },
  phone: { w: 734, h: 315 },
};

export const REGIONS: readonly RegionDef[] = [
  // Top far left.
  { id: 'deice', name: 'DE-ICE', bounds: { x: 85, y: 95, w: 175, h: 163 } },
  // Left edge, below DE-ICE (D-07d).
  { id: 'engine_controls', name: 'ENGINE', bounds: { x: 80, y: 290, w: 170, h: 135 } },
  // PFD and MFD are the same display: equal size. The centre stack between them
  // (audio panel, standby instrument) is background in Phase 1.
  { id: 'pfd', name: 'PFD', bounds: { x: 362, y: 20, w: 495, h: 367 } },
  { id: 'mfd', name: 'MFD', bounds: { x: 1269, y: 20, w: 495, h: 367 } },
  // The softkey strip under the MFD screen.
  { id: 'mfd_softkeys', name: 'MFD SOFTKEYS', bounds: { x: 1262, y: 390, w: 510, h: 42 } },
  // Under the left column and the PFD.
  { id: 'switch_bank', name: 'SWITCH ROW', bounds: { x: 70, y: 445, w: 770, h: 80 } },
  // Right of PITOT/STALL HEAT.
  { id: 'landing_gear', name: 'LANDING GEAR', bounds: { x: 850, y: 395, w: 210, h: 165 } },
  // Below the MFD, right of centre.
  { id: 'flaps', name: 'FLAPS', bounds: { x: 1300, y: 433, w: 140, h: 127 } },
  // ELT, lower right.
  { id: 'right_panel', name: 'RIGHT PANEL', bounds: { x: 1720, y: 433, w: 120, h: 107 } },
  // Under the panel: left of the pilot's left knee.
  { id: 'under_panel_left', name: 'UNDER PANEL L', bounds: { x: 15, y: 565, w: 80, h: 120 } },
  // Left of the pedestal.
  { id: 'under_panel_centre', name: 'UNDER PANEL C', bounds: { x: 860, y: 565, w: 90, h: 120 } },
  // Drawn as a plan view below the panel, fore at the top; fore-aft length not to scale.
  { id: 'pedestal', name: 'PEDESTAL', bounds: { x: 957, y: 640, w: 211, h: 365 } },
  // Right of the pedestal.
  { id: 'under_panel_right', name: 'UNDER PANEL R', bounds: { x: 1170, y: 565, w: 90, h: 120 } },
];

export const DA50RG = defineRegistry({
  viewBox: VIEWBOX,
  regions: REGIONS,
  // Plans 05 and 07 append their control lists here.
  controls: [
    ...ENGINE_CONTROLS,
    ...SWITCH_BANK_CONTROLS,
    ...MFD_CONTROLS,
    ...PEDESTAL_CONTROLS,
    ...GEAR_FLAPS_CONTROLS,
    ...UNDER_PANEL_CONTROLS,
  ],
});
