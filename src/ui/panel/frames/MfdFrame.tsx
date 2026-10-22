import {
  GLASS,
  MFD_ENGINE_LEGENDS,
  MFD_ENGINE_SELECTED_SLOT,
  MFD_MAP_LEGENDS,
  legendTabCentreX,
} from '../../../aircraft/da50rg/avionics';
import type { DisplayId } from '../../../aircraft/da50rg/avionics';
import type { Region } from '../../../engine/registry';
import type { PanelBridge } from '../../bridge';
import type { Session } from '../../session';
import { ArcGauge } from './ArcGauge';
import type { Band } from './ArcGauge';
import { BarGauge } from './BarGauge';

export interface FrameProps {
  readonly region: Region;
  readonly bridge: PanelBridge;
  /** Only the session area frame uses it (plan 02-06). */
  readonly session?: Session;
}

const TAB_FILL = '#1b2127';
const TAB_TEXT = '#c9d0d8';
const TAB_SELECTED_BORDER = '#3fd1e0';
const TAB_SELECTED_BAR = '#3ddc84';

/**
 * The 12-slot legend row of a glass screen (Table D3): one tab per softkey, centred on the key
 * below it (the centres come from the same data function the key frame uses, so keys and tabs
 * cannot drift). A blank slot keeps an empty idle tab. The selected tab gets a cyan border and a
 * green underline bar, never colour alone. Static glass content (U-14).
 */
export function LegendRow({
  display,
  legends,
  selectedSlot,
}: {
  readonly display: DisplayId;
  readonly legends: readonly string[];
  readonly selectedSlot: number;
}) {
  const { y, h, baseline, width } = GLASS.tab;
  const w = width[display];
  return (
    <g data-glass-zone="legend">
      {legends.map((text, slot) => {
        const cx = legendTabCentreX(display, slot);
        const selected = slot === selectedSlot;
        return (
          <g key={slot} data-legend-tab={slot + 1} data-selected={selected ? 'true' : undefined}>
            <rect
              x={cx - w / 2}
              y={y}
              width={w}
              height={h}
              rx={1.5}
              fill={TAB_FILL}
              stroke={selected ? TAB_SELECTED_BORDER : undefined}
              stroke-width={selected ? 1.2 : undefined}
            />
            {selected ? (
              <rect x={cx - w / 2} y={y + h - 2} width={w} height={2} fill={TAB_SELECTED_BAR} />
            ) : null}
            {text === '' ? null : (
              <text x={cx} y={baseline} text-anchor="middle" font-size={6} fill={TAB_TEXT}>
                {text}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

const HEADER_FILL = '#080b0e';
const HEADER_RULE = '#3a424b';
const HEADER_LABEL = '#8d97a2';
const HEADER_ACTIVE = '#ffffff';
const HEADER_STANDBY = '#c9d0d8';
const HEADER_TITLE = '#d8dde3';

/**
 * The header strip of a glass screen (Table D4): two frequency lines on each side and, on the
 * MFD, the page title in the centre. Static idle values (U-15), original layout; the swap arrow
 * is a path. Digits use the glass font; sizes are 6 and 8.
 */
export function GlassHeader({ title }: { readonly title?: string }) {
  const { y0, y1 } = GLASS.header;
  const line1 = 15;
  const line2 = 25;
  return (
    <g data-glass-zone="header">
      <rect x={4} y={y0} width={487} height={y1 - y0} fill={HEADER_FILL} />
      <line x1={4} y1={y1} x2={491} y2={y1} stroke={HEADER_RULE} stroke-width={1} />
      {/* Left block: two lines, label at x 8, active and standby values. */}
      <text x={8} y={line1} font-size={6} fill={HEADER_LABEL}>
        N1
      </text>
      <text class="glass-digits" x={22} y={line1} font-size={8} fill={HEADER_ACTIVE}>
        109.90
      </text>
      <path
        data-swap-arrow
        d="M 61 11.5 H 73 M 64 9 L 61 11.5 L 64 14 M 70 9 L 73 11.5 L 70 14"
        fill="none"
        stroke={HEADER_STANDBY}
        stroke-width={1}
      />
      <text class="glass-digits" x={80} y={line1} font-size={8} fill={HEADER_STANDBY}>
        111.50
      </text>
      <text x={8} y={line2} font-size={6} fill={HEADER_LABEL}>
        N2
      </text>
      <text class="glass-digits" x={22} y={line2} font-size={8} fill={HEADER_ACTIVE}>
        114.80
      </text>
      <text class="glass-digits" x={80} y={line2} font-size={8} fill={HEADER_STANDBY}>
        111.50
      </text>
      {/* Right block: communication frequencies, labels at the right end. */}
      <text class="glass-digits" x={335} y={line1} font-size={8} fill={HEADER_ACTIVE}>
        118.100
      </text>
      <text x={378} y={line1} font-size={6} fill={HEADER_LABEL}>
        RX
      </text>
      <text class="glass-digits" x={396} y={line1} font-size={8} fill={HEADER_STANDBY}>
        123.725
      </text>
      <text x={487} y={line1} text-anchor="end" font-size={6} fill={HEADER_LABEL}>
        1C
      </text>
      <text class="glass-digits" x={335} y={line2} font-size={8} fill={HEADER_ACTIVE}>
        121.500
      </text>
      <text class="glass-digits" x={396} y={line2} font-size={8} fill={HEADER_STANDBY}>
        133.330
      </text>
      <text x={487} y={line2} text-anchor="end" font-size={6} fill={HEADER_LABEL}>
        2M
      </text>
      {title === undefined ? null : (
        <text
          data-glass-title
          x={242.5}
          y={19}
          text-anchor="middle"
          font-size={8}
          fill={HEADER_TITLE}
        >
          {title}
        </text>
      )}
    </g>
  );
}

const GREEN = '#2fd36f';
const YELLOW = '#f2c230';
const RED = '#f0443c';

interface GaugeSpec {
  readonly label: string;
  readonly unit: string;
  /** Plausible engine-off idle reading (D-11); live values arrive with PNL-04. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly bands: readonly Band[];
}

// Limits and band colours are facts from the AFM engine instrument markings,
// section 02-05 (page 02-7). Scale ends are display choices. Indications whose
// markings are not in that table are left out rather than invented.
const RPM: GaugeSpec = {
  label: 'RPM',
  unit: 'rpm',
  value: 0,
  min: 0,
  max: 2500,
  // AFM 02-05: green 0-2300, yellow 2300-2340, red above 2340.
  bands: [
    { from: 0, to: 2300, color: GREEN },
    { from: 2300, to: 2340, color: YELLOW },
    { from: 2340, to: 2500, color: RED },
  ],
};
const LOAD: GaugeSpec = {
  label: 'Load',
  unit: '%',
  value: 0,
  min: 0,
  max: 100,
  // AFM 02-05: green up to 90 percent, yellow 90-100 percent.
  bands: [
    { from: 0, to: 90, color: GREEN },
    { from: 90, to: 100, color: YELLOW },
  ],
};
const OIL_PRES: GaugeSpec = {
  label: 'Oil pres',
  unit: 'bar',
  value: 0,
  min: 0,
  max: 9,
  // AFM 02-05: red 0-2.0, yellow 2.0-3.5, green 3.5-7.0, yellow 7.0-7.5, red above 7.5.
  bands: [
    { from: 0, to: 2, color: RED },
    { from: 2, to: 3.5, color: YELLOW },
    { from: 3.5, to: 7, color: GREEN },
    { from: 7, to: 7.5, color: YELLOW },
    { from: 7.5, to: 9, color: RED },
  ],
};
const OIL_TEMP: GaugeSpec = {
  label: 'Oil temp',
  unit: '°C',
  value: 15,
  min: -25,
  max: 150,
  // AFM 02-05: yellow -25..50, green 50-115, yellow 115-125, red above 125.
  bands: [
    { from: -25, to: 50, color: YELLOW },
    { from: 50, to: 115, color: GREEN },
    { from: 115, to: 125, color: YELLOW },
    { from: 125, to: 150, color: RED },
  ],
};
const COOLANT_TEMP: GaugeSpec = {
  label: 'Coolant temp',
  unit: '°C',
  value: 15,
  min: -25,
  max: 125,
  // AFM 02-05: yellow -25..60, green 60-101, yellow 101-105, red above 105.
  bands: [
    { from: -25, to: 60, color: YELLOW },
    { from: 60, to: 101, color: GREEN },
    { from: 101, to: 105, color: YELLOW },
    { from: 105, to: 125, color: RED },
  ],
};
const GEARBOX_TEMP: GaugeSpec = {
  label: 'Gearbox temp',
  unit: '°C',
  value: 15,
  min: -25,
  max: 125,
  // AFM 02-05: yellow -25..50, green 50-105, yellow 105-110, red above 110.
  bands: [
    { from: -25, to: 50, color: YELLOW },
    { from: 50, to: 105, color: GREEN },
    { from: 105, to: 110, color: YELLOW },
    { from: 110, to: 125, color: RED },
  ],
};
const FUEL_TEMP: GaugeSpec = {
  label: 'Fuel temp',
  unit: '°C',
  value: 15,
  min: -30,
  max: 70,
  // AFM 02-05: red below -25, yellow -25..-20, green -20..55, yellow 55-60, red above 60.
  bands: [
    { from: -30, to: -25, color: RED },
    { from: -25, to: -20, color: YELLOW },
    { from: -20, to: 55, color: GREEN },
    { from: 55, to: 60, color: YELLOW },
    { from: 60, to: 70, color: RED },
  ],
};
const FUEL_PRES: GaugeSpec = {
  label: 'Fuel pres',
  unit: 'bar',
  value: 0,
  min: -0.5,
  max: 1.5,
  // AFM 02-05: red below -0.3, green -0.3..1.0, red above 1.0.
  bands: [
    { from: -0.5, to: -0.3, color: RED },
    { from: -0.3, to: 1, color: GREEN },
    { from: 1, to: 1.5, color: RED },
  ],
};
const FUEL_QTY_LH: GaugeSpec = {
  label: 'Fuel qty LH',
  unit: 'gal',
  value: 20,
  min: 0,
  max: 30,
  // AFM 02-05: red below 1 US gal, green 1-25 (left tank).
  bands: [
    { from: 0, to: 1, color: RED },
    { from: 1, to: 25, color: GREEN },
    { from: 25, to: 30, color: '#3a424b' },
  ],
};
const FUEL_QTY_RH: GaugeSpec = {
  label: 'Fuel qty RH',
  unit: 'gal',
  value: 20,
  min: 0,
  max: 30,
  // AFM 02-05: red below 1 US gal, green 1-24 (right tank).
  bands: [
    { from: 0, to: 1, color: RED },
    { from: 1, to: 24, color: GREEN },
    { from: 24, to: 30, color: '#3a424b' },
  ],
};
const VOLTS: GaugeSpec = {
  label: 'Volts',
  unit: 'V',
  value: 24.5,
  min: 20,
  max: 34,
  // AFM 02-05: red below 24.1, yellow 24.1-25, green 25-30, yellow 30-32, red above 32.
  bands: [
    { from: 20, to: 24.1, color: RED },
    { from: 24.1, to: 25, color: YELLOW },
    { from: 25, to: 30, color: GREEN },
    { from: 30, to: 32, color: YELLOW },
    { from: 32, to: 34, color: RED },
  ],
};
const AMPS: GaugeSpec = {
  label: 'Amps',
  unit: 'A',
  value: 0,
  min: 0,
  max: 80,
  // AFM 02-05: green below 60, yellow 60-70, red above 70.
  bands: [
    { from: 0, to: 60, color: GREEN },
    { from: 60, to: 70, color: YELLOW },
    { from: 70, to: 80, color: RED },
  ],
};

export const SCREEN_FILL = '#05080b';
const STRIP_W = 150;
const STRIP_GAUGES: readonly GaugeSpec[] = [
  RPM,
  LOAD,
  OIL_PRES,
  OIL_TEMP,
  COOLANT_TEMP,
  GEARBOX_TEMP,
  VOLTS,
  FUEL_QTY_LH,
];
const ENGINE_BARS_LEFT: readonly GaugeSpec[] = [
  OIL_TEMP,
  COOLANT_TEMP,
  GEARBOX_TEMP,
  FUEL_TEMP,
  FUEL_PRES,
];
const ENGINE_BARS_RIGHT: readonly GaugeSpec[] = [VOLTS, AMPS, FUEL_QTY_LH, FUEL_QTY_RH];

/**
 * MFD frame (D-04a): the Map page with a small engine strip, or the full Engine page,
 * selected by the page softkey state. Static idle values (D-11); no handlers (D-09).
 */
export function MfdFrame({ region, bridge }: FrameProps) {
  const page = bridge.stateOf('sw.mfd_page').value;
  const { w, h } = region.bounds;
  return (
    <g data-mfd-page={page} pointer-events="none">
      <rect
        data-glass-zone="screen"
        x={4}
        y={4}
        width={w - 8}
        height={h - 8}
        rx={4}
        fill={SCREEN_FILL}
      />
      <GlassHeader title={page === 'engine' ? 'EIS - Engine' : 'Map - Navigation Map'} />
      <g data-glass-zone="content">
        {page === 'engine' ? <EnginePage w={w} /> : <MapPage w={w} />}
      </g>
      <LegendRow
        display="mfd"
        legends={page === 'engine' ? MFD_ENGINE_LEGENDS : MFD_MAP_LEGENDS}
        selectedSlot={page === 'engine' ? MFD_ENGINE_SELECTED_SLOT : -1}
      />
    </g>
  );
}

function MapPage({ w }: { readonly w: number }) {
  const mapX = STRIP_W + 8;
  const mapW = w - mapX - 8;
  const cx = mapX + mapW / 2;
  // Map rectangle y 34..343 (Table D6); its centre line is 188.
  const cy = 188;
  return (
    <g data-testid="mfd-map-page">
      <g data-testid="mfd-engine-strip">
        {STRIP_GAUGES.map((g, i) => (
          <BarGauge
            key={g.label}
            label={g.label}
            unit={g.unit}
            value={g.value}
            min={g.min}
            max={g.max}
            bands={g.bands}
            x={12}
            y={34 + i * 38}
            w={STRIP_W - 20}
            h={36}
          />
        ))}
      </g>
      <g data-testid="mfd-map">
        <rect x={mapX} y={34} width={mapW} height={309} fill="#0e1a14" stroke="#2c323a" />
        <circle cx={cx} cy={cy} r={70} fill="none" stroke="#3a5a48" stroke-width={1.5} />
        <circle cx={cx} cy={cy} r={140} fill="none" stroke="#3a5a48" stroke-width={1.5} />
        <path
          d={`M ${cx} ${cy - 12} l 9 18 l -9 -4 l -9 4 z`}
          fill="#f2c230"
          stroke="#05080b"
          pointer-events="none"
        />
        <path d={`M ${cx} ${cy - 150} l 6 14 l -12 0 z`} fill="#8d97a2" />
        <text x={cx + 12} y={cy - 138} font-size={10} fill="#8d97a2">
          N
        </text>
        <text x={mapX + mapW - 10} y={52} text-anchor="end" font-size={10} fill="#8d97a2">
          NORTH UP
        </text>
      </g>
    </g>
  );
}

function EnginePage({ w }: { readonly w: number }) {
  const arcs: readonly GaugeSpec[] = [RPM, LOAD, OIL_PRES];
  const colW = (w - 8) / 3;
  const barW = (w - 8) / 2 - 24;
  return (
    <g data-testid="mfd-engine-page">
      <text x={14} y={46} font-size={14} fill="#d8dde3">
        ENGINE
      </text>
      {arcs.map((g, i) => (
        <ArcGauge
          key={g.label}
          label={g.label}
          unit={g.unit}
          value={g.value}
          min={g.min}
          max={g.max}
          bands={g.bands}
          cx={4 + colW * (i + 0.5)}
          cy={112}
          r={52}
        />
      ))}
      {ENGINE_BARS_LEFT.map((g, i) => (
        <BarGauge
          key={g.label}
          label={g.label}
          unit={g.unit}
          value={g.value}
          min={g.min}
          max={g.max}
          bands={g.bands}
          x={16}
          y={176 + i * 33}
          w={barW}
          h={33}
        />
      ))}
      {ENGINE_BARS_RIGHT.map((g, i) => (
        <BarGauge
          key={g.label}
          label={g.label}
          unit={g.unit}
          value={g.value}
          min={g.min}
          max={g.max}
          bands={g.bands}
          x={w / 2 + 8}
          y={176 + i * 33}
          w={barW}
          h={33}
        />
      ))}
    </g>
  );
}
