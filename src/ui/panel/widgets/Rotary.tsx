import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import {
  MIN_RADIUS,
  angleOf,
  nearestStop,
  oneWayPointer,
  oneWayStop,
  oneWayTravel,
  stepStop,
  stopAngle,
  tapStop,
} from '../../../engine/rotary';
import type { RotaryDef } from '../../../engine/registry';
import type { DispatchResult } from '../../../engine/store';
import type { WidgetProps } from '../ControlWidget';
import { DRAG_START_PX } from '../press-arbiter';
import { registerPressTarget, seqOf } from '../press-targets';
import type { PressTarget } from '../press-targets';

const FONT = 'B612, system-ui, sans-serif';
const KNURLS = 24;

interface Gesture {
  readonly pointerId: number;
  /** Client point of pointerdown, for the travel threshold. */
  readonly x: number;
  readonly y: number;
  /** Knob-local point of pointerdown: its half steps a knob, its spot sets a stop. */
  readonly local: { readonly x: number; readonly y: number };
  /** Committed stop at pointerdown: a one-way knob measures its drag from there. */
  readonly from: string;
  /** One-way knob: pointer angle at the last sample and clockwise travel since pointerdown. */
  prevAngle: number | null;
  travel: number;
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

/** Half extent of the smallest fan symbol and the growth per further stop, in units. */
const FAN_SIZE_MIN = 3;
const FAN_SIZE_STEP = 1.5;

/**
 * One four-blade propeller glyph as a single path (four subpaths), blade length `size`, centred on
 * the origin. Original simple shapes: each blade is a leaf from the hub, the four turned 20
 * degrees off the axes so the glyph reads as a fan and not as a cross.
 */
export function fanGlyphPath(size: number): string {
  const parts: string[] = [];
  const width = 0.42 * size;
  for (let k = 0; k < 4; k++) {
    const a = ((20 + 90 * k) * Math.PI) / 180;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const vx = Math.cos(a);
    const vy = Math.sin(a);
    const at = (along: number, across: number): string =>
      `${fixed(along * size * ux + across * vx)} ${fixed(along * size * uy + across * vy)}`;
    parts.push(
      `M0 0C${at(0.3, width)} ${at(0.85, 0.8 * width)} ${at(1, 0)}` +
        `C${at(0.85, -0.8 * width)} ${at(0.3, -width)} 0 0Z`,
    );
  }
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

/** Colours of the selector-bar look: a red knob, a white pointing line, white position words. */
export const SELECTOR_RED = '#b3141c';
export const SELECTOR_RED_EDGE = '#7a0d13';
const SELECTOR_WORD = '#f2f4f7';
/** Gap between the sweep of the knob and its position words, in units. */
const SELECTOR_WORD_GAP = 4;
/** Length of the white line at the pointing end of the selector bar, in units. */
const SELECTOR_LINE = 8;

/** Width of the selector bar: the 4 to 1 shape of the real 8 by 2 cm knob (length 2r). */
export function selectorBarWidth(r: number): number {
  return r / 2;
}

/**
 * The elongated selector knob (C-52): a red bar of length 2r and width r/2 turned to the pointer
 * angle, a short white line at its pointing end, and the position words in white outside the sweep
 * at their stop directions, each reading away from the knob. All text is static (G-0.1).
 */
function SelectorBarBody({ def, state, dragAngle, pressed }: RotaryBodyProps) {
  const { r } = def;
  const current = def.stops.find((s) => s.id === state) ?? def.stops[0];
  const angle = dragAngle ?? (current === undefined ? 0 : stopAngle(def, current.id));
  const width = selectorBarWidth(r);
  const lines = def.nameless === true ? [] : placardLines(def.label);
  return (
    <g pointer-events="none" data-skin={def.skin}>
      {lines.map((line, i) => (
        <text
          key={line}
          x={0}
          y={-(r + 12) - (lines.length - 1 - i) * 9.6}
          text-anchor="middle"
          font-family={FONT}
          font-size={8}
          fill="#aab3bd"
        >
          {line}
        </text>
      ))}
      {def.stops.map((stop) => {
        const p = polar(stop.angle, r + SELECTOR_WORD_GAP);
        const side = Math.sin((stop.angle * Math.PI) / 180);
        // Screen direction of the stop: positive is down.
        const down = -Math.cos((stop.angle * Math.PI) / 180);
        // Words read away from the knob: right of it for a stop on the right, left of it for a stop
        // on the left, above or below it for a stop straight up or down.
        const anchor = side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle';
        // A stop straight up or down puts its word above or below the point; a diagonal or sideways
        // stop puts it beside the point.
        const y =
          Math.abs(side) <= 0.3 ? (down > 0 ? p.y + 6 : p.y - 1) : p.y + (down > 0.3 ? 3 : 2);
        return (
          <text
            key={stop.id}
            data-selector-word={stop.id}
            x={fixed(p.x)}
            y={fixed(y)}
            text-anchor={anchor}
            font-family={FONT}
            font-size={6}
            font-weight={700}
            fill={SELECTOR_WORD}
          >
            {stop.label}
          </text>
        );
      })}
      <g data-selector-knob transform={`rotate(${fixed(angle)})`}>
        <rect
          data-selector-bar
          x={-width / 2}
          y={-r}
          width={width}
          height={2 * r}
          rx={width / 2}
          fill={SELECTOR_RED}
          stroke={pressed ? '#8fb8e6' : SELECTOR_RED_EDGE}
          stroke-width={pressed ? 2 : 1}
        />
        <line
          data-selector-line
          x1={0}
          y1={fixed(-r + 3)}
          x2={0}
          y2={fixed(-r + 3 + SELECTOR_LINE)}
          stroke="#ffffff"
          stroke-width={1.5}
          stroke-linecap="round"
        />
      </g>
    </g>
  );
}

/**
 * Knob art (UI-SPEC 8.4), pure: black disc with rim and knurl ticks, white pointer line, printed
 * scale and placard, all static (G-0.1: the knob shows its stop by the pointer, never as text). Wide
 * footprints (the FAN, twice as wide as high) put the placard left; others put it above.
 */
export function RotaryBody(props: RotaryBodyProps) {
  if (props.def.skin === 'selector-bar') return <SelectorBarBody {...props} />;
  const { def, state, dragAngle, pressed } = props;
  const { r } = def;
  const scale = def.scale ?? 'none';
  const current = def.stops.find((s) => s.id === state) ?? def.stops[0];
  const angle = dragAngle ?? (current === undefined ? 0 : stopAngle(def, current.id));
  const tip = polar(angle, 0.8 * r);
  const root = polar(angle, 4);
  const wide = def.hit.w >= 2 * def.hit.h;
  const lines = def.nameless === true ? [] : placardLines(def.label);

  const labelRadius = scale === 'none' ? r + 7 : scale === 'arc' ? r + 7.5 : r + 8;

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
        // The fan scale prints the first stop's label only; the others carry a fan symbol.
        if (scale === 'fan' && i > 0) {
          const size = FAN_SIZE_MIN + FAN_SIZE_STEP * (i - 1);
          return (
            <path
              key={stop.id}
              data-fan-symbol={stop.id}
              data-fan-size={size}
              transform={`translate(${fixed(p.x)} ${fixed(p.y)})`}
              d={fanGlyphPath(size)}
              fill="#aab3bd"
            />
          );
        }
        return (
          <text
            key={stop.id}
            x={fixed(p.x)}
            y={fixed(p.y + 2)}
            text-anchor="middle"
            font-family={FONT}
            font-size={6}
            fill="#aab3bd"
          >
            {stop.label}
          </text>
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

/** What the press target of a click spot needs from its widget; everything is read at call time. */
export interface SpotPressDeps {
  readonly def: RotaryDef;
  /** Client point to knob-local units; null when the knob has no screen matrix. */
  readonly toLocal: (clientX: number, clientY: number) => { x: number; y: number } | null;
  readonly actuate: (id: string, stop: string) => DispatchResult;
  readonly setPending: (on: boolean) => void;
}

/**
 * The press target of the click spots of a knob (R3-Z2, R2-4.1): a latch target that acts on the
 * tap only. The tap converts the pointer-down point to knob-local units and sets the stop that
 * tapStop gives for it (null, the dead zone at the exact centre, records nothing). The factory
 * does not compare with the current stop: the store rejects an unchanged state and the result
 * carries no sequence number. Pure and hook-free; the pressed ring is driven by the gesture layer
 * through setPending, never by the factory itself.
 */
export function makeSpotPress(deps: SpotPressDeps): PressTarget {
  const { def, toLocal, actuate, setPending } = deps;
  return {
    cls: 'latch',
    setPending,
    tap(info) {
      const local = toLocal(info.down.x, info.down.y);
      if (local === null) return null;
      const stop = tapStop(def, local.x, local.y);
      return stop === null ? null : seqOf(actuate(def.id, stop));
    },
  };
}

/**
 * Knob widget (D-07, D-10). The knob body keeps its own pointer contract and is registered as an
 * own target (R3-Z2, plan 39), so a second finger can still pinch before the drag has travelled
 * DRAG_START_PX and discards the local gesture: primary pointer only, capture on pointerdown, no click listener; cancel
 * and lost capture clear without dispatching. A release under DRAG_START_PX of travel is a tap: the right
 * half steps one stop clockwise, the left half one back (a two-stop knob always toggles; a one-way
 * knob steps clockwise only, cycling, and its left half does nothing); a knob
 * with click spots sets the stop nearest to the tapped angle on the body between the spots. A
 * longer gesture is a drag: the pointer follows the finger in a UI-local signal and the nearest
 * stop is committed on release (a one-way knob clamps the drag at its start). The click spots (the FAN) are latching press targets on the press
 * arbiter (R3-Z2): they act on release and give their pointer to the view when it moves or a
 * second finger lands. Only stop ids reach the store (T-01.1-07).
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
    // Only the main button operates a control; the arbiter already drops the others for the view.
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
      local,
      from: bridge.stateOf(def.id).value,
      prevAngle: Math.hypot(local.x, local.y) < MIN_RADIUS ? null : angleOf(local.x, local.y),
      travel: 0,
      dragging: false,
      lastAngle: null,
    };
    pressed.value = true;
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!e.isPrimary || g === null || g.pointerId !== e.pointerId) return;
    if (!g.dragging && Math.hypot(e.clientX - g.x, e.clientY - g.y) >= DRAG_START_PX) {
      g.dragging = true;
    }
    if (!g.dragging) return;
    const angle = angleAt(e.clientX, e.clientY);
    if (angle === null) return;
    g.lastAngle = angle;
    if (def.oneWay === 'cw') {
      // A one-way knob measures the rotation since pointerdown and never draws the pointer behind
      // its start: the drag is clamped there, wherever the finger swings round the knob.
      g.travel = oneWayTravel(def, g.from, g.travel, g.prevAngle ?? angle, angle);
      g.prevAngle = angle;
      dragAngle.value = oneWayPointer(def, g.from, g.travel);
      return;
    }
    dragAngle.value = angle;
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!e.isPrimary || g === null || g.pointerId !== e.pointerId) return;
    const dragging = g.dragging || Math.hypot(e.clientX - g.x, e.clientY - g.y) >= DRAG_START_PX;
    const angle = dragging ? (angleAt(e.clientX, e.clientY) ?? g.lastAngle) : null;
    clear();
    if (dragging) {
      if (angle !== null) {
        const stop =
          def.oneWay === 'cw'
            ? oneWayStop(
                def,
                g.from,
                oneWayTravel(def, g.from, g.travel, g.prevAngle ?? angle, angle),
              )
            : nearestStop(def, angle);
        if (stop !== bridge.stateOf(def.id).value) bridge.actuate(def.id, stop);
      }
      return;
    }
    if (def.spots !== undefined) {
      // A knob with click spots: the spot (or the nearest angle) sets its stop at once; the store
      // rejects an unchanged state, so the current stop records no event (R2-4.1).
      const stop = tapStop(def, g.local.x, g.local.y);
      if (stop !== null) bridge.actuate(def.id, stop);
      return;
    }
    const current = bridge.stateOf(def.id).value;
    // The left half of a one-way knob steps nowhere (the knob does not turn back).
    const next = stepStop(def, current, g.local.x >= 0 ? 1 : -1);
    if (next !== current) bridge.actuate(def.id, next);
  };

  // Built in the render body and registered by a ref callback on every render, so the target
  // never closes over stale props.
  const spotPress = makeSpotPress({
    def,
    toLocal,
    actuate: (id, stop) => bridge.actuate(id, stop),
    setPending: (on) => {
      pressed.value = on;
    },
  });

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
        ref={(el: SVGRectElement | null) =>
          registerPressTarget(el, { cls: 'own', dragStartPx: DRAG_START_PX, discard: clear })
        }
      />
      {(def.spots ?? []).map((spot) => (
        <rect
          key={spot.stop}
          data-detent={`${def.id}:${spot.stop}`}
          x={spot.x - spot.w / 2}
          y={spot.y - spot.h / 2}
          width={spot.w}
          height={spot.h}
          fill="transparent"
          pointer-events="all"
          ref={(el: SVGRectElement | null) => registerPressTarget(el, spotPress)}
        />
      ))}
    </g>
  );
}
