import type { Registry } from '../../engine/registry';
import { paint } from './Defs';

// Static shell art under all regions (UI-SPEC "Panel Surface", D-01, D-02, D-06). Original flat
// vector work in the final 2000 x 1300 space: solid fills, shared gradients and strokes only.
// Every element is decorative: the root has pointer-events none and nothing here carries a
// pointer handler or a tap-target attribute, so taps on art emit no control event (P1 D-09).

const BEZEL_GROW = 16;
const BEZEL_FILL = '#0c0d0f';
const RIM = '#2d3138';
const LEGEND = '#c9d0d8';

// Letter spacing is a style because the `.panel-svg text` CSS rule would override the attribute.
const TRACK_BEZEL = 'letter-spacing:0.2em';
const TRACK_WORDMARK = 'letter-spacing:0.3em';

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

/** Pure static shell art layer; reads only the PFD and MFD bounds of the registry. */
export function PanelShell({ registry }: { registry: Registry }) {
  const pfd = registry.regions.find((r) => r.id === 'pfd');
  const mfd = registry.regions.find((r) => r.id === 'mfd');
  return (
    <g data-layer="shell" pointer-events="none">
      <KneeCavity />
      <FacePlate />
      <Coaming />
      <Nameplate />
      {pfd === undefined ? null : <DisplayBezel {...pfd.bounds} />}
      {mfd === undefined ? null : <DisplayBezel {...mfd.bounds} />}
      <Wordmark />
    </g>
  );
}
