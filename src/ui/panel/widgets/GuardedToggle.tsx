import { useSignal } from '@preact/signals';
import { guardIdFor } from '../../../engine/registry';
import type { GuardedToggleDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { SwitchBody } from './Toggle';

const TAP_SLOP_PX = 10;
const FONT = 'B612, system-ui, sans-serif';

interface PointerStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

/**
 * One tap target with the shared widget pointer contract: only primary pointers, capture
 * on pointerdown, actuate on a pointerup within the tap slop, never listen to click.
 */
function useTapTarget(onTap: () => void) {
  const start = useSignal<PointerStart | null>(null);
  const clear = () => {
    start.value = null;
  };
  return {
    pressed: start.value !== null,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (!e.isPrimary) return;
        try {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        } catch {
          // The pointer may already be gone; the tap is still evaluated on pointerup.
        }
        start.value = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      },
      onPointerUp: (e: PointerEvent) => {
        const s = start.value;
        if (!e.isPrimary || s === null || s.pointerId !== e.pointerId) return;
        clear();
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP_PX) return;
        onTap();
      },
      onPointerCancel: clear,
      onLostPointerCapture: clear,
    },
  };
}

/**
 * Guarded switch (D-06, D-07b). The guard is a separate control with its own state: tap it
 * to lift, then tap the switch; the guard stays up until it is tapped again. While the guard
 * is closed no switch tap target is rendered, so a tap on the covered switch can only lift
 * the guard; the store interlock rejects the switch as "blocked" as defence in depth.
 */
export function GuardedToggle({ def, bridge }: WidgetProps<GuardedToggleDef>) {
  const guardId = guardIdFor(def.id);
  const guardDef = bridge.registry.get(guardId);
  const guardLabels = guardDef?.kind === 'guard' ? guardDef.states : null;

  const [first, second] = def.states;
  const state = bridge.stateOf(def.id).value;
  const isSecond = state === second.id;
  const stateLabel = (isSecond ? second : first).label;

  const guardState = bridge.stateOf(guardId).value;
  const guardOpen = guardState === 'open';
  const guardLabel =
    guardLabels === null ? guardState.toUpperCase() : guardLabels[guardOpen ? 1 : 0].label;

  const guardTap = useTapTarget(() => {
    bridge.actuate(guardId, guardOpen ? 'closed' : 'open');
  });
  const switchTap = useTapTarget(() => {
    bridge.actuate(def.id, isSecond ? first.id : second.id);
  });

  const labelWidth = Math.min(def.label.length * 5.2, def.hit.w - 2);
  const hatchId = `hatch-${def.id.replace(/[^a-z0-9]/g, '-')}`;
  const open = def.guardOpenHit;

  return (
    <>
      <g
        data-control-id={def.id}
        data-kind={def.kind}
        data-state={state}
        transform={`translate(${def.x} ${def.y})`}
      >
        <SwitchBody
          def={def}
          top={-def.hit.h / 2}
          labelWidth={labelWidth}
          isSecond={isSecond}
          pressed={switchTap.pressed}
          stateLabel={stateLabel}
        />
        {guardOpen ? (
          <rect
            data-hit={def.id}
            x={-def.hit.w / 2}
            y={-def.hit.h / 2}
            width={def.hit.w}
            height={def.hit.h}
            fill="transparent"
            pointer-events="all"
            {...switchTap.handlers}
          />
        ) : null}
      </g>
      <g
        data-control-id={guardId}
        data-kind="guard"
        data-state={guardState}
        transform={`translate(${def.x} ${def.y})`}
      >
        <g pointer-events="none">
          <defs>
            <pattern
              id={hatchId}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={6} height={6} fill="#7a1d1d" />
              <rect width={3} height={6} fill="#c43030" />
            </pattern>
          </defs>
          {guardOpen ? (
            <>
              {/* Lifted cover: hinge line at the top of the switch footprint, flap above it. */}
              <rect
                x={open.x + 2}
                y={open.y + 2}
                width={open.w - 4}
                height={open.h - 4}
                rx={3}
                fill={`url(#${hatchId})`}
                stroke="#e04040"
                stroke-width={1.5}
              />
              <line
                x1={open.x + 2}
                y1={open.y + open.h}
                x2={open.x + open.w - 2}
                y2={open.y + open.h}
                stroke="#8a929c"
                stroke-width={2}
              />
            </>
          ) : (
            <rect
              x={-24}
              y={-22}
              width={48}
              height={46}
              rx={4}
              fill={`url(#${hatchId})`}
              fill-opacity={0.8}
              stroke="#e04040"
              stroke-width={1.5}
            />
          )}
          <text
            data-state-text
            x={0}
            y={def.hit.h / 2 + 10}
            text-anchor="middle"
            font-family={FONT}
            font-size={7}
            font-weight={700}
            fill="#e8a0a0"
          >
            {guardLabel}
          </text>
        </g>
        <rect
          data-hit={guardId}
          x={guardOpen ? open.x : -def.hit.w / 2}
          y={guardOpen ? open.y : -def.hit.h / 2}
          width={guardOpen ? open.w : def.hit.w}
          height={guardOpen ? open.h : def.hit.h}
          fill="transparent"
          pointer-events="all"
          {...guardTap.handlers}
        />
      </g>
    </>
  );
}
