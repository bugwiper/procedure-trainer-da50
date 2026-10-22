import { describe, expect, it } from 'vitest';
import { MAX_TEXT_LENGTH, parseManifest, parseScenario } from '../src/scenario/parse';
import { colOf, lineOf, MINIMAL, swap } from './scenario-text';

// Parser errors of an author (SCN-01): every issue names its line and column. Each case edits the
// minimal valid scenario in one place; the expected position is that place in the edited text.
function issuesOf(text: string) {
  const result = parseScenario(text);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues;
}

const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${String(i)}`).join(' ');

describe('parseScenario', () => {
  it('accepts the minimal scenario', () => {
    expect(parseScenario(MINIMAL).ok).toBe(true);
  });

  it('locates an unknown key at the key itself', () => {
    const text = swap(MINIMAL, 'ordered: false', 'ordred: false');
    const issues = issuesOf(text);
    expect(issues).toContainEqual({
      path: 'procedure.0.ordred',
      message: 'unknown key "ordred"',
      line: lineOf(text, 'ordred'),
      col: colOf(text, 'ordred', 'ordred'),
    });
  });

  it('locates a wrong severity at the severity key', () => {
    const text = swap(
      MINIMAL,
      'severity: critical\n        text: Reduce',
      'severity: urgent\n        text: Reduce',
    );
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.steps.0.severity',
      line: lineOf(text, 'severity: urgent'),
      col: colOf(text, 'severity: urgent', 'severity'),
    });
  });

  it('locates a string where a list is expected', () => {
    const text = swap(MINIMAL, 'procedure[2]:', 'procedure: nothing');
    const issues = issuesOf(text);
    // The decoder keeps only the first of the stray lines; the issue is at or after the key.
    expect(issues[0]?.line).toBeGreaterThanOrEqual(lineOf(text, 'procedure: nothing'));
    expect(issues[0]?.line).toBeGreaterThan(0);
  });

  it('reports the decoder line for an array count that does not match', () => {
    const text = swap(MINIMAL, 'annunciations[1]: eng_oil_temp', 'annunciations[2]: eng_oil_temp');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBeGreaterThanOrEqual(lineOf(text, 'annunciations[2]'));
    expect(issues[0]?.col).toBe(1);
    expect(issues[0]?.message).not.toMatch(/^Line \d+/);
  });

  it('reports a list that is shorter than its header', () => {
    const text = swap(MINIMAL, 'procedure[2]:', 'procedure[3]:');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBeGreaterThanOrEqual(lineOf(text, 'procedure[3]'));
  });

  it('reports tab indentation at its line', () => {
    const text = swap(MINIMAL, '  document: "AFM', '\tdocument: "AFM');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBe(lineOf(text, '\tdocument'));
  });

  it('reports a duplicate key, never accepts it silently', () => {
    const text = swap(MINIMAL, 'disclaimer: training-aid', 'disclaimer: training-aid\nformat: 1');
    const result = parseScenario(text);
    if (result.ok) {
      throw new Error('a duplicate top-level key was accepted');
    }
    expect(result.issues[0]?.line).toBeGreaterThan(0);
  });

  it('refuses a text over the size cap before decoding, at line 1', () => {
    const issues = issuesOf('x'.repeat(MAX_TEXT_LENGTH + 1));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: '(root)', line: 1, col: 1 });
  });

  it('rejects a 13-word step text and accepts 12 words', () => {
    expect(parseScenario(swap(MINIMAL, 'text: Reduce power', `text: ${words(12)}`)).ok).toBe(true);
    const text = swap(MINIMAL, 'text: Reduce power', `text: ${words(13)}`);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.steps.0.text',
      line: lineOf(text, 'w12'),
      col: colOf(text, 'w12', 'text'),
    });
  });

  it('rejects a 61-word situation and accepts 60 words', () => {
    const situation = 'situation: "Short situation in own words."';
    expect(parseScenario(swap(MINIMAL, situation, `situation: "${words(60)}"`)).ok).toBe(true);
    const text = swap(MINIMAL, situation, `situation: "${words(61)}"`);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'briefing.situation', line: lineOf(text, 'w60') });
  });

  it('rejects a 19-character title and accepts 18', () => {
    expect(parseScenario(swap(MINIMAL, 'title: MINIMAL', 'title: ABCDEFGHIJKLMNOPQR')).ok).toBe(
      true,
    );
    const text = swap(MINIMAL, 'title: MINIMAL', 'title: ABCDEFGHIJKLMNOPQRS');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'title', line: lineOf(text, 'title:'), col: 1 });
  });

  it('rejects a branch label without a colon and one with 9 words', () => {
    const branch = (label: string) =>
      swap(
        MINIMAL,
        '  - kind: line\n    text: Increase airspeed',
        `  - kind: branch\n    label: "${label}"\n    when:\n      check: state\n      control: lv.cowl_flap\n      is: closed`,
      );
    expect(parseScenario(branch('If something:')).ok).toBe(true);
    const noColon = branch('If something');
    expect(issuesOf(noColon)[0]).toMatchObject({
      path: 'procedure.1.label',
      line: lineOf(noColon, 'label:'),
    });
    const nine = branch(`${words(8)} nine:`);
    expect(issuesOf(nine)[0]).toMatchObject({
      path: 'procedure.1.label',
      line: lineOf(nine, 'label:'),
    });
  });

  it('rejects an empty source document and a malformed verified date', () => {
    const empty = swap(MINIMAL, 'document: "AFM DA 50 C, Doc 9.01.01-E"', 'document: "  "');
    expect(issuesOf(empty)[0]).toMatchObject({
      path: 'source.document',
      line: lineOf(empty, 'document:'),
    });
    const date = swap(MINIMAL, 'verified: "2026-10-22"', 'verified: "22.10.2026"');
    expect(issuesOf(date)[0]).toMatchObject({
      path: 'source.verified',
      line: lineOf(date, 'verified:'),
    });
  });

  it('locates a key with a dot at the whole key', () => {
    const text = swap(MINIMAL, 'lv.cowl_flap: closed', 'lv.cowl_flap: 12');
    // A number is a legal value for the record (typed string), so the schema rejects it.
    const issues = issuesOf(text);
    expect(issues[0]).toMatchObject({
      path: 'initial.controls.lv.cowl_flap',
      line: lineOf(text, 'lv.cowl_flap: 12'),
      col: colOf(text, 'lv.cowl_flap: 12', 'lv.cowl_flap'),
    });
  });

  it('never throws for text that is not a document', () => {
    for (const text of ['', ':::', '- - -', 'a: [', '{', 'format: 2']) {
      expect(() => parseScenario(text)).not.toThrow();
      expect(parseScenario(text).ok).toBe(false);
    }
  });
});

describe('parseManifest', () => {
  const manifest = [
    'format: 1',
    'title: Engine',
    'free: true',
    'scenarios[1]:',
    '  - id: minimal',
    '    title: MINIMAL',
    '    file: minimal',
  ].join('\n');

  it('accepts a manifest', () => {
    expect(parseManifest(manifest).ok).toBe(true);
  });

  it('locates an unknown key and a wrong value', () => {
    const extra = parseManifest(`${manifest}\ncount: 1`);
    expect(extra.ok).toBe(false);
    if (extra.ok) return;
    expect(extra.issues[0]).toMatchObject({ path: 'count', line: 8, col: 1 });
    const bad = parseManifest(swap(manifest, 'free: true', 'free: maybe'));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.issues[0]).toMatchObject({ path: 'free', line: 3, col: 1 });
  });
});
