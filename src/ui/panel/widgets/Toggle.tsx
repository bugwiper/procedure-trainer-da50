import { useSignal } from '@preact/signals';
import type { ToggleDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { BatBody } from '../skins/Bat';
import { RockerBody } from '../skins/Rocker';

const TAP_SLOP_PX = 10;
const FONT = 'B612, system-ui, sans-serif';

interface PointerStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Toggle widget (switch and softkey skins). State reads from the graphic position (and the
 * data-state and aria-label for tests and assistive technology), never from colour alone and never
 * from printed text (G-0.1). Pointer contract: only primary
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

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      data-skin={skin}
      data-size={def.size}
      data-colour={def.colour}
      data-pressed-half={skin === 'rocker' ? (isSecond ? 'upper' : 'lower') : undefined}
      data-pressed={pressed.value ? 'true' : undefined}
      role="img"
      aria-label={`${def.label}: ${stateLabel}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      {skin === 'rocker' ? (
        <RockerBody def={def} position={isSecond ? 'high' : 'low'} pressed={pressed.value} />
      ) : skin === 'bat' ? (
        <BatBody def={def} position={isSecond ? 'high' : 'low'} pressed={pressed.value} />
      ) : (
        <SoftkeyBody
          def={def}
          labelWidth={Math.min(def.label.length * 3.6, def.hit.w - 6)}
          isSecond={isSecond}
          pressed={pressed.value}
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
  readonly labelWidth: number;
}

/**
 * Softkey skin: the selected state is a 2.5-unit white stroke (Color 5). The body draws its
 * legend only, centred; the state is never printed (G-0.1).
 */
export function SoftkeyBody({ def, labelWidth, isSecond, pressed }: BodyProps) {
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
        stroke={isSecond ? '#e6e9ed' : '#4a525c'}
        stroke-width={isSecond ? 2.5 : 1}
      />
      <text
        x={0}
        y={2}
        text-anchor="middle"
        font-family={FONT}
        font-size={6}
        fill="#aab3bd"
        textLength={labelWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {def.label}
      </text>
    </g>
  );
}
