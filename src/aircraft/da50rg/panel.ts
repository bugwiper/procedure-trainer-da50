// DA50 RG panel layout: viewBox, device profiles, regions and the control registry.
//
// Layout facts (D-19, D-21, PNL-08) come from private reference photos that are git-ignored
// and viewed as layout facts only, never copied or traced (D-04b, D-06): IMG_0650 for the
// front panel and DA50_virtual for the left panel and the under-panel. Method: front-panel
// positions in IMG_0650 photo pixels, with horizontal perspective corrected so the PFD and
// MFD come out the same width (they are the same display) and the lower-panel slope
// flattened so the straight switch row is horizontal; the left column and switch row
// averaged with DA50_virtual normalised to the PFD (opposite-seat perspectives cancel);
// vertical scale set by the display aspect 1.35; the under-panel and pedestal from
// DA50_virtual. Phase 1.1 adds the glareshield, the de-ice panel, the centre console and
// the environmental plate from the UI-SPEC photo reading (P650, P386, PED, SIM, COCK),
// again numbers only. Nothing is widened or enlarged for touch size.

import { defineRegistry } from '../../engine/registry';
import type { RegionDef, Size } from '../../engine/registry';
import { BUTTON_CONTROLS } from './controls/buttons';
import { DEICE_CONTROLS } from './controls/deice';
import { ENGINE_CONTROLS } from './controls/engine';
import { KNOB_CONTROLS } from './controls/knobs';
import { LIGHTS_CONTROLS } from './controls/lights';
import { MFD_CONTROLS } from './controls/mfd';
import { GEAR_FLAPS_CONTROLS } from './controls/gear-flaps';
import { PEDESTAL_CONTROLS } from './controls/pedestal';
import { SWITCH_BANK_CONTROLS } from './controls/switch-bank';
import { UNDER_PANEL_CONTROLS } from './controls/under-panel';

/**
 * True panel proportions: the glareshield strip above the displays, the front panel, and the
 * centre console area below (UI-SPEC "Coordinate Space and Regions", D-02).
 */
export const VIEWBOX: Size = { w: 2000, h: 1300 };

/**
 * Every Phase 1 front-panel y moved down by this much when the glareshield strip was added
 * above the displays (UI-SPEC "Coordinate Space and Regions").
 */
export const PANEL_Y_OFFSET = 180;

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
  // Glareshield hump above the displays: the four exterior light switches (D-08).
  { id: 'lights', name: 'LIGHTS', bounds: { x: 930, y: 20, w: 280, h: 150 } },
  // De-ice mode selector and the ALTERNATE switch, top far left.
  { id: 'deice', name: 'DE-ICE', bounds: { x: 85, y: 275, w: 175, h: 115 } },
  // De-ice switch rows below the mode selector. Split from DE-ICE (PD-02): in one 190-tall
  // region the four-position mode selector cannot reach 44 px per detent on the phone.
  { id: 'deice_switches', name: 'DE-ICE SWITCHES', bounds: { x: 85, y: 390, w: 175, h: 75 } },
  // Left edge, below DE-ICE (D-07d).
  { id: 'engine_controls', name: 'ENGINE', bounds: { x: 80, y: 470, w: 170, h: 135 } },
  // PFD and MFD are the same display: equal size. The centre stack between them
  // (audio panel, standby instrument) is background in Phase 1.
  { id: 'pfd', name: 'PFD', bounds: { x: 362, y: 200, w: 495, h: 367 } },
  // The two dimmer knobs in the hump between the displays.
  {
    id: 'light_knobs',
    name: 'INSTRUMENT AND FLOOD LIGHT',
    bounds: { x: 1010, y: 187, w: 150, h: 103 },
  },
  { id: 'mfd', name: 'MFD', bounds: { x: 1269, y: 200, w: 495, h: 367 } },
  // The softkey strip under the MFD screen. Ends at 608, one unit under the softkey (G-4: the
  // flap region above it grew upward by 5).
  { id: 'mfd_softkeys', name: 'MFD SOFTKEYS', bounds: { x: 1262, y: 570, w: 510, h: 38 } },
  // Under the left column and the PFD.
  { id: 'switch_bank', name: 'SWITCH ROW', bounds: { x: 70, y: 621, w: 764, h: 84 } },
  // Gear lever, gear lamps and the STALL/GEAR TEST part.
  { id: 'landing_gear', name: 'LANDING GEAR', bounds: { x: 836, y: 575, w: 239, h: 165 } },
  // The LEVEL button between the gear and flap blocks.
  { id: 'level', name: 'LEVEL', bounds: { x: 1076, y: 635, w: 48, h: 80 } },
  // Below the MFD, right of centre: flap lever and flap lamps.
  { id: 'flaps', name: 'FLAPS', bounds: { x: 1190, y: 608, w: 250, h: 132 } },
  // ELT, lower right.
  { id: 'right_panel', name: 'RIGHT PANEL', bounds: { x: 1720, y: 613, w: 120, h: 107 } },
  // Under the panel: left of the pilot's left knee.
  { id: 'under_panel_left', name: 'UNDER PANEL L', bounds: { x: 15, y: 745, w: 80, h: 120 } },
  // Left of the pedestal.
  { id: 'under_panel_centre', name: 'UNDER PANEL C', bounds: { x: 860, y: 740, w: 90, h: 125 } },
  // Environmental plate, top of the centre console. Split from the pedestal (PD-01): in one
  // 540-tall region the phone shows 0.56 px per unit and POWER reaches only 34 px.
  { id: 'env_control', name: 'ENVIRONMENTAL CONTROL', bounds: { x: 957, y: 750, w: 211, h: 265 } },
  // Drawn as a plan view below the panel, fore at the top; fore-aft length not to scale.
  { id: 'pedestal', name: 'PEDESTAL', bounds: { x: 957, y: 1042, w: 211, h: 248 } },
  // Right of the pedestal.
  { id: 'under_panel_right', name: 'UNDER PANEL R', bounds: { x: 1170, y: 740, w: 90, h: 125 } },
];

export const DA50RG = defineRegistry({
  viewBox: VIEWBOX,
  regions: REGIONS,
  // Plans 05 and 07 append their control lists here.
  controls: [
    ...LIGHTS_CONTROLS,
    ...KNOB_CONTROLS,
    ...DEICE_CONTROLS,
    ...ENGINE_CONTROLS,
    ...SWITCH_BANK_CONTROLS,
    ...BUTTON_CONTROLS,
    ...MFD_CONTROLS,
    ...PEDESTAL_CONTROLS,
    ...GEAR_FLAPS_CONTROLS,
    ...UNDER_PANEL_CONTROLS,
  ],
});
