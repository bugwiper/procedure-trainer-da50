// The validate command's core (D-21, SCN-01, SCN-02): every pack folder, its manifest and its
// scenario files, checked with the same checkScenario the app uses, plus the manifest rules of
// Table L9 (missing or invalid manifest, entry without file, file without entry, id and title
// mismatches, repeated entry ids). Every problem comes back as file, line, column and message,
// sorted for stable output. Author errors are never thrown. No file system here: the CLI reads
// the files and hands the texts in.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { DA50RG_ENV } from '../aircraft/da50rg/aircraft';
import type { AircraftEnv } from '../engine/env';
import { checkScenario } from './lint';
import { parseManifest } from './parse';
import type { ScenarioIssue } from './parse';
import type { Manifest } from './schema';
import { indexToon, locate } from './toon-index';
import type { PathSegment, ToonIndex } from './toon-index';

export interface PackInput {
  /** Repo-relative pack folder, e.g. `scenarios/engine`. */
  readonly dir: string;
  /** Folder name. */
  readonly id: string;
  /** Text of `pack.toon`, or null when the folder has none. */
  readonly manifestText: string | null;
  /** Scenario files of the folder: base name without `.toon`, and the text. */
  readonly files: readonly { readonly name: string; readonly text: string }[];
}

export interface ValidationIssue {
  /** Repo-relative file path. */
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
}

/** `<file>:<line>:<col>: <message>` */
export const formatIssue = (issue: ValidationIssue): string =>
  `${issue.file}:${String(issue.line)}:${String(issue.col)}: ${issue.message}`;

const display = (issue: ScenarioIssue): string =>
  issue.path === '(root)' ? issue.message : `${issue.path}: ${issue.message}`;

function validatePack(pack: PackInput, env: AircraftEnv): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const manifestFile = `${pack.dir}/pack.toon`;
  const fileOf = (name: string): string => `${pack.dir}/${name}.toon`;
  const push = (file: string, line: number, col: number, message: string): void => {
    out.push({ file, line, col, message });
  };

  let manifest: Manifest | undefined;
  let manifestIndex: ToonIndex | undefined;
  if (pack.manifestText === null) {
    push(manifestFile, 1, 1, `pack "${pack.id}" has no manifest pack.toon`);
  } else {
    const parsed = parseManifest(pack.manifestText);
    if (parsed.ok) {
      manifest = parsed.value;
      manifestIndex = indexToon(pack.manifestText);
    } else {
      for (const issue of parsed.issues) push(manifestFile, issue.line, issue.col, display(issue));
    }
  }
  const inManifest = (segments: readonly PathSegment[]) =>
    manifestIndex === undefined ? { line: 1, col: 1 } : locate(manifestIndex, segments);

  // Each scenario file: schema, registry and lint; keep the ones that pass.
  const checked = new Map<string, { id: string; title: string; idAt: ReturnType<typeof locate> }>();
  for (const file of pack.files) {
    const result = checkScenario(file.text, env);
    if (!result.ok) {
      for (const issue of result.issues)
        push(fileOf(file.name), issue.line, issue.col, display(issue));
      continue;
    }
    checked.set(file.name, {
      id: result.scenario.id,
      title: result.scenario.title,
      idAt: locate(indexToon(file.text), ['id']),
    });
  }

  if (manifest === undefined) return out;

  // L9: the manifest and the folder describe the same scenarios.
  const listed = new Set<string>();
  const ids = new Set<string>();
  manifest.scenarios.forEach((entry, i) => {
    const at = (field: string) => inManifest(['scenarios', i, field]);
    if (ids.has(entry.id)) {
      push(manifestFile, at('id').line, at('id').col, `scenario id "${entry.id}" is listed twice`);
    }
    ids.add(entry.id);
    listed.add(entry.file);
    const exists = pack.files.some((f) => f.name === entry.file);
    if (!exists) {
      push(
        manifestFile,
        at('file').line,
        at('file').col,
        `file "${entry.file}.toon" does not exist in ${pack.dir}`,
      );
      return;
    }
    const scenario = checked.get(entry.file);
    if (scenario === undefined) return; // its own problems are reported above
    if (scenario.id !== entry.id) {
      push(
        fileOf(entry.file),
        scenario.idAt.line,
        scenario.idAt.col,
        `id "${scenario.id}" differs from manifest id "${entry.id}"`,
      );
    }
    if (scenario.title !== entry.title) {
      push(
        manifestFile,
        at('title').line,
        at('title').col,
        `title "${entry.title}" differs from the title "${scenario.title}" of ${entry.file}.toon`,
      );
    }
  });
  for (const file of pack.files) {
    if (!listed.has(file.name)) {
      push(fileOf(file.name), 1, 1, `scenario file is not listed in ${manifestFile}`);
    }
  }
  return out;
}

export function validateAll(
  packs: readonly PackInput[],
  env: AircraftEnv = DA50RG_ENV,
): ValidationIssue[] {
  return packs
    .flatMap((pack) => validatePack(pack, env))
    .sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.col - b.col ||
        a.message.localeCompare(b.message),
    );
}
