"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { AlertTriangle, Info, Lightbulb, ThumbsUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { BesarSessionStat, Insight, PredicatePie } from "@/lib/scoring/recap";

const PREDICATE_COLORS: Record<string, string> = {
  "Sangat Baik": "var(--chart-4)",
  Baik: "var(--chart-2)",
  Cukup: "var(--chart-3)",
  Kurang: "var(--destructive)",
};
const predicateConfig = Object.fromEntries(
  Object.entries(PREDICATE_COLORS).map(([k, color]) => [k, { label: k, color }]),
) satisfies ChartConfig;

const ATTENDANCE_COLORS = { Hadir: "var(--chart-2)", Izin: "var(--chart-3)", Alpa: "var(--destructive)" };
const attendanceConfig = Object.fromEntries(
  Object.entries(ATTENDANCE_COLORS).map(([k, color]) => [k, { label: k, color }]),
) satisfies ChartConfig;

function Donut({
  data,
  colors,
  config,
  centerValue,
  centerLabel,
}: {
  data: Array<{ name: string; value: number }>;
  colors: Record<string, string>;
  config: ChartConfig;
  centerValue: string;
  centerLabel: string;
}) {
  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-36">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={colors[d.name]} />
          ))}
          <Label
            content={({ viewBox }) =>
              viewBox && "cx" in viewBox && "cy" in viewBox ? (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-base font-semibold">
                    {centerValue}
                  </tspan>
                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 15} className="fill-muted-foreground text-[9px]">
                    {centerLabel}
                  </tspan>
                </text>
              ) : null
            }
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function Legend({ items, colors }: { items: Array<{ name: string; pct: number }>; colors: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: colors[i.name] }} />
          <span className="truncate text-muted-foreground">{i.name}</span>
          <span className="ml-auto font-medium tabular-nums">{i.pct}%</span>
        </span>
      ))}
    </div>
  );
}

export function PredicatePieGrid({ title, description, pies }: { title: string; description: string; pies: PredicatePie[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pies.map((p) => (
          <div key={p.code} className={cn("space-y-2 rounded-lg border p-3", p.lowPct >= 25 && "border-destructive/40")}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold">{p.label}</p>
              {p.lowPct >= 25 ? (
                <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">perlu perhatian</span>
              ) : null}
            </div>
            {p.n === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">Belum ada data</p>
            ) : (
              <>
                <Donut
                  data={p.slices}
                  colors={PREDICATE_COLORS}
                  config={predicateConfig}
                  centerValue={p.mean !== null ? p.mean.toFixed(1) : "—"}
                  centerLabel="rata-rata"
                />
                <Legend items={p.slices} colors={PREDICATE_COLORS} />
                <p className="text-[10px] text-muted-foreground">
                  {p.lowPct}% Cukup/Kurang · n = {p.n}
                </p>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BesarPieGrid({ description, sessions }: { description: string; sessions: BesarSessionStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Kehadiran per Kegiatan Besar</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => {
          const total = s.hadir + s.izin + s.alpa;
          const pct = (v: number) => (total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0);
          const slices = [
            { name: "Hadir", value: s.hadir, pct: pct(s.hadir) },
            { name: "Izin", value: s.izin, pct: pct(s.izin) },
            { name: "Alpa", value: s.alpa, pct: pct(s.alpa) },
          ];
          return (
            <div key={s.code} className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold">{s.name}</p>
              {!s.held ? (
                <p className="py-10 text-center text-xs text-muted-foreground">Belum terlaksana / belum diimpor</p>
              ) : (
                <>
                  <Donut
                    data={slices}
                    colors={ATTENDANCE_COLORS}
                    config={attendanceConfig}
                    centerValue={`${s.hadirPct}%`}
                    centerLabel="hadir"
                  />
                  <Legend items={slices} colors={ATTENDANCE_COLORS} />
                  <p className="text-[10px] text-muted-foreground">
                    {s.hadir} hadir · {s.izin} izin · {s.alpa} alpa
                  </p>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const TONE = {
  warning: { icon: AlertTriangle, className: "border-destructive/40 bg-destructive/5", iconClass: "text-destructive" },
  info: { icon: Info, className: "border-amber-500/40 bg-amber-500/5", iconClass: "text-amber-600 dark:text-amber-400" },
  positive: { icon: ThumbsUp, className: "border-emerald-600/40 bg-emerald-600/5", iconClass: "text-emerald-600" },
} as const;

export function InsightList({ description, insights }: { description: string; insights: Insight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Lightbulb className="size-4 text-primary" />
          Insight & Rekomendasi
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {insights.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada data yang cukup untuk insight.</p> : null}
        {insights.map((ins, i) => {
          const tone = TONE[ins.tone];
          const Icon = tone.icon;
          return (
            <div key={i} className={cn("space-y-1.5 rounded-lg border p-3", tone.className)}>
              <p className="flex items-start gap-1.5 text-sm font-semibold">
                <Icon className={cn("mt-0.5 size-4 shrink-0", tone.iconClass)} />
                {ins.title}
              </p>
              <p className="text-xs text-muted-foreground">{ins.detail}</p>
              {ins.recommendation ? (
                <p className="rounded-md bg-background/70 p-2 text-xs">
                  <span className="font-semibold">Rekomendasi: </span>
                  {ins.recommendation}
                </p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
