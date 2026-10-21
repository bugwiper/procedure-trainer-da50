import type { ComponentChildren } from 'preact';
import {
  BUS_CORNER_RADIUS,
  BUS_ORDER,
  BUS_OUTLINES,
  BUS_STROKE,
  BUS_TITLES,
  BUS_TITLE_STYLE,
} from '../../aircraft/da50rg/bus-boxes';
import type { BusPoint } from '../../aircraft/da50rg/bus-boxes';

// Static shell art of the bus panel (phase 01.2, D-01), drawn from bus-boxes.ts: the stair-step
// bus outlines and their titles. Everything is decorative: the shell root has pointer-events
// none, nothing here carries a handler or a tap target, and no breaker is drawn here (breakers
// are widgets of the registry).

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * Closed polygon path with every corner rounded by `radius`: one move command to the point
 * `radius` along the first edge, then a straight line and one quadratic corner curve per vertex.
 * Edges must be axis-parallel and longer than twice the radius.
 */
export function roundedPolygonPath(points: readonly BusPoint[], radius: number): string {
  const n = points.length;
  const at = (i: number): BusPoint => {
    const p = points[((i % n) + n) % n];
    if (p === undefined) throw new Error('roundedPolygonPath: empty polygon');
    return p;
  };
  /** The point `radius` from `from` on the straight edge towards `to`. */
  const toward = (from: BusPoint, to: BusPoint): BusPoint => {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    return { x: from.x + dx * radius, y: from.y + dy * radius };
  };
  const start = toward(at(0), at(1));
  let d = `M${fmt(start.x)} ${fmt(start.y)}`;
  for (let i = 1; i <= n; i++) {
    const v = at(i);
    const before = toward(v, at(i - 1));
    const after = i === n ? start : toward(v, at(i + 1));
    d += `L${fmt(before.x)} ${fmt(before.y)}Q${fmt(v.x)} ${fmt(v.y)} ${fmt(after.x)} ${fmt(after.y)}`;
  }
  return `${d}Z`;
}

/**
 * Layer 10: the bus panel. The plate arrives as a child (drawn by the shell from the plate data,
 * so the rectangle exists once). Draw order: plate, outlines, titles.
 */
export function BusPanelArt({ plate }: { plate: ComponentChildren }) {
  return (
    <g data-shell="bus-panel">
      {plate}
      {BUS_ORDER.map((bus) => (
        <path
          key={bus}
          data-shell="bus-outline"
          data-bus={bus}
          d={roundedPolygonPath(BUS_OUTLINES[bus], BUS_CORNER_RADIUS)}
          fill="none"
          stroke={BUS_STROKE.color}
          stroke-width={BUS_STROKE.width}
        />
      ))}
      {BUS_TITLES.map((title) => (
        <text
          key={title.bus}
          data-shell="bus-title"
          data-bus={title.bus}
          x={title.x}
          y={title.y}
          text-anchor="middle"
          font-size={8}
          fill={BUS_TITLE_STYLE.fill}
          stroke={BUS_TITLE_STYLE.cut}
          stroke-width={BUS_TITLE_STYLE.cutWidth}
          stroke-linejoin="round"
          paint-order="stroke"
        >
          {title.text}
        </text>
      ))}
    </g>
  );
}
