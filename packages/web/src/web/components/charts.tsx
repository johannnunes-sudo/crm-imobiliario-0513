import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart, Cell, Pie, PieChart,
} from "recharts";

const axis = { fontSize: 11.5, fill: "#9aa09b" };

function Tip({ active, payload, label, format }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-[12px] shadow-md">
      {label && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="tnum font-medium text-foreground">{format ? format(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export type SeriesDef = { key: string; name: string; color: string };

export function Bars({ data, series, height = 240, format, stacked, layout = "horizontal", onBarClick }: { data: Record<string, any>[]; series: SeriesDef[]; height?: number; format?: (v: number) => string; stacked?: boolean; layout?: "horizontal" | "vertical"; onBarClick?: (label: string) => void }) {
  if (layout === "vertical")
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" barCategoryGap="24%" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#ececE6" />
          <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={format} />
          <YAxis type="category" dataKey="label" tick={axis} axisLine={false} tickLine={false} width={112} />
          <Tooltip cursor={{ fill: "rgba(31,58,46,0.04)" }} content={<Tip format={format} />} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? "s" : undefined} radius={stacked ? (i === series.length - 1 ? [0, 3, 3, 0] : 0) : [0, 3, 3, 0]} maxBarSize={18} cursor={onBarClick ? "pointer" : undefined} onClick={onBarClick ? (d: any) => onBarClick(d.label) : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={4} barCategoryGap="28%" margin={{ top: 8, right: 8, left: format ? 0 : -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#ececE6" />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={format} width={format ? 64 : 40} />
        <Tooltip cursor={{ fill: "rgba(31,58,46,0.04)" }} content={<Tip format={format} />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? "s" : undefined} radius={stacked ? 0 : [3, 3, 0, 0]} maxBarSize={stacked ? 34 : 26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, series, height = 240, format }: { data: Record<string, any>[]; series: SeriesDef[]; height?: number; format?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#ececE6" />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={format} width={format ? 64 : 40} />
        <Tooltip content={<Tip format={format} />} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.25} dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({ data, series, height = 240, format }: { data: Record<string, any>[]; series: SeriesDef[]; height?: number; format?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: format ? 0 : -18, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="#ececE6" />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={format} width={format ? 64 : 40} />
        <Tooltip content={<Tip format={format} />} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 180, center }: { data: { name: string; value: number; color: string }[]; height?: number; center?: React.ReactNode }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={1.5} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{center}</div>}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="size-2 rounded-[2px]" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

export const PALETTE = ["#5FAE3A", "#1F3A2E", "#A9D18E", "#C98A1B", "#6B8F7E", "#D9DDD5"];
