import type { Registry } from '../../engine/registry';
import { PLACARDS, placardLineY } from '../../aircraft/da50rg/placards';
import {
  ENV_BOXES,
  ENV_TITLE,
  GEAR_BLOCK,
  HEADING_FRAME,
  PLATES,
  PLATE_HEADINGS,
} from '../../aircraft/da50rg/plates';
import type { GroupBoxDef, PlateDef } from '../../aircraft/da50rg/plates';
import { detentOffset } from '../../engine/detents';
import { BusPanelArt } from './BusPanelArt';
import { paint } from './Defs';

// Static shell art under all regions (UI-SPEC "Panel Surface", D-01, D-02, D-06). Original flat
// vector work in the final 2180 x 1300 space: solid fills, shared gradients and strokes only.
// The space was widened by 180 units on the right only (phase 01.2 owner decision U-01); the shell
// silhouette stretches with it and nothing left of x 1956 changed.
// Every element is decorative: the root has pointer-events none and nothing here carries a
// pointer handler or a tap-target attribute, so taps on art emit no control event (P1 D-09).

/** Width added on the right of the 2000 wide phase 01.1 space (owner decision U-01). */
const RIGHT_EXTENSION = 180;

/** A display bezel is its screen region grown by 16 on the top, left and right ... */
const BEZEL_GROW = 16;
/** ... and by 41 on the bottom: the lip that carries the row of 12 softkeys (phase 01.2, U-11). */
const BEZEL_GROW_BOTTOM = 41;
const BEZEL_FILL = '#0c0d0f';
const RIM = '#2d3138';
const LEGEND = '#c9d0d8';
const PLATE = '#17191d';

// Letter spacing is a style because the `.panel-svg text` CSS rule would override the attribute.
const TRACK_BEZEL = 'letter-spacing:0.2em';
const TRACK_WORDMARK = 'letter-spacing:0.3em';

const PLATE_FILLS: Readonly<Record<string, string>> = {
  'lights-recess': BEZEL_FILL,
  'centre-stack': '#101215',
  'ap-unit': '#101215',
  'pfd-left-unit': BEZEL_FILL,
  'mfd-right-unit': BEZEL_FILL,
  environmental: '#1f2226',
  pedestal: '#1f2226',
  'bus-panel': '#15171a',
};

/** One visible plate drawn from the plate data (owner finding G-0.5). */
function Plate({ id }: { id: string }) {
  const plate: PlateDef | undefined = PLATES.find((p) => p.id === id);
  if (plate === undefined) return null;
  return (
    <rect
      data-plate={plate.id}
      data-plate-regions={plate.regions.join(' ')}
      x={plate.x}
      y={plate.y}
      width={plate.w}
      height={plate.h}
      rx={plate.rx}
      fill={PLATE_FILLS[plate.id] ?? PLATE}
      stroke={RIM}
    />
  );
}

/** Layer 2: dark knee cavity under the face plate, the console body stands on it. */
function KneeCavity({ width }: { width: number }) {
  return <rect data-shell="knee-cavity" x={0} y={745} width={width} height={555} fill="#0e1013" />;
}

/** Layer 3: face plate x 20..2160, y 190..745, upper corners rx 24, lower corners rx 40. */
const FACE_RIGHT = 1980 + RIGHT_EXTENSION;
const FACE_PLATE_PATH = `M44 190 H${FACE_RIGHT - 24} A24 24 0 0 1 ${FACE_RIGHT} 214 V705 A40 40 0 0 1 ${FACE_RIGHT - 40} 745 H60 A40 40 0 0 1 20 705 V214 A24 24 0 0 1 44 190 Z`;

function FacePlate() {
  return (
    <g data-shell="face-plate">
      <path d={FACE_PLATE_PATH} fill={paint('g-plate')} />
      {/* Light from the top left: 1-unit light edge on top and left, dark edge bottom and right. */}
      <path
        d={`M20.5 705 V214 A23.5 23.5 0 0 1 44 190.5 H${FACE_RIGHT - 24}`}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        stroke-width={1}
      />
      <path
        d={`M${FACE_RIGHT - 0.5} 214 V705 A39.5 39.5 0 0 1 ${FACE_RIGHT - 40} 744.5 H60 A39.5 39.5 0 0 1 20.5 705`}
        fill="none"
        stroke="rgba(0,0,0,0.6)"
        stroke-width={1}
      />
    </g>
  );
}

/** Layer 5: leather coaming with the glareshield hump spanning x 880..1380 (centre 1130). */
const COAMING_RIGHT = 2000 + RIGHT_EXTENSION;
const COAMING_PATH = `M0 190 L0 130 Q0 100 40 96 L760 84 Q820 82 850 56 L880 24 Q890 12 910 12 L1350 12 Q1370 12 1380 24 L1410 56 Q1440 82 1500 84 L${COAMING_RIGHT - 40} 96 Q${COAMING_RIGHT} 100 ${COAMING_RIGHT} 130 L${COAMING_RIGHT} 190 Z`;
/** The stitch line follows the top edge, inset 8. */
const COAMING_STITCH_PATH = `M8 190 L8 134 Q8 108 44 104 L760 92 Q828 90 858 64 L888 32 Q896 20 910 20 L1350 20 Q1364 20 1372 32 L1402 64 Q1432 90 1500 92 L${COAMING_RIGHT - 44} 104 Q${COAMING_RIGHT - 8} 108 ${COAMING_RIGHT - 8} 134 L${COAMING_RIGHT - 8} 190`;

function Coaming() {
  return (
    <g data-shell="coaming">
      <path d={COAMING_PATH} fill={paint('g-coaming')} />
      <path
        d={COAMING_STITCH_PATH}
        fill="none"
        stroke="#5a606a"
        stroke-width={0.8}
        stroke-dasharray="3 2"
      />
    </g>
  );
}

/** Layer 7 plus the GO-AROUND mark: a display bezel is its region grown by 16 (41 below), rx 10. */
function DisplayBezel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g data-shell="bezel">
      <rect
        x={x - BEZEL_GROW}
        y={y - BEZEL_GROW}
        width={w + 2 * BEZEL_GROW}
        height={h + BEZEL_GROW + BEZEL_GROW_BOTTOM}
        rx={10}
        fill={BEZEL_FILL}
        stroke={RIM}
        stroke-width={1}
      />
      {/* Replacement for the avionics maker's mark (D-05): text only. */}
      <text
        x={x + w / 2}
        y={y - 6}
        text-anchor="middle"
        font-size={8}
        fill="#8a9099"
        style={TRACK_BEZEL}
      >
        GO-AROUND
      </text>
    </g>
  );
}

/** The DA50RG nameplate on the left coaming shoulder, 150 x 28 centred on (560, 120). */
function Nameplate() {
  return (
    <g data-shell="nameplate">
      <rect x={485} y={106} width={150} height={28} rx={4} fill="#1b1d21" stroke={RIM} />
      <text x={560} y={125} text-anchor="middle" font-size={14} fill={LEGEND}>
        DA50RG
      </text>
    </g>
  );
}

/** Replacement for the airframe maker's wordmark: text only, no logo or swoosh shape (D-05). */
function Wordmark() {
  return (
    <text
      data-shell="wordmark"
      x={1232}
      y={625}
      text-anchor="middle"
      font-size={14}
      fill="#b9c0c8"
      style={TRACK_WORDMARK}
    >
      RUBIN
    </text>
  );
}

/**
 * Layer 4: console body x 937..1188 from y 745 down, darker leather side walls and white
 * stitching dashed 3 2 at 45 percent, inset 8.
 */
function ConsoleBody() {
  return (
    <g data-shell="console">
      <rect x={937} y={745} width={251} height={555} rx={18} fill={paint('g-console')} />
      <rect x={937} y={763} width={14} height={537} fill="#101215" />
      <rect x={1174} y={763} width={14} height={537} fill="#101215" />
      <rect
        x={945}
        y={753}
        width={235}
        height={539}
        rx={12}
        fill="none"
        stroke="#cfd3d8"
        stroke-opacity={0.45}
        stroke-width={1}
        stroke-dasharray="3 2"
      />
    </g>
  );
}

/** Width of a drawn title in units: the same 4.2 per character the lever names use. */
const TITLE_CHAR = 4.2;
const BOX_RADIUS = 5;

/** Outline of a group box, open on the top edge where its title sits (static shell art). */
export function groupBoxPath(box: GroupBoxDef): string {
  const { x, y, w, h } = box;
  const r = BOX_RADIUS;
  const half = (box.title.length * TITLE_CHAR + 6) / 2;
  const cx = x + w / 2;
  return [
    `M${cx + half} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}H${cx - half}`,
  ].join('');
}

/** One outlined group box with its title cutting the top edge. */
function GroupBox({ box }: { box: GroupBoxDef }) {
  return (
    <g data-shell="group-box" data-box={box.id}>
      <path
        d={groupBoxPath(box)}
        fill="none"
        stroke={LEGEND}
        stroke-opacity={0.6}
        stroke-width={1}
      />
      <text
        x={box.x + box.w / 2}
        y={box.y + 2}
        text-anchor="middle"
        font-size={6}
        fill={LEGEND}
        textLength={box.title.length * TITLE_CHAR}
        lengthAdjust="spacingAndGlyphs"
      >
        {box.title}
      </text>
    </g>
  );
}

/** Half width of the temperature triangle's wide end, and its distance left of the slot centre. */
const TRIANGLE_HALF = 4;
const TRIANGLE_OFFSET = 18;

export interface TemperatureTriangle {
  /** The wide end (top, at the warm stop) and the point (bottom, at the cold stop). */
  readonly top: { readonly y: number; readonly x1: number; readonly x2: number };
  readonly tip: { readonly x: number; readonly y: number };
}

/**
 * Long thin triangle left of the TEMPERATURE slot, wide end at the warm stop and the point at the
 * cold stop. Positioned from the lever in the registry, never from literals.
 */
export function temperatureTriangle(registry: Registry): TemperatureTriangle | undefined {
  const def = registry.get('lv.env_temp');
  if (def === undefined || def.kind !== 'detent-lever') return undefined;
  const region = registry.regions.find((r) => r.id === def.region);
  if (region === undefined) return undefined;
  const cx = region.bounds.x + def.x - TRIANGLE_OFFSET;
  const cy = region.bounds.y + def.y;
  const warm = def.detents.find((d) => d.id === 'warm');
  const cold = def.detents.find((d) => d.id === 'cold');
  if (warm === undefined || cold === undefined) return undefined;
  return {
    top: {
      y: cy + detentOffset(warm.pos, def.track).dy,
      x1: cx - TRIANGLE_HALF,
      x2: cx + TRIANGLE_HALF,
    },
    tip: { x: cx, y: cy + detentOffset(cold.pos, def.track).dy },
  };
}

/** Environmental-control plate on the console top (plain plate, the controls are widgets), and the pedestal plate below it. */
function EnvironmentalPlate({ registry }: { registry: Registry }) {
  const tri = temperatureTriangle(registry);
  return (
    <g data-shell="environmental-plate">
      <Plate id="environmental" />
      <Plate id="pedestal" />
      <text x={ENV_TITLE.x} y={ENV_TITLE.y} text-anchor="middle" font-size={8} fill={LEGEND}>
        {ENV_TITLE.text}
      </text>
      {ENV_BOXES.map((box) => (
        <GroupBox key={box.id} box={box} />
      ))}
      {tri === undefined ? null : (
        <path
          data-shell="temp-triangle"
          d={`M${tri.top.x1} ${tri.top.y}H${tri.top.x2}L${tri.tip.x} ${tri.tip.y}Z`}
          fill="none"
          stroke={LEGEND}
          stroke-opacity={0.7}
          stroke-width={1}
          stroke-linejoin="round"
        />
      )}
    </g>
  );
}

/** Layer 6: lights recess inside the hump, LIGHTS heading at y 56 with a bracket line each side. */
function LightsRecess() {
  return (
    <g data-shell="lights-recess">
      <Plate id="lights-recess" />
      <path
        d="M956 56 V52 H1088 M1152 52 H1284 V56"
        fill="none"
        stroke={LEGEND}
        stroke-opacity={0.6}
        stroke-width={1}
      />
      <text x={1120} y={56} text-anchor="middle" font-size={8} fill={LEGEND}>
        LIGHTS
      </text>
    </g>
  );
}

/**
 * Layer 8: centre stack plate x 875..1160, y 185..575, with the autopilot unit plate and the two
 * knob column plates beside the displays. The units are regions that draw their own housing
 * (phase 01.2 plan 06), so the shell draws plates only.
 */
function CentreStack() {
  return (
    <g data-shell="centre-stack">
      <Plate id="centre-stack" />
      <Plate id="ap-unit" />
      <Plate id="pfd-left-unit" />
      <Plate id="mfd-right-unit" />
    </g>
  );
}

/** Layer 9: the plates of the lower switch strip (the gear plate is drawn under the bezels) and their engraved placards. */
function SwitchStrips() {
  return (
    <g data-shell="switch-strips">
      <Plate id="strip-switch-row" />
      <Plate id="strip-flaps" />
      {/* LANDING GEAR bracket header over the gear cluster, speed line under it. */}
      <path
        d="M846 646 V630 H986 V646"
        fill="none"
        stroke={LEGEND}
        stroke-opacity={0.6}
        stroke-width={1}
      />
      <text x={916} y={GEAR_BLOCK.headingY} text-anchor="middle" font-size={8} fill={LEGEND}>
        LANDING GEAR
      </text>
      <text x={916} y={GEAR_BLOCK.speedLineY} text-anchor="middle" font-size={6} fill={LEGEND}>
        VLE / VLO = 162 KIAS
      </text>
      {/* ESS BUS placard left of the ESS BUS slot (slot x 572). */}
      <g data-shell="ess-bus-placard" fill={LEGEND} text-anchor="middle">
        <text x={521} y={650} font-size={6}>
          ESS BUS
        </text>
        <text x={521} y={657} font-size={6}>
          NOT FOR
        </text>
        <text x={521} y={664} font-size={6}>
          NORMAL
        </text>
        <text x={521} y={671} font-size={6}>
          OPERATION
        </text>
      </g>
    </g>
  );
}

/**
 * Plate placards (owner finding G-6): static text printed beside a control, resolved against the
 * registry (region origin plus control centre plus the placard offsets). Never state dependent.
 */
function Placards({ registry }: { registry: Registry }) {
  return (
    <g data-shell="placards" fill={LEGEND}>
      {PLACARDS.flatMap((placard) => {
        const def = registry.get(placard.near);
        const region =
          def === undefined ? undefined : registry.regions.find((r) => r.id === def.region);
        if (def === undefined || region === undefined) return [];
        const x = region.bounds.x + def.x + placard.dx;
        const y = region.bounds.y + def.y;
        return placard.lines.map((line, i) => (
          <text
            key={`${placard.id}.${i}`}
            data-placard={placard.id}
            x={x}
            y={y + placardLineY(placard, i)}
            text-anchor={placard.anchor}
            font-size={placard.size}
          >
            {line}
          </text>
        ));
      })}
    </g>
  );
}

/** Plate headings drawn from data: the text centred in its white outline frame (owner finding G-1). */
function PlateHeadings() {
  return (
    <g data-shell="plate-headings">
      {PLATE_HEADINGS.map((h) => (
        <g key={h.id} data-shell="plate-heading" data-heading={h.id}>
          <rect
            x={h.x}
            y={h.y}
            width={h.w}
            height={h.h}
            rx={h.rx}
            fill="none"
            stroke={HEADING_FRAME.stroke}
            stroke-width={HEADING_FRAME.width}
          />
          <text
            x={h.x + h.w / 2}
            y={h.y + h.h / 2 + h.size * 0.35}
            text-anchor="middle"
            font-size={h.size}
            fill={LEGEND}
          >
            {h.text}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Layer 11: de-ice and engine plates of the left strip and the static vent. */
function LeftStrip() {
  return (
    <g data-shell="left-strip">
      <Plate id="deice" />
      <Plate id="engine" />
      <PlateHeadings />
      <g data-shell="vent">
        <circle cx={60} cy={700} r={28} fill="#0a0b0d" stroke={RIM} stroke-width={1} />
        {[21, 14, 7].map((r) => (
          <circle
            key={r}
            data-shell="vent-ring"
            cx={60}
            cy={700}
            r={r}
            fill="none"
            stroke={RIM}
            stroke-width={1}
          />
        ))}
      </g>
    </g>
  );
}

const FUEL_BARS: readonly { y: number; w: number }[] = [
  { y: 648, w: 110 },
  { y: 658, w: 88 },
  { y: 668, w: 100 },
  { y: 678, w: 76 },
  { y: 688, w: 104 },
];

/** Layer 12: NO SMOKING placard outline and the fuel placard (decorative bars, no real text). */
function StaticDecor() {
  return (
    <g data-shell="decor">
      <rect
        x={965}
        y={725}
        width={64}
        height={14}
        rx={2}
        fill="none"
        stroke={LEGEND}
        stroke-opacity={0.6}
        stroke-width={1}
      />
      <text x={997} y={735} text-anchor="middle" font-size={6} fill={LEGEND}>
        NO SMOKING
      </text>
      <rect x={1560} y={640} width={140} height={60} rx={3} fill="#3b4047" stroke={RIM} />
      {FUEL_BARS.map((bar) => (
        <rect key={bar.y} x={1570} y={bar.y} width={bar.w} height={4} rx={1} fill="#5b626b" />
      ))}
    </g>
  );
}

/** Pure static shell art layer; reads only the PFD and MFD bounds of the registry. */
export function PanelShell({ registry }: { registry: Registry }) {
  const pfd = registry.regions.find((r) => r.id === 'pfd');
  const mfd = registry.regions.find((r) => r.id === 'mfd');
  return (
    <g data-layer="shell" pointer-events="none">
      <KneeCavity width={registry.viewBox.w} />
      <ConsoleBody />
      <FacePlate />
      <Coaming />
      <LightsRecess />
      {/* The gear plate runs up to 28 units under the PFD bezel corner; drawn first so the bezel stays whole. */}
      <Plate id="strip-gear" />
      {pfd === undefined ? null : <DisplayBezel {...pfd.bounds} />}
      {mfd === undefined ? null : <DisplayBezel {...mfd.bounds} />}
      <CentreStack />
      <SwitchStrips />
      <BusPanelArt plate={<Plate id="bus-panel" />} />
      <LeftStrip />
      <StaticDecor />
      <EnvironmentalPlate registry={registry} />
      {/* After every plate, so no plate paints over a placard. */}
      <Placards registry={registry} />
      <Nameplate />
      <Wordmark />
    </g>
  );
}
