import { useSignal } from '@preact/signals';
import type { Ref } from 'preact';
import { useRef } from 'preact/hooks';
import { detentOffset, projectToTrack, snapToDetent } from '../../../engine/detents';
import type { DetentDef, DetentLeverDef } from '../../../engine/registry';
import type { DispatchResult } from '../../../engine/store';
import type { WidgetProps } from '../ControlWidget';
import { DRAG_START_PX } from '../press-arbiter';
import { registerPressTarget, seqOf } from '../press-targets';
import type { PressTarget } from '../press-targets';
import { FlapBody } from '../skins/Flap';
import { EnvIcon, ENV_ICONS, LEVER_ART, LeverHandle, LeverTrack } from '../skins/LeverHandles';

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
 * Pointer handlers of the drag handle of one lever; absent in static renders (tests), present in
 * the widget. The handle is a drag control that keeps its own gesture and is registered as an own
 * target (R3-Z2, plan 39); the marker taps and the tap-toggle flap are latching presses on the
 * press arbiter (see LeverPress).
 */
export interface LeverHandlers {
  readonly onHandleDown: (e: PointerEvent) => void;
  readonly onHandleMove: (e: PointerEvent) => void;
  readonly onHandleUp: (e: PointerEvent) => void;
  readonly clearDrag: () => void;
}

/** A ref callback that registers a press target on a hit rectangle. */
export type PressRef = (el: SVGRectElement | null) => void;

/**
 * The press registrations of one lever (R3-Z2): the ref callback of the tap-toggle hit, the one of
 * the drag handle hit (an own target) and the ref callback of every marker rectangle by detent
 * id. Absent in static renders (tests), so the pure body keeps working without a render context.
 */
export interface LeverPress {
  readonly brake: PressRef;
  readonly handle: PressRef;
  readonly marker: (detent: string) => PressRef;
}

/** The other detent of a two-detent tap-toggle lever: a tap goes from the current one to it. */
export function tapToggleTarget(def: DetentLeverDef, state: string): string {
  const other = def.detents.find((d) => d.id !== state) ?? def.detents[0]!;
  return other.id;
}

/** What a press target of a lever needs from its widget; everything is read at call time. */
export interface TapTogglePressDeps {
  readonly def: DetentLeverDef;
  readonly stateOf: () => string;
  readonly actuate: (id: string, detent: string) => DispatchResult;
  readonly setPending: (on: boolean) => void;
}

/**
 * The press target of a tap-toggle lever (R3-Z2): a latch target whose tap actuates the other
 * detent and returns the sequence number of the event, or null when nothing was recorded. Pure and
 * hook-free; the pressed ring is driven by the gesture layer through setPending, never by the
 * factory itself.
 */
export function makeTapTogglePress(deps: TapTogglePressDeps): PressTarget {
  const { def, stateOf, actuate, setPending } = deps;
  return {
    cls: 'latch',
    setPending,
    tap() {
      return seqOf(actuate(def.id, tapToggleTarget(def, stateOf())));
    },
  };
}

export interface MarkerPressDeps {
  readonly def: DetentLeverDef;
  /** The detent this marker rectangle stands for. */
  readonly detent: string;
  readonly actuate: (id: string, detent: string) => DispatchResult;
}

/**
 * The press target of one marker rectangle of a lever (R3-Z2): a latch target whose tap jumps to
 * its detent and returns the sequence number, or null when the store records nothing (the detent
 * is the current one). A marker has no pending visual. A drag-only lever has no marker, so it is
 * never given one (PNL-06).
 */
export function makeMarkerPress(deps: MarkerPressDeps): PressTarget {
  const { def, detent, actuate } = deps;
  return {
    cls: 'latch',
    tap() {
      return seqOf(actuate(def.id, detent));
    },
  };
}

/**
 * The press target of a lever handle (R3-Z2, R3-Z3): a drag control that keeps its pointer and only
 * needs the discard hook. After a marker tap the handle rests on that very marker, so a second
 * tap of a double tap lands on the handle: its pair key is the key of the marker under it, which
 * lets the gesture layer join the pair (a join never starts one: a double tap on the handle
 * alone stays two presses). A drag-only lever has no markers and no pair key.
 */
export function makeHandlePress(deps: {
  readonly def: DetentLeverDef;
  readonly state: string;
  readonly discard: () => void;
}): PressTarget {
  const { def, state, discard } = deps;
  const own = { cls: 'own', dragStartPx: DRAG_START_PX, discard } as const;
  return def.dragOnly === true ? own : { ...own, pairKey: `${def.id}:${state}` };
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
  /** The press registrations of the brake hit and the marker rectangles (absent in static renders). */
  readonly press?: LeverPress;
  /** Tap-toggle levers only: the transient pressed ring. */
  readonly pressed?: boolean;
}

/**
 * Body of a tap-toggle lever (R2-4.2): the hinged flap and one hit over the whole footprint. No
 * track, tick, legend or marker; prints no text. Pure, no hooks.
 */
function TapToggleBody({
  def,
  state,
  groupRef,
  press,
  pressed,
}: Pick<LeverBodyProps, 'def' | 'state' | 'groupRef' | 'press' | 'pressed'>) {
  const current: DetentDef = def.detents.find((d) => d.id === state) ?? def.detents[0]!;
  return (
    <g
      ref={groupRef}
      data-control-id={def.id}
      data-kind={def.kind}
      data-skin={def.skin}
      data-state={state}
      data-pressed={pressed === true ? 'true' : undefined}
      role="img"
      aria-label={`${def.label}: ${current.label}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <FlapBody def={def} state={state} pressed={pressed === true} />
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        ref={press?.brake}
      />
    </g>
  );
}

/**
 * Pure body of a detent lever (D-09, UI-SPEC 8.5): name (unless nameless), track art, one tick path, detent
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
  press,
  pressed,
}: LeverBodyProps) {
  if (def.tapToggle === true) {
    return (
      <TapToggleBody def={def} state={state} groupRef={groupRef} press={press} pressed={pressed} />
    );
  }
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
    def.nameless === true
      ? []
      : art !== undefined && def.label.length * 4.2 <= room
        ? [def.label]
        : placardLines(def.label);
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
  const legendDetents =
    def.legends !== undefined
      ? def.detents.filter((d) => def.legends?.includes(d.id))
      : dragOnly
        ? def.detents
        : markerDetents;
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
                // Vertical sliders print their pictograms right of the slot (owner photo), horizontal
                // ones at the slot ends; neither lies under the handle.
                const x = vertical ? (art?.across ?? 11) + 9 : at.dx + (at.dx < 0 ? -14 : 14);
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
            ref={press?.marker(d.id)}
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
        ref={press?.handle}
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
export function DetentLever(props: WidgetProps<DetentLeverDef>) {
  return props.def.tapToggle === true ? <TapToggleLever {...props} /> : <DragLever {...props} />;
}

/** The tap-toggle lever widget: a tap on the footprint toggles the two detents (R2-4.2). */
function TapToggleLever({ def, bridge }: WidgetProps<DetentLeverDef>) {
  const pressed = useSignal(false);
  // Built in the render body and registered by a ref callback on every render, so the target
  // never closes over stale props; it reads the state at call time.
  const target = makeTapTogglePress({
    def,
    stateOf: () => bridge.stateOf(def.id).peek(),
    actuate: (id, detent) => bridge.actuate(id, detent),
    setPending: (p) => {
      pressed.value = p;
    },
  });
  const state = bridge.stateOf(def.id).value;
  return (
    <LeverBody
      def={def}
      state={state}
      handlePos={0}
      dragging={false}
      regionWidth={def.hit.w}
      press={{
        brake: (el) => registerPressTarget(el, target),
        handle: () => undefined,
        marker: () => () => undefined,
      }}
      pressed={pressed.value}
    />
  );
}

function DragLever({ def, bridge }: WidgetProps<DetentLeverDef>) {
  const groupRef = useRef<SVGGElement>(null);
  const drag = useSignal<DragStart | null>(null);
  const dragPos = useSignal<number | null>(null);

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
    if (travel < DRAG_START_PX || pos === null) return;
    bridge.actuate(def.id, snapToDetent(pos, def.detents));
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
      handlers={{ onHandleDown, onHandleMove, onHandleUp, clearDrag }}
      press={{
        brake: () => undefined,
        // The handle is an own target: the widget keeps the drag and its capture, the gesture
        // layer only lets a second finger take the press away before DRAG_START_PX of travel and
        // then calls discard, which clears the local drag so no stale position remains.
        handle: (el) =>
          registerPressTarget(el, makeHandlePress({ def, state, discard: clearDrag })),
        marker: (detent) => {
          const target = makeMarkerPress({
            def,
            detent,
            actuate: (id, value) => bridge.actuate(id, value),
          });
          return (el) => registerPressTarget(el, target);
        },
      }}
    />
  );
}
