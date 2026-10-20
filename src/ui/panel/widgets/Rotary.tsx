import { useSignal } from '@preact/signals';
import { Fragment } from 'preact';
import { useRef } from 'preact/hooks';
import { angleOf, nearestStop, stepStop, stopAngle } from '../../../engine/rotary';
import type { RotaryDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';

const MIN_DRAG_PX = 4;
/** A drag point closer than this to the knob centre gives no stable angle. */
const MIN_RADIUS = 2;
const FONT = 'B612, system-ui, sans-serif';
const KNURLS = 24;

interface Gesture {
  readonly pointerId: number;
  /** Client point of pointerdown, for the travel threshold. */
  readonly x: number;
  readonly y: number;
  /** The pointerdown was on the right half of the knob (local x >= 0). */
  readonly right: boolean;
  dragging: boolean;
  lastAngle: number | null;
}

/** Point at `angle` degrees clockwise from 12 o'clock and distance `radius` from the centre. */
function polar(angle: number, radius: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  return { x: radius * Math.sin(a), y: -radius * Math.cos(a) };
}

function fixed(value: number): string {
  return value.toFixed(2);
}

/** Splits a long placard into two balanced lines at a space. */
function placardLines(label: string): string[] {
  if (label.length <= 9 || !label.includes(' ')) return [label];
  const mid = label.length / 2;
  let best = -1;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return [label.slice(0, best), label.slice(best + 1)];
}

/** Path of the 24 knurl ticks along the rim, as one element. */
function knurlPath(r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < KNURLS; i++) {
    const a = (i * 360) / KNURLS;
    const from = polar(a, r - 2.5);
    const to = polar(a, r - 0.8);
    parts.push(`M${fixed(from.x)} ${fixed(from.y)}L${fixed(to.x)} ${fixed(to.y)}`);
  }
  return parts.join('');
}

/** Tick marks of the arc scale: a long tick at every stop, a short one halfway between. */
function arcTicks(def: RotaryDef): string {
  const parts: string[] = [];
  const stops = def.stops;
  stops.forEach((stop, i) => {
    const from = polar(stop.angle, def.r + 1.5);
    const to = polar(stop.angle, def.r + 4.5);
    parts.push(`M${fixed(from.x)} ${fixed(from.y)}L${fixed(to.x)} ${fixed(to.y)}`);
    const next = stops[i + 1];
    if (next !== undefined) {
      const mid = (stop.angle + next.angle) / 2;
      const a = polar(mid, def.r + 1.5);
      const b = polar(mid, def.r + 3.5);
      parts.push(`M${fixed(a.x)} ${fixed(a.y)}L${fixed(b.x)} ${fixed(b.y)}`);
    }
  });
  return parts.join('');
}

export interface RotaryBodyProps {
  readonly def: RotaryDef;
  /** Committed stop id: the pointer rests there. */
  readonly state: string;
  /** Angle the pointer follows while a drag is in progress; never reaches the store. */
  readonly dragAngle?: number | null;
  /** Transient: a pointer is down on the knob. */
  readonly pressed: boolean;
}

/**
 * Knob art (UI-SPEC 8.4), pure: black disc with rim and knurl ticks, white pointer line, printed
 * scale and placard, all static (G-0.1: the knob shows its stop by the pointer, never as text). Wide
 * footprints (the FAN, twice as wide as high) put the placard left; others put it above.
 */
export function RotaryBody({ def, state, dragAngle, pressed }: RotaryBodyProps) {
  const { r } = def;
  const scale = def.scale ?? 'none';
  const current = def.stops.find((s) => s.id === state) ?? def.stops[0];
  const angle = dragAngle ?? (current === undefined ? 0 : stopAngle(def, current.id));
  const tip = polar(angle, 0.8 * r);
  const root = polar(angle, 4);
  const wide = def.hit.w >= 2 * def.hit.h;
  const lines = placardLines(def.label);

  const labelRadius = scale === 'none' ? r + 7 : scale === 'arc' ? r + 7.5 : r + 8;
  const dotRadius = r + 3;

  return (
    <g pointer-events="none">
      {lines.map((line, i) => {
        const y = wide
          ? 3 + (i - (lines.length - 1) / 2) * 9.6
          : -(r + (scale === 'none' ? 4 : 12)) - (lines.length - 1 - i) * 9.6;
        return (
          <text
            key={line}
            x={wide ? -def.hit.w / 2 + 1 : 0}
            y={y}
            text-anchor={wide ? 'start' : 'middle'}
            font-family={FONT}
            font-size={8}
            fill="#aab3bd"
          >
            {line}
          </text>
        );
      })}
      {scale === 'arc' ? (
        <path d={arcTicks(def)} fill="none" stroke="#6b7580" stroke-width={1} />
      ) : null}
      {def.stops.map((stop, i) => {
        const p = polar(stop.angle, labelRadius);
        return (
          <Fragment key={stop.id}>
            {scale === 'dots' ? (
              <circle
                cx={fixed(polar(stop.angle, dotRadius).x)}
                cy={fixed(polar(stop.angle, dotRadius).y)}
                r={0.6 + 0.35 * i}
                fill="#aab3bd"
              />
            ) : null}
            <text
              x={fixed(p.x)}
              y={fixed(p.y + 2)}
              text-anchor="middle"
              font-family={FONT}
              font-size={6}
              fill="#aab3bd"
            >
              {stop.label}
            </text>
          </Fragment>
        );
      })}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="#0d0e10"
        stroke={pressed ? '#8fb8e6' : '#3a3f46'}
        stroke-width={1}
      />
      <path d={knurlPath(r)} fill="none" stroke="#2e3238" stroke-width={0.8} />
      <line
        x1={fixed(root.x)}
        y1={fixed(root.y)}
        x2={fixed(tip.x)}
        y2={fixed(tip.y)}
        stroke="#f2f4f7"
        stroke-width={2}
        stroke-linecap="round"
      />
    </g>
  );
}

/**
 * Knob widget (D-07, D-10). Phase 1 pointer contract: primary pointer only, capture on
 * pointerdown, no click listener; cancel and lost capture clear without dispatching. A release
 * under 4 px of travel is a tap: the right half steps one stop clockwise, the left half one back
 * (a two-stop knob always toggles). A longer gesture is a drag: the pointer follows the finger
 * in a UI-local signal and the nearest stop is committed on release. Only stop ids reach the
 * store (T-01.1-07).
 */
export function Rotary({ def, bridge }: WidgetProps<RotaryDef>) {
  const groupRef = useRef<SVGGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const dragAngle = useSignal<number | null>(null);
  const pressed = useSignal(false);

  const state = bridge.stateOf(def.id).value;
  const stateLabel = def.stops.find((s) => s.id === state)?.label ?? state;

  const toLocal = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const m = groupRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const clear = () => {
    gesture.current = null;
    dragAngle.value = null;
    pressed.value = false;
  };

  /** Angle of a client point seen from the knob centre; null when too close to the centre. */
  const angleAt = (clientX: number, clientY: number): number | null => {
    const local = toLocal(clientX, clientY);
    if (local === null || Math.hypot(local.x, local.y) < MIN_RADIUS) return null;
    return angleOf(local.x, local.y);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const local = toLocal(e.clientX, e.clientY);
    if (local === null) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the release is still evaluated on pointerup.
    }
    gesture.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      right: local.x >= 0,
      dragging: false,
      lastAngle: null,
    };
    pressed.value = true;
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!e.isPrimary || g === null || g.pointerId !== e.pointerId) return;
    if (!g.dragging && Math.hypot(e.clientX - g.x, e.clientY - g.y) >= MIN_DRAG_PX) {
      g.dragging = true;
    }
    if (!g.dragging) return;
    const angle = angleAt(e.clientX, e.clientY);
    if (angle === null) return;
    g.lastAngle = angle;
    dragAngle.value = angle;
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!e.isPrimary || g === null || g.pointerId !== e.pointerId) return;
    const dragging = g.dragging || Math.hypot(e.clientX - g.x, e.clientY - g.y) >= MIN_DRAG_PX;
    const angle = dragging ? (angleAt(e.clientX, e.clientY) ?? g.lastAngle) : null;
    clear();
    if (dragging) {
      if (angle !== null) bridge.actuate(def.id, nearestStop(def, angle));
      return;
    }
    bridge.actuate(def.id, stepStop(def, bridge.stateOf(def.id).value, g.right ? 1 : -1));
  };

  return (
    <g
      ref={groupRef}
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      role="img"
      aria-label={`${def.label}: ${stateLabel}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <RotaryBody def={def} state={state} dragAngle={dragAngle.value} pressed={pressed.value} />
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={clear}
        onLostPointerCapture={clear}
      />
    </g>
  );
}
