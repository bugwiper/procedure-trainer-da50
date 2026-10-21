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
import { ArcGauge } from './ArcGauge';
import type { Band } from './ArcGauge';
import { BarGauge } from './BarGauge';

export interface FrameProps {
  readonly region: Region;
  readonly bridge: PanelBridge;
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

const SCREEN_FILL = '#05080b';
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
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={4} fill={SCREEN_FILL} />
      {page === 'engine' ? <EnginePage w={w} /> : <MapPage w={w} h={h} />}
      <LegendRow
        display="mfd"
        legends={page === 'engine' ? MFD_ENGINE_LEGENDS : MFD_MAP_LEGENDS}
        selectedSlot={page === 'engine' ? MFD_ENGINE_SELECTED_SLOT : -1}
      />
    </g>
  );
}

function MapPage({ w, h }: { readonly w: number; readonly h: number }) {
  const mapX = STRIP_W + 8;
  const mapW = w - mapX - 8;
  const cx = mapX + mapW / 2;
  const cy = h / 2 + 4;
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
            y={12 + i * 43}
            w={STRIP_W - 20}
            h={40}
          />
        ))}
      </g>
      <g data-testid="mfd-map">
        <rect x={mapX} y={12} width={mapW} height={h - 24} fill="#0e1a14" stroke="#2c323a" />
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
        <text x={mapX + 10} y={34} font-size={14} fill="#d8dde3">
          MAP
        </text>
        <text x={mapX + mapW - 10} y={34} text-anchor="end" font-size={10} fill="#8d97a2">
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
      <text x={14} y={24} font-size={14} fill="#d8dde3">
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
          cy={100}
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
          y={184 + i * 34}
          w={barW}
          h={34}
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
          y={184 + i * 34}
          w={barW}
          h={34}
        />
      ))}
    </g>
  );
}
