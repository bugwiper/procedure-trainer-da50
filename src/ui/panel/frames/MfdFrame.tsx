import {
  GLASS,
  MFD_ENGINE_LEGENDS,
  MFD_ENGINE_SELECTED_SLOT,
  MFD_MAP_LEGENDS,
  legendTabCentreX,
} from '../../../aircraft/da50rg/avionics';
import type { DisplayId } from '../../../aircraft/da50rg/avionics';
import { DA50RG_QUANTITIES } from '../../../aircraft/da50rg/quantities';
import type { BandColour, QuantityId } from '../../../engine/quantities';
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
  /** The quantity's base reading: shown when the bridge has no value for the quantity. */
  readonly value: number;
  /** Every gauge reads a named quantity (D-07, D-12); range and bands come from its data. */
  readonly quantity: QuantityId;
  readonly min: number;
  readonly max: number;
  readonly bands: readonly Band[];
  /** Digits after the point in the readout: the gauge's resolution (C-12). */
  readonly decimals: number;
}

/** An unmarked scale range (colour 'none'): the dark scale colour of the frame. */
const UNMARKED = '#3a424b';

const BAND_COLOUR: Readonly<Record<BandColour, string>> = {
  green: GREEN,
  yellow: YELLOW,
  red: RED,
  none: UNMARKED,
};

/**
 * A gauge whose range, base value, unit and colour bands all come from the aircraft quantity data
 * (the AFM 02-05 markings live there once, src/aircraft/da50rg/quantities.ts), and whose reading is
 * that quantity's current value. The frame holds no gauge number of its own (T-03-04).
 */
function quantityGauge(label: string, quantity: QuantityId, decimals: number): GaugeSpec {
  const def = DA50RG_QUANTITIES.get(quantity);
  if (def === undefined) throw new Error(`unknown quantity "${quantity}"`);
  let from = def.min;
  const bands: Band[] = def.bands.map((b) => {
    const band = { from, to: b.to, color: BAND_COLOUR[b.colour] };
    from = b.to;
    return band;
  });
  return {
    label,
    unit: def.unit,
    value: def.base,
    quantity,
    min: def.min,
    max: def.max,
    bands,
    decimals,
  };
}

const RPM: GaugeSpec = quantityGauge('RPM', 'rpm', 0);
const LOAD: GaugeSpec = quantityGauge('Load', 'load_pct', 0);
const OIL_PRES: GaugeSpec = quantityGauge('Oil pres', 'oil_pressure_bar', 1);
const OIL_TEMP: GaugeSpec = quantityGauge('Oil temp', 'oil_temp_c', 0);
const COOLANT_TEMP: GaugeSpec = quantityGauge('Coolant temp', 'coolant_temp_c', 0);
const GEARBOX_TEMP: GaugeSpec = quantityGauge('Gearbox temp', 'gearbox_temp_c', 0);
const FUEL_TEMP: GaugeSpec = quantityGauge('Fuel temp', 'fuel_temp_c', 0);
const FUEL_PRES: GaugeSpec = quantityGauge('Fuel pres', 'fuel_pressure_bar', 1);
const FUEL_QTY_LH: GaugeSpec = quantityGauge('Fuel qty LH', 'fuel_qty_lh_gal', 1);
const FUEL_QTY_RH: GaugeSpec = quantityGauge('Fuel qty RH', 'fuel_qty_rh_gal', 1);
const VOLTS: GaugeSpec = quantityGauge('Volts', 'bus_volts', 1);
const AMPS: GaugeSpec = quantityGauge('Amps', 'alt1_amps', 0);

type Quantities = Readonly<Record<QuantityId, number>>;

/** The reading of a gauge: its quantity when the bridge has a value, else the quantity's base. */
function readingOf(g: GaugeSpec, quantities: Quantities): number {
  return quantities[g.quantity] ?? g.value;
}

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
 * selected by the page softkey state. Every gauge reads a simulated quantity (D-12); no handlers
 * (D-09).
 */
export function MfdFrame({ region, bridge }: FrameProps) {
  const page = bridge.stateOf('sw.mfd_page').value;
  const quantities = bridge.quantities.value;
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
        {page === 'engine' ? (
          <EnginePage w={w} quantities={quantities} />
        ) : (
          <MapPage w={w} quantities={quantities} />
        )}
      </g>
      <LegendRow
        display="mfd"
        legends={page === 'engine' ? MFD_ENGINE_LEGENDS : MFD_MAP_LEGENDS}
        selectedSlot={page === 'engine' ? MFD_ENGINE_SELECTED_SLOT : -1}
      />
    </g>
  );
}

function MapPage({ w, quantities }: { readonly w: number; readonly quantities: Quantities }) {
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
            value={readingOf(g, quantities)}
            min={g.min}
            max={g.max}
            bands={g.bands}
            decimals={g.decimals}
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

function EnginePage({ w, quantities }: { readonly w: number; readonly quantities: Quantities }) {
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
          value={readingOf(g, quantities)}
          min={g.min}
          max={g.max}
          bands={g.bands}
          decimals={g.decimals}
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
          value={readingOf(g, quantities)}
          min={g.min}
          max={g.max}
          bands={g.bands}
          decimals={g.decimals}
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
          value={readingOf(g, quantities)}
          min={g.min}
          max={g.max}
          bands={g.bands}
          decimals={g.decimals}
          x={w / 2 + 8}
          y={176 + i * 33}
          w={barW}
          h={33}
        />
      ))}
    </g>
  );
}
