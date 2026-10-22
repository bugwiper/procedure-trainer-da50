// The pack seam (D-20, PLT-03): the app lists and opens scenarios only through a PackProvider
// guarded by an AccessPolicy. listPacks reads the pack manifests and never calls a scenario
// loader; openScenario asks the policy first, then finds the manifest entry, loads the pack,
// parses and lints the file. Every failure comes back as a reason, nothing an author or a loader
// does makes openScenario throw. Later paid-pack gating plugs in as a different policy and
// provider; the callers do not change.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { AircraftEnv } from '../engine/env';
import { lintScenario } from './lint';
import { parseManifest, parseScenario } from './parse';
import type { ScenarioIssue } from './parse';
import type { Scenario } from './schema';

export interface PackScenarioEntry {
  readonly id: string;
  readonly title: string;
  /** Base name of the scenario file without `.toon`. */
  readonly file: string;
}

export interface PackMeta {
  readonly id: string;
  readonly title: string;
  readonly free: boolean;
  readonly scenarios: readonly PackScenarioEntry[];
}

export interface PackSource {
  readonly id: string;
  readonly files: readonly { readonly name: string; readonly text: string }[];
}

export interface PackProvider {
  /** Reads the manifests only; never loads scenario text. */
  listPacks(): Promise<readonly PackMeta[]>;
  loadPack(id: string): Promise<PackSource>;
}

export interface AccessPolicy {
  canAccess(packId: string): boolean | Promise<boolean>;
}

/** Every pack is open in v1. */
export const OPEN_ACCESS: AccessPolicy = Object.freeze({ canAccess: () => true });

export interface PackModules {
  /** Manifest texts keyed `/scenarios/<pack>/pack.toon`. */
  readonly manifests: Readonly<Record<string, string>>;
  /** Lazy scenario text loaders keyed `/scenarios/<pack>/<name>.toon`. */
  readonly loaders: Readonly<Record<string, () => Promise<string>>>;
}

const MANIFEST_KEY = /^\/scenarios\/([^/]+)\/pack\.toon$/;
const FILE_KEY = /^\/scenarios\/([^/]+)\/([^/]+)\.toon$/;

function readManifests(manifests: PackModules['manifests']): PackMeta[] {
  const packs: PackMeta[] = [];
  for (const [key, text] of Object.entries(manifests).sort(([a], [b]) => a.localeCompare(b))) {
    const id = MANIFEST_KEY.exec(key)?.[1];
    if (id === undefined) continue;
    const parsed = parseManifest(text);
    if (!parsed.ok) {
      const detail = parsed.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
      throw new Error(`invalid pack manifest ${key}: ${detail}`);
    }
    const { title, free, scenarios } = parsed.value;
    packs.push({
      id,
      title,
      free,
      scenarios: scenarios.map((s) => ({ id: s.id, title: s.title, file: s.file })),
    });
  }
  return packs;
}

export function createPackProvider(modules: PackModules): PackProvider {
  return {
    listPacks: () =>
      new Promise<readonly PackMeta[]>((resolve) => {
        resolve(readManifests(modules.manifests));
      }),
    loadPack: async (id) => {
      if (!Object.hasOwn(modules.manifests, `/scenarios/${id}/pack.toon`)) {
        throw new Error(`unknown pack "${id}"`);
      }
      const wanted = Object.entries(modules.loaders)
        .flatMap(([key, load]) => {
          const match = FILE_KEY.exec(key);
          return match?.[1] === id && match[2] !== 'pack' ? [{ key, name: match[2], load }] : [];
        })
        .sort((a, b) => a.key.localeCompare(b.key));
      const files = await Promise.all(
        wanted.map(async ({ name, load }) => ({ name: name ?? '', text: await load() })),
      );
      return { id, files };
    },
  };
}

export interface ScenarioRef {
  readonly pack: string;
  /** The manifest entry id. */
  readonly scenario: string;
}

export type OpenFailure = 'denied' | 'missing' | 'load-failed' | 'invalid';

export type OpenResult =
  | { readonly ok: true; readonly scenario: Scenario }
  | {
      readonly ok: false;
      readonly reason: OpenFailure;
      readonly issues: readonly ScenarioIssue[];
    };

function failure(reason: OpenFailure, issues: readonly ScenarioIssue[]): OpenResult {
  return { ok: false, reason, issues };
}

const note = (path: string, message: string): ScenarioIssue[] => [{ path, message }];

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

/**
 * Order: policy, manifest entry, loadPack, file by entry.file, parse, lint, id equals entry id.
 * A policy that throws or rejects denies (fail closed).
 */
export async function openScenario(
  source: { readonly provider: PackProvider; readonly policy: AccessPolicy },
  env: AircraftEnv,
  ref: ScenarioRef,
): Promise<OpenResult> {
  let allowed: boolean;
  try {
    allowed = await source.policy.canAccess(ref.pack);
  } catch {
    allowed = false;
  }
  if (!allowed) return failure('denied', note('(pack)', `pack "${ref.pack}" is not open`));

  let packs: readonly PackMeta[];
  try {
    packs = await source.provider.listPacks();
  } catch (error) {
    return failure('load-failed', note('(manifest)', errorText(error)));
  }
  const entry = packs.find((p) => p.id === ref.pack)?.scenarios.find((s) => s.id === ref.scenario);
  if (entry === undefined) {
    return failure(
      'missing',
      note('(pack)', `no scenario "${ref.scenario}" in pack "${ref.pack}"`),
    );
  }

  let pack: PackSource;
  try {
    pack = await source.provider.loadPack(ref.pack);
  } catch (error) {
    return failure('load-failed', note('(pack)', errorText(error)));
  }
  const file = pack.files.find((f) => f.name === entry.file);
  if (file === undefined) {
    return failure('missing', note('(pack)', `pack "${ref.pack}" has no file "${entry.file}"`));
  }

  const parsed = parseScenario(file.text);
  if (!parsed.ok) return failure('invalid', parsed.issues);
  const issues = lintScenario(parsed.value, env);
  if (issues.length > 0) return failure('invalid', issues);
  if (parsed.value.id !== entry.id) {
    return failure(
      'invalid',
      note('id', `file id "${parsed.value.id}" differs from manifest id "${entry.id}"`),
    );
  }
  return { ok: true, scenario: parsed.value };
}
