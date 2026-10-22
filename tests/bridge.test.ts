import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
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

// Scenario baseline and time source (plan 02-04, SCN-03, D-08, D-13).
describe('bridge reset', () => {
  const aircraft = { quantities: DA50RG_QUANTITIES };
  const baseline = { 'lv.power': 'p75', 'lv.cowl_flap': 'closed' };

  it('applies a baseline to the signals and lamps without an event and sets the quantities', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, aircraft);
    expect(bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
    bridge.actuate('lv.cowl_flap', 'open');
    expect(bridge.indicatorOf('lt.cowl_open').value).toBe(true);
    bridge.reset(baseline, { oil_temp_c: 128, oil_pressure_bar: 5 });
    expect(bridge.stateOf('lv.power').value).toBe('p75');
    expect(bridge.stateOf('lv.cowl_flap').value).toBe('closed');
    expect(bridge.indicatorOf('lt.cowl_open').value).toBe(false);
    expect(bridge.indicatorOf('lt.cowl_closed').value).toBe(true);
    expect(bridge.store.events()).toEqual([]);
    expect(bridge.quantities.value).toEqual({
      ...DA50RG_QUANTITIES.baseValues(),
      oil_temp_c: 128,
      oil_pressure_bar: 5,
    });
    const snapshot = bridge.store.snapshot();
    for (const def of DA50RG.controls) {
      expect(bridge.stateOf(def.id).value).toBe(snapshot[def.id]);
    }
  });

  it('keeps the baseline through a retract of another control', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, aircraft);
    bridge.reset(baseline);
    bridge.actuate('lv.flaps', 'to');
    expect(bridge.retract(0)).toMatchObject({ ok: true, restored: 'up' });
    expect(bridge.stateOf('lv.power').value).toBe('p75');
    bridge.actuate('lv.power', 'p50');
    expect(bridge.retract(0)).toMatchObject({ ok: true, restored: 'p75' });
    expect(bridge.stateOf('lv.power').value).toBe('p75');
  });

  it('a second reset without quantities returns them to idle', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, aircraft);
    bridge.reset(baseline, { oil_temp_c: 128 });
    bridge.reset({});
    expect(bridge.quantities.value).toEqual(DA50RG_QUANTITIES.baseValues());
    expect(bridge.stateOf('lv.power').value).toBe('p70');
  });

  it('refuses an illegal baseline and changes nothing', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, aircraft);
    bridge.reset(baseline);
    expect(() => bridge.reset({ 'lv.power': 'p99' })).toThrow(RangeError);
    expect(bridge.stateOf('lv.power').value).toBe('p75');
  });

  it('has an empty quantities signal without an aircraft', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS);
    expect(bridge.quantities.value).toEqual({});
    bridge.reset(baseline, { oil_temp_c: 128 });
    expect(bridge.quantities.value).toEqual({ oil_temp_c: 128 });
  });
});

describe('bridge cas signal', () => {
  const baseline = { 'lv.power': 'p75', 'lv.cowl_flap': 'closed' };

  it('follows a quantities reset and a return to idle', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    expect(bridge.cas.value).toEqual([]);
    bridge.reset(baseline, { oil_temp_c: 128, oil_pressure_bar: 5 });
    expect(bridge.cas.value).toEqual([
      { id: 'eng_oil_temp', text: 'ENG OIL TEMP', level: 'warning' },
    ]);
    bridge.reset({}, { oil_temp_c: 125 });
    expect(bridge.cas.value).toEqual([]);
    bridge.reset(baseline, { oil_temp_c: 128 });
    expect(bridge.cas.value).toHaveLength(1);
    bridge.reset({});
    expect(bridge.cas.value).toEqual([]);
  });

  it('keeps the message after an actuation of another control', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    bridge.reset(baseline, { oil_temp_c: 128 });
    bridge.actuate('lv.cowl_flap', 'open');
    expect(bridge.cas.value.map((m) => m.id)).toEqual(['eng_oil_temp']);
  });

  it('is empty for a free bridge and for a bridge without an aircraft', () => {
    expect(createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV).cas.value).toEqual([]);
    expect(createPanelBridge(DA50RG).cas.value).toEqual([]);
    expect(
      createPanelBridge(DA50RG, DA50RG_INDICATORS, { quantities: DA50RG_QUANTITIES }).cas.value,
    ).toEqual([]);
  });
});

describe('bridge time source', () => {
  it('stamps events with the given clock and null restores performance.now', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS);
    bridge.setTimeSource(() => 1234);
    bridge.actuate('lv.flaps', 'to');
    expect(bridge.store.events()[0]?.t).toBe(1234);
    bridge.setTimeSource(null);
    bridge.actuate('lv.flaps', 'ldg');
    const t = bridge.store.events()[1]?.t ?? 0;
    expect(t).not.toBe(1234);
    expect(t).toBeGreaterThan(0);
  });
});

describe('bridge setQuantities (plan 03-01)', () => {
  const aircraft = { quantities: DA50RG_QUANTITIES };

  it('replaces the values, and the same values again keep the very same object', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, aircraft);
    const next = { ...DA50RG_QUANTITIES.baseValues(), oil_temp_c: 100 };
    bridge.setQuantities(next);
    expect(bridge.quantities.value).toEqual(next);
    const held = bridge.quantities.value;
    bridge.setQuantities({ ...next });
    expect(bridge.quantities.value).toBe(held);
    bridge.setQuantities({ ...next, oil_temp_c: 100.01 });
    expect(bridge.quantities.value).not.toBe(held);
    expect(bridge.quantities.value['oil_temp_c']).toBe(100.01);
  });

  it('feeds the derived CAS chips', () => {
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    expect(bridge.cas.value).toEqual([]);
    bridge.setQuantities({ ...DA50RG_QUANTITIES.baseValues(), oil_temp_c: 130 });
    expect(bridge.cas.value.map((m) => m.id)).toEqual(['eng_oil_temp']);
  });
});
