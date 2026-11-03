import type { ActiveCas, CasLevel } from '../../../engine/cas';
import { CAS_COLUMN, casColumnRows } from '../../../aircraft/da50rg/pfd-layout';

// CAS messages on the PFD (PNL-03, PNL-25, D-03 to D-06). One stacked column at the lower right of
// the glass in the region-local units of the 495 x 367 PFD: black rows joined without a gap, thin
// level-coloured type, the bottom edge fixed so that the column grows upward. The list arrives in
// display order (warnings, cautions, advisories) and is drawn top row first; nothing is sorted here.
// Static: no flashing, no animation, no sound, no border, no live region. The message, level and
// trigger come from the aircraft rule table; this file only draws them.

// An advisory is white, the text colour of the glass (Phase 6, the transfer pump message).
const LEVEL_FILL: Readonly<Record<CasLevel, string>> = {
  warning: '#f0443c',
  caution: '#f2c230',
  advisory: '#ffffff',
};
const LEVEL_NAME: Readonly<Record<CasLevel, string>> = {
  warning: 'Warning',
  caution: 'Caution',
  advisory: 'Advisory',
};

export function CasChips({ active }: { readonly active: readonly ActiveCas[] }) {
  const rows = casColumnRows(active.length);
  return (
    <g data-testid="cas-chips" pointer-events="none">
      {rows.map((row, i) => {
        const message = active[i];
        if (message === undefined) return null;
        return (
          <g
            key={message.id}
            data-testid="cas-chip"
            data-cas-id={message.id}
            data-level={message.level}
            role="img"
            aria-label={`${LEVEL_NAME[message.level]}: ${message.text}`}
          >
            <rect x={row.x} y={row.y} width={row.width} height={row.height} fill="#000000" />
            <text
              x={row.x + row.width / 2}
              y={row.y + CAS_COLUMN.textBaseline}
              text-anchor="middle"
              font-size={CAS_COLUMN.fontSize}
              fill={LEVEL_FILL[message.level]}
            >
              {message.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
