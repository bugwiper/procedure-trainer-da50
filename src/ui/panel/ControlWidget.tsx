import type { ControlDef } from '../../engine/registry';
import type { PanelBridge } from '../bridge';
import { CircuitBreaker } from './widgets/CircuitBreaker';
import { CodeEntry } from './widgets/CodeEntry';
import { DetentLever } from './widgets/DetentLever';
import { GuardedToggle } from './widgets/GuardedToggle';
import { MomentaryButton } from './widgets/MomentaryButton';
import { Rotary } from './widgets/Rotary';
import { Toggle } from './widgets/Toggle';

export interface WidgetProps<D extends ControlDef = ControlDef> {
  readonly def: D;
  readonly bridge: PanelBridge;
}

export class UnsupportedControlKindError extends Error {}

/** Picks the widget by control kind; data without a widget fails loudly. */
export function ControlWidget({ def, bridge }: WidgetProps) {
  switch (def.kind) {
    case 'toggle':
      return <Toggle def={def} bridge={bridge} />;
    case 'guarded-toggle':
      return <GuardedToggle def={def} bridge={bridge} />;
    case 'detent-lever':
      return <DetentLever def={def} bridge={bridge} />;
    case 'momentary-button':
      return <MomentaryButton def={def} bridge={bridge} />;
    case 'rotary':
      return <Rotary def={def} bridge={bridge} />;
    case 'circuit-breaker':
      return <CircuitBreaker def={def} bridge={bridge} />;
    case 'code-entry':
      return <CodeEntry def={def} bridge={bridge} />;
    case 'guard':
      // The guard is drawn by its guarded-toggle widget.
      return null;
    default:
      return unsupported(def);
  }
}

/** Compile error when a ControlKind has no branch above; at run time unreachable. */
function unsupported(def: never): never {
  const { id, kind } = def as ControlDef;
  throw new UnsupportedControlKindError(`no widget for control "${id}" of kind "${kind}"`);
}
