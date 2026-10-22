// Reference check of a validated scenario against the aircraft (D-22): every control, state,
// quantity and band the file names must resolve in the registry and the quantity data. One issue
// per reference that does not resolve, with the dot path of the offending field. Controls and
// quantities are looked up through Map-backed getters and the scenario-keyed records are only
// iterated over their own keys, so a key such as "constructor" or "__proto__" never resolves
// (T-02-02). Plan 05 adds the remaining rules and line numbers.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { AircraftEnv } from '../engine/env';
import { legalStates } from '../engine/registry';
import type { ScenarioIssue } from './parse';
import type { ProcedureNode, Predicate, Scenario } from './schema';

export function lintScenario(scenario: Scenario, env: AircraftEnv): ScenarioIssue[] {
  const issues: ScenarioIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  const checkControl = (path: string, id: string) => {
    const def = env.registry.get(id);
    if (def === undefined) add(path, `unknown control "${id}"`);
    return def;
  };

  const checkPredicate = (path: string, predicate: Predicate): void => {
    switch (predicate.check) {
      case 'state': {
        const def = checkControl(`${path}.control`, predicate.control);
        if (def !== undefined && !legalStates(def).includes(predicate.is)) {
          add(`${path}.is`, `"${predicate.is}" is not a state of control "${def.id}"`);
        }
        return;
      }
      case 'state_in': {
        const def = checkControl(`${path}.control`, predicate.control);
        if (def === undefined) return;
        const legal = legalStates(def);
        predicate.in.forEach((state, i) => {
          if (!legal.includes(state)) {
            add(`${path}.in.${String(i)}`, `"${state}" is not a state of control "${def.id}"`);
          }
        });
        return;
      }
      case 'travel':
      case 'travel_rel': {
        const def = checkControl(`${path}.control`, predicate.control);
        if (def !== undefined && def.kind !== 'detent-lever') {
          add(
            `${path}.control`,
            `a ${predicate.check} check needs a detent lever, "${def.id}" is a ${def.kind}`,
          );
        }
        return;
      }
      case 'quantity': {
        if (env.quantities.get(predicate.quantity) === undefined) {
          add(`${path}.quantity`, `unknown quantity "${predicate.quantity}"`);
        }
        return;
      }
      case 'band': {
        const def = env.quantities.get(predicate.quantity);
        if (def === undefined) {
          add(`${path}.quantity`, `unknown quantity "${predicate.quantity}"`);
          return;
        }
        predicate.in.forEach((band, i) => {
          if (!def.bands.some((b) => b.id === band)) {
            add(`${path}.in.${String(i)}`, `"${band}" is not a band of quantity "${def.id}"`);
          }
        });
        return;
      }
    }
  };

  const checkNodes = (path: string, nodes: readonly ProcedureNode[]): void => {
    nodes.forEach((node, i) => {
      const here = `${path}.${String(i)}`;
      switch (node.kind) {
        case 'line':
          return;
        case 'group':
          node.steps.forEach((step, j) => {
            checkPredicate(`${here}.steps.${String(j)}.done`, step.done);
          });
          return;
        case 'branch':
          checkPredicate(`${here}.when`, node.when);
          checkNodes(`${here}.nodes`, node.nodes);
          return;
        case 'decision':
          node.branches.forEach((branch, j) => {
            const branchPath = `${here}.branches.${String(j)}`;
            checkPredicate(`${branchPath}.when`, branch.when);
            checkNodes(`${branchPath}.nodes`, branch.nodes);
          });
          return;
      }
    });
  };

  for (const [id, state] of Object.entries(scenario.initial.controls)) {
    const def = env.registry.get(id);
    const path = `initial.controls.${id}`;
    if (def === undefined) add(path, `unknown control "${id}"`);
    else if (!legalStates(def).includes(state)) {
      add(path, `"${state}" is not a state of control "${id}"`);
    }
  }

  for (const [id, value] of Object.entries(scenario.initial.quantities)) {
    const def = env.quantities.get(id);
    const path = `initial.quantities.${id}`;
    if (def === undefined) add(path, `unknown quantity "${id}"`);
    else if (value < def.min || value > def.max) {
      add(
        path,
        `${String(value)} is outside ${String(def.min)}..${String(def.max)} of quantity "${id}"`,
      );
    }
  }

  checkNodes('procedure', scenario.procedure);
  scenario.forbidden.forEach((item, i) => {
    checkPredicate(`forbidden.${String(i)}.trigger`, item.trigger);
    if (item.when !== undefined) checkPredicate(`forbidden.${String(i)}.when`, item.when);
  });

  return issues;
}
