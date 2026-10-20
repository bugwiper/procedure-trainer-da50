import type { ControlDef } from '../../engine/registry';
import type { PanelBridge } from '../bridge';
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
    case 'guard':
      // The guard is drawn by its guarded-toggle widget.
      return null;
    default:
      throw new UnsupportedControlKindError(
        `no widget for control "${def.id}" of kind "${def.kind}"`,
      );
  }
}
