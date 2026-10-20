import { Fragment } from 'preact';

// Expands pure Preact components into a plain element tree so node-environment tests can count
// nodes and read props and text without a DOM. Function components are called with their props
// (no render context), so a component that uses hooks throws a clear error.

export interface El {
  /** SVG tag name; '#fragment' for fragments. */
  readonly tag: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly Tree[];
}

export type Tree = El | string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function expandInto(node: unknown, out: Tree[]): void {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) expandInto(item, out);
    return;
  }
  if (!isRecord(node) || !('type' in node)) {
    throw new Error(`vnode-walk: unsupported node of type ${typeof node}`);
  }
  const type = node['type'];
  const rawProps = node['props'];
  const props = isRecord(rawProps) ? rawProps : {};
  if (typeof type === 'function') {
    if (type === Fragment) {
      out.push({ tag: '#fragment', props: {}, children: expandChildren(props['children']) });
      return;
    }
    let result: unknown;
    try {
      result = (type as (p: Record<string, unknown>) => unknown)(props);
    } catch (error) {
      const name = (type as { name?: string }).name ?? 'component';
      throw new Error(
        `vnode-walk: ${name} could not be expanded without a render context (hooks are not supported): ${String(error)}`,
        { cause: error },
      );
    }
    expandInto(result, out);
    return;
  }
  if (typeof type !== 'string') throw new Error('vnode-walk: unsupported vnode type');
  const { children, ...rest } = props;
  out.push({ tag: type, props: rest, children: expandChildren(children) });
}

function expandChildren(children: unknown): Tree[] {
  const out: Tree[] = [];
  expandInto(children, out);
  return out;
}

/** Expand a vnode (or the result of calling a pure component) into one element tree. */
export function expand(vnode: unknown): El {
  const out: Tree[] = [];
  expandInto(vnode, out);
  const first = out[0];
  if (out.length !== 1 || first === undefined || typeof first === 'string') {
    throw new Error('vnode-walk: expected exactly one root element');
  }
  return first;
}

function walk(tree: Tree, visit: (el: El) => void): void {
  if (typeof tree === 'string') return;
  visit(tree);
  for (const child of tree.children) walk(child, visit);
}

/** All elements in document order, root included. */
export function findElements(tree: Tree, predicate: (el: El) => boolean): El[] {
  const found: El[] = [];
  walk(tree, (el) => {
    if (predicate(el)) found.push(el);
  });
  return found;
}

/** Number of real elements (fragments are not counted). */
export function countElements(tree: Tree): number {
  return findElements(tree, (el) => el.tag !== '#fragment').length;
}

/** Concatenated text content, one space between text nodes of different elements. */
export function textOf(tree: Tree): string {
  if (typeof tree === 'string') return tree;
  return tree.children
    .map((child) => textOf(child))
    .filter((t) => t !== '')
    .join(' ');
}
