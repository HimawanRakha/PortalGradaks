"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeightedItem, NilaiGroup, SkillCategory } from "@/lib/scoring/calculate";

function ScoreRow({ label, weight, score }: { label: string; weight?: number; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">
        {label}
        {weight !== undefined ? <span className="ml-1 text-[10px] opacity-60">(bobot {weight})</span> : null}
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{score !== null ? score.toFixed(1) : "—"}</span>
    </div>
  );
}

function NilaiGroupCard({ group }: { group: NilaiGroup }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{group.label}</p>
        <p className="text-sm font-bold tabular-nums">{group.score !== null ? group.score.toFixed(1) : "—"}</p>
      </div>
      <div className="space-y-1 border-t pt-2">
        {group.subNilai.map((sub) => (
          <ScoreRow key={sub.code} label={sub.label} weight={sub.weight} score={sub.score} />
        ))}
      </div>
    </div>
  );
}

function SkillCategoryGrid({ categories }: { categories: SkillCategory[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {categories.map((cat) => (
        <div key={cat.code} className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">{cat.label}</p>
          <p className="text-lg font-semibold tabular-nums">{cat.score !== null ? cat.score.toFixed(1) : "—"}</p>
        </div>
      ))}
    </div>
  );
}

function RawItemsDisclosure({ title, items }: { title: string; items: WeightedItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
      >
        Rincian mentah {title} ({items.length} entri)
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-1 border-t px-3 py-2">
          {items.map((item, i) => (
            <div key={`${item.refCode}-${i}`} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
              <span className="shrink-0 tabular-nums">
                {item.rawValue}/{item.maxValue} · bobot {item.weight} → {item.normalizedValue.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ScoreBreakdownList({
  personalGroups,
  skillCategories,
  personalItems,
  skillItems,
}: {
  personalGroups: NilaiGroup[];
  skillCategories: SkillCategory[];
  personalItems: WeightedItem[];
  skillItems: WeightedItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai Personal — Kolektif / Kolaborasi / Kontribusi</p>
        {personalGroups.map((group) => (
          <NilaiGroupCard key={group.code} group={group} />
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai Keahlian</p>
        <SkillCategoryGrid categories={skillCategories} />
      </div>
      <div className="space-y-2">
        <RawItemsDisclosure title="Nilai Personal" items={personalItems} />
        <RawItemsDisclosure title="Nilai Keahlian" items={skillItems} />
      </div>
    </div>
  );
}
