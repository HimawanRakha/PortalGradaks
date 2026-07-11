"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeightedItem } from "@/lib/scoring/calculate";

function BucketList({ title, items }: { title: string; items: WeightedItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
      >
        Rincian {title} ({items.length} komponen)
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

export function ScoreBreakdownList({ personal, skill }: { personal: WeightedItem[]; skill: WeightedItem[] }) {
  return (
    <div className="space-y-2">
      <BucketList title="Nilai Personal" items={personal} />
      <BucketList title="Nilai Keahlian" items={skill} />
    </div>
  );
}
