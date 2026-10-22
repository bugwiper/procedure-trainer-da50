import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { CODE_ENTRY_CLEAR_KEY } from '../../../engine/registry';
import type { CodeEntryDef, CodeEntryKeyDef } from '../../../engine/registry';
import { createEntryBuffer, makeCodeKeyPress } from '../code-entry';
import type { WidgetProps } from '../ControlWidget';
import { registerPressTarget } from '../press-targets';

const FONT = 'B612, system-ui, sans-serif';
const HOUSING = { fill: '#171a1f', stroke: '#3a414a' } as const;
const KEY_FACE = { fill: '#2b3138', stroke: '#566069' } as const;
const WINDOW_FACE = { fill: '#07090c', stroke: '#566069' } as const;
const INK = '#e6e9ed';

/** Half sides of the housing: the region is 360 x 200 and the housing lies inside it with 4 units to spare. */
const HOUSING_HALF = { w: 176, h: 96 } as const;

/**
 * The simplified transponder (D-11, PNL-07): a dark housing, a readout window and one key per
 * alphabet character plus CLR. A key is a momentary press target (C-16): the gesture layer commits
 * it after the hold time, a quick tap is a press and a release together, and a key never zooms,
 * never forms a double-tap pair and never retracts, so a code with a repeated digit can be typed
 * with quick taps. The entry buffer is UI-local (C-15): the digits typed so far are not control
 * state and never reach the store; the fourth digit dispatches the whole code with one event, CLR
 * empties the buffer, and a new run (store reset) empties it too. The readout shows the typed
 * digits padded with dashes while typing, else the committed code: it is the one text of the
 * panel that follows a control state (D-11, C-17), marked data-glass="readout". Every printed
 * label (the name and the key legends) is static (G-0.1).
 */
export function CodeEntry({ def, bridge }: WidgetProps<CodeEntryDef>) {
  const buffer = useRef(createEntryBuffer(def.digits));
  const typed = useSignal('');
  const state = bridge.stateOf(def.id).value;

  useEffect(() => {
    // A new run starts without a partial entry.
    return bridge.store.onReset(() => {
      buffer.current.clear();
      typed.value = '';
    });
  }, [bridge, typed]);

  const readout = typed.value === '' ? state : typed.value.padEnd(def.digits, '-');

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      role="img"
      aria-label={`${def.label}: CODE`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <CodeEntryBody
        def={def}
        readout={readout}
        keyRef={(k) => {
          const press = makeCodeKeyPress({
            def,
            key: k.key,
            buffer: buffer.current,
            actuate: (id, value) => bridge.actuate(id, value),
            onChange: () => {
              typed.value = buffer.current.value;
            },
          });
          return (el) => registerPressTarget(el, press);
        }}
      />
    </g>
  );
}

export interface CodeEntryBodyProps {
  readonly def: CodeEntryDef;
  /** The text of the readout: the typed digits padded with dashes, or the committed code. */
  readonly readout: string;
  /** Ref callback of the hit rectangle of a key; absent draws the art only (unit tests). */
  readonly keyRef?: (key: CodeEntryKeyDef) => (el: SVGRectElement | null) => void;
}

/**
 * The art and the key hit rectangles of the unit, pure and hook-free so a node test can read its
 * text. Every printed text is static (the name, the key legends) except the readout, the one text
 * of the panel that follows a control state (D-11, C-17).
 */
export function CodeEntryBody({ def, readout, keyRef }: CodeEntryBodyProps) {
  const { display } = def;
  return (
    <g>
      <rect
        x={-HOUSING_HALF.w}
        y={-HOUSING_HALF.h}
        width={2 * HOUSING_HALF.w}
        height={2 * HOUSING_HALF.h}
        rx={8}
        fill={HOUSING.fill}
        stroke={HOUSING.stroke}
        stroke-width={1.5}
        pointer-events="none"
      />
      <text
        x={0}
        y={display.y - display.h / 2 - 6}
        text-anchor="middle"
        font-family={FONT}
        font-size={8}
        fill={INK}
        pointer-events="none"
      >
        {def.label}
      </text>
      <rect
        x={display.x - display.w / 2}
        y={display.y - display.h / 2}
        width={display.w}
        height={display.h}
        rx={4}
        fill={WINDOW_FACE.fill}
        stroke={WINDOW_FACE.stroke}
        stroke-width={1}
        pointer-events="none"
      />
      <text
        class="glass-digits"
        data-glass="readout"
        x={display.x}
        y={display.y + display.h * 0.3}
        text-anchor="middle"
        font-size={display.h * 0.8}
        fill="#7fe08a"
        pointer-events="none"
      >
        {readout}
      </text>
      {def.keys.map((k) => (
        <g key={k.key} pointer-events="none">
          <rect
            x={k.x - k.w / 2}
            y={k.y - k.h / 2}
            width={k.w}
            height={k.h}
            rx={6}
            fill={KEY_FACE.fill}
            stroke={KEY_FACE.stroke}
            stroke-width={1.5}
          />
          <text
            x={k.x}
            y={k.y + (k.key === CODE_ENTRY_CLEAR_KEY ? 3.5 : 6)}
            text-anchor="middle"
            font-family={FONT}
            font-size={k.key === CODE_ENTRY_CLEAR_KEY ? 10 : 18}
            fill={INK}
          >
            {k.label}
          </text>
          <rect
            data-detent={`${def.id}:${k.key}`}
            x={k.x - k.w / 2}
            y={k.y - k.h / 2}
            width={k.w}
            height={k.h}
            fill="transparent"
            pointer-events="all"
            ref={keyRef?.(k)}
          />
        </g>
      ))}
    </g>
  );
}
