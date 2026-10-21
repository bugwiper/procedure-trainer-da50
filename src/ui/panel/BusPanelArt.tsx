import { Fragment } from 'preact';
import type { ComponentChildren } from 'preact';
import {
  BUS_CORNER_RADIUS,
  BUS_ORDER,
  BUS_OUTLINES,
  BUS_PLUGS,
  BUS_PLUG_STYLE,
  BUS_PUMP_BOXES,
  BUS_STROKE,
  BUS_SUBPANEL,
  BUS_TITLES,
  BUS_TITLE_SIZE,
  BUS_TITLE_STYLE,
  busTitleCut,
} from '../../aircraft/da50rg/bus-boxes';
import type { BusPoint } from '../../aircraft/da50rg/bus-boxes';
import { labelBaseline } from './skins/Breaker';

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
 * so the rectangle exists once). Draw order: plate, lower-row sub-panel, outlines, pump boxes,
 * plugs with their labels, then each title preceded by its plate-coloured cut rectangle (the cut
 * hides the outline edge behind the title; the title is plain unstroked text, R3-1.1). The plug labels use the breaker label baselines, so a plug
 * label and a breaker label can never disagree.
 */
export function BusPanelArt({ plate }: { plate: ComponentChildren }) {
  return (
    <g data-shell="bus-panel">
      {plate}
      <rect
        data-shell="bus-subpanel"
        x={BUS_SUBPANEL.x}
        y={BUS_SUBPANEL.y}
        width={BUS_SUBPANEL.w}
        height={BUS_SUBPANEL.h}
        rx={BUS_SUBPANEL.rx}
        fill={BUS_SUBPANEL.fill}
        stroke={BUS_SUBPANEL.stroke}
        stroke-width={1}
      />
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
      {BUS_PUMP_BOXES.map((box) => (
        <rect
          key={box.name}
          data-shell="bus-pump-box"
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={box.rx}
          fill="none"
          stroke={BUS_STROKE.color}
          stroke-width={BUS_STROKE.width}
        />
      ))}
      {BUS_PLUGS.map((plug) => (
        <g key={plug.id}>
          <circle
            data-shell="bus-plug"
            cx={plug.x}
            cy={plug.y}
            r={plug.r}
            fill={BUS_PLUG_STYLE.fill}
            stroke={BUS_PLUG_STYLE.rim}
            stroke-width={BUS_PLUG_STYLE.rimWidth}
          />
          {plug.labelLines.map((line, index) => (
            <text
              key={line}
              data-shell="bus-plug-label"
              x={plug.x + (plug.labelDx ?? 0)}
              y={plug.y + labelBaseline(index, plug.labelLines.length)}
              text-anchor="middle"
              font-size={6}
              fill="#aab3bd"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
      {BUS_TITLES.map((title) => {
        const cut = busTitleCut(title);
        return (
          <Fragment key={title.bus}>
            <rect
              data-shell="bus-title-cut"
              data-bus={title.bus}
              x={cut.x}
              y={cut.y}
              width={cut.w}
              height={cut.h}
              fill={BUS_TITLE_STYLE.cut}
            />
            <text
              data-shell="bus-title"
              data-bus={title.bus}
              x={title.x}
              y={title.y}
              text-anchor="middle"
              font-size={BUS_TITLE_SIZE}
              fill={BUS_TITLE_STYLE.fill}
            >
              {title.text}
            </text>
          </Fragment>
        );
      })}
    </g>
  );
}
