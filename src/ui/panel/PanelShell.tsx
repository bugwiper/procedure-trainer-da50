import type { Registry } from '../../engine/registry';
import { PLATES } from '../../aircraft/da50rg/plates';
import type { PlateDef } from '../../aircraft/da50rg/plates';
import { paint } from './Defs';

// Static shell art under all regions (UI-SPEC "Panel Surface", D-01, D-02, D-06). Original flat
// vector work in the final 2000 x 1300 space: solid fills, shared gradients and strokes only.
// Every element is decorative: the root has pointer-events none and nothing here carries a
// pointer handler or a tap-target attribute, so taps on art emit no control event (P1 D-09).

const BEZEL_GROW = 16;
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
  environmental: '#1f2226',
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
function KneeCavity() {
  return <rect data-shell="knee-cavity" x={0} y={745} width={2000} height={555} fill="#0e1013" />;
}

/** Layer 3: face plate x 20..1980, y 190..745, upper corners rx 24, lower corners rx 40. */
const FACE_PLATE_PATH =
  'M44 190 H1956 A24 24 0 0 1 1980 214 V705 A40 40 0 0 1 1940 745 H60 A40 40 0 0 1 20 705 V214 A24 24 0 0 1 44 190 Z';

function FacePlate() {
  return (
    <g data-shell="face-plate">
      <path d={FACE_PLATE_PATH} fill={paint('g-plate')} />
      {/* Light from the top left: 1-unit light edge on top and left, dark edge bottom and right. */}
      <path
        d="M20.5 705 V214 A23.5 23.5 0 0 1 44 190.5 H1956"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        stroke-width={1}
      />
      <path
        d="M1979.5 214 V705 A39.5 39.5 0 0 1 1940 744.5 H60 A39.5 39.5 0 0 1 20.5 705"
        fill="none"
        stroke="rgba(0,0,0,0.6)"
        stroke-width={1}
      />
    </g>
  );
}

/** Layer 5: leather coaming with the glareshield hump spanning x 880..1380 (centre 1130). */
const COAMING_PATH =
  'M0 190 L0 130 Q0 100 40 96 L760 84 Q820 82 850 56 L880 24 Q890 12 910 12 L1350 12 Q1370 12 1380 24 L1410 56 Q1440 82 1500 84 L1960 96 Q2000 100 2000 130 L2000 190 Z';
/** The stitch line follows the top edge, inset 8. */
const COAMING_STITCH_PATH =
  'M8 190 L8 134 Q8 108 44 104 L760 92 Q828 90 858 64 L888 32 Q896 20 910 20 L1350 20 Q1364 20 1372 32 L1402 64 Q1432 90 1500 92 L1956 104 Q1992 108 1992 134 L1992 190';

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

/** Layer 7 plus the GO-AROUND mark: a display bezel is its region grown by 16, rx 10. */
function DisplayBezel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g data-shell="bezel">
      <rect
        x={x - BEZEL_GROW}
        y={y - BEZEL_GROW}
        width={w + 2 * BEZEL_GROW}
        height={h + 2 * BEZEL_GROW}
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

/** Environmental-control plate on the console top (plain plate, the sliders are widgets). */
function EnvironmentalPlate() {
  return (
    <g data-shell="environmental-plate">
      <Plate id="environmental" />
      <text x={1062} y={782} text-anchor="middle" font-size={8} fill={LEGEND}>
        ENVIRONMENTAL CONTROL
      </text>
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

/** One plain recessed outline that reserves the space of a Phase 01.2 avionics unit. */
function ReservedOutline({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      data-shell="reserved-outline"
      x={x}
      y={y}
      width={w}
      height={h}
      rx={4}
      fill="#0b0c0e"
      stroke={RIM}
      stroke-width={1}
    />
  );
}

/**
 * Layer 8: centre stack plate x 880..1240, y 185..560. The audio panel column, the standby
 * instrument and the autopilot column are outlines only (Phase 01.2 draws them); they start
 * below the two dimmer knobs (y 300).
 */
function CentreStack() {
  return (
    <g data-shell="centre-stack">
      <Plate id="centre-stack" />
      <ReservedOutline x={892} y={300} w={76} h={248} />
      <ReservedOutline x={982} y={300} w={156} h={140} />
      <ReservedOutline x={1152} y={300} w={76} h={248} />
    </g>
  );
}

/** Layer 9: the two plates of the lower switch strip and their engraved placards. */
function SwitchStrips() {
  return (
    <g data-shell="switch-strips">
      <Plate id="strip-left" />
      <Plate id="strip-right" />
      {/* LANDING GEAR bracket header over the gear cluster, speed line under it. */}
      <path
        d="M846 646 V630 H986 V646"
        fill="none"
        stroke={LEGEND}
        stroke-opacity={0.6}
        stroke-width={1}
      />
      <text x={916} y={640} text-anchor="middle" font-size={8} fill={LEGEND}>
        LANDING GEAR
      </text>
      <text x={916} y={733} text-anchor="middle" font-size={6} fill={LEGEND}>
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

/** One bracket outline of the right bus panel with its heading. */
function BusBracket({ y, h, title }: { y: number; h: number; title: string }) {
  return (
    <g data-shell="bus-bracket">
      <rect
        x={1810}
        y={y}
        width={160}
        height={h}
        rx={4}
        fill="none"
        stroke={LEGEND}
        stroke-opacity={0.4}
        stroke-width={1}
      />
      <text x={1890} y={y + 14} text-anchor="middle" font-size={8} fill={LEGEND}>
        {title}
      </text>
    </g>
  );
}

/** Layer 10: bus panel x 1800..1980. Bracket outlines and headings only (breakers: PNL-12). */
function BusPanel() {
  return (
    <g data-shell="bus-panel">
      <rect x={1800} y={215} width={180} height={530} rx={8} fill="#15171a" stroke={RIM} />
      <BusBracket y={225} h={140} title="ESSENTIAL BUS" />
      <BusBracket y={375} h={190} title="MAIN BUS" />
      <BusBracket y={575} h={160} title="AVIONICS BUS" />
    </g>
  );
}

/** Layer 11: de-ice and engine plates of the left strip and the static vent. */
function LeftStrip() {
  return (
    <g data-shell="left-strip">
      <Plate id="deice" />
      <Plate id="engine" />
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
      <KneeCavity />
      <ConsoleBody />
      <FacePlate />
      <Coaming />
      <LightsRecess />
      {pfd === undefined ? null : <DisplayBezel {...pfd.bounds} />}
      {mfd === undefined ? null : <DisplayBezel {...mfd.bounds} />}
      <CentreStack />
      <SwitchStrips />
      <BusPanel />
      <LeftStrip />
      <StaticDecor />
      <EnvironmentalPlate />
      <Nameplate />
      <Wordmark />
    </g>
  );
}
