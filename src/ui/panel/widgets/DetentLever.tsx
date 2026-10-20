import { useSignal } from '@preact/signals';
import type { Ref } from 'preact';
import { useRef } from 'preact/hooks';
import { detentOffset, projectToTrack, snapToDetent } from '../../../engine/detents';
import type { DetentDef, DetentLeverDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { EnvIcon, ENV_ICONS, LEVER_ART, LeverHandle, LeverTrack } from '../skins/LeverHandles';

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

/** Pointer handlers of one lever; absent in static renders (tests), present in the widget. */
export interface LeverHandlers {
  readonly onHandleDown: (e: PointerEvent) => void;
  readonly onHandleMove: (e: PointerEvent) => void;
  readonly onHandleUp: (e: PointerEvent) => void;
  readonly clearDrag: () => void;
  readonly onMarkerDown: (detent: string) => (e: PointerEvent) => void;
  readonly onMarkerUp: (e: PointerEvent) => void;
  readonly clearTap: () => void;
}

export interface LeverBodyProps {
  readonly def: DetentLeverDef;
  /** Committed detent id. */
  readonly state: string;
  /** Track fraction of the handle, the drag position while dragging. */
  readonly handlePos: number;
  readonly dragging: boolean;
  /** Width of the lever's region, to keep placards inside it. */
  readonly regionWidth: number;
  readonly handlers?: LeverHandlers;
  readonly groupRef?: Ref<SVGGElement>;
}

/**
 * Pure body of a detent lever (D-09, UI-SPEC 8.5): name, track art, one tick path, detent
 * legends (static, no state readout, G-0.1), marker targets, handle and the handle hit, all from props. No hooks, no
 * state, so node tests expand it and count nodes. The handle hit spans the full footprint width
 * by one handle square along the track, so the whole visible grip can be grabbed.
 */
export function LeverBody({
  def,
  state,
  handlePos,
  dragging,
  regionWidth,
  handlers,
  groupRef,
}: LeverBodyProps) {
  const current: DetentDef = def.detents.find((d) => d.id === state) ?? def.detents[0]!;
  const dragOnly = def.dragOnly === true;
  const markerIds = dragOnly ? [] : (def.markers ?? def.detents.map((d) => d.id));
  const markerDetents = def.detents.filter((d) => markerIds.includes(d.id));
  const skin = def.skin;
  const art = skin === undefined ? undefined : LEVER_ART[skin];

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

  const handleAt = detentOffset(handlePos, def.track);
  const top = -def.hit.h / 2;

  // Name: one line when it fits the region around the lever, else two balanced lines.
  const room = Math.min(regionWidth - 8, 2 * Math.min(def.x, regionWidth - def.x) - 4);
  const lines =
    art !== undefined && def.label.length * 4.2 <= room ? [def.label] : placardLines(def.label);
  // A skinned vertical lever prints its name above the highest handle position when the
  // footprint top would be covered by the stowed handle, but never above the region.
  const nameTop =
    art !== undefined && vertical
      ? Math.max(
          Math.min(top + 6, -(length / 2 + art.along) - 3 - 7 * (lines.length - 1)),
          -def.y + (art.nameInset ?? 4),
        )
      : top + 6;

  // Legends. A skinned vertical lever keeps them clear of the handle, to its right; a skinned
  // horizontal one prints them below the handle's cross extent, under the slot ends.
  const labelX = art !== undefined && vertical ? art.across + 4 : 10;
  const labelRoom = Math.max(14, regionWidth - def.x - labelX - 3);
  const knobW = vertical ? Math.min(34, side) : 16;
  const knobH = vertical ? 16 : Math.min(34, side);
  const legendDetents = dragOnly ? def.detents : markerDetents;
  // Legends are static placards: none is hidden or moved by the handle position.
  const labelled = art !== undefined && vertical ? [] : legendDetents;
  const skinnedLegends = art !== undefined && vertical ? legendDetents : [];

  const tick = art?.tick ?? 4;
  const tickPath = def.detents
    .map((d) => {
      const at = detentOffset(d.pos, def.track);
      return vertical ? `M${-tick} ${at.dy}H${tick}` : `M${at.dx} ${-tick}V${tick}`;
    })
    .join('');

  return (
    <g
      ref={groupRef}
      data-control-id={def.id}
      data-kind={def.kind}
      data-skin={skin}
      data-state={state}
      role="img"
      aria-label={`${def.label}: ${current.label}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <g pointer-events="none">
        {skin !== undefined ? (
          <LeverTrack skin={skin} length={length} axis={def.track.axis} handleAt={handleAt} />
        ) : (
          <line
            x1={vertical ? 0 : -length / 2}
            y1={vertical ? -length / 2 : 0}
            x2={vertical ? 0 : length / 2}
            y2={vertical ? length / 2 : 0}
            stroke="#4a525c"
            stroke-width={3}
            stroke-linecap="round"
          />
        )}
        {lines.map((line, i) => (
          <text
            key={line}
            x={0}
            y={nameTop + i * 7}
            text-anchor="middle"
            font-family={FONT}
            font-size={6}
            fill="#aab3bd"
            textLength={Math.min(line.length * 4.2, regionWidth - 8)}
            lengthAdjust="spacingAndGlyphs"
          >
            {line}
          </text>
        ))}
        <path d={tickPath} fill="none" stroke={art?.tickColour ?? '#6b7580'} stroke-width={1} />
        {skin === 'env-slider'
          ? def.detents
              .filter((d) => ENV_ICONS[d.id] !== undefined)
              .map((d) => {
                const at = detentOffset(d.pos, def.track);
                const x = vertical ? -((art?.across ?? 11) + 9) : at.dx + (at.dx < 0 ? -14 : 14);
                return <EnvIcon key={d.id} detent={d.id} x={x} y={vertical ? at.dy : 0} />;
              })
          : null}
        {skinnedLegends.map((d) => {
          const at = detentOffset(d.pos, def.track);
          return (
            <text
              key={d.id}
              x={labelX}
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
        {labelled.map((d) => {
          const at = detentOffset(d.pos, def.track);
          // A skinned horizontal slider prints the legend under its end, centred and below the
          // handle's cross extent so the handle never covers it.
          const centred = art !== undefined;
          const legendY = art !== undefined ? art.across + 8 : at.dy + 2;
          return (
            <text
              key={d.id}
              x={centred ? at.dx : at.dx + labelX}
              y={legendY}
              text-anchor={centred ? 'middle' : undefined}
              font-family={FONT}
              font-size={6}
              fill={centred ? '#c9d0d8' : '#aab3bd'}
              textLength={Math.min(d.label.length * 4.2, centred ? 30 : labelRoom)}
              lengthAdjust="spacingAndGlyphs"
            >
              {d.label}
            </text>
          );
        })}
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
            onPointerDown={handlers?.onMarkerDown(d.id)}
            onPointerUp={handlers?.onMarkerUp}
            onPointerCancel={handlers?.clearTap}
            onLostPointerCapture={handlers?.clearTap}
          />
        );
      })}
      <g transform={`translate(${handleAt.dx} ${handleAt.dy})`} pointer-events="none">
        {skin !== undefined ? (
          <LeverHandle skin={skin} axis={def.track.axis} dragging={dragging} />
        ) : (
          <>
            <rect
              x={-knobW / 2}
              y={-knobH / 2}
              width={knobW}
              height={knobH}
              rx={3}
              fill={dragOnly ? '#c62828' : dragging ? '#56606b' : '#3a424b'}
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
          </>
        )}
      </g>
      <rect
        data-hit={def.id}
        x={vertical ? -across / 2 : handleAt.dx - side / 2}
        y={vertical ? handleAt.dy - side / 2 : -across / 2}
        width={vertical ? across : side}
        height={vertical ? side : across}
        fill="transparent"
        pointer-events="all"
        onPointerDown={handlers?.onHandleDown}
        onPointerMove={handlers?.onHandleMove}
        onPointerUp={handlers?.onHandleUp}
        onPointerCancel={handlers?.clearDrag}
        onLostPointerCapture={handlers?.clearDrag}
      />
    </g>
  );
}

/**
 * Lever widget (D-05). The handle drags along the track and snaps to the nearest detent on
 * release; tapping a marker jumps there. In-progress positions live in a UI-local signal and
 * never reach the store: only the committed detent is dispatched (T-01-13). A dragOnly lever
 * has no marker targets, so a tap cannot move it (PNL-06, T-01-21). The art is the pure
 * LeverBody; this wrapper owns the signals, the ref and the pointer handlers.
 */
export function DetentLever({ def, bridge }: WidgetProps<DetentLeverDef>) {
  const groupRef = useRef<SVGGElement>(null);
  const drag = useSignal<DragStart | null>(null);
  const dragPos = useSignal<number | null>(null);
  const tap = useSignal<TapStart | null>(null);

  const state = bridge.stateOf(def.id).value;
  const current: DetentDef = def.detents.find((d) => d.id === state) ?? def.detents[0]!;

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

  return (
    <LeverBody
      def={def}
      state={state}
      handlePos={dragPos.value ?? current.pos}
      dragging={drag.value !== null}
      regionWidth={region?.bounds.w ?? def.hit.w}
      groupRef={groupRef}
      handlers={{
        onHandleDown,
        onHandleMove,
        onHandleUp,
        clearDrag,
        onMarkerDown,
        onMarkerUp,
        clearTap,
      }}
    />
  );
}
