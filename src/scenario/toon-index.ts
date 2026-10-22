// Path-to-position index for TOON text (SCN-01, RESEARCH Code Example 1). The decoder reports a
// line for its own errors only; schema and lint issues carry a path, and this index turns a path
// into the line and column of the key (or list item) that holds it. It reads the text line by
// line with the decoder's fixed indent of two spaces and never throws: a structure it does not
// understand is skipped (the decoder reports it), and an unknown path falls back to its nearest
// known ancestor.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

export type PathSegment = string | number;

export interface Position {
  /** 1-based. */
  readonly line: number;
  /** 1-based. */
  readonly col: number;
}

export type ToonIndex = ReadonlyMap<string, Position>;

const INDENT = 2;
const SEP = '\u0000';
const KEY_RE = /^("(?:[^"\\]|\\.)*"|[^:[{"\s][^:[{]*?)(\[[^\]]*\])?(\{[^}]*\})?:(?:\s+(.*)|\s*)$/;
const DELIMITERS = /[,\t|]/;

type Container =
  | { readonly kind: 'object'; readonly path: readonly PathSegment[] }
  | { readonly kind: 'list'; readonly path: readonly PathSegment[]; next: number }
  | {
      readonly kind: 'rows';
      readonly path: readonly PathSegment[];
      next: number;
      readonly fields: readonly string[];
    };

function unquoteKey(raw: string): string {
  if (!raw.startsWith('"')) return raw.trim();
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'string' ? value : raw;
  } catch {
    return raw;
  }
}

const splitFields = (header: string): string[] =>
  header
    .slice(1, -1)
    .split(DELIMITERS)
    .map((field) => unquoteKey(field.trim()));

const keyOf = (path: readonly PathSegment[]): string => path.join(SEP);

export function indexToon(source: string): ToonIndex {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const positions = new Map<string, Position>();
  const put = (path: readonly PathSegment[], line: number, col: number): void => {
    const key = keyOf(path);
    if (!positions.has(key)) positions.set(key, { line, col });
  };
  // contexts[depth] is the container whose children sit at that indent depth.
  const contexts: Container[] = [{ kind: 'object', path: [] }];

  const keyLine = (
    content: string,
    depth: number,
    line: number,
    col: number,
    container: Container,
  ): boolean => {
    const match = KEY_RE.exec(content);
    const rawKey = match?.[1];
    if (match === null || rawKey === undefined) return false;
    const path = [...container.path, unquoteKey(rawKey)];
    put(path, line, col);
    const arrayHeader = match[2];
    const fields = match[3];
    const rest = match[4];
    contexts.length = depth + 1;
    if (arrayHeader !== undefined) {
      if (rest !== undefined && rest !== '') {
        const count = rest.split(DELIMITERS).length;
        for (let i = 0; i < count; i++) put([...path, i], line, col);
      } else if (fields !== undefined) {
        contexts[depth + 1] = { kind: 'rows', path, next: 0, fields: splitFields(fields) };
      } else {
        contexts[depth + 1] = { kind: 'list', path, next: 0 };
      }
    } else if (rest === undefined || rest === '') {
      contexts[depth + 1] = { kind: 'object', path };
    }
    return true;
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmedEnd = raw.replace(/\s+$/, '');
    const content = trimmedEnd.trimStart();
    if (content === '' || content.startsWith('#')) return;
    const lead = trimmedEnd.length - content.length;
    const depth = Math.floor(lead / INDENT);
    const col = lead + 1;
    const container = contexts[depth];
    if (container === undefined) return;

    if (container.kind === 'rows') {
      const rowPath = [...container.path, container.next++];
      put(rowPath, line, col);
      for (const field of container.fields) put([...rowPath, field], line, col);
      return;
    }
    if (container.kind === 'list' && (content === '-' || content.startsWith('- '))) {
      const itemPath = [...container.path, container.next++];
      put(itemPath, line, col);
      contexts.length = depth + 1;
      const inner = content === '-' ? '' : content.slice(2);
      if (inner !== '') {
        const item: Container = { kind: 'object', path: itemPath };
        contexts[depth + 1] = item;
        if (!keyLine(inner, depth + 1, line, col + 2, item)) contexts.length = depth + 1;
      }
      return;
    }
    if (container.kind === 'object') keyLine(content, depth, line, col, container);
  });
  return positions;
}

/** The position of a path, or of its nearest known ancestor, or line 1 column 1. */
export function locate(index: ToonIndex, path: readonly PathSegment[]): Position {
  for (let n = path.length; n >= 0; n--) {
    const hit = index.get(keyOf(path.slice(0, n)));
    if (hit !== undefined) return hit;
  }
  return { line: 1, col: 1 };
}
