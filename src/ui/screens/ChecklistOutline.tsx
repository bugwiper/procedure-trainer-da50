import type { OutlineItem, OutlineMarker, OutlineVerdict, VerdictTone } from '../outline';

// The recursive checklist outline of the briefing and the debrief (UI-SPEC "Checklist outline",
// Table O1), in the two printed forms of plan 03-14 (owner decision 2026-10-23). Hook-free on
// purpose, so tests/vnode-walk.ts can expand it. Nesting is real list nesting: a decision holds its
// branches in a nested list, a branch holds its children in one.
// Table form: one row per item with the number at the left, the item next to it and the desired
// action at the right (a dotted leader between), and full-width comment rows (a boxed one keeps its
// reference at the right of the same row). Outline form: the printed marker in front of an item,
// drawn as a small SVG shape so it looks the same on every device.
// A step row carries the debrief-row test id and its aria-label only when it has a verdict, so a
// briefing step is its text alone. All text is rendered as text children, never as markup.

/** How the items are laid out: numbered rows with actions at the right, or the marked outline. */
export type ChecklistForm = 'table' | 'outline';

const TONE_COLORS: Readonly<Record<VerdictTone, string>> = {
  done: '#2fd36f',
  critical: '#ff5a50',
  standard: '#f2c230',
  neutral: '#aab3bd',
};

function Verdict({ verdict }: { readonly verdict: OutlineVerdict }) {
  return (
    <span class="outline-verdict" style={{ color: TONE_COLORS[verdict.tone] }}>
      {verdict.word}
    </span>
  );
}

/**
 * The heading band of a printed checklist: its title and, when declared, the message tag. Nothing
 * when the scenario declares neither.
 */
export function ChecklistHeading({
  heading,
  message,
}: {
  readonly heading?: string | undefined;
  readonly message?: string | undefined;
}) {
  if (heading === undefined && message === undefined) return null;
  return (
    <div class="checklist-heading" data-testid="checklist-heading">
      {heading === undefined ? null : (
        <span class="checklist-title" data-testid="checklist-title">
          {heading}
        </span>
      )}
      {message === undefined ? null : (
        <span class="checklist-message" data-testid="checklist-message">
          {message}
        </span>
      )}
    </div>
  );
}

// The six printed markers, drawn in a 24 x 16 box with the shape at the left, in the text colour.
// Display vocabulary only; the names come from the scenario data.
function MarkerShape({ marker }: { readonly marker: OutlineMarker }) {
  switch (marker) {
    case 'arrow':
      return <polygon points="3,3 14,8 3,13" fill="currentColor" />;
    case 'diamond':
      return <polygon points="8,2 14,8 8,14 2,8" fill="currentColor" />;
    case 'diamond_arrow':
      return (
        <>
          <polygon points="6,3 11,8 6,13 1,8" fill="currentColor" />
          <path d="M11 8 H20" stroke="currentColor" stroke-width="1.5" fill="none" />
          <polygon points="18,5 23,8 18,11" fill="currentColor" />
        </>
      );
    case 'double_arrow':
      return (
        <path
          d="M2 3 L7 8 L2 13 M9 3 L14 8 L9 13"
          stroke="currentColor"
          stroke-width="1.6"
          fill="none"
        />
      );
    case 'circle':
      return <circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.5" fill="none" />;
    case 'square':
      return <rect x="4" y="4" width="8" height="8" fill="currentColor" />;
  }
}

function Marker({ marker }: { readonly marker: OutlineMarker }) {
  return (
    <svg
      class="outline-marker"
      data-marker={marker}
      viewBox="0 0 24 16"
      width="24"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <MarkerShape marker={marker} />
    </svg>
  );
}

/** The marker of an item in the outline form; nothing in the table form or without a marker. */
function MarkerOf({
  marker,
  form,
}: {
  readonly marker: OutlineMarker | undefined;
  readonly form: ChecklistForm;
}) {
  return form === 'outline' && marker !== undefined ? <Marker marker={marker} /> : null;
}

/** The row class of the outline form; an item without a marker lines up with marked siblings. */
function rowClass(
  form: ChecklistForm,
  aligned: boolean,
  marker: OutlineMarker | undefined,
): string {
  if (form === 'table') return 'outline-row outline-trow';
  return aligned && marker === undefined ? 'outline-row outline-nomarker' : 'outline-row';
}

/** The cells of a table row: number, item text, dotted leader and desired action. */
function TableCells({
  number,
  text,
  action,
  muted,
}: {
  readonly number: number | undefined;
  readonly text: string;
  readonly action: string | undefined;
  readonly muted: boolean;
}) {
  return (
    <>
      {number === undefined ? null : <span class="outline-number">{String(number)}</span>}
      <span class={muted ? 'outline-text outline-muted' : 'outline-text'}>{text}</span>
      {action === undefined ? null : (
        <>
          <span class="outline-leader" aria-hidden="true" />
          <span class="outline-action">{action}</span>
        </>
      )}
    </>
  );
}

function Item({
  item,
  form,
  aligned,
}: {
  readonly item: OutlineItem;
  readonly form: ChecklistForm;
  readonly aligned: boolean;
}) {
  switch (item.kind) {
    case 'line': {
      const table = form === 'table';
      return (
        <li
          class={table && item.number === undefined ? 'outline-item outline-bare' : 'outline-item'}
          data-kind="line"
          data-muted={item.muted ? 'true' : undefined}
        >
          <div class={rowClass(form, aligned, item.marker)}>
            <MarkerOf marker={item.marker} form={form} />
            {table ? (
              <TableCells
                number={item.number}
                text={item.text}
                action={item.action}
                muted={item.muted}
              />
            ) : (
              <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
                {item.text}
              </span>
            )}
            {item.notGraded ? <span class="outline-meta">Not graded</span> : null}
          </div>
        </li>
      );
    }
    case 'comment':
      return (
        <li
          class="outline-item"
          data-kind="comment"
          data-boxed={item.boxed === true ? 'true' : undefined}
          data-muted={item.muted ? 'true' : undefined}
        >
          <div
            class={
              item.boxed === true
                ? 'outline-row outline-comment outline-boxed'
                : 'outline-row outline-comment'
            }
          >
            <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
              {item.text}
            </span>
            {item.action === undefined ? null : <span class="outline-action">{item.action}</span>}
          </div>
        </li>
      );
    case 'step': {
      const table = form === 'table';
      const label: string[] = [];
      if (item.tag !== null) label.push(item.tag);
      label.push(item.text);
      if (item.verdict !== null) label.push(item.verdict.word);
      const classes = ['outline-item', 'outline-step'];
      if (table && item.number === undefined) classes.push('outline-bare');
      return (
        <li
          class={classes.join(' ')}
          data-kind="step"
          data-testid={item.verdict === null ? undefined : 'debrief-row'}
          data-step-id={item.id}
          data-verdict={item.verdict?.word}
          data-muted={item.muted ? 'true' : undefined}
          aria-label={item.verdict === null ? undefined : label.join(', ')}
        >
          <div class={rowClass(form, aligned, item.marker)}>
            <MarkerOf marker={item.marker} form={form} />
            {item.tag === null ? null : <span class="outline-tag">{item.tag}</span>}
            {table ? (
              <TableCells
                number={item.number}
                text={item.text}
                action={item.action}
                muted={item.muted}
              />
            ) : (
              <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
                {item.text}
              </span>
            )}
            {item.verdict === null ? null : <Verdict verdict={item.verdict} />}
          </div>
        </li>
      );
    }
    case 'order':
      return (
        <li class="outline-item" data-kind="order" data-kept={item.kept ? 'true' : 'false'}>
          <div class="outline-row">
            <span class="outline-meta">{item.text}</span>
          </div>
        </li>
      );
    case 'decision':
      return (
        <li class="outline-item" data-kind="decision" data-muted={item.muted ? 'true' : undefined}>
          <div class={rowClass(form, aligned, item.marker)}>
            <MarkerOf marker={item.marker} form={form} />
            <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
              {item.text}
            </span>
            {item.notGraded ? <span class="outline-meta">Not graded</span> : null}
          </div>
          <List items={item.branches} form={form} />
        </li>
      );
    case 'branch': {
      const notApplicable = item.status === 'not_applicable';
      return (
        <li class="outline-item" data-kind="branch" data-status={item.status}>
          <div class={rowClass(form, aligned, item.marker)}>
            <MarkerOf marker={item.marker} form={form} />
            <span class={notApplicable ? 'outline-label outline-muted' : 'outline-label'}>
              {item.label}
            </span>
            {notApplicable ? <span class="outline-meta">Not applicable</span> : null}
          </div>
          {item.children.length > 0 ? <List items={item.children} form={form} /> : null}
        </li>
      );
    }
  }
}

function hasMarker(item: OutlineItem): boolean {
  return (
    (item.kind === 'line' ||
      item.kind === 'step' ||
      item.kind === 'decision' ||
      item.kind === 'branch') &&
    item.marker !== undefined
  );
}

function List({
  items,
  form,
}: {
  readonly items: readonly OutlineItem[];
  readonly form: ChecklistForm;
}) {
  // Siblings that carry no marker keep their text in line with the marked ones.
  const aligned = items.some(hasMarker);
  return (
    <ul class={form === 'table' ? 'outline-list outline-table' : 'outline-list'}>
      {items.map((item, i) => (
        <Item key={i} item={item} form={form} aligned={aligned} />
      ))}
    </ul>
  );
}

/** The outline of `items` as nested lists in the given form; nothing when there are none. */
export function ChecklistOutline({
  items,
  form = 'outline',
}: {
  readonly items: readonly OutlineItem[];
  readonly form?: ChecklistForm;
}) {
  return <List items={items} form={form} />;
}
