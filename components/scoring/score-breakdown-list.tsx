"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ComputedScores, ItemOrigin, WeightedItem, PersonalComponent } from "@/lib/scoring/calculate";
import type { AttendanceSection } from "@/lib/scoring/attendance-summary";

const ORIGIN_LABELS: Record<ItemOrigin, string> = {
  MENTOR: "mentor",
  IMPORT: "impor",
  KELOMPOK: "kelompok",
  KOSONG: "belum diisi = 0",
  KEAKTIFAN: "keaktifan sesi",
  KEHADIRAN: "kehadiran",
};

const fmt = (v: number | null) => (v !== null ? v.toFixed(1) : "—");

/** A score card whose details (where the number came from) open on click. */
function ExpandableCard({
  title,
  subtitle,
  score,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  score: number | null;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-lg border", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {subtitle ? <span className="block text-[10px] text-muted-foreground">{subtitle}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm font-bold tabular-nums">{fmt(score)}</span>
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? <div className="space-y-2 border-t px-3 py-2">{children}</div> : null}
    </div>
  );
}

function ItemList({ items }: { items: WeightedItem[] }) {
  if (items.length === 0) return <p className="text-[11px] text-muted-foreground">Belum ada nilai yang masuk.</p>;
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={`${item.refCode}-${i}`} className="flex items-start justify-between gap-2 text-[11px]">
          <span className="min-w-0">
            <span className="block truncate">{item.label}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {item.source} · {ORIGIN_LABELS[item.origin]}
            </span>
          </span>
          <span className={cn("shrink-0 tabular-nums", item.origin === "KOSONG" && "text-destructive")}>
            {item.rawValue}/{item.maxValue} → {item.normalizedValue.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_VARIANT = { HADIR: "default", IZIN: "secondary", ALPA: "destructive" } as const;

function SessionStatusList({ section }: { section: AttendanceSection }) {
  if (section.entries.length === 0) return <p className="text-[11px] text-muted-foreground">Belum ada data kehadiran.</p>;
  return (
    <div className="space-y-1">
      {section.entries.map((e) => (
        <div key={e.sessionId} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="min-w-0 truncate">
            {e.sessionName}
            {e.derivedFromScores ? <span className="text-[10px] text-muted-foreground"> (dari nilai kuis)</span> : null}
          </span>
          {e.status ? (
            <Badge variant={STATUS_VARIANT[e.status]} className="text-[10px]">
              {e.status}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">belum terlaksana</span>
          )}
        </div>
      ))}
    </div>
  );
}

function pct(weight: number) {
  return `${Math.round(weight * 100)}%`;
}

function componentSubtitle(c: PersonalComponent) {
  return c.score === null ? `bobot ${pct(c.weight)} · belum ada data` : `bobot ${pct(c.effectiveWeight)} dari Nilai Personal`;
}

export function ScoreBreakdownList({ computed }: { computed: ComputedScores }) {
  const { personal, skill, attendance } = computed;
  const sectionFor = (code: string) => attendance.find((s) => s.category === code);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai Personal — klik untuk rincian</p>
        {personal.components.map((c) => {
          if (c.code === "MATERI") {
            return (
              <ExpandableCard key={c.code} title={c.label} subtitle={componentSubtitle(c)} score={c.score}>
                <p className="text-[10px] text-muted-foreground">
                  Nilai rubrik mentor & kuis per materi, dikelompokkan ke Kolektif / Kolaborasi / Kontribusi.
                </p>
                {personal.groups.map((group) => (
                  <div key={group.code} className="space-y-1.5 rounded-md bg-muted/40 p-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{group.label}</span>
                      <span className="tabular-nums">{fmt(group.score)}</span>
                    </div>
                    {group.subNilai.map((sub) => (
                      <ExpandableCard
                        key={sub.code}
                        title={`${sub.code} ${sub.label}`}
                        subtitle={`bobot ${sub.weight}`}
                        score={sub.score}
                        className="bg-background"
                      >
                        <ItemList items={personal.items.filter((item) => item.targets.includes(sub.code))} />
                      </ExpandableCard>
                    ))}
                  </div>
                ))}
              </ExpandableCard>
            );
          }
          const section = sectionFor(c.code);
          return (
            <ExpandableCard key={c.code} title={c.label} subtitle={componentSubtitle(c)} score={c.score}>
              <p className="text-[10px] text-muted-foreground">HADIR = 100, IZIN = 50, ALPA = 0 — rata-rata sesi yang sudah terlaksana.</p>
              {section ? <SessionStatusList section={section} /> : null}
            </ExpandableCard>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai Keahlian — klik untuk rincian</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {skill.categories.map((cat) => (
            <ExpandableCard
              key={cat.code}
              title={cat.label}
              subtitle={
                cat.activities.length > 0
                  ? `${cat.activities.length} kegiatan keahlian diikuti`
                  : cat.activityScore === 0
                    ? "belum ikut kegiatan keahlian"
                    : "evaluasi mentor"
              }
              score={cat.score}
            >
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span>Evaluasi mentor</span>
                <span className="tabular-nums">{fmt(cat.mentorScore)}</span>
              </div>
              <ItemList items={skill.items.filter((item) => item.targets.includes(cat.code))} />
              <div className="flex items-center justify-between border-t pt-2 text-[11px] font-medium">
                <span>Kegiatan keahlian</span>
                <span className="tabular-nums">{fmt(cat.activityScore)}</span>
              </div>
              {cat.activities.length > 0 ? (
                <ul className="list-disc pl-4 text-[11px]">
                  {cat.activities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {cat.activityScore === 0
                    ? "Belum mengikuti kegiatan keahlian kategori ini — porsi kegiatan bernilai 0. Ikut minimal 1 kegiatan untuk mendapat porsi penuh."
                    : "Belum ada kegiatan keahlian kategori ini — sementara nilai hanya dari evaluasi mentor."}
                </p>
              )}
            </ExpandableCard>
          ))}
        </div>
      </div>
    </div>
  );
}
