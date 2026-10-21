/**
 * Shared gradients and patterns of the panel (UI-SPEC "Panel Surface", shading rule 2): every
 * paint is defined here once with an id prefixed g- or p- and referenced through paint().
 * Widgets and the shell never define their own. Each gradient has at most three stops, none
 * animate, and no filter is used (flat SVG only, D-06).
 */
export const DEF_IDS = [
  'g-plate',
  'g-console',
  'g-coaming',
  'g-chrome',
  'g-brushed',
  'g-silver',
  'g-halo-green',
  'g-halo-red',
  'g-halo-white',
  'g-halo-amber',
  'p-carbon',
  'p-hatch',
] as const;

export type DefId = (typeof DEF_IDS)[number];

/** The `fill` / `stroke` value that references a shared definition. */
export function paint(id: DefId): string {
  return `url(#${id})`;
}

interface VerticalStops {
  readonly id: DefId;
  readonly top: string;
  readonly bottom: string;
}

/** Top-to-bottom gradients: the light comes from above (shading rule 1). */
const VERTICAL: readonly VerticalStops[] = [
  { id: 'g-plate', top: '#1d2024', bottom: '#141619' },
  { id: 'g-console', top: '#15171b', bottom: '#101215' },
  { id: 'g-coaming', top: '#23272d', bottom: '#15171b' },
  { id: 'g-chrome', top: '#f2f4f7', bottom: '#8b9199' },
  { id: 'g-brushed', top: '#d9dde2', bottom: '#8e949c' },
  { id: 'g-silver', top: '#e8ecf0', bottom: '#9aa1a9' },
];

interface Halo {
  readonly id: DefId;
  readonly lit: string;
  readonly clear: string;
}

/** Lamp halos: radial from the lit colour to transparent (no blur filter, rule 4). */
const HALOS: readonly Halo[] = [
  { id: 'g-halo-green', lit: 'rgba(61,220,132,0.45)', clear: 'rgba(61,220,132,0)' },
  { id: 'g-halo-red', lit: 'rgba(255,67,56,0.5)', clear: 'rgba(255,67,56,0)' },
  { id: 'g-halo-white', lit: 'rgba(255,255,255,0.4)', clear: 'rgba(255,255,255,0)' },
  { id: 'g-halo-amber', lit: 'rgba(255,184,28,0.5)', clear: 'rgba(255,184,28,0)' },
];

/** One defs element holding all twelve shared paints. Pure: no hooks, no state. */
export function Defs() {
  return (
    <defs>
      {VERTICAL.map((g) => (
        <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={g.top} />
          <stop offset="1" stop-color={g.bottom} />
        </linearGradient>
      ))}
      {HALOS.map((h) => (
        <radialGradient key={h.id} id={h.id} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color={h.lit} />
          <stop offset="0.6" stop-color={h.lit} stop-opacity="0.5" />
          <stop offset="1" stop-color={h.clear} />
        </radialGradient>
      ))}
      {/* Carbon grip of the POWER handle: 45-degree hatch, 2-unit pitch. */}
      <pattern
        id="p-carbon"
        width={2}
        height={2}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={2} height={2} fill="#c9ced4" />
        <rect width={2} height={1} fill="#8e959d" />
      </pattern>
      {/* Guard cover hatch of the de-ice ALTERNATE switch (UI-SPEC 8.6). */}
      <pattern
        id="p-hatch"
        width={6}
        height={6}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={6} height={6} fill="#c43030" fill-opacity="0.35" />
        <rect width={6} height={1.5} fill="#e04040" />
      </pattern>
    </defs>
  );
}
