import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '@toon-format/toon';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { checkScenario } from '../src/scenario/lint';

// CNT-02, D-15 (phase 07, plan 03): the README section "Writing a scenario" is a guide a developer
// follows alone, so what it shows must stay true. Its one complete scenario (the fenced block
// marked `toon example`) goes through the same check as `npm run validate`; every piece (`toon
// fragment`) decodes as TOON; the ids it names are the ids of the aircraft data and the npm scripts
// it names are the scripts of package.json. Ids and counts come from the aircraft data, never from
// literals here.

const root = fileURLToPath(new URL('../', import.meta.url));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const HEADING = '## Writing a scenario';

interface Block {
  readonly info: string;
  readonly text: string;
}

/** The section text between its heading and the next level-two heading outside a fence. */
function sectionOf(text: string): string {
  const lines = text.split('\n');
  const from = lines.findIndex((line) => line === HEADING);
  if (from < 0) throw new Error(`the README has no section "${HEADING}"`);
  const taken: string[] = [];
  let fenced = false;
  for (const line of lines.slice(from + 1)) {
    if (line.startsWith('```')) fenced = !fenced;
    if (!fenced && line.startsWith('## ')) break;
    taken.push(line);
  }
  return taken.join('\n');
}

/** The fenced blocks of a text with their info strings. */
function blocksOf(text: string): Block[] {
  const found: Block[] = [];
  const lines = text.split('\n');
  let open: { info: string; body: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (open === null) open = { info: line.slice(3).trim(), body: [] };
      else {
        found.push({ info: open.info, text: `${open.body.join('\n')}\n` });
        open = null;
      }
    } else if (open !== null) open.body.push(line);
  }
  return found;
}

const section = sectionOf(readme);
const blocks = blocksOf(section);
const examples = blocks.filter((b) => b.info === 'toon example');
const fragments = blocks.filter((b) => b.info === 'toon fragment');

/** The ids in backticks on the line that starts with the given bullet label. */
function listedIds(label: string): string[] {
  const line = section.split('\n').find((l) => l.startsWith(`- **${label}:**`));
  if (line === undefined) throw new Error(`the section has no line "- **${label}:**"`);
  return [...line.matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1] ?? '');
}

/** Every value found under a key anywhere in a decoded document. */
function valuesUnder(doc: unknown, key: string): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [name, value] of Object.entries(node)) {
      if (name === key) out.push(value);
      walk(value);
    }
  };
  walk(doc);
  return out;
}

describe('the README section "Writing a scenario" (D-15)', () => {
  it('exists once', () => {
    const headings = readme.split('\n').filter((line) => line === HEADING);
    expect(headings).toHaveLength(1);
    // The old short section is folded into it.
    expect(readme.split('\n').filter((line) => line === '## Scenario files')).toHaveLength(0);
    expect(section).toContain('docs/CONTENT-POLICY.md');
  });

  it('holds exactly one complete example and at least one fragment', () => {
    expect(examples).toHaveLength(1);
    expect(fragments.length).toBeGreaterThan(0);
  });

  it('the example passes the same check as npm run validate against the DA50 RG', () => {
    const [example] = examples;
    if (example === undefined) throw new Error('no example block');
    const checked = checkScenario(example.text, DA50RG_ENV);
    if (!checked.ok) {
      const lines = checked.issues.map((i) => `${i.line}:${i.col}: ${i.path}: ${i.message}`);
      throw new Error(`the guide's example does not pass:\n${lines.join('\n')}`);
    }
    // It shows every part a beginner needs.
    const { scenario } = checked;
    expect(scenario.checklist?.form).toBe('table');
    expect(scenario.forbidden.length).toBeGreaterThan(0);
    expect(scenario.outcomes.length).toBeGreaterThan(0);
    expect(scenario.onset?.cues?.length ?? 0).toBeGreaterThan(0);
    expect(scenario.profile).toBeDefined();
    expect(scenario.further).toBeDefined();
    expect(scenario.annunciations.length).toBeGreaterThan(0);
  });

  it('every fragment decodes as TOON', () => {
    for (const fragment of fragments) {
      expect(() => decode(fragment.text), fragment.text).not.toThrow();
    }
  });

  it('the scenes, cues and further options it lists are those of the aircraft, all of them', () => {
    expect([...listedIds('Scenes')].sort()).toEqual([...DA50RG_ENV.scenes.ids].sort());
    expect([...listedIds('Cues')].sort()).toEqual([...DA50RG_ENV.cues.ids].sort());
    const options = [...DA50RG_ENV.further.ids('action'), ...DA50RG_ENV.further.ids('conduct')];
    expect([...listedIds('Further options')].sort()).toEqual([...options].sort());
  });

  it('the scene, cue and further ids its examples use exist in the aircraft data', () => {
    const docs = [...fragments, ...examples].map((b) => decode(b.text));
    let named = 0;
    for (const doc of docs) {
      for (const scene of valuesUnder(doc, 'scene')) {
        named += 1;
        expect(DA50RG_ENV.scenes.has(String(scene)), `scene ${String(scene)}`).toBe(true);
      }
      for (const cues of valuesUnder(doc, 'cues')) {
        for (const id of cues as string[]) {
          named += 1;
          expect(DA50RG_ENV.cues.get(id), `cue ${id}`).toBeDefined();
        }
      }
      for (const further of valuesUnder(doc, 'further')) {
        const section = further as {
          actions?: { id: string }[];
          conduct?: { accept?: string[] } | string;
        };
        for (const action of section.actions ?? []) {
          named += 1;
          expect(DA50RG_ENV.further.has(action.id), `option ${action.id}`).toBe(true);
        }
        const accept = typeof section.conduct === 'object' ? (section.conduct.accept ?? []) : [];
        for (const id of accept) {
          named += 1;
          expect(DA50RG_ENV.further.option(id)?.kind, `conduct ${id}`).toBe('conduct');
        }
      }
    }
    expect(named).toBeGreaterThan(0);
  });

  it('every npm script it names is a script of package.json', () => {
    const named = [...section.matchAll(/npm run ([a-z0-9:_-]+)/g)].map((m) => m[1] ?? '');
    expect(named.length).toBeGreaterThan(0);
    for (const script of named) {
      expect(Object.keys(packageJson.scripts), `npm run ${script}`).toContain(script);
    }
  });

  it('covers where the files go, validation, playing, and the optional parts', () => {
    const needles = [
      'pack.toon',
      'npm run validate',
      'file:line:col',
      'npm run dev',
      'CHOOSE SITUATION',
      'Variants',
      'cues',
      'flight profile',
      'further',
      'training hints',
      'Retry',
    ];
    for (const needle of needles) {
      expect(section.toLowerCase(), needle).toContain(needle.toLowerCase());
    }
  });
});
