import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { detentOffset, projectToTrack, snapToDetent } from '../../../engine/detents';
import type { DetentDef, DetentLeverDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';

const MIN_DRAG_PX = 4;
const TAP_SLOP_PX = 10;
const FONT = 'B612, system-ui, sans-serif';

interface DragStart {
  readonly pointerId: number;
  /** Client point of pointerdown, for the travel threshold. */
  readonly x: number;
  readonly y: number;
  /** Offset of the grab point from the handle centre, in lever-local units. */
  readonly grabX: number;
  readonly grabY: number;
}

interface TapStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly detent: string;
}

/** Splits a long placard into two balanced lines at a space. */
function placardLines(label: string): string[] {
  if (label.length <= 12 || !label.includes(' ')) return [label];
  const mid = label.length / 2;
  let best = -1;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return [label.slice(0, best), label.slice(best + 1)];
}

/**
 * Lever widget (D-05). The handle drags along the track and snaps to the nearest detent on
 * release; tapping a marker jumps there. In-progress positions live in a UI-local signal and
 * never reach the store: only the committed detent is dispatched (T-01-13). A dragOnly lever
 * has no marker targets, so a tap cannot move it (PNL-06, T-01-21).
 */
export function DetentLever({ def, bridge }: WidgetProps<DetentLeverDef>) {
  const groupRef = useRef<SVGGElement>(null);
  const drag = useSignal<DragStart | null>(null);
  const dragPos = useSignal<number | null>(null);
  const tap = useSignal<TapStart | null>(null);

  const state = bridge.stateOf(def.id).value;
  const current: DetentDef = def.detents.find((d) => d.id === state) ?? def.detents[0]!;
  const dragOnly = def.dragOnly === true;
  const markerIds = dragOnly ? [] : (def.markers ?? def.detents.map((d) => d.id));
  const markerDetents = def.detents.filter((d) => markerIds.includes(d.id));

  const { length } = def.track;
  const vertical = def.track.axis === 'v';
  const markerPositions = markerDetents.map((d) => d.pos * length).sort((a, b) => a - b);
  let spacing = Infinity;
  for (let i = 1; i < markerPositions.length; i++) {
    spacing = Math.min(spacing, (markerPositions[i] ?? 0) - (markerPositions[i - 1] ?? 0));
  }
  const along = vertical ? def.hit.h : def.hit.w;
  const across = vertical ? def.hit.w : def.hit.h;
  const side = Math.min(across, along - length, spacing);

  const handlePos = dragPos.value ?? current.pos;
  const handleAt = detentOffset(handlePos, def.track);

  const toLocal = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const g = groupRef.current;
    const m = g?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const clearDrag = () => {
    drag.value = null;
    dragPos.value = null;
  };

  const onHandleDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const local = toLocal(e.clientX, e.clientY);
    if (local === null) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the release is still evaluated on pointerup.
    }
    const at = detentOffset(current.pos, def.track);
    drag.value = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      grabX: local.x - at.dx,
      grabY: local.y - at.dy,
    };
    dragPos.value = current.pos;
  };

  const posFor = (s: DragStart, clientX: number, clientY: number): number | null => {
    const local = toLocal(clientX, clientY);
    if (local === null) return null;
    return projectToTrack({ x: local.x - s.grabX, y: local.y - s.grabY }, def.track);
  };

  const onHandleMove = (e: PointerEvent) => {
    const s = drag.value;
    if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
    const pos = posFor(s, e.clientX, e.clientY);
    if (pos !== null) dragPos.value = pos;
  };

  const onHandleUp = (e: PointerEvent) => {
    const s = drag.value;
    if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
    const pos = posFor(s, e.clientX, e.clientY) ?? dragPos.value;
    const travel = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    clearDrag();
    if (travel < MIN_DRAG_PX || pos === null) return;
    bridge.actuate(def.id, snapToDetent(pos, def.detents));
  };

  const onMarkerDown = (detent: string) => (e: PointerEvent) => {
    if (!e.isPrimary) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the tap is still evaluated on pointerup.
    }
    tap.value = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, detent };
  };

  const onMarkerUp = (e: PointerEvent) => {
    const s = tap.value;
    if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
    tap.value = null;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP_PX) return;
    bridge.actuate(def.id, s.detent);
  };

  const clearTap = () => {
    tap.value = null;
  };

  const region = bridge.registry.regions.find((r) => r.id === def.region);
  const labelX = vertical ? 10 : 0;
  const labelRoom = Math.max(14, (region?.bounds.w ?? def.hit.w) - def.x - labelX - 3);
  const knobW = vertical ? Math.min(34, side) : 16;
  const knobH = vertical ? 16 : Math.min(34, side);
  // A label under the knob would be half hidden; the state text already names that detent.
  const labelled = (dragOnly ? def.detents : markerDetents).filter(
    (d) => Math.abs(d.pos - handlePos) * length > (vertical ? knobH : knobW) / 2 + 3,
  );
  const lines = placardLines(def.label);
  const top = -def.hit.h / 2;

  return (
    <g
      ref={groupRef}
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      transform={`translate(${def.x} ${def.y})`}
    >
      <g pointer-events="none">
        {lines.map((line, i) => (
          <text
            key={line}
            x={0}
            y={top + 6 + i * 7}
            text-anchor="middle"
            font-family={FONT}
            font-size={6.5}
            fill="#aab3bd"
            textLength={Math.min(line.length * 4.2, (region?.bounds.w ?? def.hit.w) - 8)}
            lengthAdjust="spacingAndGlyphs"
          >
            {line}
          </text>
        ))}
        <line
          x1={vertical ? 0 : -length / 2}
          y1={vertical ? -length / 2 : 0}
          x2={vertical ? 0 : length / 2}
          y2={vertical ? length / 2 : 0}
          stroke="#4a525c"
          stroke-width={3}
          stroke-linecap="round"
        />
        {def.detents.map((d) => {
          const at = detentOffset(d.pos, def.track);
          return (
            <line
              key={d.id}
              x1={vertical ? -4 : at.dx}
              y1={vertical ? at.dy : -4}
              x2={vertical ? 4 : at.dx}
              y2={vertical ? at.dy : 4}
              stroke="#6b7580"
              stroke-width={1}
            />
          );
        })}
        {labelled.map((d) => {
          const at = detentOffset(d.pos, def.track);
          return (
            <text
              key={d.id}
              x={at.dx + labelX}
              y={at.dy + 2}
              font-family={FONT}
              font-size={6}
              fill="#aab3bd"
              textLength={Math.min(d.label.length * 4.2, labelRoom)}
              lengthAdjust="spacingAndGlyphs"
            >
              {d.label}
            </text>
          );
        })}
        <text
          data-state-text
          x={0}
          y={def.hit.h / 2 - 3}
          text-anchor="middle"
          font-family={FONT}
          font-size={9}
          font-weight={700}
          fill="#d8dde3"
        >
          {current.label}
        </text>
      </g>
      {markerDetents.map((d) => {
        const at = detentOffset(d.pos, def.track);
        return (
          <rect
            key={d.id}
            data-detent={`${def.id}:${d.id}`}
            x={at.dx - side / 2}
            y={at.dy - side / 2}
            width={side}
            height={side}
            fill="transparent"
            pointer-events="all"
            onPointerDown={onMarkerDown(d.id)}
            onPointerUp={onMarkerUp}
            onPointerCancel={clearTap}
            onLostPointerCapture={clearTap}
          />
        );
      })}
      <g transform={`translate(${handleAt.dx} ${handleAt.dy})`} pointer-events="none">
        <rect
          x={-knobW / 2}
          y={-knobH / 2}
          width={knobW}
          height={knobH}
          rx={3}
          fill={dragOnly ? '#c62828' : drag.value !== null ? '#56606b' : '#3a424b'}
          stroke={dragOnly ? '#ff8a80' : '#d8dde3'}
          stroke-width={1.5}
        />
        {dragOnly ? (
          <text
            x={0}
            y={2.2}
            text-anchor="middle"
            font-family={FONT}
            font-size={6}
            font-weight={700}
            fill="#ffffff"
          >
            PULL
          </text>
        ) : null}
      </g>
      <rect
        data-hit={def.id}
        x={handleAt.dx - side / 2}
        y={handleAt.dy - side / 2}
        width={side}
        height={side}
        fill="transparent"
        pointer-events="all"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={clearDrag}
        onLostPointerCapture={clearDrag}
      />
    </g>
  );
}
