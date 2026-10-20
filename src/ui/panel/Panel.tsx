import type { JSX } from 'preact';
import type { PanelBridge } from '../bridge';
import { ControlWidget } from './ControlWidget';
import { MfdFrame } from './frames/MfdFrame';
import type { FrameProps } from './frames/MfdFrame';

/** Glass-display frames by region id; frames are presentational and carry no handlers (D-09). */
const FRAMES: Readonly<Record<string, (props: FrameProps) => JSX.Element>> = {
  mfd: MfdFrame,
};

/**
 * Root panel SVG. Iterates regions and their controls; carries no pointer handlers
 * (neutral areas emit nothing, D-09). Pointer handling lives on widget hit rects only.
 */
export function Panel({ bridge }: { bridge: PanelBridge }) {
  const { registry } = bridge;
  const { w, h } = registry.viewBox;
  return (
    <svg
      class="panel-svg"
      data-testid="panel"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="DA50 RG instrument panel"
    >
      <rect data-testid="panel-background" x={0} y={0} width={w} height={h} fill="#14171c" />
      {registry.regions.map((region) => (
        <g
          key={region.id}
          data-region-id={region.id}
          transform={`translate(${region.bounds.x} ${region.bounds.y})`}
        >
          <rect
            data-region-frame
            x={0}
            y={0}
            width={region.bounds.w}
            height={region.bounds.h}
            rx={8}
            fill="#1b1f25"
            stroke="#2c323a"
            pointer-events="none"
          />
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
          {(() => {
            const Frame = FRAMES[region.id];
            return Frame === undefined ? null : <Frame region={region} bridge={bridge} />;
          })()}
          {region.controlIds.map((id) => {
            const def = registry.get(id);
            return def === undefined ? null : <ControlWidget key={id} def={def} bridge={bridge} />;
          })}
        </g>
      ))}
    </svg>
  );
}
