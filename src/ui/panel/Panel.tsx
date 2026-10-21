import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { PanelBridge } from '../bridge';
import { ControlWidget } from './ControlWidget';
import { Defs } from './Defs';
import { MfdFrame } from './frames/MfdFrame';
import type { FrameProps } from './frames/MfdFrame';
import { PfdFrame } from './frames/PfdFrame';
import { SoftkeysFrame } from './frames/SoftkeysFrame';
import { UnitHousing } from './frames/UnitHousing';
import { PanelShell } from './PanelShell';
import { IndicatorLight } from './widgets/IndicatorLight';
import { attachZoomGestures, viewBoxAttr } from './zoom';

/** Glass-display frames by region id; frames are presentational and carry no handlers (D-09). */
const FRAMES: Readonly<Record<string, (props: FrameProps) => JSX.Element>> = {
  pfd: PfdFrame,
  mfd: MfdFrame,
  // Inert key art (the keys that are not controls) of the softkey rows below the displays.
  mfd_softkeys: SoftkeysFrame,
  pfd_softkeys: SoftkeysFrame,
  // Inert avionics units: housing and a not-operable label, no control, no handler (D-05, D-06).
  pfd_bezel_right: UnitHousing,
  audio_panel: UnitHousing,
  standby_efis: UnitHousing,
};

/**
 * Development flag, read once: ?regions=1 draws the Phase 1 region frames and captions. By
 * default the regions are invisible geometry only (UI-SPEC "Region frames").
 */
const SHOW_REGIONS =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('regions') === '1';

/**
 * Root panel SVG. Iterates regions and their controls; carries no pointer handlers
 * (neutral areas emit nothing, D-09). Pointer handling lives on widget hit rects only; the
 * zoom gesture layer attaches its own listeners and only ever changes the viewBox (D-20).
 */
export function Panel({ bridge }: { bridge: PanelBridge }) {
  const { registry } = bridge;
  const { w, h } = registry.viewBox;
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return undefined;
    return attachZoomGestures(svg, { registry });
  }, [registry]);
  return (
    <svg
      ref={svgRef}
      class="panel-svg"
      data-testid="panel"
      viewBox={viewBoxAttr}
      preserveAspectRatio="xMidYMid meet"
      aria-label="DA50 RG instrument panel"
    >
      <rect data-testid="panel-background" x={0} y={0} width={w} height={h} fill="#14171c" />
      <Defs />
      <PanelShell registry={registry} />
      {registry.regions.map((region) => (
        <g
          key={region.id}
          data-region-id={region.id}
          transform={`translate(${region.bounds.x} ${region.bounds.y})`}
        >
          {/* Invisible region geometry: the e2e helpers and the zoom tests read its box. */}
          <rect
            data-region-frame
            x={0}
            y={0}
            width={region.bounds.w}
            height={region.bounds.h}
            rx={8}
            fill={SHOW_REGIONS ? '#1b1f25' : 'none'}
            stroke={SHOW_REGIONS ? '#2c323a' : 'none'}
            pointer-events="none"
          />
          {SHOW_REGIONS ? (
            <text
              x={4}
              y={-4}
              font-family="B612, system-ui, sans-serif"
              font-size={10}
              letter-spacing={1}
              fill="#5c6670"
              pointer-events="none"
            >
              {region.name}
            </text>
          ) : null}
          {(() => {
            const Frame = FRAMES[region.id];
            return Frame === undefined ? null : <Frame region={region} bridge={bridge} />;
          })()}
          {(bridge.indicators?.inRegion(region.id) ?? []).map((def) => (
            <IndicatorLight key={def.id} def={def} bridge={bridge} />
          ))}
          {region.controlIds.map((id) => {
            const def = registry.get(id);
            return def === undefined ? null : <ControlWidget key={id} def={def} bridge={bridge} />;
          })}
        </g>
      ))}
    </svg>
  );
}
