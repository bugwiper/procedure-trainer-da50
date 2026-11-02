// The checklist catalog (Phase 7, plan 07-06, R-16): the contents pages of the aircraft's emergency
// checklist booklet as data, in groups with their printed headings. An entry carries the printed
// message tag, an optional printed qualifier and, where a scenario is shipped for it, the reference
// of that scenario. Two readers use it: the pad's CHOOSE SITUATION lists the situations by group and
// in the printed order, and the Realistic checklist chooser shows every entry, greyed where there is
// no scenario. The aircraft owns the data (src/aircraft/da50rg/checklist-catalog.ts, read through
// AircraftEnv.catalog); nothing here names a group, a tag or a scenario. The catalog is display and
// order only: grade never reads it. The cross-check against the shipped scenarios is a check of
// `npm run validate` (src/scenario/catalog-check.ts), not a per-open lint, so a paid pack does not
// need an entry in the public catalog.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

/** The scenario an entry links to: pack folder id and scenario id of the manifest. */
export interface CatalogRef {
  readonly pack: string;
  readonly scenario: string;
}

/** One printed row of a contents page. */
export interface CatalogEntry {
  /** The printed message tag, verbatim. */
  readonly tag: string;
  /** An optional printed qualifier (for example the pressure of an oxygen message). */
  readonly detail?: string;
  /** The shipped scenario of this entry; absent for a printed checklist that has none. */
  readonly ref?: CatalogRef;
}

export interface CatalogGroup {
  readonly id: string;
  /** The printed heading of the group. */
  readonly heading: string;
  /** The short static label of the group's tab on the narrow pad. */
  readonly tab: string;
  readonly entries: readonly CatalogEntry[];
}

export interface CatalogDefinition {
  readonly groups: readonly CatalogGroup[];
  /** Repo-relative path of the data file, named by the validate check when it reports the catalog. */
  readonly source: string;
}

/** An entry with the group it stands in and its unique key. */
export interface CatalogPlace {
  readonly group: CatalogGroup;
  readonly entry: CatalogEntry;
  readonly key: string;
}

export interface CatalogSet {
  readonly groups: readonly CatalogGroup[];
  readonly source: string;
  /** The unique key of an entry: the group id and a slug of tag and detail. */
  entryKey(groupId: string, entry: CatalogEntry): string;
  /** Every entry in the printed order (group by group). */
  places(): readonly CatalogPlace[];
  /** The group whose entry links to this scenario; undefined for a scenario the catalog does not know. */
  groupOf(ref: CatalogRef): CatalogGroup | undefined;
  /** As `groupOf`, but a scenario the catalog does not know belongs to the last group. */
  groupOrLast(ref: CatalogRef): CatalogGroup;
  /** The entry that links to this scenario. */
  entryOf(ref: CatalogRef): CatalogPlace | undefined;
  /**
   * The items in the catalog order, stable: linked entries in the printed order, then the items the
   * catalog does not know, in the order they came in.
   */
  order<T extends CatalogRef>(items: readonly T[]): T[];
}

export class CatalogError extends Error {}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The key of an entry: unique inside a catalog (defineCatalog throws for a repeat). */
export function entryKey(groupId: string, entry: CatalogEntry): string {
  const detail = entry.detail === undefined ? '' : `-${slug(entry.detail)}`;
  return `${groupId}:${slug(entry.tag)}${detail}`;
}

const refKey = (ref: CatalogRef): string => `${ref.pack}/${ref.scenario}`;

export function defineCatalog(definition: CatalogDefinition): CatalogSet {
  if (definition.groups.length === 0) throw new CatalogError('the catalog has no group');
  const groupIds = new Set<string>();
  const keys = new Set<string>();
  const byRef = new Map<string, CatalogPlace>();
  const places: CatalogPlace[] = [];
  const order = new Map<string, number>();
  for (const group of definition.groups) {
    if (group.id === '') throw new CatalogError('a group has an empty id');
    if (groupIds.has(group.id)) throw new CatalogError(`group "${group.id}" is defined twice`);
    groupIds.add(group.id);
    if (group.heading === '') throw new CatalogError(`group "${group.id}" has an empty heading`);
    if (group.tab === '') throw new CatalogError(`group "${group.id}" has an empty tab label`);
    for (const entry of group.entries) {
      if (entry.tag === '')
        throw new CatalogError(`group "${group.id}" has an entry with an empty tag`);
      const key = entryKey(group.id, entry);
      if (keys.has(key)) throw new CatalogError(`entry "${key}" is defined twice`);
      keys.add(key);
      const place: CatalogPlace = { group, entry, key };
      places.push(place);
      if (entry.ref !== undefined) {
        const at = refKey(entry.ref);
        if (byRef.has(at)) throw new CatalogError(`scenario "${at}" is the link of two entries`);
        byRef.set(at, place);
        order.set(at, places.length - 1);
      }
    }
  }
  const lastGroup = definition.groups[definition.groups.length - 1];
  if (lastGroup === undefined) throw new CatalogError('the catalog has no group');
  const frozenPlaces = Object.freeze([...places]);
  return Object.freeze({
    groups: Object.freeze([...definition.groups]),
    source: definition.source,
    entryKey,
    places: () => frozenPlaces,
    groupOf: (ref: CatalogRef) => byRef.get(refKey(ref))?.group,
    groupOrLast: (ref: CatalogRef) => byRef.get(refKey(ref))?.group ?? lastGroup,
    entryOf: (ref: CatalogRef) => byRef.get(refKey(ref)),
    order: <T extends CatalogRef>(items: readonly T[]): T[] => {
      const known: { item: T; at: number }[] = [];
      const unknown: T[] = [];
      for (const item of items) {
        const at = order.get(refKey(item));
        if (at === undefined) unknown.push(item);
        else known.push({ item, at });
      }
      known.sort((a, b) => a.at - b.at);
      return [...known.map((k) => k.item), ...unknown];
    },
  });
}
