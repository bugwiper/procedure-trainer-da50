import { decode } from '@toon-format/toon';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { indexToon, locate } from '../src/scenario/toon-index';
import type { PathSegment } from '../src/scenario/toon-index';

// The path-to-line index (SCN-01, RESEARCH Code Example 1): differential against the decoder over
// every shipped and fixture file, plus small syntax edge cases.
const root = fileURLToPath(new URL('../', import.meta.url));

function toonFiles(folder: string): string[] {
  return readdirSync(join(root, folder), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${folder}/${entry.name}`;
    if (entry.isDirectory()) return toonFiles(rel);
    return entry.name.endsWith('.toon') ? [rel] : [];
  });
}

/** Every path of a decoded value below the root. */
function pathsOf(value: unknown, prefix: PathSegment[] = []): PathSegment[][] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => [[...prefix, i], ...pathsOf(item, [...prefix, i])]);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => [
      [...prefix, key],
      ...pathsOf(item, [...prefix, key]),
    ]);
  }
  return [];
}

describe('indexToon, differential over the repo files', () => {
  const files = [...toonFiles('scenarios'), ...toonFiles('tests/fixtures/scenarios')];

  it('finds the files', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(files)('has an exact entry for every decoded path of %s', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const index = indexToon(text);
    const missing = pathsOf(decode(text)).filter((path) => {
      const hit = index.get(path.join('\u0000'));
      return hit === undefined;
    });
    expect(missing).toEqual([]);
  });
});

describe('indexToon positions', () => {
  const text = [
    '# a comment',
    '',
    'format: 1',
    'source:',
    '  document: "x"',
    '"quoted key": 1',
    'initial:',
    '  controls:',
    '    lv.power: p75',
    'tags[3]: a,b,c',
    'items[2]:',
    '  - id: first',
    '    name: one',
    '  - id: second',
    '    name: two',
    'rows[2]{a,b}:',
    '  1,2',
    '  3,4',
  ].join('\n');
  const index = indexToon(text);
  const at = (...path: PathSegment[]) => locate(index, path);

  it('points a key at its line and column', () => {
    expect(at('format')).toEqual({ line: 3, col: 1 });
    expect(at('source', 'document')).toEqual({ line: 5, col: 3 });
  });

  it('keeps dotted and quoted keys as one segment', () => {
    expect(at('initial', 'controls', 'lv.power')).toEqual({ line: 9, col: 5 });
    expect(at('quoted key')).toEqual({ line: 6, col: 1 });
  });

  it('points a list item and its inline first field after the hyphen', () => {
    expect(at('items', 0)).toEqual({ line: 12, col: 3 });
    expect(at('items', 0, 'id')).toEqual({ line: 12, col: 5 });
    expect(at('items', 0, 'name')).toEqual({ line: 13, col: 5 });
    expect(at('items', 1, 'name')).toEqual({ line: 15, col: 5 });
  });

  it('points the elements of an inline array at the header line', () => {
    expect(at('tags', 0)).toEqual({ line: 10, col: 1 });
    expect(at('tags', 2)).toEqual({ line: 10, col: 1 });
  });

  it('points tabular rows and their cells at the row line', () => {
    expect(at('rows', 1)).toEqual({ line: 18, col: 3 });
    expect(at('rows', 1, 'b')).toEqual({ line: 18, col: 3 });
  });

  it('falls back to the nearest ancestor, then to line 1 column 1', () => {
    expect(at('items', 1, 'unknown', 'deeper')).toEqual({ line: 14, col: 3 });
    expect(at('nothing', 'here')).toEqual({ line: 1, col: 1 });
    expect(locate(index, [])).toEqual({ line: 1, col: 1 });
  });

  it('ignores a byte order mark and carriage returns', () => {
    const crlf = indexToon('﻿a: 1\r\nb:\r\n  c: 2\r\n');
    expect(crlf.get('b\u0000c')).toEqual({ line: 3, col: 3 });
    expect(crlf.get('a')).toEqual({ line: 1, col: 1 });
  });

  it('never throws on text it does not understand', () => {
    expect(() => indexToon('\t- : [\n   odd\n- -\n:::')).not.toThrow();
    expect(() => indexToon('')).not.toThrow();
  });
});
