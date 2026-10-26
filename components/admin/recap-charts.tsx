"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DepartmentStat, HistBin, RecapStats } from "@/lib/scoring/recap";

type Explanations = {
  personalHist: string;
  skillHist: string;
  components: string;
  subNilai: string;
  skillCategories: string;
  attendance: string;
  departments: string;
};

const histConfig = {
  layak: { label: "Layak diagregasi", color: "var(--chart-2)" },
  tidakLayak: { label: "Tidak layak", color: "var(--destructive)" },
} satisfies ChartConfig;

const meanConfig = { mean: { label: "Rata-rata", color: "var(--chart-1)" } } satisfies ChartConfig;

const skillConfig = {
  mean: { label: "Nilai kategori", color: "var(--chart-1)" },
  mentorMean: { label: "Evaluasi mentor", color: "var(--chart-5)" },
} satisfies ChartConfig;

const attendanceConfig = { hadirPct: { label: "% Hadir", color: "var(--chart-2)" } } satisfies ChartConfig;

const deptConfig = {
  personalMean: { label: "Nilai Personal", color: "var(--chart-1)" },
  skillMean: { label: "Nilai Keahlian", color: "var(--chart-3)" },
} satisfies ChartConfig;

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Histogram({ data }: { data: HistBin[] }) {
  return (
    <ChartContainer config={histConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ top: 16, left: -16, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bin" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-30} textAnchor="end" height={40} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={10} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="layak" stackId="a" fill="var(--color-layak)" />
        <Bar dataKey="tidakLayak" stackId="a" fill="var(--color-tidakLayak)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function HorizontalMeans<T extends Record<string, unknown>>({
  data,
  config,
  keys,
  labelKey = "label",
  domainMax = 100,
}: {
  data: T[];
  config: ChartConfig;
  keys: string[];
  labelKey?: string;
  domainMax?: number;
}) {
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * keys.length * 26 + 40) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, domainMax]} tickLine={false} axisLine={false} fontSize={10} />
        <YAxis type="category" dataKey={labelKey} tickLine={false} axisLine={false} width={130} fontSize={10} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {keys.map((k) => (
          <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={3}>
            <LabelList dataKey={k} position="right" fontSize={10} className="fill-foreground" />
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function RecapCharts({
  stats,
  departments,
  explanations,
}: {
  stats: RecapStats;
  departments: DepartmentStat[] | null;
  explanations: Explanations;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Sebaran Nilai Personal" description={explanations.personalHist}>
        <Histogram data={stats.personalHist} />
      </ChartCard>
      <ChartCard title="Sebaran Nilai Keahlian" description={explanations.skillHist}>
        <Histogram data={stats.skillHist} />
      </ChartCard>
      <ChartCard title="Komponen Nilai Personal" description={explanations.components}>
        <HorizontalMeans data={stats.components} config={meanConfig} keys={["mean"]} />
      </ChartCard>
      <ChartCard title="Sub-Nilai Penilaian Materi" description={explanations.subNilai}>
        <HorizontalMeans data={stats.subNilai} config={meanConfig} keys={["mean"]} />
      </ChartCard>
      <ChartCard title="Kategori Nilai Keahlian" description={explanations.skillCategories}>
        <HorizontalMeans data={stats.skillCategories} config={skillConfig} keys={["mean", "mentorMean"]} />
        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground sm:grid-cols-4">
          {stats.skillCategories.map((c) => (
            <span key={c.code}>
              {c.label}: {c.participationPct ?? 0}% ikut kegiatan
            </span>
          ))}
        </div>
      </ChartCard>
      <ChartCard title="Tingkat Kehadiran Kegiatan Wajib" description={explanations.attendance}>
        <HorizontalMeans data={stats.attendance} config={attendanceConfig} keys={["hadirPct"]} />
      </ChartCard>
      {departments ? (
        <div className="lg:col-span-2">
          <ChartCard title="Perbandingan Antar Departemen" description={explanations.departments}>
            <ChartContainer config={deptConfig} className="aspect-auto h-72 w-full">
              <BarChart data={departments} margin={{ top: 20, left: -16, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="personalMean" fill="var(--color-personalMean)" radius={3}>
                  <LabelList dataKey="personalMean" position="top" fontSize={10} className="fill-foreground" />
                </Bar>
                <Bar dataKey="skillMean" fill="var(--color-skillMean)" radius={3}>
                  <LabelList dataKey="skillMean" position="top" fontSize={10} className="fill-foreground" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </div>
      ) : null}
    </div>
  );
}
