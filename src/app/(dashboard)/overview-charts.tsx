"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Recessive axes/grid; text in text tokens, never series colour (dataviz non-negotiables).
const axis = { stroke: "var(--text-muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
  },
  labelStyle: { color: "var(--text-muted)" },
  itemStyle: { color: "var(--text)" },
  cursor: { stroke: "var(--border)", fill: "var(--surface-2)" },
};

export function LeadsPerDay({ data }: { data: { day: string; leads: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label="Leads per day, last 30 days">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => d.slice(8)} interval={4} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => `${d} (IST)`} />
          <Line
            type="monotone"
            dataKey="leads"
            name="Leads"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadsByCampaign({ data }: { data: { campaign: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-text-muted">No campaigns yet.</p>;
  return (
    <div
      style={{ height: Math.max(120, data.length * 36) }}
      role="img"
      aria-label="Leads by campaign, last 30 days"
    >
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="campaign" {...axis} width={120} />
          <Tooltip {...tooltipStyle} />
          <Bar
            dataKey="count"
            name="Leads"
            fill="var(--text-muted)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: "right", fill: "var(--text)", fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
