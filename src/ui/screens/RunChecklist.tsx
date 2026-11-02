import { useRef } from 'preact/hooks';
import type { CatalogGroup, CatalogSet } from '../../engine/catalog';
import type { BranchVerdict, GradeResult } from '../../engine/grading';
import type { ScenarioRef } from '../../scenario/packs';
import type { Scenario } from '../../scenario/schema';
import { buildOutline, checklistHead } from '../outline';
import type { ChecklistList } from '../session';
import { ChecklistHeading, ChecklistOutline } from './ChecklistOutline';
import { INPUT_SHIELD_MS } from './Modal';

/** What the sheet shows: one checklist (marked or plain), or the list of checklists (Realistic). */
export type SheetBody =
  | {
      readonly kind: 'checklist';
      readonly scenario: Scenario;
      readonly branches: readonly BranchVerdict[];
      /** The grade of the partial recording against this checklist (R-24); null marks nothing. */
      readonly marks: GradeResult | null;
      /** Which steps the program checks, so which rows can be ticked (R-23). */
      readonly autoSteps: 'all' | 'panel' | 'none';
      /** The ticked row keys of this checklist. */
      readonly ticks: ReadonlySet<string>;
      readonly onTick: (rowKey: string) => void;
    }
  | {
      readonly kind: 'list';
      readonly list: ChecklistList;
      /** The groups of the booklet catalog (R-16, R-17): one tab each, the entries below. */
      readonly catalog: CatalogSet;
      /** The id of the selected group. */
      readonly tab: string;
      readonly onTab: (id: string) => void;
      readonly onChoose: (ref: ScenarioRef) => void;
      readonly onRetry: () => void;
    };

/**
 * The checklist sheet of a run (Phase 7, SES-02, R-02, R-03): the printed heading and message tag and
 * the outline in its briefing form (the rows the Easy briefing shows, with the branches decided at the
 * start), docked to the side of the panel area. With `marks` (the grade of the partial recording)
 * the steps already done carry the word Done in green (the live outline form); steps not done carry
 * nothing. On Realistic the sheet can instead list the headings of all checklists, every one alike
 * (nothing marks the situation's own; plan 07-06: grouped in tabs by the booklet catalog, entries without a loaded scenario greyed), and a shown checklist has a button back to that list
 * (`onBackToList`). It is not a modal: it holds
 * no modal id, so the run clock keeps running and the panel stays operable beside it. It has its own
 * hide button (the CHECKLIST button of the pad can be under the sheet), Escape inside it hides it, it
 * scrolls and never reaches the footer. All scenario text is rendered as text children.
 * The Hide button ignores a click for the first 400 ms: on a narrow portrait phone the bottom sheet
 * appears right under the pad button, and the click that follows the tap which opened the sheet
 * would otherwise land on Hide and close the sheet again at once.
 */
export function RunChecklist({
  body,
  onHide,
  onBackToList,
}: {
  readonly body: SheetBody;
  readonly onHide: () => void;
  /** Present on Realistic: from a shown checklist back to the list of checklists. */
  readonly onBackToList?: () => void;
}) {
  const shownAt = useRef(performance.now());
  return (
    <section
      class="run-checklist"
      aria-labelledby="run-checklist-title"
      data-testid="run-checklist"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onHide();
      }}
    >
      <div class="run-checklist-bar">
        <h2 id="run-checklist-title" class="run-checklist-title">
          {body.kind === 'list' ? 'Checklists' : 'Checklist'}
        </h2>
        <button
          type="button"
          class="secondary-button run-checklist-hide"
          data-testid="run-checklist-hide"
          onClick={() => {
            if (performance.now() - shownAt.current >= INPUT_SHIELD_MS) onHide();
          }}
        >
          Hide
        </button>
      </div>
      <div class="run-checklist-body" tabIndex={0} data-testid="run-checklist-body">
        {body.kind === 'list' ? (
          <ChecklistChoices
            list={body.list}
            catalog={body.catalog}
            tab={body.tab}
            onTab={body.onTab}
            onChoose={body.onChoose}
            onRetry={body.onRetry}
          />
        ) : (
          <>
            {onBackToList === undefined ? null : (
              <button
                type="button"
                class="secondary-button run-checklist-back"
                data-testid="run-checklist-back"
                onClick={onBackToList}
              >
                All checklists
              </button>
            )}
            <SheetChecklist body={body} />
          </>
        )}
      </div>
    </section>
  );
}

function SheetChecklist({ body }: { readonly body: Extract<SheetBody, { kind: 'checklist' }> }) {
  const { scenario, branches, marks, autoSteps, ticks, onTick } = body;
  // Always the live form: without marks nothing is program-checked and every row can be ticked.
  const outline =
    marks === null
      ? buildOutline(scenario, branches, 'live', undefined, { keys: ticks, autoSteps: 'none' })
      : buildOutline(scenario, branches, 'live', marks, { keys: ticks, autoSteps });
  const head = checklistHead(scenario);
  return (
    <>
      <ChecklistHeading heading={head.heading} message={head.message} />
      <ChecklistOutline items={outline} form={head.form} onTap={onTick} />
    </>
  );
}

/** One row of the Realistic list: a printed entry, loaded (a button) or not (greyed). */
interface ListRow {
  readonly key: string;
  readonly tag: string;
  readonly detail: string | undefined;
  /** The loaded scenario the row opens; undefined for a greyed row. */
  readonly ref: ScenarioRef | undefined;
}

/** The rows of one group in the printed order; scenarios the catalog does not know follow the last group. */
function rowsOf(catalog: CatalogSet, group: CatalogGroup, list: ChecklistList): readonly ListRow[] {
  const loaded = (ref: ScenarioRef | undefined) =>
    ref !== undefined &&
    list.entries.some((e) => e.ref.pack === ref.pack && e.ref.scenario === ref.scenario)
      ? ref
      : undefined;
  const rows: ListRow[] = group.entries.map((entry) => ({
    key: catalog.entryKey(group.id, entry),
    tag: entry.tag,
    detail: entry.detail,
    ref: loaded(entry.ref),
  }));
  if (catalog.groups[catalog.groups.length - 1]?.id === group.id) {
    for (const entry of list.entries) {
      if (catalog.entryOf(entry.ref) !== undefined) continue;
      rows.push({
        key: `${entry.ref.pack}/${entry.ref.scenario}`,
        tag: entry.heading,
        detail: undefined,
        ref: entry.ref,
      });
    }
  }
  return rows;
}

/**
 * The checklists of the booklet (R-17): one tab per catalog group with its full printed heading and
 * the entries of the selected tab below in the printed order. An entry whose scenario is loaded is a
 * button, every other entry is greyed and disabled; nothing says which one belongs to the situation.
 * Loading and failure are told in own words below the tabs.
 */
export function ChecklistChoices({
  list,
  catalog,
  tab,
  onTab,
  onChoose,
  onRetry,
}: {
  readonly list: ChecklistList;
  readonly catalog: CatalogSet;
  readonly tab: string;
  readonly onTab: (id: string) => void;
  readonly onChoose: (ref: ScenarioRef) => void;
  readonly onRetry: () => void;
}) {
  const selected = catalog.groups.find((group) => group.id === tab) ?? catalog.groups[0];
  const tabs = (
    <div class="run-checklist-tabs" role="tablist" data-testid="run-checklist-tabs">
      {catalog.groups.map((group) => (
        <button
          key={group.id}
          type="button"
          role="tab"
          class="secondary-button run-checklist-tab"
          data-testid={`run-checklist-tab-${group.id}`}
          aria-selected={group.id === selected?.id}
          onClick={() => {
            onTab(group.id);
          }}
        >
          {group.heading}
        </button>
      ))}
    </div>
  );
  if (list.status === 'failed') {
    return (
      <>
        {tabs}
        <div class="run-checklist-message" role="status" data-testid="run-checklist-failed">
          <p>The checklists could not be loaded. The run goes on.</p>
          <button
            type="button"
            class="secondary-button"
            data-testid="run-checklist-retry"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      </>
    );
  }
  if (list.status !== 'ready' || selected === undefined) {
    return (
      <>
        {tabs}
        <p class="run-checklist-message" role="status" data-testid="run-checklist-loading">
          Loading the checklists.
        </p>
      </>
    );
  }
  return (
    <>
      {tabs}
      <ul class="run-checklist-list" role="tabpanel" data-testid="run-checklist-list">
        {rowsOf(catalog, selected, list).map((row) => {
          const { ref } = row;
          return (
            <li key={row.key}>
              {ref === undefined ? (
                <button
                  type="button"
                  class="secondary-button run-checklist-entry run-checklist-entry-greyed"
                  data-testid="run-checklist-entry-greyed"
                  disabled
                  aria-disabled="true"
                >
                  <span>{row.tag}</span>
                  {row.detail === undefined ? null : (
                    <span class="run-checklist-detail">{row.detail}</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  class="secondary-button run-checklist-entry"
                  data-testid="run-checklist-entry"
                  onClick={() => {
                    onChoose(ref);
                  }}
                >
                  <span>{row.tag}</span>
                  {row.detail === undefined ? null : (
                    <span class="run-checklist-detail">{row.detail}</span>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
