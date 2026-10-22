import type { OutlineItem, OutlineVerdict, VerdictTone } from '../outline';

// The recursive checklist outline of the briefing and the debrief (UI-SPEC "Checklist outline",
// Table O1). Hook-free on purpose, so tests/vnode-walk.ts can expand it. Nesting is real list
// nesting: a decision holds its branches in a nested list, a branch holds its children in one.
// All text is rendered as text children, never as markup.

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

function Item({ item }: { readonly item: OutlineItem }) {
  switch (item.kind) {
    case 'line':
      return (
        <li class="outline-item" data-kind="line" data-muted={item.muted ? 'true' : undefined}>
          <div class="outline-row">
            <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
              {item.text}
            </span>
            {item.notGraded ? <span class="outline-meta">Not graded</span> : null}
          </div>
        </li>
      );
    case 'step': {
      const label: string[] = [];
      if (item.tag !== null) label.push(item.tag);
      label.push(item.text);
      if (item.verdict !== null) label.push(item.verdict.word);
      return (
        <li
          class="outline-item outline-step"
          data-kind="step"
          data-testid={item.muted ? undefined : 'debrief-row'}
          data-step-id={item.id}
          data-verdict={item.verdict?.word}
          data-muted={item.muted ? 'true' : undefined}
          aria-label={item.muted ? undefined : label.join(', ')}
        >
          <div class="outline-row">
            {item.tag === null ? null : <span class="outline-tag">{item.tag}</span>}
            <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
              {item.text}
            </span>
            {item.verdict === null ? null : <Verdict verdict={item.verdict} />}
          </div>
        </li>
      );
    }
    case 'decision':
      return (
        <li class="outline-item" data-kind="decision" data-muted={item.muted ? 'true' : undefined}>
          <div class="outline-row">
            <span class={item.muted ? 'outline-text outline-muted' : 'outline-text'}>
              {item.text}
            </span>
            {item.notGraded ? <span class="outline-meta">Not graded</span> : null}
          </div>
          <List items={item.branches} />
        </li>
      );
    case 'branch': {
      const notApplicable = item.status === 'not_applicable';
      return (
        <li class="outline-item" data-kind="branch" data-status={item.status}>
          <div class="outline-row">
            <span class={notApplicable ? 'outline-label outline-muted' : 'outline-label'}>
              {item.label}
            </span>
            {notApplicable ? <span class="outline-meta">Not applicable</span> : null}
          </div>
          {item.children.length > 0 ? <List items={item.children} /> : null}
        </li>
      );
    }
  }
}

function List({ items }: { readonly items: readonly OutlineItem[] }) {
  return (
    <ul class="outline-list">
      {items.map((item, i) => (
        <Item key={i} item={item} />
      ))}
    </ul>
  );
}

/** The outline of `items` as nested lists; nothing when there are none. */
export function ChecklistOutline({ items }: { readonly items: readonly OutlineItem[] }) {
  return <List items={items} />;
}
