import { describe, expect, it } from 'vitest';
import { MAX_TEXT_LENGTH, parseManifest, parseScenario } from '../src/scenario/parse';
import { MARKERS, MAX_LINE_WORDS, MAX_NOTE_WORDS } from '../src/scenario/schema';
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

  it('rejects a 21-word step text and accepts 20 words', () => {
    expect(MAX_LINE_WORDS).toBe(20);
    expect(parseScenario(swap(MINIMAL, 'text: Reduce power', `text: ${words(20)}`)).ok).toBe(true);
    const text = swap(MINIMAL, 'text: Reduce power', `text: ${words(21)}`);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.steps.0.text',
      line: lineOf(text, 'w20'),
      col: colOf(text, 'w20', 'text'),
    });
  });

  it('keeps 12 words for a forbidden text, in own words', () => {
    const own = 'text: Increase power';
    expect(parseScenario(swap(MINIMAL, own, `text: ${words(12)}`)).ok).toBe(true);
    const text = swap(MINIMAL, own, `text: ${words(13)}`);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'forbidden.0.text', line: lineOf(text, 'w12') });
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

describe('a checklist as printed (plan 03-13)', () => {
  const LINE = '  - kind: line\n    text: Increase airspeed';
  // Adds keys to the line (`withLine`) or one node after it (`withNode`; the list header count
  // follows, strict decoding).
  const withLine = (extra: string): string => swap(MINIMAL, LINE, `${LINE}\n${extra}`);
  const withNode = (node: string): string =>
    withLine(node).replace('procedure[2]:', 'procedure[3]:');

  it('accepts number and action on a line and on a step', () => {
    const text = swap(
      withLine('    number: 1\n    action: check IN'),
      'text: Reduce power',
      'text: Reduce power\n        number: 2\n        action: "OFF"',
    );
    const result = parseScenario(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.procedure[1]).toMatchObject({ number: 1, action: 'check IN' });
    const group = result.value.procedure[0];
    expect(group?.kind === 'group' && group.steps[0]).toMatchObject({ number: 2, action: 'OFF' });
  });

  it('rejects the numbers 0, 100 and 1.5 at the key', () => {
    for (const bad of ['0', '100', '1.5']) {
      const text = withLine(`    number: ${bad}`);
      const issues = issuesOf(text);
      expect(issues, bad).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'procedure.1.number',
        line: lineOf(text, `number: ${bad}`),
        col: colOf(text, `number: ${bad}`, 'number'),
      });
    }
    expect(parseScenario(withLine('    number: 99')).ok).toBe(true);
  });

  it('accepts a comment node with and without boxed and with an action', () => {
    for (const body of [
      '  - kind: comment\n    text: Leave icing conditions.',
      '  - kind: comment\n    text: EMERGENCY LANDING (ENGINE OFF)\n    boxed: true\n    action: (page 9)',
    ]) {
      expect(parseScenario(withNode(body)).ok).toBe(true);
    }
  });

  it('accepts a capital letter as a row mark on a line and rejects the other strings', () => {
    expect(parseScenario(withLine('    number: A')).ok).toBe(true);
    expect(parseScenario(withLine('    number: Z')).ok).toBe(true);
    for (const bad of ['a', 'AB', '"1"', '"0"', '""']) {
      const text = withLine(`    number: ${bad}`);
      const issues = issuesOf(text);
      expect(issues, bad).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'procedure.1.number',
        line: lineOf(text, `number: ${bad}`),
      });
    }
  });

  it('accepts the three comment styles and rejects an unknown one at the key', () => {
    for (const style of ['subheading', 'warning', 'caution']) {
      const body = `  - kind: comment\n    style: ${style}\n    text: After Standstill`;
      expect(parseScenario(withNode(body)).ok, style).toBe(true);
    }
    const text = withNode('  - kind: comment\n    style: bold\n    text: After Standstill');
    expect(issuesOf(text)).toContainEqual(
      expect.objectContaining({ path: 'procedure.2.style', line: lineOf(text, 'style: bold') }),
    );
  });

  it('caps a plain or sub-heading comment at the line words and a WARNING or CAUTION block at MAX_NOTE_WORDS', () => {
    const words = (n: number): string => Array.from({ length: n }, () => 'word').join(' ');
    const comment = (style: string, n: number): string =>
      `  - kind: comment\n    style: ${style}\n    text: ${words(n)}`;
    expect(parseScenario(withNode(comment('subheading', MAX_LINE_WORDS))).ok).toBe(true);
    const long = withNode(comment('subheading', MAX_LINE_WORDS + 1));
    expect(issuesOf(long)).toContainEqual(
      expect.objectContaining({ path: 'procedure.2.text', line: lineOf(long, 'text: word') }),
    );
    for (const style of ['warning', 'caution']) {
      expect(parseScenario(withNode(comment(style, MAX_NOTE_WORDS))).ok, style).toBe(true);
      const over = withNode(comment(style, MAX_NOTE_WORDS + 1));
      expect(issuesOf(over), style).toContainEqual(
        expect.objectContaining({ path: 'procedure.2.text' }),
      );
    }
    const plain = withNode(`  - kind: comment\n    text: ${words(MAX_LINE_WORDS + 1)}`);
    expect(issuesOf(plain)).toContainEqual(expect.objectContaining({ path: 'procedure.2.text' }));
  });

  it('rejects an unknown key in a comment at the key itself', () => {
    const text = withNode('  - kind: comment\n    text: Leave icing conditions.\n    boxd: true');
    const issues = issuesOf(text);
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'procedure.2.boxd',
        line: lineOf(text, 'boxd'),
        col: colOf(text, 'boxd', 'boxd'),
      }),
    );
  });

  it('accepts exactly the six marker names on a line, a step, a decision and both branch shapes', () => {
    expect(MARKERS).toEqual([
      'arrow',
      'diamond',
      'diamond_arrow',
      'double_arrow',
      'circle',
      'square',
    ]);
    const decision = (marker: string): string =>
      [
        '  - kind: decision',
        `    marker: ${marker}`,
        '    text: Check',
        '    branches[1]:',
        `      - marker: ${marker}`,
        '        label: "If more:"',
        '        when:',
        '          check: state',
        '          control: lv.cowl_flap',
        '          is: closed',
      ].join('\n');
    const branch = (marker: string): string =>
      [
        '  - kind: branch',
        `    marker: ${marker}`,
        '    label: "If less:"',
        '    when:',
        '      check: state',
        '      control: lv.cowl_flap',
        '      is: closed',
      ].join('\n');
    for (const marker of MARKERS) {
      expect(parseScenario(withLine(`    marker: ${marker}`)).ok, `line ${marker}`).toBe(true);
      const step = swap(
        MINIMAL,
        'text: Reduce power',
        `text: Reduce power\n        marker: ${marker}`,
      );
      expect(parseScenario(step).ok, `step ${marker}`).toBe(true);
      expect(parseScenario(withNode(decision(marker))).ok, `decision ${marker}`).toBe(true);
      expect(parseScenario(withNode(branch(marker))).ok, `branch ${marker}`).toBe(true);
    }
  });

  it('rejects any other marker word at the key', () => {
    const text = withLine('    marker: star');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.1.marker',
      line: lineOf(text, 'marker: star'),
      col: colOf(text, 'marker: star', 'marker'),
    });
  });

  it('accepts the two forms and rejects any other at the key', () => {
    for (const form of ['table', 'outline']) {
      const text = swap(MINIMAL, 'procedure[2]:', `checklist:\n  form: ${form}\nprocedure[2]:`);
      expect(parseScenario(text).ok, form).toBe(true);
    }
    const bad = swap(MINIMAL, 'procedure[2]:', 'checklist:\n  form: list\nprocedure[2]:');
    expect(issuesOf(bad)[0]).toMatchObject({
      path: 'checklist.form',
      line: lineOf(bad, 'form: list'),
      col: colOf(bad, 'form: list', 'form'),
    });
  });

  it('defaults the form to outline and keeps heading and message', () => {
    const text = swap(
      MINIMAL,
      'procedure[2]:',
      'checklist:\n  heading: ALTN 1 FAIL\n  message: ALTERNATOR 1 HAS FAILED\nprocedure[2]:',
    );
    const result = parseScenario(text);
    expect(result.ok && result.value.checklist).toEqual({
      form: 'outline',
      heading: 'ALTN 1 FAIL',
      message: 'ALTERNATOR 1 HAS FAILED',
    });
  });
});

describe('the Realistic setup in the onset block (plan 03-11, C-58)', () => {
  const WITH_ONSET = `${MINIMAL}onset:
  window_s[2]: 2,6
  quantities:
    oil_temp_c: 114
  parameters:
    oil_temp_rate: 3
`;

  it('accepts onset quantities and parameters and keeps their values', () => {
    const result = parseScenario(WITH_ONSET);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.onset).toEqual({
      window_s: [2, 6],
      quantities: { oil_temp_c: 114 },
      parameters: { oil_temp_rate: 3 },
      controls: {},
      cues: [],
    });
  });

  it('defaults both to empty when only the window is given', () => {
    const result = parseScenario(`${MINIMAL}onset:\n  window_s[2]: 5,20\n`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.onset).toEqual({
      window_s: [5, 20],
      quantities: {},
      parameters: {},
      controls: {},
      cues: [],
    });
  });

  it('reads onset.cues as a list of ids, at most four, and rejects a bad id at its entry', () => {
    const ok = parseScenario(
      `${MINIMAL}onset:\n  window_s[2]: 5,20\n  cues[2]: flames,cabin_smoke\n`,
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.onset?.cues).toEqual(['flames', 'cabin_smoke']);
    const many = parseScenario(`${MINIMAL}onset:\n  window_s[2]: 5,20\n  cues[5]: a,b,c,d,e\n`);
    expect(many.ok).toBe(false);
    const bad = `${MINIMAL}onset:\n  window_s[2]: 5,20\n  cues[1]: Bad-Id\n`;
    const issues = issuesOf(bad);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('onset.cues.0');
  });

  it('rejects a non-numeric quantity or parameter at the line of the key', () => {
    for (const [from, to, key] of [
      ['oil_temp_c: 114', 'oil_temp_c: hot', 'oil_temp_c: hot'],
      ['oil_temp_rate: 3', 'oil_temp_rate: fast', 'oil_temp_rate: fast'],
    ] as const) {
      const text = swap(WITH_ONSET, from, to);
      const issues = issuesOf(text);
      expect(issues, key).toHaveLength(1);
      expect(issues[0]?.path).toMatch(/^onset\.(quantities|parameters)\./);
      expect(issues[0]?.line).toBe(lineOf(text, key));
    }
  });

  it('rejects an unknown key inside onset at the key itself', () => {
    const text = swap(WITH_ONSET, '  parameters:', '  paramters:');
    const issues = issuesOf(text);
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'onset.paramters',
        line: lineOf(text, 'paramters:'),
        col: colOf(text, 'paramters:', 'paramters'),
      }),
    );
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
