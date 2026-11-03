import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { createPackProvider, OPEN_ACCESS } from '../src/scenario/packs';
import { parseScenario } from '../src/scenario/parse';
import type { ProcedureNode, Scenario, Step } from '../src/scenario/schema';
import { createPanelBridge } from '../src/ui/bridge';
import { createSession } from '../src/ui/session';

// Doors and the emergency window are panel steps in every shipped checklist (Phase 9, plan 09-05,
// R-12, P-06). The finding was established from the shipped files: every row that names a door or
// the emergency window is a graded step on the door release lever (state open) or the emergency
// window (state open), and ENGINE FIRE IN FLIGHT rows 7 and 8, which were plain lines the grade never
// saw, are optional steps now. The table below is typed by hand from the files (it is the independent
// reference), a scan keeps a line node from naming a door or a window, and every row is credited by a
// recording that opens its control and not credited without one. Severity optional in flight is owner
// decision S-07 (the simulation has no standstill, so the row is credited whenever the control opens).

const root = fileURLToPath(new URL('../', import.meta.url));

interface DoorRow {
  readonly file: string;
  readonly number: number;
  readonly id: string;
  readonly control: 'lv.door_release' | 'sw.emerg_window';
  readonly severity: 'critical' | 'standard' | 'optional';
}

/** The eleven rows of the shipped files that name a door or the emergency window, typed by hand. */
const ROWS: readonly DoorRow[] = [
  {
    file: 'engine/eng-fire-in-flight',
    number: 7,
    id: 'windows_open',
    control: 'sw.emerg_window',
    severity: 'optional',
  },
  {
    file: 'engine/eng-fire-in-flight',
    number: 8,
    id: 'doors_open',
    control: 'lv.door_release',
    severity: 'optional',
  },
  {
    file: 'fire/elec-fire-flight',
    number: 7,
    id: 'windows_open',
    control: 'sw.emerg_window',
    severity: 'optional',
  },
  {
    file: 'fire/elec-fire-flight',
    number: 8,
    id: 'doors_open',
    control: 'lv.door_release',
    severity: 'optional',
  },
  {
    file: 'fire/elec-fire-ground',
    number: 5,
    id: 'door_open',
    control: 'lv.door_release',
    severity: 'critical',
  },
  {
    file: 'fire/eng-fire-ground',
    number: 4,
    id: 'door_open',
    control: 'lv.door_release',
    severity: 'critical',
  },
  {
    file: 'fire/takeoff-fire-abort',
    number: 7,
    id: 'door_open',
    control: 'lv.door_release',
    severity: 'critical',
  },
  {
    file: 'fire/takeoff-fire-no-abort',
    number: 5,
    id: 'windows_open',
    control: 'sw.emerg_window',
    severity: 'optional',
  },
  {
    file: 'fire/takeoff-fire-no-abort',
    number: 6,
    id: 'doors_open',
    control: 'lv.door_release',
    severity: 'optional',
  },
  {
    file: 'icing/icing-unintentional',
    number: 10,
    id: 'windows_open',
    control: 'sw.emerg_window',
    severity: 'optional',
  },
  {
    file: 'landing/landing-engine-off',
    number: 12,
    id: 'doors_unlatch',
    control: 'lv.door_release',
    severity: 'standard',
  },
];

const load = (file: string): Scenario => {
  const parsed = parseScenario(readFileSync(`${root}scenarios/${file}.toon`, 'utf8'));
  if (!parsed.ok) throw new Error(`${file} does not parse`);
  return parsed.value;
};

const stepsOf = (nodes: readonly ProcedureNode[]): Step[] =>
  nodes.flatMap((node): Step[] => {
    switch (node.kind) {
      case 'group':
        return [...node.steps];
      case 'branch':
        return stepsOf(node.nodes);
      case 'decision':
        return node.branches.flatMap((branch) => stepsOf(branch.nodes));
      default:
        return [];
    }
  });

const linesOf = (nodes: readonly ProcedureNode[]): string[] =>
  nodes.flatMap((node): string[] => {
    switch (node.kind) {
      case 'line':
        return [`${node.text} ${node.action ?? ''}`];
      case 'branch':
        return linesOf(node.nodes);
      case 'decision':
        return node.branches.flatMap((branch) => linesOf(branch.nodes));
      default:
        return [];
    }
  });

/** Every shipped scenario file, found from the pack folders (no name is listed here). */
const SHIPPED = readdirSync(`${root}scenarios`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((pack) =>
    readdirSync(`${root}scenarios/${pack.name}`)
      .filter((name) => name.endsWith('.toon') && name !== 'pack.toon')
      .map((name) => `${pack.name}/${name.replace(/\.toon$/, '')}`),
  );

describe('every shipped row that names a door or the emergency window is a panel step', () => {
  it('the table has the rows of the files, no row more and none fewer', () => {
    // Derived from the files: the steps whose predicate names the lever or the window.
    const found = SHIPPED.flatMap((file) =>
      stepsOf(load(file).procedure)
        .filter(
          (step) =>
            'control' in step.done &&
            (step.done.control === 'lv.door_release' || step.done.control === 'sw.emerg_window'),
        )
        .map((step) => `${file}#${step.id}`),
    );
    expect(found.sort()).toEqual(ROWS.map((row) => `${row.file}#${row.id}`).sort());
  });

  for (const row of ROWS) {
    it(`${row.file} row ${String(row.number)} is the step ${row.id} on ${row.control}, ${row.severity}`, () => {
      const step = stepsOf(load(row.file).procedure).find((item) => item.id === row.id);
      expect(step).toBeDefined();
      expect(step?.number).toBe(row.number);
      expect(step?.severity).toBe(row.severity);
      expect(step?.done).toMatchObject({ check: 'state', control: row.control, is: 'open' });
      expect(DA50RG.get(row.control)).toBeDefined();
    });

    it(`${row.file} ${row.id} is credited by a recording that opens ${row.control} and not without it`, () => {
      const scenario = load(row.file);
      const recording = (events: Recording['events']): Recording => ({
        scenarioId: scenario.id,
        completedAt: 10_000,
        events,
      });
      const verdict = (events: Recording['events']) =>
        grade(scenario, DA50RG_ENV, recording(events)).steps.find((s) => s.id === row.id);
      expect(verdict([])?.credited).toBe(false);
      const opened = verdict([{ t: 1000, id: row.control, value: 'open' }]);
      expect(opened?.credited).toBe(true);
      expect(opened?.enteredAt).toBe(0);
    });
  }

  it('no line node of any shipped file names a door or a window: such a row would be invisible to the grade', () => {
    for (const file of SHIPPED) {
      for (const text of linesOf(load(file).procedure)) {
        expect(text, file).not.toMatch(/\b(doors?|windows?)\b/i);
      }
    }
  });
});

describe('the live sheet credits the window and the door of ENGINE FIRE IN FLIGHT when they open', () => {
  it('marks windows_open and doors_open as the events happen', async () => {
    const manifest = `format: 1
title: Engine
free: true
scenarios[1]:
  - id: eng-fire-in-flight
    title: ENGINE FIRE
    file: eng-fire-in-flight
`;
    const text = readFileSync(`${root}scenarios/engine/eng-fire-in-flight.toon`, 'utf8');
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    const session = createSession({
      bridge,
      packs: {
        provider: createPackProvider({
          manifests: { '/scenarios/engine/pack.toon': manifest },
          loaders: { '/scenarios/engine/eng-fire-in-flight.toon': () => Promise.resolve(text) },
        }),
        policy: OPEN_ACCESS,
      },
      env: DA50RG_ENV,
      rng: () => 0,
      onRunStart: () => undefined,
    });
    await session.newSituation();
    session.setLevel('easy');
    session.startRun();
    session.toggleChecklist();
    const mark = (id: string) => session.checklistMarks.value?.steps.find((s) => s.id === id);
    expect(mark('windows_open')?.credited).toBe(false);
    expect(mark('doors_open')?.credited).toBe(false);
    bridge.actuate('sw.emerg_window', 'open');
    expect(mark('windows_open')?.credited).toBe(true);
    expect(mark('doors_open')?.credited).toBe(false);
    bridge.actuate('lv.door_release', 'open');
    expect(mark('doors_open')?.credited).toBe(true);
  });
});
