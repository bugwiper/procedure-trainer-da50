import {
  AV_MASTER_CONTROL,
  GLASS,
  MFD_ENGINE_LEGENDS,
  MFD_ENGINE_SELECTED_SLOT,
  MFD_MAP_LEGENDS,
  legendTabCentreX,
  secondRadioRowLive,
} from '../../../aircraft/da50rg/avionics';
import type { DisplayId } from '../../../aircraft/da50rg/avionics';
import { ENGINE_PAGE } from '../../../aircraft/da50rg/engine-page';
import type { PageEntry } from '../../../aircraft/da50rg/engine-page';
import { MAP_STRIP } from '../../../aircraft/da50rg/map-strip';
import { deiceEndurance } from '../../../aircraft/da50rg/deice-endurance';
import { formatEndurance, fuelCalculator } from '../../../aircraft/da50rg/fuel-calculator';
import { DA50RG_QUANTITIES } from '../../../aircraft/da50rg/quantities';
import type { BandColour, QuantityId } from '../../../engine/quantities';
import type { Region } from '../../../engine/registry';
import type { PanelBridge } from '../../bridge';
import type { Session } from '../../session';
import { ArcGauge } from './ArcGauge';
import type { Band } from './ArcGauge';
import { BarGauge } from './BarGauge';
import { BoxFrame } from './BoxFrame';
import { DualGauge } from './DualGauge';
import { GLASS_DARK, GREEN, RED, YELLOW, textBoxWidth, toneOf } from './gauge-alert';
import { POINTER_OUTLINE, pointerPath } from './pointer';

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
/** The swap arrows and the frames of the two standby frequencies (static, never a control). */
const HEADER_SWAP = TAB_SELECTED_BORDER;

const FREQ_FONT = 8;
const LABEL_FONT = 6;
/** Baselines of the two frequency rows, and of the middle letter of the stacked radio name. */
const LINE_1 = 15;
const LINE_2 = 25;
const LINE_MID = 20;
/** The turquoise frame of a standby frequency: padding around the digits and the corner radius. */
const FRAME_PAD_X = 1.5;
const FRAME_ABOVE = 7.5;
const FRAME_H = 10.5;
const SWAP_ARROW_W = 14;
/** The radio names as stacked letters, one per line of the header (two rows and the gap between). */
const NAV_LETTERS: readonly (readonly [string, number])[] = [
  ['N', LINE_1],
  ['A', LINE_MID],
  ['V', LINE_2],
];
const COM_LETTERS: readonly (readonly [string, number])[] = [
  ['C', LINE_1],
  ['O', LINE_MID],
  ['M', LINE_2],
];

/** The extent of each second row: from the first digit to the end of the last one, with the frame padding. */
const NAV_ROW_2_X0 = 24 - FRAME_PAD_X;
const NAV_ROW_2_X1 = 84 + textBoxWidth('111.50', FREQ_FONT, true) + FRAME_PAD_X;
const COM_ROW_2_X0 = 362 - FRAME_PAD_X;
const COM_ROW_2_X1 = 428 + textBoxWidth('133.330', FREQ_FONT, true) + FRAME_PAD_X;
/** The unreachable look of a second row (the real display with the avionics off): box and crosses. */
const OFF_FILL = '#5f5d2b';
const OFF_CROSS = '#e3d12b';
/** The box lies under the first-row frames (which end at y 18) and above the header rule (y 28). */
const OFF_Y0 = LINE_2 - FRAME_ABOVE + 0.7;
const OFF_Y1 = LINE_2 + 2.5;

/**
 * A second radio row with the avionics off: a yellow-grey box and two crossing yellow lines over it
 * (owner decision, PANEL-REVIEW.md item 15). Drawn instead of the two frequencies, never in addition.
 */
function UnreachableRow({
  row,
  x0,
  x1,
}: {
  readonly row: 'nav2' | 'com2';
  readonly x0: number;
  readonly x1: number;
}) {
  return (
    <g data-radio-row-off={row}>
      <rect x={x0} y={OFF_Y0} width={x1 - x0} height={OFF_Y1 - OFF_Y0} fill={OFF_FILL} />
      <path
        data-radio-row-cross
        d={`M ${x0} ${OFF_Y0} L ${x1} ${OFF_Y1} M ${x0} ${OFF_Y1} L ${x1} ${OFF_Y0}`}
        fill="none"
        stroke={OFF_CROSS}
        stroke-width={0.9}
      />
    </g>
  );
}

/**
 * Whether the second radio row of both glass displays shows its frequencies: it follows the AV
 * MASTER switch alone (owner decision). The PFD and the MFD both ask here.
 */
export function glassSecondRowLive(bridge: PanelBridge): boolean {
  return secondRadioRowLive(bridge.stateOf(AV_MASTER_CONTROL).value);
}

/** A frequency in the glass digits; `frame` draws the thin turquoise frame of a standby frequency. */
function Frequency({
  x,
  y,
  text,
  fill,
  frame = false,
}: {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fill: string;
  readonly frame?: boolean;
}) {
  return (
    <>
      {frame ? (
        <rect
          data-standby-frame
          x={x - FRAME_PAD_X}
          y={y - FRAME_ABOVE}
          width={textBoxWidth(text, FREQ_FONT, true) + 2 * FRAME_PAD_X}
          height={FRAME_H}
          rx={1}
          fill="none"
          stroke={HEADER_SWAP}
          stroke-width={0.8}
        />
      ) : null}
      <text class="glass-digits" x={x} y={y} font-size={FREQ_FONT} fill={fill}>
        {text}
      </text>
    </>
  );
}

/** The swap arrow between the standby and the active frequency of the first row of a radio. */
function SwapArrow({ x }: { readonly x: number }) {
  const mid = LINE_1 - 3.5;
  const x1 = x + SWAP_ARROW_W;
  return (
    <path
      data-swap-arrow
      d={`M ${x} ${mid} H ${x1} M ${x + 3} ${mid - 2.5} L ${x} ${mid} L ${x + 3} ${mid + 2.5} M ${x1 - 3} ${mid - 2.5} L ${x1} ${mid} L ${x1 - 3} ${mid + 2.5}`}
      fill="none"
      stroke={HEADER_SWAP}
      stroke-width={1}
    />
  );
}

/**
 * The header strip of a glass screen (Table D4): two frequency rows on each side and, on the MFD,
 * the page title in the centre. The radio name stands as stacked letters (NAV at the left, COM at
 * the right) with a small 1 beside the first and a small 2 beside the second row. In each first row
 * the outer frequency is the standby one (a thin turquoise frame) and the inner one the active one,
 * with a turquoise swap arrow between them. Static idle values (U-15), original layout. The second
 * row (NAV 2 and COM 2) follows AV MASTER (owner decision, PANEL-REVIEW.md item 15): with the
 * switch off each second row is a yellow-grey box with two crossing yellow lines (unreachable, as on
 * the real display) and the two frequencies are not drawn; the first row, the frames and the arrows
 * stay. The PFD and the MFD draw this one header. Digits use the glass font; sizes are 6 and 8.
 */
export function GlassHeader({
  title,
  secondRowLive,
}: {
  readonly title?: string;
  readonly secondRowLive: boolean;
}) {
  const { y0, y1 } = GLASS.header;
  return (
    <g data-glass-zone="header">
      <rect x={4} y={y0} width={487} height={y1 - y0} fill={HEADER_FILL} />
      <line x1={4} y1={y1} x2={491} y2={y1} stroke={HEADER_RULE} stroke-width={1} />
      {/* Left block: NAV, standby (outer, framed) and active (inner) with the swap arrow. */}
      {NAV_LETTERS.map(([letter, y]) => (
        <text key={letter} x={8} y={y} font-size={LABEL_FONT} fill={HEADER_LABEL}>
          {letter}
        </text>
      ))}
      <text x={15} y={LINE_1} font-size={LABEL_FONT} fill={HEADER_LABEL}>
        1
      </text>
      <text x={15} y={LINE_2} font-size={LABEL_FONT} fill={HEADER_LABEL}>
        2
      </text>
      <Frequency x={24} y={LINE_1} text="109.90" fill={HEADER_ACTIVE} frame />
      <SwapArrow x={64} />
      <Frequency x={84} y={LINE_1} text="111.50" fill={HEADER_ACTIVE} />
      {secondRowLive ? (
        <>
          <Frequency x={24} y={LINE_2} text="114.80" fill={HEADER_STANDBY} />
          <Frequency x={84} y={LINE_2} text="111.50" fill={HEADER_ACTIVE} />
        </>
      ) : (
        <UnreachableRow row="nav2" x0={NAV_ROW_2_X0} x1={NAV_ROW_2_X1} />
      )}
      {/* Right block: COM, active (inner) and standby (outer, framed), the digits left of the letters. */}
      {COM_LETTERS.map(([letter, y]) => (
        <text
          key={letter}
          x={487}
          y={y}
          text-anchor="end"
          font-size={LABEL_FONT}
          fill={HEADER_LABEL}
        >
          {letter}
        </text>
      ))}
      <text x={479} y={LINE_1} text-anchor="end" font-size={LABEL_FONT} fill={HEADER_LABEL}>
        1
      </text>
      <text x={479} y={LINE_2} text-anchor="end" font-size={LABEL_FONT} fill={HEADER_LABEL}>
        2
      </text>
      <Frequency x={362} y={LINE_1} text="118.100" fill={HEADER_ACTIVE} />
      <SwapArrow x={406} />
      <Frequency x={428} y={LINE_1} text="123.725" fill={HEADER_ACTIVE} frame />
      {secondRowLive ? (
        <>
          <Frequency x={362} y={LINE_2} text="121.500" fill={HEADER_ACTIVE} />
          <Frequency x={428} y={LINE_2} text="133.330" fill={HEADER_STANDBY} />
        </>
      ) : (
        <UnreachableRow row="com2" x0={COM_ROW_2_X0} x1={COM_ROW_2_X1} />
      )}
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

type Quantities = Readonly<Record<QuantityId, number>>;

/** A reading that is a finite number, else the fallback (a text node never prints NaN). */
const finiteOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

/** The reading of a gauge: its quantity when the bridge has a value, else the quantity's base. */
function readingOf(g: GaugeSpec, quantities: Quantities): number {
  return finiteOr(quantities[g.quantity], g.value);
}

/** Every quantity of the bridge, the base of the ones it has no value for. */
function withBases(quantities: Quantities): Quantities {
  return { ...DA50RG_QUANTITIES.baseValues(), ...quantities };
}

const ROW_LABEL = '#aab3bd';
const ROW_VALUE = '#ffffff';
/** Baseline of a one-line row below its top, as in the bar gauge. */
const ROW_BASELINE = 11;
/** The sub-box rows: first baseline below the box top, the pitch, the side padding. */
const SUB_ROW_TOP = 16;
const SUB_ROW_PITCH = 10;
const SUB_ROW_PAD = 5;
/** The even rows of the endurance box: room the cut-in title takes, the bottom padding, text size. */
const EVEN_TOP = 6;
const EVEN_BOTTOM = 2;
const SUB_FONT = 8;
const SUB_CAP_EM = 0.7;
/** The baseline of row i of count rows spread evenly over the height of a box below its title. */
const evenBaseline = (rect: { readonly y: number; readonly h: number }, count: number, i: number) =>
  rect.y +
  EVEN_TOP +
  ((i + 0.5) * (rect.h - EVEN_TOP - EVEN_BOTTOM)) / count +
  (SUB_CAP_EM * SUB_FONT) / 2;
/** The rudder trim scale: inset from the row ends, line and mark offsets, tick heights. */
const TRIM_INSET = 12;
const TRIM_LINE_DY = 14;
const TRIM_MARK_DY = 32;
const TRIM_TICK_H = 4;
const TRIM_TICK_CENTRE_H = 7;
/** The labelled form (map strip): caption baseline and scale line below the top, the end marks beside the line. */
const TRIM_CAPTION_DY = 7;
const TRIM_LABELLED_LINE_DY = 19;
const TRIM_MARK_GAP = 3;
/** Room for the unit text HRS at the end of the service row. */
const SERVICE_UNIT_W = 28;
/** The range where there is none (engine stopped). */
const NO_RANGE = '---';

/** The value of a quantity by id: the bridge's value, else the quantity's base (0 if unknown). */
function valueOf(quantity: QuantityId, quantities: Quantities): number {
  return finiteOr(quantities[quantity], DA50RG_QUANTITIES.get(quantity)?.base ?? 0);
}

export const SCREEN_FILL = GLASS_DARK;
const STRIP_W = 150;
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
      <GlassHeader
        title={page === 'engine' ? 'EIS - Engine' : 'Map - Navigation Map'}
        secondRowLive={glassSecondRowLive(bridge)}
      />
      <g data-glass-zone="content">
        {page === 'engine' ? (
          <EnginePage quantities={quantities} />
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
        {MAP_STRIP.map((entry) => (
          <PageEntryView key={entry.id} entry={entry} quantities={quantities} />
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

/**
 * The engine page: every box of ENGINE_PAGE (src/aircraft/da50rg/engine-page.ts) at its rectangle,
 * each gauge reading its simulated quantity. The frame holds no page coordinate.
 */
function EnginePage({ quantities }: { readonly quantities: Quantities }) {
  return (
    <g data-testid="mfd-engine-page">
      {ENGINE_PAGE.flatMap((column) => column.entries).map((entry) => (
        <PageEntryView key={entry.id} entry={entry} quantities={quantities} />
      ))}
    </g>
  );
}

function PageEntryView({
  entry,
  quantities,
}: {
  readonly entry: PageEntry;
  readonly quantities: Quantities;
}) {
  switch (entry.kind) {
    case 'arc': {
      const g = quantityGauge(entry.label, entry.quantity, entry.decimals);
      const value = readingOf(g, quantities);
      return (
        <ArcGauge
          label={g.label}
          unit={g.unit}
          value={value}
          min={g.min}
          max={g.max}
          bands={g.bands}
          decimals={g.decimals}
          tone={toneOf(DA50RG_QUANTITIES, g.quantity, value)}
          cx={entry.centre.x}
          cy={entry.centre.y}
          r={entry.radius}
        />
      );
    }
    case 'bar': {
      const g = quantityGauge(entry.label, entry.quantity, entry.decimals);
      const value = readingOf(g, quantities);
      return (
        <BarGauge
          label={g.label}
          unit={entry.unit ? g.unit : ''}
          value={value}
          min={g.min}
          max={g.max}
          bands={g.bands}
          decimals={g.decimals}
          tone={toneOf(DA50RG_QUANTITIES, g.quantity, value)}
          labelAlign="centre"
          x={entry.rect.x}
          y={entry.rect.y}
          w={entry.rect.w}
          h={entry.rect.h}
        />
      );
    }
    case 'dual': {
      // The second quantity shares the range and the band table of the first (tested).
      const g = quantityGauge(entry.label, entry.quantity, entry.decimals);
      const first = readingOf(g, quantities);
      const second = valueOf(entry.second, quantities);
      return (
        <DualGauge
          label={g.label}
          min={g.min}
          max={g.max}
          bands={g.bands}
          decimals={g.decimals}
          marks={entry.marks}
          scale={entry.scale}
          first={{ value: first, tone: toneOf(DA50RG_QUANTITIES, g.quantity, first) }}
          second={{ value: second, tone: toneOf(DA50RG_QUANTITIES, entry.second, second) }}
          x={entry.rect.x}
          y={entry.rect.y}
          w={entry.rect.w}
        />
      );
    }
    case 'frame':
      return (
        <BoxFrame
          id={entry.id}
          title={entry.title}
          x={entry.rect.x}
          y={entry.rect.y}
          w={entry.rect.w}
          h={entry.rect.h}
        >
          {entry.rows.map((row) => (
            <PageEntryView key={row.id} entry={row} quantities={quantities} />
          ))}
        </BoxFrame>
      );
    case 'flow': {
      const value = valueOf(entry.quantity, quantities);
      return (
        <g data-row={entry.id} pointer-events="none">
          <text x={entry.rect.x} y={entry.rect.y + ROW_BASELINE} font-size={10} fill={ROW_LABEL}>
            {entry.label.toUpperCase()}
          </text>
          <text
            class="glass-digits"
            data-readout={entry.id}
            x={entry.rect.x + entry.rect.w}
            y={entry.rect.y + ROW_BASELINE}
            text-anchor="end"
            font-size={10}
            fill={ROW_VALUE}
          >
            {value.toFixed(entry.decimals)}
          </text>
        </g>
      );
    }
    case 'calculator': {
      const calc = fuelCalculator(withBases(quantities));
      const values = [
        calc.remainGal.toFixed(1),
        calc.usedGal.toFixed(1),
        formatEndurance(calc.enduranceMin),
        calc.rangeNm === null ? NO_RANGE : String(Math.round(calc.rangeNm)),
      ];
      const ids = ['calc_remain', 'calc_used', 'calc_endurance', 'calc_range'];
      return (
        <BoxFrame id={entry.id} title={entry.title} {...rectProps(entry)}>
          {entry.labels.map((label, i) => (
            <SubRow
              key={label}
              id={ids[i] ?? label}
              label={label}
              value={values[i] ?? ''}
              x={entry.rect.x}
              w={entry.rect.w}
              y={entry.rect.y + SUB_ROW_TOP + i * SUB_ROW_PITCH}
            />
          ))}
        </BoxFrame>
      );
    }
    case 'endurance': {
      const found = deiceEndurance(valueOf(entry.quantity, quantities));
      const values = [formatEndurance(found.normMin), formatEndurance(found.highMin)];
      const ids = ['endurance_norm', 'endurance_high'];
      return (
        <BoxFrame id={entry.id} title={entry.title} {...rectProps(entry)}>
          {entry.labels.map((label, i) => (
            <SubRow
              key={label}
              id={ids[i] ?? label}
              label={label}
              value={values[i] ?? ''}
              x={entry.rect.x}
              w={entry.rect.w}
              y={evenBaseline(entry.rect, entry.labels.length, i)}
            />
          ))}
        </BoxFrame>
      );
    }
    case 'trim': {
      const def = DA50RG_QUANTITIES.get(entry.quantity);
      const min = def?.min ?? -100;
      const max = def?.max ?? 100;
      const value = Math.min(max, Math.max(min, valueOf(entry.quantity, quantities)));
      const scaleAt = (v: number): number =>
        entry.rect.x + TRIM_INSET + ((v - min) / (max - min)) * (entry.rect.w - 2 * TRIM_INSET);
      const labelled = entry.label !== undefined;
      const lineY = entry.rect.y + (labelled ? TRIM_LABELLED_LINE_DY : TRIM_LINE_DY);
      const markY = labelled ? lineY + 3 : entry.rect.y + TRIM_MARK_DY;
      const ticks = [min, min + (max - min) / 4, min + (max - min) / 2, max - (max - min) / 4, max];
      const pointerX = scaleAt(value);
      return (
        <g data-row={entry.id} pointer-events="none">
          <line
            x1={scaleAt(min)}
            y1={lineY}
            x2={scaleAt(max)}
            y2={lineY}
            stroke={ROW_LABEL}
            stroke-width={1.5}
          />
          {ticks.map((t, i) => (
            <line
              key={t}
              x1={scaleAt(t)}
              y1={lineY}
              x2={scaleAt(t)}
              y2={lineY + (i === 2 ? TRIM_TICK_CENTRE_H : TRIM_TICK_H)}
              stroke={ROW_LABEL}
              stroke-width={1.5}
            />
          ))}
          <path
            data-trim-pointer
            d={pointerPath(pointerX, lineY + 1, 'above')}
            fill={ROW_VALUE}
            stroke={GLASS_DARK}
            stroke-width={POINTER_OUTLINE}
          />
          {entry.label === undefined ? null : (
            <text
              data-trim-caption
              x={entry.rect.x + entry.rect.w / 2}
              y={entry.rect.y + TRIM_CAPTION_DY}
              text-anchor="middle"
              font-size={8}
              fill={ROW_LABEL}
            >
              {entry.label.toUpperCase()}
            </text>
          )}
          <text
            x={labelled ? scaleAt(min) - TRIM_MARK_GAP : scaleAt(min)}
            y={markY}
            text-anchor={labelled ? 'end' : 'middle'}
            font-size={8}
            fill={ROW_LABEL}
          >
            {entry.marks[0]}
          </text>
          <text
            x={labelled ? scaleAt(max) + TRIM_MARK_GAP : scaleAt(max)}
            y={markY}
            text-anchor={labelled ? 'start' : 'middle'}
            font-size={8}
            fill={ROW_LABEL}
          >
            {entry.marks[1]}
          </text>
        </g>
      );
    }
    case 'service': {
      const value = valueOf(entry.quantity, quantities);
      return (
        <g data-row={entry.id} pointer-events="none">
          <text
            class="glass-digits"
            data-readout={entry.id}
            x={entry.rect.x + entry.rect.w - SERVICE_UNIT_W}
            y={entry.rect.y + ROW_BASELINE}
            text-anchor="end"
            font-size={10}
            fill={ROW_VALUE}
          >
            {value.toFixed(entry.decimals)}
          </text>
          <text
            x={entry.rect.x + entry.rect.w}
            y={entry.rect.y + ROW_BASELINE}
            text-anchor="end"
            font-size={10}
            fill={ROW_LABEL}
          >
            {entry.unit}
          </text>
        </g>
      );
    }
  }
}

const rectProps = (entry: PageEntry) => ({
  x: entry.rect.x,
  y: entry.rect.y,
  w: entry.rect.w,
  h: entry.rect.h,
});

/** One row of a sub-box (calculator, endurance): the static label at the left, the number at the right. */
function SubRow({
  id,
  label,
  value,
  x,
  w,
  y,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly x: number;
  readonly w: number;
  readonly y: number;
}) {
  return (
    <g data-row={id} pointer-events="none">
      <text x={x + SUB_ROW_PAD} y={y} font-size={SUB_FONT} fill={ROW_LABEL}>
        {label}
      </text>
      <text
        class="glass-digits"
        data-readout={id}
        x={x + w - SUB_ROW_PAD}
        y={y}
        text-anchor="end"
        font-size={SUB_FONT}
        fill={ROW_VALUE}
      >
        {value}
      </text>
    </g>
  );
}
