// Scenario variants (phase 3.1, SCN-09, V-01 to V-05): several causes behind one failure message.
// A scenario file declares `variants`; a run draws one by seed (variantFromSeed) and the engine
// resolves it into a plain derived scenario (resolveVariant): the variant's faulted controls and
// parameters laid over, and only the steps and forbidden items that apply in it kept. Every node of
// the procedure stays (a group may end up empty), so branch paths and the printed outline are those
// of the file. Sim, grade and lint then run on the resolved scenario unchanged. Only + - * / are
// used, so the draw agrees bit for bit in node and every browser.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { ProcedureNode, Scenario } from '../scenario/schema';
import { mulberry32 } from './sim';

/** The id of the variant a seed draws: the first mulberry32 value times the weight total, cumulative. */
export function variantFromSeed(seed: number, variants: Scenario['variants']): string {
  const last = variants.at(-1);
  if (last === undefined) throw new RangeError('the scenario declares no variants');
  let total = 0;
  for (const variant of variants) total += variant.weight;
  const x = mulberry32(seed)() * total;
  let upTo = 0;
  for (const variant of variants) {
    upTo += variant.weight;
    if (x < upTo) return variant.id;
  }
  return last.id;
}

/** True when a run of this (resolved) scenario has the simulation set a control at the onset. */
export function canInject(scenario: Scenario): boolean {
  return scenario.onset !== undefined && Object.keys(scenario.onset.controls).length > 0;
}

/**
 * The scenario a drawn variant makes (V-03). `id` null means the first variant (V-04: a recording
 * that names none). A scenario without variants resolves to itself; an unknown id, or an id on a
 * scenario without variants, throws Error naming it. With `realistic` (and an onset) the variant's
 * controls go into `onset.controls`, so the Realistic start stays clean and the simulation sets
 * them at the onset; otherwise they go into `initial.controls`, in force from t 0. The variant's
 * parameters go into `parameters` and, when an onset exists, into `onset.parameters`, so they win
 * the last layer. The result declares no variants.
 */
export function resolveVariant(
  scenario: Scenario,
  id: string | null,
  realistic: boolean,
): Scenario {
  if (scenario.variants.length === 0) {
    if (id !== null) throw new Error(`scenario "${scenario.id}" declares no variant "${id}"`);
    return scenario;
  }
  const variant =
    id === null ? scenario.variants[0] : scenario.variants.find((item) => item.id === id);
  if (variant === undefined) {
    throw new Error(`scenario "${scenario.id}" declares no variant "${id ?? ''}"`);
  }

  const named = new Set(scenario.variants.flatMap((item) => item.applies));
  const applies = new Set(variant.applies);
  const keeps = (nodeId: string): boolean => !named.has(nodeId) || applies.has(nodeId);

  const prune = (nodes: readonly ProcedureNode[]): ProcedureNode[] =>
    nodes.map((node): ProcedureNode => {
      switch (node.kind) {
        case 'line':
        case 'comment':
          return node;
        case 'group':
          return { ...node, steps: node.steps.filter((step) => keeps(step.id)) };
        case 'branch':
          return { ...node, nodes: prune(node.nodes) };
        case 'decision':
          return {
            ...node,
            branches: node.branches.map((branch) => ({ ...branch, nodes: prune(branch.nodes) })),
          };
      }
    });

  const onset = scenario.onset;
  const atOnset = realistic && onset !== undefined;
  return {
    ...scenario,
    initial: atOnset
      ? scenario.initial
      : { ...scenario.initial, controls: { ...scenario.initial.controls, ...variant.controls } },
    parameters: { ...scenario.parameters, ...variant.parameters },
    ...(onset === undefined
      ? {}
      : {
          onset: {
            ...onset,
            controls: atOnset ? { ...onset.controls, ...variant.controls } : onset.controls,
            parameters: { ...onset.parameters, ...variant.parameters },
          },
        }),
    procedure: prune(scenario.procedure),
    forbidden: scenario.forbidden.filter((item) => keeps(item.id)),
    variants: [],
  };
}
