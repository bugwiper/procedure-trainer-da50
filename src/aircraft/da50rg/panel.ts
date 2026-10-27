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
import type { Rect, RegionDef, Size } from '../../engine/registry';
import { BREAKER_CONTROLS, CB_REGIONS } from './controls/breakers';
import { BUTTON_CONTROLS } from './controls/buttons';
import { CABIN_CONTROLS } from './controls/cabin';
import { DEICE_CONTROLS } from './controls/deice';
import { ENGINE_CONTROLS } from './controls/engine';
import { KNOB_CONTROLS } from './controls/knobs';
import { LIGHTS_CONTROLS } from './controls/lights';
import { MFD_CONTROLS } from './controls/mfd';
import { GEAR_FLAPS_CONTROLS } from './controls/gear-flaps';
import { PEDALS_CONTROLS } from './controls/pedals';
import { PEDESTAL_CONTROLS } from './controls/pedestal';
import { SQUAWK_CONTROLS } from './controls/squawk';
import { SWITCH_BANK_CONTROLS } from './controls/switch-bank';
import { UNDER_PANEL_CONTROLS } from './controls/under-panel';

/**
 * True panel proportions: the glareshield strip above the displays, the front panel, and the
 * centre console area below (UI-SPEC "Coordinate Space and Regions", D-02). Phase 01.2 widened the
 * space from 2000 to 2180 by adding 180 units on the right only (owner decision U-01): every
 * region, plate and control left of x 1980 keeps its coordinates.
 */
export const VIEWBOX: Size = { w: 2180, h: 1300 };

/**
 * Height of the windscreen above the instrument panel (Phase 5, W-01): the opening of the owner's
 * cockpit photo is about a fifth of its width. Nothing of the panel moves; the space grows upward.
 */
export const WINDSCREEN_H = 440;

/** The whole drawable space: the windscreen above the instrument-panel viewBox (W-01). */
export const EXTENT: Rect = { x: 0, y: -WINDSCREEN_H, w: VIEWBOX.w, h: VIEWBOX.h + WINDSCREEN_H };

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
  // The emergency window (Phase 5.1, P-07): the oval in the side pane at the far left of the
  // windscreen extent. Its region is NESTED inside the windscreen region and listed before it,
  // because the zoom takes the first region that contains the tapped point. The one named
  // exception of the no-overlap gates (tests/layout.test.ts).
  { id: 'side_window', name: 'SIDE WINDOW', bounds: { x: 6, y: -280, w: 112, h: 210 } },
  // The windscreen above the panel (Phase 5, W-03): invisible geometry for the zoom, art only, no
  // control. It owns the space above y 0 and nothing else.
  {
    id: 'windscreen',
    name: 'WINDSCREEN',
    bounds: { x: 0, y: -WINDSCREEN_H, w: VIEWBOX.w, h: WINDSCREEN_H },
  },
  // Glareshield hump above the displays: the four exterior light switches (D-08).
  { id: 'lights', name: 'LIGHTS', bounds: { x: 930, y: 20, w: 280, h: 150 } },
  // De-ice upper block, top far left: MAX button, mode toggle, three lamps, ALTERNATE (plan 21).
  { id: 'deice', name: 'DE-ICE', bounds: { x: 85, y: 205, w: 175, h: 185 } },
  // De-ice switch rows below the mode toggle. Split from DE-ICE (PD-02): in one tall region the
  // three thirds of the mode toggle cannot reach 44 px each on the phone.
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
  // The softkey strip under the PFD screen: 12 inert keys, art only (no control). Ends at x 835
  // because landing_gear starts at 836 and a key may not leave its region; y 570 is below pfd (567).
  { id: 'pfd_softkeys', name: 'PFD SOFTKEYS', bounds: { x: 356, y: 570, w: 479, h: 38 } },
  // Right knob column of the PFD, in the free space between the PFD bezel (ends x 873) and the
  // audio panel; ends at y 574, above landing_gear (575). View-only: holds no control (D-05).
  { id: 'pfd_bezel_right', name: 'PFD KNOBS RIGHT', bounds: { x: 875, y: 196, w: 68, h: 378 } },
  // Audio panel beside the PFD column, left of the dimmer knobs (light_knobs starts at x 1010).
  { id: 'audio_panel', name: 'AUDIO PANEL', bounds: { x: 946, y: 196, w: 60, h: 378 } },
  // Backup EFIS (static item, D-06) below the dimmer knobs (light_knobs ends y 290).
  { id: 'standby_efis', name: 'BACKUP EFIS', bounds: { x: 1026, y: 296, w: 120, h: 278 } },
  // Left knob column of the PFD, in the free strip between the engine and de-ice plates (end x 270)
  // and the PFD bezel (starts x 346); ends at x 342, clear of pfd_softkeys (x 356).
  { id: 'pfd_bezel_left', name: 'PFD KNOBS LEFT', bounds: { x: 274, y: 196, w: 68, h: 408 } },
  // Autopilot panel right of the dimmer knobs (light_knobs ends x 1160); ends y 604 above the
  // flaps region (608) and x 1250, left of the MFD bezel (1253).
  { id: 'autopilot_panel', name: 'AUTOPILOT PANEL', bounds: { x: 1164, y: 196, w: 86, h: 408 } },
  // Right knob column of the MFD: right of mfd_softkeys (ends x 1772) and the bezel (1780), ends
  // x 1866 left of the bus plate (1874); 84 wide and 378 tall like the PFD right column.
  { id: 'mfd_bezel_right', name: 'MFD KNOBS RIGHT', bounds: { x: 1782, y: 196, w: 84, h: 378 } },
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
  // Circuit-breaker regions of the bus panel (phase 01.2, controls/breakers.ts).
  ...CB_REGIONS,
  // Under the panel: left of the pilot's left knee.
  { id: 'under_panel_left', name: 'UNDER PANEL L', bounds: { x: 15, y: 745, w: 80, h: 120 } },
  // The ECS SHUTOFF pull knob (owner description 2026-10-22): between ALTERNATE STATIC (global x 51)
  // and the EMERGENCY GEAR EXTENSION handle (x 907), about one third of the way, on the row of the
  // other under-panel pulls. Like them it reaches into the reserved pilot legroom (a named exception
  // of the legroom gate).
  { id: 'under_panel_ecs', name: 'UNDER PANEL ECS', bounds: { x: 296, y: 745, w: 80, h: 120 } },
  // Left of the pedestal.
  { id: 'under_panel_centre', name: 'UNDER PANEL C', bounds: { x: 860, y: 740, w: 90, h: 125 } },
  // Environmental plate, top of the centre console. Split from the pedestal (PD-01): in one
  // 540-tall region the phone shows 0.56 px per unit and POWER reaches only 34 px.
  // DIRECTION, TEMPERATURE and FAN. CIRCULATING AIR is its own region below (plan 20): a single
  // 290-tall region would shrink the zoom scale below the 44 px tap size on the phone.
  { id: 'env_control', name: 'ENVIRONMENTAL CONTROL', bounds: { x: 957, y: 750, w: 211, h: 240 } },
  { id: 'env_circ', name: 'CIRCULATING AIR', bounds: { x: 957, y: 990, w: 211, h: 50 } },
  // Drawn as a plan view below the panel, fore at the top; fore-aft length not to scale.
  { id: 'pedestal', name: 'PEDESTAL', bounds: { x: 957, y: 1042, w: 211, h: 248 } },
  // Right of the pedestal.
  { id: 'under_panel_right', name: 'UNDER PANEL R', bounds: { x: 1170, y: 740, w: 90, h: 125 } },
  // Session area (phase 02, D-14 amended): the NEW SITUATION and CHOOSE SITUATION buttons in the
  // co-pilot legroom right of the centre console, below the face plate. Real-geometry exception of
  // the 02 UI-SPEC: it is trainer content, not an aircraft part, and carries no registry control.
  { id: 'scenario_area', name: 'SESSION', bounds: { x: 1300, y: 780, w: 440, h: 480 } },
  // Simplified transponder (phase 03, D-11): a temporary trainer part; its position is not a
  // fidelity item and it is replaced later by the transponder of the PFD. Since Phase 5.1 it sits
  // in the co-pilot footwell beside the session buttons (it left the pilot's footwell for the toe
  // brakes). Holds the one code-entry control kp.squawk.
  { id: 'transponder', name: 'TRANSPONDER', bounds: { x: 1800, y: 780, w: 320, h: 200 } },
  // The toe brakes (Phase 5.1, P-02): the floor of the pilot's footwell. Holds the one control lv.toe_brakes, drawn as two pedals.
  { id: 'pedals', name: 'PEDALS', bounds: { x: 300, y: 1150, w: 360, h: 110 } },
  // The red door release lever (Phase 5.1, P-09): low at the left edge, at the pilot's arm rest.
  // The place is an assumption for the owner's review; it reaches into the reserved pilot legroom
  // (a named exception of the legroom gate, next to the ECS pull).
  { id: 'door_arm', name: 'DOOR RELEASE', bounds: { x: 4, y: 1000, w: 96, h: 240 } },
];

export const DA50RG = defineRegistry({
  viewBox: VIEWBOX,
  extent: EXTENT,
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
    ...BREAKER_CONTROLS,
    ...SQUAWK_CONTROLS,
    ...PEDALS_CONTROLS,
    ...CABIN_CONTROLS,
  ],
});
