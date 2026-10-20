import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { RegistryError, defineRegistry } from '../src/engine/registry';
import type { ControlSpec } from '../src/engine/registry';

// Registry invariant suite (PNL-02). Inline fixtures build the malformed definitions.

const VIEW_BOX = { w: 100, h: 100 };
const REGIONS = [{ id: 'r1', name: 'R1', bounds: { x: 0, y: 0, w: 100, h: 100 } }];

const base = { label: 'X', region: 'r1', x: 10, y: 10, hit: { w: 20, h: 20 } };

function toggle(id: string): ControlSpec {
  return {
    ...base,
    kind: 'toggle',
    id,
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ],
    default: 'off',
  };
}

function build(controls: readonly ControlSpec[]) {
  return defineRegistry({ viewBox: VIEW_BOX, regions: REGIONS, controls });
}

describe('DA50RG registry', () => {
  it('builds without throwing and contains the tracer controls', () => {
    expect(DA50RG.get('sw.engine_master')).toBeDefined();
    expect(DA50RG.get('sw.mfd_page')).toBeDefined();
  });
});

describe('kind prefix rule', () => {
  it('rejects a toggle whose id starts with "lv."', () => {
    expect(() => build([toggle('lv.bad_toggle')])).toThrow(RegistryError);
    expect(() => build([toggle('lv.bad_toggle')])).toThrow(/lv\.bad_toggle/);
  });
});
