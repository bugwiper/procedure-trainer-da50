import { useSignal } from '@preact/signals';
import type { ToggleDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';

const TAP_SLOP_PX = 10;
const FONT = 'B612, system-ui, sans-serif';

interface PointerStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Toggle widget (switch and softkey skins). State reads from the graphic position and
 * the state text, never from colour alone (D-13). Pointer contract: only primary
 * pointers, capture on pointerdown, actuate on a pointerup within the tap slop, never
 * listen to click (RESEARCH Pattern 5).
 */
export function Toggle({ def, bridge }: WidgetProps<ToggleDef>) {
  const pressed = useSignal(false);
  const start = useSignal<PointerStart | null>(null);

  const [first, second] = def.states;
  const state = bridge.stateOf(def.id).value;
  const isSecond = state === second.id;
  const stateLabel = (isSecond ? second : first).label;

  const clear = () => {
    start.value = null;
    pressed.value = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the tap is still evaluated on pointerup.
    }
    start.value = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    pressed.value = true;
  };

  const onPointerUp = (e: PointerEvent) => {
    const s = start.value;
    if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
    clear();
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP_PX) return;
    bridge.actuate(def.id, isSecond ? first.id : second.id);
  };

  const skin = def.skin ?? 'bat';
  const top = -def.hit.h / 2;
  const labelWidth = Math.min(def.label.length * 5.2, def.hit.w - 2);

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      transform={`translate(${def.x} ${def.y})`}
    >
      {skin === 'bat' ? (
        <SwitchBody
          def={def}
          top={top}
          labelWidth={labelWidth}
          isSecond={isSecond}
          pressed={pressed.value}
          stateLabel={stateLabel}
        />
      ) : (
        <SoftkeyBody
          def={def}
          labelWidth={Math.min(def.label.length * 3.6, def.hit.w - 6)}
          isSecond={isSecond}
          pressed={pressed.value}
          stateLabel={stateLabel}
        />
      )}
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={clear}
        onLostPointerCapture={clear}
      />
    </g>
  );
}

export interface BodyProps {
  readonly def: Pick<ToggleDef, 'label' | 'hit'>;
  readonly isSecond: boolean;
  readonly pressed: boolean;
  readonly stateLabel: string;
  readonly labelWidth: number;
}

/** Switch skin, shared with the guarded toggle widget. */
export function SwitchBody({
  def,
  top,
  labelWidth,
  isSecond,
  pressed,
  stateLabel,
}: BodyProps & { top: number }) {
  const h = def.hit.h;
  const labelY = top + 9;
  const lampY = labelY + 10;
  const textY = h / 2 - 6;
  const pivotY = 4.5;
  const reach = Math.min(14, (h - 37) / 2 - 1);
  // The bat handle points up for the second state and down for the first.
  const tipY = isSecond ? pivotY - reach : pivotY + reach;
  return (
    <g pointer-events="none">
      <text
        x={0}
        y={labelY}
        text-anchor="middle"
        font-family={FONT}
        font-size={8}
        fill="#aab3bd"
        textLength={labelWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {def.label}
      </text>
      <circle
        cx={0}
        cy={lampY}
        r={3.5}
        fill={isSecond ? '#39d98a' : '#2b3138'}
        stroke="#4a525c"
        stroke-width={1}
      />
      <circle cx={0} cy={pivotY} r={5} fill={pressed ? '#56606b' : '#3a424b'} stroke="#6b7580" />
      <line
        x1={0}
        y1={pivotY}
        x2={0}
        y2={tipY}
        stroke={pressed ? '#ffffff' : '#d8dde3'}
        stroke-width={5}
        stroke-linecap="round"
      />
      <text
        data-state-text
        x={0}
        y={textY}
        text-anchor="middle"
        font-family={FONT}
        font-size={9}
        font-weight={700}
        fill="#d8dde3"
      >
        {stateLabel}
      </text>
    </g>
  );
}

function SoftkeyBody({ def, labelWidth, isSecond, pressed, stateLabel }: Omit<BodyProps, never>) {
  const w = def.hit.w - 2;
  const h = def.hit.h - 2;
  return (
    <g pointer-events="none">
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={5}
        fill={pressed ? '#3a424b' : '#262c33'}
        stroke={isSecond ? '#5ab0ff' : '#4a525c'}
        stroke-width={isSecond ? 2.5 : 1}
      />
      <text
        x={0}
        y={-5}
        text-anchor="middle"
        font-family={FONT}
        font-size={6}
        fill="#aab3bd"
        textLength={labelWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {def.label}
      </text>
      <text
        data-state-text
        x={0}
        y={9}
        text-anchor="middle"
        font-family={FONT}
        font-size={8}
        font-weight={700}
        fill="#d8dde3"
      >
        {stateLabel}
      </text>
    </g>
  );
}
