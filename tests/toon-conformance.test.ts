import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '@toon-format/toon';
import { describe, expect, it } from 'vitest';

// Conformance corpus for the pinned TOON decoder (RESEARCH Pitfall 4, SCN-01, T-02-13).
// TOON is a Working Draft. Each case below is a way hand-written scenario files rely on the
// decoder. A failing case after a TOON upgrade means the upgrade changes how hand-written files
// decode and needs a deliberate migration (files, schema, this corpus), not a quick fix of the
// test. Dependabot ignores @toon-format/toon for the same reason. Files under
// tests/fixtures/broken are deliberately faulty and not part of this corpus.
const root = fileURLToPath(new URL('../', import.meta.url));

describe('decoder behaviour the scenario files rely on (@toon-format/toon 4.4.0)', () => {
  it('decodes the blueprint scenario file as the schema expects', () => {
    const text = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
    const doc = decode(text) as Record<string, unknown>;
    expect(doc['format']).toBe(1);
    expect((doc['source'] as Record<string, unknown>)['issue']).toBe('018');
    const initial = doc['initial'] as { controls: Record<string, unknown> };
    expect(Object.keys(initial.controls)).toContain('lv.power');
    expect(initial.controls['lv.power']).toBe('p75');
    const procedure = doc['procedure'] as { branches: unknown[] }[];
    expect(procedure[0]?.branches).toHaveLength(2);
    const forbidden = doc['forbidden'] as { trigger: { delta: unknown } }[];
    expect(forbidden[0]?.trigger.delta).toBe(0);
  });

  it('keeps a quoted numeric-looking string a string', () => {
    expect(decode('issue: "018"')).toEqual({ issue: '018' });
  });

  it('keeps no and off strings (no YAML booleans)', () => {
    expect(decode('a: no')).toEqual({ a: 'no' });
    expect(decode('a: off')).toEqual({ a: 'off' });
  });

  it('keeps a dotted key whole (no path expansion)', () => {
    expect(decode('controls:\n  lv.power: p75')).toEqual({ controls: { 'lv.power': 'p75' } });
  });

  it('decodes numbers', () => {
    expect(decode('x: -10')).toEqual({ x: -10 });
    expect(decode('x: 128')).toEqual({ x: 128 });
  });

  it('decodes a boolean', () => {
    expect(decode('x: true')).toEqual({ x: true });
  });

  it('decodes an inline array with its length', () => {
    expect(decode('in[2]: a,b')).toEqual({ in: ['a', 'b'] });
  });

  it('ignores a full-line comment', () => {
    expect(decode('# comment\na: 1')).toEqual({ a: 1 });
  });

  it('has no trailing comments: the text after # belongs to the value', () => {
    expect(decode('a: b # c')).toEqual({ a: 'b # c' });
  });

  it('decodes an empty list header nodes[0]: as an empty array (recorded on 4.4.0)', () => {
    // Recorded on the first run: no error, an empty array. Authors may write `nodes[0]:`
    // or omit `nodes`; the schema default is the empty list.
    expect(decode('nodes[0]:')).toEqual({ nodes: [] });
  });

  it('reads every non-broken scenario file in the repository without a decoder error', () => {
    const folders = [join(root, 'scenarios'), join(root, 'tests/fixtures/scenarios')];
    let seen = 0;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.toon')) {
          expect(() => decode(readFileSync(path, 'utf8')), path).not.toThrow();
          seen += 1;
        }
      }
    };
    for (const folder of folders) walk(folder);
    expect(seen).toBeGreaterThan(0);
  });
});
