import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type { ControlDef, DetentLeverDef } from '../src/engine/registry';
import { LeverBody } from '../src/ui/panel/widgets/DetentLever';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { El, Tree } from './vnode-walk';

// Lever skins (PNL-11, D-09, UI-SPEC 8.5). Pure vnode and data checks, no DOM.

function isLever(c: ControlDef): c is DetentLeverDef {
  return c.kind === 'detent-lever';
}

const LEVERS = DA50RG.controls.filter(isLever);

function lever(id: string): DetentLeverDef {
  const found = LEVERS.find((l) => l.id === id);
  if (found === undefined) throw new Error(`unknown lever ${id}`);
  return found;
}

function regionWidth(def: DetentLeverDef): number {
  const region = DA50RG.regions.find((r) => r.id === def.region);
  if (region === undefined) throw new Error(`unknown region ${def.region}`);
  return region.bounds.w;
}

function body(def: DetentLeverDef, state: string, dragging = false, pos?: number): El {
  const detent = def.detents.find((d) => d.id === state);
  if (detent === undefined) throw new Error(`unknown detent ${state}`);
  return expand(
    LeverBody({
      def,
      state,
      handlePos: pos ?? detent.pos,
      dragging,
      regionWidth: regionWidth(def),
    }),
  );
}

function stateTexts(tree: Tree): El[] {
  return findElements(tree, (el) => 'data-state-text' in el.props);
}

function texts(tree: Tree): string[] {
  return findElements(tree, (el) => el.tag === 'text').map((el) => textOf(el));
}

function sourceOf(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('LeverBody', () => {
  it('stays within 40 nodes with exactly one state text equal to the detent label, in every state', () => {
    expect(LEVERS.length).toBeGreaterThanOrEqual(12);
    for (const def of LEVERS) {
      for (const detent of def.detents) {
        for (const dragging of [false, true]) {
          const tree = body(def, detent.id, dragging);
          const id = `${def.id}/${detent.id}/${String(dragging)}`;
          expect(countElements(tree), id).toBeLessThanOrEqual(40);
          const found = stateTexts(tree);
          expect(found, id).toHaveLength(1);
          expect(textOf(found[0] as El), id).toBe(detent.label);
        }
      }
    }
  });

  it('draws POWER with its 21 detents inside the node cap and all ticks as one path', () => {
    const power = lever('lv.power');
    expect(power.detents).toHaveLength(21);
    const tree = body(power, 'p70');
    expect(countElements(tree)).toBeLessThanOrEqual(40);
    const ticks = findElements(
      tree,
      (el) => el.tag === 'path' && String(el.props['d']).startsWith('M'),
    );
    expect(ticks.filter((t) => String(t.props['d']).split('M').length - 1 === 21)).toHaveLength(1);
  });

  it('names the lever on the group: data-skin, role img and aria-label LABEL: STATE', () => {
    for (const def of LEVERS) {
      const first = def.detents[0];
      if (first === undefined) throw new Error('no detent');
      const tree = body(def, first.id);
      expect(tree.props['role'], def.id).toBe('img');
      expect(tree.props['aria-label'], def.id).toBe(`${def.label}: ${first.label}`);
      expect(tree.props['data-skin'], def.id).toBe(def.skin);
    }
  });

  it('is pure: it renders without a render context (no hooks)', () => {
    const def = lever('lv.gear');
    expect(() => body(def, 'up')).not.toThrow();
  });

  it('gives the handle hit the full footprint width and one handle square along the track', () => {
    for (const def of LEVERS) {
      const first = def.detents[0];
      if (first === undefined) throw new Error('no detent');
      const hit = findElements(body(def, first.id), (el) => el.props['data-hit'] === def.id)[0];
      expect(hit, def.id).toBeDefined();
      const vertical = def.track.axis === 'v';
      const wide = vertical ? hit?.props['width'] : hit?.props['height'];
      expect(wide, def.id).toBe(vertical ? def.hit.w : def.hit.h);
    }
  });

  it('gives a dragOnly lever no marker targets, the wider handle hit notwithstanding', () => {
    const emerg = lever('lv.emerg_gear');
    expect(emerg.dragOnly).toBe(true);
    const tree = body(emerg, 'normal');
    expect(findElements(tree, (el) => 'data-detent' in el.props)).toHaveLength(0);
  });
});

describe('gear knob', () => {
  it('lv.gear is the gear-knob skin: a silver knob with UP and DOWN legends', () => {
    const gear = lever('lv.gear');
    expect(gear.skin).toBe('gear-knob');
    const tree = body(gear, 'up');
    const all = JSON.stringify(findElements(tree, () => true).map((el) => el.props));
    expect(all).toContain('url(#g-silver)');
    expect(texts(tree)).toEqual(expect.arrayContaining(['UP', 'DOWN']));
  });

  it('draws the knob as a disc of r 22 with twelve flute lines', () => {
    const tree = body(lever('lv.gear'), 'down');
    const disc = findElements(tree, (el) => el.tag === 'circle' && el.props['r'] === 22);
    expect(disc).toHaveLength(1);
    const flutes = findElements(
      tree,
      (el) => el.tag === 'path' && el.props['stroke'] === '#7d838b',
    );
    expect(flutes).toHaveLength(1);
    expect(String(flutes[0]?.props['d']).split('M').length - 1).toBe(12);
  });

  it('marks a grab with the blue ring only while dragging', () => {
    const calm = JSON.stringify(
      findElements(body(lever('lv.gear'), 'up'), () => true).map((e) => e.props),
    );
    const grab = JSON.stringify(
      findElements(body(lever('lv.gear'), 'up', true), () => true).map((e) => e.props),
    );
    expect(calm).not.toContain('#8fb8e6');
    expect(grab).toContain('#8fb8e6');
  });

  it('follows the drag position, not the committed detent, while dragging', () => {
    const gear = lever('lv.gear');
    const at = (pos: number) =>
      findElements(
        expand(
          LeverBody({ def: gear, state: 'up', handlePos: pos, dragging: true, regionWidth: 239 }),
        ),
        (el) =>
          el.tag === 'g' &&
          typeof el.props['transform'] === 'string' &&
          String(el.props['transform']).startsWith('translate(0 ') &&
          !('data-control-id' in el.props),
      )[0]?.props['transform'];
    expect(at(1)).not.toEqual(at(0));
  });
});

describe('FLAPS, de-ice MODE and the pull handles', () => {
  const EXPECTED: Record<string, string> = {
    'lv.flaps': 'flaps-block',
    'lv.deice_mode': 'bat-small',
    'lv.alt_static': 'pull-t',
    'lv.emerg_gear': 'pull-tab',
    'lv.alt_air': 'pull-boot',
  };

  it('assigns the skins of UI-SPEC 8.5', () => {
    for (const [id, skin] of Object.entries(EXPECTED)) expect(lever(id).skin, id).toBe(skin);
  });

  it('keeps EMERGENCY GEAR EXTENSION dragOnly with no markers', () => {
    const emerg = lever('lv.emerg_gear');
    expect(emerg.dragOnly).toBe(true);
    expect(emerg.markers).toBeUndefined();
  });

  it('uses the safety red #c4161f only in the pull-t and pull-tab bodies among the levers', () => {
    for (const def of LEVERS) {
      const first = def.detents[0];
      if (first === undefined) throw new Error('no detent');
      const props = JSON.stringify(
        findElements(body(def, first.id), () => true).map((e) => e.props),
      );
      const red = props.toLowerCase().includes('#c4161f');
      expect(red, def.id).toBe(def.skin === 'pull-t' || def.skin === 'pull-tab');
    }
  });

  it('draws FLAPS as a 46 x 26 block in a 54 wide slot with three notches', () => {
    const flaps = lever('lv.flaps');
    const tree = body(flaps, 'up');
    const block = findElements(
      tree,
      (el) => el.tag === 'rect' && el.props['width'] === 46 && el.props['height'] === 26,
    );
    expect(block).toHaveLength(1);
    const slot = findElements(
      tree,
      (el) =>
        el.tag === 'rect' &&
        el.props['width'] === 54 &&
        el.props['height'] === flaps.track.length + 36,
    );
    expect(slot).toHaveLength(1);
    const ticks = findElements(
      tree,
      (el) => el.tag === 'path' && String(el.props['d']).startsWith('M-27'),
    );
    expect(String(ticks[0]?.props['d']).split('M').length - 1).toBe(3);
  });

  it('puts PULL on the red knob and the red tab, and ALTERNATE AIR vertically on the boot', () => {
    expect(texts(body(lever('lv.alt_static'), 'closed'))).toContain('PULL');
    expect(texts(body(lever('lv.emerg_gear'), 'normal'))).toContain('PULL');
    const boot = body(lever('lv.alt_air'), 'closed');
    const vertical = findElements(
      boot,
      (el) => el.tag === 'text' && el.props['transform'] === 'rotate(90)',
    );
    expect(vertical.map((t) => textOf(t))).toEqual(['ALTERNATE AIR']);
  });

  it('keeps the stem of a pulled handle between the entry plate and the handle', () => {
    const open = body(lever('lv.alt_static'), 'open');
    const closed = body(lever('lv.alt_static'), 'closed');
    const stem = (t: El) =>
      findElements(
        t,
        (el) => el.tag === 'rect' && el.props['width'] === 4 && el.props['fill'] === '#8b9199',
      )[0];
    expect(Number(stem(open)?.props['height'])).toBeGreaterThan(
      Number(stem(closed)?.props['height']),
    );
  });
});

describe('lever sources', () => {
  it('use only the font sizes 6, 8, 10 and 14', () => {
    for (const path of [
      '../src/ui/panel/widgets/DetentLever.tsx',
      '../src/ui/panel/skins/LeverHandles.tsx',
    ]) {
      const src = sourceOf(path);
      const sizes = [...src.matchAll(/font-size=\{([^}]+)\}/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]],
      );
      expect(sizes.length, path).toBeGreaterThan(0);
      for (const size of sizes) {
        expect(['6', '8', '10', '14', 'compact ? 8 : 10'], `${path} ${size}`).toContain(size);
      }
    }
  });
});
