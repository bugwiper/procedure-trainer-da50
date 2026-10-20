import { useRef } from 'preact/hooks';
import type { MomentaryButtonDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';

const FONT = 'B612, system-ui, sans-serif';

/**
 * Momentary push button (D-07c). Pointer contract: only primary pointers; pointerdown
 * captures the pointer and actuates the pressed state at once; the first of pointerup,
 * pointercancel or lostpointercapture actuates the released state exactly once (a per-press
 * flag, with the store's "unchanged" rejection as the backstop), so the button can never
 * stay stuck pressed (RESEARCH Pitfall 7).
 */
export function MomentaryButton({ def, bridge }: WidgetProps<MomentaryButtonDef>) {
  const [released, pressed] = def.states;
  const activePointer = useRef<number | null>(null);

  const state = bridge.stateOf(def.id).value;
  const isPressed = state === pressed.id;
  const stateLabel = (isPressed ? pressed : released).label;

  const release = (e: PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    bridge.actuate(def.id, released.id);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary || activePointer.current !== null) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the release is still handled on pointerup.
    }
    activePointer.current = e.pointerId;
    bridge.actuate(def.id, pressed.id);
  };

  const top = -def.hit.h / 2;
  const labelY = top + 9;
  const textY = def.hit.h / 2 - 6;
  const capY = (labelY + textY) / 2;
  const capR = Math.min(13, (textY - labelY) / 2 - 8);
  const labelWidth = Math.min(def.label.length * 5.2, def.hit.w - 2);

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      transform={`translate(${def.x} ${def.y})`}
    >
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
        {/* Lit ring while pressed; the cap looks depressed (smaller, darker, shifted down). */}
        <circle
          cx={0}
          cy={capY}
          r={capR + 3}
          fill="none"
          stroke={isPressed ? '#39d98a' : '#2b3138'}
          stroke-width={2}
        />
        <circle
          cx={0}
          cy={capY + (isPressed ? 1 : 0)}
          r={isPressed ? capR - 1 : capR}
          fill={isPressed ? '#2f353c' : '#4a525c'}
          stroke="#6b7580"
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
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        onPointerDown={onPointerDown}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      />
    </g>
  );
}
