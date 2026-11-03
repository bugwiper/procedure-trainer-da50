import { useSignal } from '@preact/signals';
import { SESSION_LAYOUT, labelAnchorX, labelBaseline } from '../session-area';
import type { LocalRect } from '../session-area';
import { registerPressTarget } from '../press-targets';
import type { PressTarget } from '../press-targets';

const FACE = '#1b2127';
const RIM = '#3a424b';
const FACE_SELECTED = '#2c5d8f';
const RIM_PRESSED = '#8fb8e6';
const LABEL = '#e6e9ed';
const FOCUS = '#8fb8e6';
/** The dimming of a disabled button (the whole group: face, rim and label). */
const DISABLED_OPACITY = 0.38;
/** Distance between the baselines of a two-line label (size 14). */
const LINE_STEP = 18;

export interface SessionButtonProps {
  /** Region-local rectangle (SESSION_LAYOUT). */
  readonly rect: LocalRect;
  /**
   * The printed label, size 14. A line feed breaks it into centred lines (owner decision 2026-11-02:
   * the two-line labels of the footwell cluster); the block of lines stays centred on the button.
   */
  readonly label: string;
  readonly ariaLabel: string;
  /** Stable key of the hit element (data-session-hit). */
  readonly id: string;
  readonly onActivate: () => void;
  /** Keeps the pressed rim (a load started by this button is still running). */
  readonly held?: boolean;
  /**
   * A toggle button that is switched on (Phase 7, R-07): the face is tinted, the rim is the pressed
   * rim and the group says aria-pressed. The label never changes (G-0). Absent: not a toggle.
   */
  readonly selected?: boolean;
  /**
   * Greyed out and not pressable (owner decision 2026-11-03: the Avoid actions under the emergency
   * landing): the group is dimmed, says aria-disabled, shows no pressed rim and ignores a press and
   * the keyboard. The label never changes (G-0); a selected state stays visible, dimmed.
   */
  readonly disabled?: boolean;
  /** performance.now() time before which an activation is ignored (the 400 ms shield of a new view). */
  readonly ignoreUntil?: number;
}

/**
 * The press target of a session button: class action, drives the pressed rim through setPending
 * and calls onActivate on the first release inside the slop. It never records anything: a session
 * button is not a registry control and never touches the store (T-02-08).
 */
export function makeSessionPress(
  onActivate: () => void,
  setPending: (on: boolean) => void,
): PressTarget {
  return {
    cls: 'action',
    setPending,
    tap() {
      onActivate();
      return null;
    },
  };
}

/**
 * Session button (UI-SPEC "Session Control Area"): a dark face with a rim, a caps label and a
 * transparent hit rectangle. Acts on release through the gesture layer (never listens to click),
 * and by keyboard (Enter and Space). Static label: nothing on it changes with state, only the rim
 * while a press is pending.
 */
export function SessionButton({
  rect,
  label,
  ariaLabel,
  id,
  onActivate,
  held = false,
  selected,
  disabled = false,
  ignoreUntil,
}: SessionButtonProps) {
  const pending = useSignal(false);
  // Pointer release and keyboard share one rule: a press inside the shield of a new view is dropped.
  const activate = () => {
    if (disabled) return;
    if (ignoreUntil !== undefined && performance.now() < ignoreUntil) return;
    onActivate();
  };
  const press = makeSessionPress(activate, (on) => {
    pending.value = on;
  });
  const rimPressed = (pending.value && !disabled) || held || selected === true;
  const { x, y, w, h } = rect;
  const lines = label.split('\n');
  return (
    <g
      class="session-button"
      data-session-button={id}
      data-pressed={rimPressed ? 'true' : undefined}
      data-selected={selected === undefined ? undefined : selected ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      opacity={disabled ? DISABLED_OPACITY : undefined}
      aria-pressed={selected}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={selected === true ? FACE_SELECTED : FACE}
        stroke={rimPressed ? RIM_PRESSED : RIM}
        stroke-width={rimPressed ? 3 : 2}
        pointer-events="none"
      />
      <text
        x={labelAnchorX(rect)}
        y={labelBaseline(rect)}
        text-anchor="middle"
        font-size={SESSION_LAYOUT.label.size}
        fill={LABEL}
        pointer-events="none"
      >
        {lines.length === 1
          ? label
          : lines.map((line, index) => (
              <tspan
                key={line}
                x={labelAnchorX(rect)}
                dy={index === 0 ? -((lines.length - 1) * LINE_STEP) / 2 : LINE_STEP}
              >
                {line}
              </tspan>
            ))}
      </text>
      {/* Keyboard focus outline: width 4, 4 outside the rim; shown by stage.css on :focus-visible. */}
      <rect
        class="session-focus"
        x={x - 4}
        y={y - 4}
        width={w + 8}
        height={h + 8}
        rx={14}
        fill="none"
        stroke={FOCUS}
        stroke-width={4}
        pointer-events="none"
      />
      <rect
        data-session-hit={id}
        x={x}
        y={y}
        width={w}
        height={h}
        fill="transparent"
        pointer-events="all"
        ref={(el: SVGRectElement | null) => registerPressTarget(el, press)}
      />
    </g>
  );
}
