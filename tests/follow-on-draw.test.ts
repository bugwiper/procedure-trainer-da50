import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { followOnFromSeed } from '../src/engine/follow-on';
import { checkScenario } from '../src/scenario/lint';

// The weighted draw of the follow-on target (Phase 9, plan 09-04, R-06). The seeds and the targets
// of the tables below are written by hand; the generator is an independent copy of the public-domain
// mulberry32 formula inside this file, never imported from src, so a change of the engine's
// generator or of the cumulative rule is caught here and not copied along.
const root = fileURLToPath(new URL('../', import.meta.url));

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIELD = { pack: 'landing', scenario: 'field', weight: 2 };
const WATER = { pack: 'landing', scenario: 'water', weight: 1 };
const LIST = [FIELD, WATER] as const;

// The target a seed draws for the weights 2 and 1: the first value of the independent copy times 3,
// below 2 the first target, else the second (values computed once with the copy above, then typed).
const TABLE: readonly (readonly [number, 'field' | 'water'])[] = [
  [1, 'field'],
  [2, 'water'],
  [3, 'water'],
  [4, 'water'],
  [5, 'water'],
  [6, 'field'],
  [7, 'field'],
  [8, 'field'],
  [9, 'field'],
  [10, 'field'],
  [42, 'field'],
  [123456789, 'field'],
  [4294967295, 'water'],
];

describe('followOnFromSeed (R-06)', () => {
  it('draws the hand-written table of seeds for the weights 2 and 1', () => {
    for (const [seed, expected] of TABLE) {
      expect(followOnFromSeed(seed, LIST).scenario, `seed ${String(seed)}`).toBe(expected);
    }
  });

  it('agrees with the independent copy of the formula on seeds 1 to 3000', () => {
    for (let seed = 1; seed <= 3000; seed += 1) {
      const x = mulberry(seed)() * 3;
      expect(followOnFromSeed(seed, LIST).scenario, `seed ${String(seed)}`).toBe(
        x < 2 ? 'field' : 'water',
      );
    }
  });

  it('draws two to one over seeds 1 to 3000, within a stated tolerance', () => {
    let field = 0;
    for (let seed = 1; seed <= 3000; seed += 1) {
      if (followOnFromSeed(seed, LIST).scenario === 'field') field += 1;
    }
    // 2000 are expected; the tolerance of 120 is 4 percent of the draws (about 4.6 standard deviations).
    expect(Math.abs(field - 2000)).toBeLessThanOrEqual(120);
    expect(3000 - field).toBeGreaterThan(0);
  });

  it('never draws a target of weight 0 and ignores its place in the list', () => {
    const zeroFirst = [{ ...FIELD, weight: 0 }, WATER] as const;
    const zeroLast = [WATER, { ...FIELD, weight: 0 }] as const;
    for (let seed = 1; seed <= 3000; seed += 1) {
      expect(followOnFromSeed(seed, zeroFirst).scenario).toBe('water');
      expect(followOnFromSeed(seed, zeroLast).scenario).toBe('water');
    }
  });

  it('always draws the only target, and returns the list entry itself', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      expect(followOnFromSeed(seed, [WATER])).toBe(WATER);
    }
  });

  it('throws RangeError for an empty list and for a total of 0', () => {
    expect(() => followOnFromSeed(1, [])).toThrow(RangeError);
    expect(() =>
      followOnFromSeed(1, [
        { ...FIELD, weight: 0 },
        { ...WATER, weight: 0 },
      ]),
    ).toThrow(RangeError);
  });

  it('is deterministic: the same seed and list give the same target', () => {
    for (const seed of [0, 1, 99, 4294967295]) {
      expect(followOnFromSeed(seed, LIST)).toBe(followOnFromSeed(seed, LIST));
    }
  });

  it('draws four weighted targets by the cumulative rule', () => {
    const four = [
      { pack: 'p', scenario: 'a', weight: 1 },
      { pack: 'p', scenario: 'b', weight: 0 },
      { pack: 'p', scenario: 'c', weight: 3 },
      { pack: 'p', scenario: 'd', weight: 6 },
    ];
    for (let seed = 1; seed <= 500; seed += 1) {
      const x = mulberry(seed)() * 10;
      const expected = x < 1 ? 'a' : x < 4 ? 'c' : 'd';
      expect(followOnFromSeed(seed, four).scenario, `seed ${String(seed)}`).toBe(expected);
    }
  });
});

describe('a replay of the draw (T-09-10)', () => {
  // The fixture source names two landing fixtures with the weights 2 and 1: the recorded
  // `{ seed, from }` and the source file give back the recorded target.
  const parsed = checkScenario(
    readFileSync(`${root}tests/fixtures/scenarios/landing-source.toon`, 'utf8'),
    DA50RG_ENV,
  );
  if (!parsed.ok) throw new Error('the source fixture does not check');
  const list = parsed.scenario.further?.follow_on?.['conduct_emergency'];
  if (list === undefined) throw new Error('the source fixture names no follow-on');

  it('reads weights 2 and 1 from the file', () => {
    expect(list.map((t) => t.weight)).toEqual([2, 1]);
  });

  it('gives the recorded target for a recorded seed', () => {
    for (const seed of [1, 2, 8, 10, 3000, 4294967295]) {
      const recorded = { seed, from: parsed.scenario.id };
      const live = followOnFromSeed(recorded.seed, list);
      const replay = followOnFromSeed(recorded.seed, list);
      expect(replay.scenario).toBe(live.scenario);
      expect(['landing-fixture', 'landing-fixture-off']).toContain(replay.scenario);
    }
    // The hand-written expectation (table above): seed 1 draws the first fixture, seed 2 the second.
    expect(followOnFromSeed(1, list).scenario).toBe('landing-fixture');
    expect(followOnFromSeed(2, list).scenario).toBe('landing-fixture-off');
  });
});

describe('the draw over the shipped sources (R-07)', () => {
  // The two sources name the engine-off landing (weight 2) and the ditching (weight 1); the targets
  // of the table seeds are the hand-typed ones of the first table above (below 2 of 3: the landing).
  const SOURCES = [
    'scenarios/engine/eng-fire-in-flight.toon',
    'scenarios/fire/takeoff-fire-no-abort.toon',
  ];

  it.each(SOURCES)(
    '%s: the weights are 2 and 1 and the table seeds draw the typed targets',
    (path) => {
      const checked = checkScenario(readFileSync(`${root}${path}`, 'utf8'), DA50RG_ENV);
      if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
      const list = checked.scenario.further?.follow_on?.['conduct_emergency'];
      expect(list?.map((t) => `${t.pack}/${t.scenario}:${String(t.weight)}`)).toEqual([
        'landing/landing-engine-off:2',
        'landing/ditching:1',
      ]);
      if (list === undefined) return;
      for (const [seed, expected] of TABLE) {
        expect(followOnFromSeed(seed, list).scenario, `seed ${String(seed)}`).toBe(
          expected === 'field' ? 'landing-engine-off' : 'ditching',
        );
      }
      // Over seeds 1 to 3000 the engine-off landing is drawn about twice as often as the ditching.
      let landing = 0;
      for (let seed = 1; seed <= 3000; seed += 1) {
        if (followOnFromSeed(seed, list).scenario === 'landing-engine-off') landing += 1;
      }
      expect(Math.abs(landing - 2000)).toBeLessThanOrEqual(120);
    },
  );
});
