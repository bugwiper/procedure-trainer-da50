import {
  SOFTKEY_CENTRE_Y,
  SOFTKEY_KEY,
  SOFTKEY_ROWS,
  SOFTKEY_SLOT_COUNT,
  softkeyCentre,
} from '../../../aircraft/da50rg/avionics';
import type { DisplayId } from '../../../aircraft/da50rg/avionics';
import type { FrameProps } from './MfdFrame';

const KEY_FILL = '#15181c';
const KEY_PRESSED_FILL = '#2a3037';
const KEY_RIM = '#2d3138';
const KEY_TOP_EDGE = 'rgba(255,255,255,0.14)';
const TRIANGLE = '#e6e9ed';
const SELECTED_STROKE = '#e6e9ed';

interface CapProps {
  /** Centre of the key in the coordinate space of the parent group. */
  readonly cx: number;
  readonly cy: number;
  readonly selected?: boolean;
  readonly pressed?: boolean;
}

/**
 * One hardware key: a dark rounded cap with a light top edge and a white up-triangle, no text
 * (the legend stands on the glass above it). The interactive key and the inert ones share it, so
 * they cannot look different. Selected is a 2.5-unit white stroke (Color 5), never colour alone.
 */
export function SoftkeyCap({ cx, cy, selected = false, pressed = false }: CapProps) {
  const { w, h, rx } = SOFTKEY_KEY;
  return (
    <>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={pressed ? KEY_PRESSED_FILL : KEY_FILL}
        stroke={selected ? SELECTED_STROKE : KEY_RIM}
        stroke-width={selected ? 2.5 : 1}
      />
      <path
        d={`M ${cx - w / 2 + rx} ${cy - h / 2 + 1.5} H ${cx + w / 2 - rx}`}
        fill="none"
        stroke={KEY_TOP_EDGE}
        stroke-width={1}
      />
      <path
        d={`M ${cx - 3.5} ${cy + 2.5} L ${cx + 3.5} ${cy + 2.5} L ${cx} ${cy - 2.5} Z`}
        fill={TRIANGLE}
      />
    </>
  );
}

function displayOf(regionId: string): DisplayId | undefined {
  return (Object.keys(SOFTKEY_ROWS) as DisplayId[]).find(
    (d) => SOFTKEY_ROWS[d].regionId === regionId,
  );
}

/**
 * Inert softkey art of one softkey region (D-04, T-01.2-09): every slot of the row except the one
 * that holds a control, in region-local coordinates. Hook-free, no handler, pointer events off, so
 * a tap on an inert key reaches nothing and emits no event.
 */
export function SoftkeysFrame({ region, bridge }: FrameProps) {
  const display = displayOf(region.id);
  if (display === undefined) return <g data-softkeys={region.id} pointer-events="none" />;
  const { x: ox, y: oy } = region.bounds;
  const owned = region.controlIds.flatMap((id) => bridge.registry.get(id) ?? []);
  const keys = [];
  for (let slot = 0; slot < SOFTKEY_SLOT_COUNT; slot++) {
    const c = softkeyCentre(display, slot);
    const cx = c.x - ox;
    const cy = SOFTKEY_CENTRE_Y - oy;
    if (owned.some((def) => Math.abs(def.x - cx) < 0.5 && Math.abs(def.y - cy) < 0.5)) continue;
    keys.push(
      <g key={slot} data-softkey={`${display}:${slot + 1}`}>
        <SoftkeyCap cx={cx} cy={cy} />
      </g>,
    );
  }
  return (
    <g data-softkeys={region.id} pointer-events="none">
      {keys}
    </g>
  );
}
