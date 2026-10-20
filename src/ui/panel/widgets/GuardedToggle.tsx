import { useSignal } from '@preact/signals';
import { guardIdFor } from '../../../engine/registry';
import type { GuardedToggleDef } from '../../../engine/registry';
import type { WidgetProps } from '../ControlWidget';
import { paint } from '../Defs';
import { RockerBody } from '../skins/Rocker';

const TAP_SLOP_PX = 10;

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

  const open = def.guardOpenHit;

  return (
    <>
      <g
        data-control-id={def.id}
        data-kind={def.kind}
        data-state={state}
        data-skin="rocker"
        data-size={def.size}
        data-colour={def.colour}
        data-pressed-half={isSecond ? 'upper' : 'lower'}
        data-pressed={switchTap.pressed ? 'true' : undefined}
        role="img"
        aria-label={`${def.label}: ${stateLabel}`}
        transform={`translate(${def.x} ${def.y})`}
      >
        <RockerBody def={def} position={isSecond ? 'high' : 'low'} pressed={switchTap.pressed} />
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
        role="img"
        aria-label={`${def.label} guard: ${guardLabel}`}
        transform={`translate(${def.x} ${def.y})`}
      >
        <GuardCover def={def} guardOpen={guardOpen} />
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

export interface GuardCoverProps {
  readonly def: Pick<GuardedToggleDef, 'hit' | 'guardOpenHit'>;
  readonly guardOpen: boolean;
}

/** Y offsets of the three hatch bars inside the closed cover (rect 40 x 54 centred on the rocker). */
const COVER_BARS = [-15, -4, 7] as const;

/**
 * Pure art of the translucent red guard cover (UI-SPEC 8.6): closed it covers the rocker
 * (rect 40 x 54, rx 4, #c43030 at 35 percent, border #e04040 1.5) with three hatch bars from the
 * shared p-hatch; open it is drawn lifted above the rocker with the hinge line. It draws no text
 * at all (G-0.1); the guard state is in data-state and the aria-label of its group.
 */
export function GuardCover({ def, guardOpen }: GuardCoverProps) {
  const open = def.guardOpenHit;
  const tint = { fill: '#c43030', 'fill-opacity': 0.35, stroke: '#e04040', 'stroke-width': 1.5 };
  return (
    <g pointer-events="none">
      {guardOpen ? (
        <>
          {/* Lifted cover: hinge line at the top of the switch footprint, flap above it. */}
          <rect
            x={open.x + 2}
            y={open.y + 2}
            width={open.w - 4}
            height={open.h - 4}
            rx={3}
            {...tint}
          />
          {COVER_BARS.map((dy, i) => (
            <rect
              key={dy}
              x={open.x + 8}
              y={open.y + 7 + i * 7}
              width={open.w - 16}
              height={3}
              fill={paint('p-hatch')}
            />
          ))}
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
        <>
          <rect x={-20} y={-27} width={40} height={54} rx={4} {...tint} />
          {COVER_BARS.map((dy) => (
            <rect key={dy} x={-16} y={dy - 1.5} width={32} height={3} fill={paint('p-hatch')} />
          ))}
        </>
      )}
    </g>
  );
}
