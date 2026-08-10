"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The chart system.
 *
 * Every chart on every dashboard goes through `ChartFigure`, which is what
 * makes them read as one system rather than eight separately-styled plots. It
 * also enforces three rules centrally instead of hoping each caller remembers:
 *
 *  - **Empty is not zero.** A chart with no underlying records renders an
 *    explicit empty state, never an axis with a flat line at zero. This is the
 *    same discipline the rest of the codebase applies to "configured: false"
 *    versus "count: 0", carried into the visual layer.
 *  - **A table view always exists.** Four of the eight categorical slots sit
 *    below 3:1 contrast on this site's paper surface, which obligates a
 *    non-color path to the same numbers.
 *  - **A legend appears for two or more series, never for one** — with one
 *    series the heading already names it, so a legend would be noise.
 */

export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

export const ORDINAL_COLORS = [
  "var(--ordinal-1)",
  "var(--ordinal-2)",
  "var(--ordinal-3)",
  "var(--ordinal-4)",
  "var(--ordinal-5)",
] as const;

export type Series = { key: string; label: string; color?: string };

const numberFormat = new Intl.NumberFormat("en-US");

function formatValue(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? numberFormat.format(value) : value.toFixed(2);
}

/**
 * Assigns a categorical hue by the series' fixed position.
 *
 * Slots are assigned by index into the declared series list and never cycled:
 * a ninth series would silently repaint as slot 1 and two different entities
 * would share a color, so callers must fold beyond eight into "Other" instead.
 */
function colorFor(series: Series, index: number): string {
  if (series.color) return series.color;
  if (index >= SERIES_COLORS.length) {
    throw new Error(
      `Chart series "${series.key}" exceeds the eight categorical slots. Fold the tail into an "Other" series or facet the chart instead of cycling hues.`,
    );
  }
  return SERIES_COLORS[index];
}

type ChartFigureProps = {
  title: string;
  description?: string;
  series: readonly Series[];
  rows: readonly Record<string, unknown>[];
  xKey: string;
  xLabel: string;
  /** Shown instead of the plot when there is genuinely nothing recorded yet. */
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
};

export function ChartFigure({
  title,
  description,
  series,
  rows,
  xKey,
  xLabel,
  emptyTitle,
  emptyBody,
  children,
}: ChartFigureProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const isEmpty = rows.length === 0;

  return (
    <figure className="chart-figure">
      <header>
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {!isEmpty && (
          <button
            type="button"
            className="chart-toggle"
            aria-pressed={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? "CHART" : "TABLE"}
          </button>
        )}
      </header>

      {series.length > 1 && !isEmpty && (
        <div className="chart-legend">
          {series.map((entry, index) => (
            <span key={entry.key} style={{ color: colorFor(entry, index) }}>
              <i />
              <span style={{ color: "var(--muted)" }}>{entry.label}</span>
            </span>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="chart-empty">
          <strong>{emptyTitle}</strong>
          <span>{emptyBody}</span>
        </div>
      ) : showTable ? (
        <div className="chart-table-wrap" id={tableId}>
          <table className="chart-table">
            <thead>
              <tr>
                <th scope="col">{xLabel}</th>
                {series.map((entry) => (
                  <th scope="col" key={entry.key}>
                    {entry.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">{String(row[xKey] ?? "")}</th>
                  {series.map((entry) => (
                    <td key={entry.key}>{formatValue(row[entry.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-body">{children}</div>
      )}
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: unknown; color?: string; dataKey?: string }[];
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <b>{String(label ?? "")}</b>
      {payload.map((entry) => (
        <span key={entry.dataKey ?? entry.name}>
          <i style={{ background: entry.color }} />
          {entry.name}: <strong>{formatValue(entry.value)}</strong>
        </span>
      ))}
    </div>
  );
}

const axisStyle = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fill: "var(--chart-ink-muted)",
} as const;

const sharedAxes = (
  <>
    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" vertical={false} />
  </>
);

/* ------------------------------------------------------------------ *
 * Forms
 * ------------------------------------------------------------------ */

/**
 * Change over time.
 *
 * A single y-axis, always — two measures on different scales get two charts or
 * an indexed common base, never a second axis, because a dual-axis plot lets
 * the author choose where the lines cross.
 */
export function TrendChart({
  rows,
  xKey,
  series,
  height = 240,
  area = false,
}: {
  rows: readonly Record<string, unknown>[];
  xKey: string;
  series: readonly Series[];
  height?: number;
  area?: boolean;
}) {
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={rows as Record<string, unknown>[]} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        {sharedAxes}
        <XAxis
          dataKey={xKey}
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          minTickGap={24}
        />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
        {series.map((entry, index) =>
          area ? (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={colorFor(entry, index)}
              fill={colorFor(entry, index)}
              fillOpacity={0.12}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--white)" }}
            />
          ) : (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={colorFor(entry, index)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--white)" }}
            />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Magnitude comparison across categories. */
export function BarSeriesChart({
  rows,
  xKey,
  series,
  height = 240,
  stacked = false,
}: {
  rows: readonly Record<string, unknown>[];
  xKey: string;
  series: readonly Series[];
  height?: number;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows as Record<string, unknown>[]} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        {sharedAxes}
        <XAxis
          dataKey={xKey}
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          minTickGap={16}
        />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(20 35 29 / .04)" }} />
        {series.map((entry, index) => (
          <Bar
            key={entry.key}
            dataKey={entry.key}
            name={entry.label}
            fill={colorFor(entry, index)}
            stackId={stacked ? "stack" : undefined}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            // A 2px surface-coloured gap keeps adjacent and stacked fills from
            // reading as one continuous mass.
            stroke="var(--white)"
            strokeWidth={2}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * A funnel, drawn as horizontal ordinal bars with the conversion rate labelled
 * on each step.
 *
 * Deliberately not a tapering "funnel" polygon: the classic funnel shape
 * encodes each stage as an *area*, which readers systematically misjudge, and
 * its width at the neck is not proportional to anything. Bars on a shared
 * baseline compare by length, which is the one visual channel people read
 * accurately.
 */
export function FunnelChart({
  stages,
  height = 220,
}: {
  stages: readonly { label: string; count: number; conversionFromPrevious: number | null }[];
  height?: number;
}) {
  const rows = stages.map((stage) => ({
    label: stage.label,
    count: stage.count,
    conversion: stage.conversionFromPrevious,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          width={92}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(20 35 29 / .04)" }} />
        <Bar dataKey="count" name="Records" radius={[0, 4, 4, 0]} maxBarSize={26} stroke="var(--white)" strokeWidth={2}>
          {rows.map((row, index) => (
            <Cell key={row.label} fill={ORDINAL_COLORS[Math.min(index, ORDINAL_COLORS.length - 1)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ *
 * Non-chart forms
 * ------------------------------------------------------------------ */

/**
 * A single number.
 *
 * Sometimes the right visualization is not a chart. A lone total, a rate, or a
 * ratio is read faster as large type than as a one-bar plot.
 *
 * `value` accepts null to mean "not measured yet", which renders as an em dash
 * — never as 0, which would read as a measured zero.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number | null;
  hint?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const toneColor =
    tone === "good"
      ? "var(--status-good)"
      : tone === "warning"
        ? "var(--status-warning)"
        : tone === "critical"
          ? "var(--status-critical)"
          : "var(--ink)";

  return (
    <article className="stat-tile">
      <span>{label}</span>
      <strong style={{ color: toneColor }}>
        {value === null ? "—" : typeof value === "number" ? formatValue(value) : value}
      </strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

/** A labelled proportion bar — for "X of Y" progress against a known target. */
export function MeterBar({
  label,
  value,
  target,
  formatter = (input: number) => numberFormat.format(input),
}: {
  label: string;
  value: number;
  target: number;
  formatter?: (value: number) => string;
}) {
  const share = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <div className="meter-row">
      <div className="meter-head">
        <span>{label}</span>
        <strong>
          {formatter(value)} <em>/ {formatter(target)}</em>
        </strong>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={label}
      >
        <i style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
