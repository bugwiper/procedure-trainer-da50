import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { createPanelBridge } from '../src/ui/bridge';

// Bridge retract (owner finding R3-Z3, plan 35): the control signal and every derived lamp follow a
// log-level retract. Node environment: the bridge needs no DOM.

describe('bridge retract', () => {
  it('returns the flap lever and its lamp to the previous state and empties the log', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS);
    const lever = bridge.stateOf('lv.flaps');
    const lamp = bridge.indicatorOf('lt.flap_to');
    expect(lever.value).toBe('up');
    expect(lamp.value).toBe(false);

    const actuated = bridge.actuate('lv.flaps', 'to');
    expect(actuated.ok).toBe(true);
    expect(lever.value).toBe('to');
    expect(lamp.value).toBe(true);

    const result = bridge.retract(0);
    expect(result).toMatchObject({ ok: true, restored: 'up' });
    expect(lever.value).toBe('up');
    expect(lamp.value).toBe(false);
    expect(bridge.store.events()).toEqual([]);
  });

  it('changes no signal when the retract is refused', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS);
    bridge.actuate('lv.flaps', 'to');
    bridge.actuate('lv.flaps', 'ldg');
    const lever = bridge.stateOf('lv.flaps');
    const lamp = bridge.indicatorOf('lt.flap_to');
    expect(bridge.retract(0)).toEqual({ ok: false, reason: 'not-last' });
    expect(lever.value).toBe('ldg');
    expect(lamp.value).toBe(false);
    expect(bridge.store.events()).toHaveLength(2);
  });

  it('keeps the signals in step with the store after a mix of actuations and retracts', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS);
    bridge.actuate('lv.flaps', 'to');
    bridge.actuate('cb.pitot', 'out');
    bridge.retract(1);
    bridge.retract(0);
    bridge.actuate('lv.flaps', 'ldg');
    const snapshot = bridge.store.snapshot();
    for (const def of DA50RG.controls) {
      expect(bridge.stateOf(def.id).value).toBe(snapshot[def.id]);
    }
    expect(bridge.store.events().map((e) => [e.seq, e.id, e.value])).toEqual([
      [0, 'lv.flaps', 'ldg'],
    ]);
  });
});
