"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RubricValuePicker } from "./rubric-value-picker";
import { saveUnitEventScoresAction } from "@/app/(dashboard)/mentor/actions";

type Parameter = { id: string; subCode: string; name: string; maxValue: number; rubricAnchors: unknown; clusterLabel: string | null; order: number };
type Material = { id: string; name: string; parameters: Parameter[] };

/**
 * One shared set of values per UNIT (not per student) — the Inclenation
 * event categories (Teraktif/Terdisiplin/Pelanggaran). Structurally a
 * GroupCard twin minus the membership concept. Unlike GroupCard's clusters,
 * clusterLabel here is ONLY a visual section heading — every parameter still
 * gets its own independent RubricValuePicker (Terdisiplin's 6 criteria must
 * not share one fanned-out value the way a material's rubric cluster does).
 */
function UnitEventMaterialCard({ unitId, material, initialValues }: { unitId: string; material: Material; initialValues: Record<string, number | null> }) {
  const initial: Record<string, number | null> = {};
  for (const p of material.parameters) initial[p.id] = initialValues[p.id] ?? null;

  const [values, setValues] = useState<Record<string, number | null>>(initial);
  const [pending, startTransition] = useTransition();

  const sections: Array<{ label: string | null; parameters: Parameter[] }> = [];
  for (const p of material.parameters) {
    const last = sections[sections.length - 1];
    if (last && last.label === p.clusterLabel) last.parameters.push(p);
    else sections.push({ label: p.clusterLabel, parameters: [p] });
  }

  function update(parameterId: string, value: number | null) {
    setValues((prev) => ({ ...prev, [parameterId]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveUnitEventScoresAction(unitId, values);
      if (result.ok) toast.success(`Nilai ${material.name} tersimpan.`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{material.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section, i) => (
          <div key={i} className="space-y-2">
            {section.label ? <p className="text-xs font-semibold text-muted-foreground">{section.label}</p> : null}
            {section.parameters.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm">
                  {p.name} <span className="text-xs font-normal text-muted-foreground">(rentang 0–{p.maxValue})</span>
                </p>
                <RubricValuePicker value={values[p.id] ?? null} onChange={(v) => update(p.id, v)} maxValue={p.maxValue} anchors={p.rubricAnchors as Record<string, string> | null} />
              </div>
            ))}
          </div>
        ))}
        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan {material.name}
        </Button>
      </CardContent>
    </Card>
  );
}

export function UnitEventScoringSection({ unitId, materials, initialValues }: { unitId: string; materials: Material[]; initialValues: Record<string, number | null> }) {
  if (materials.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Penilaian Event Inclenation (Unit)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Nilai di bawah ini berlaku untuk seluruh unit, bukan per-maba — dipakai untuk penentuan juara Terbaik/Terdisiplin. Rentang nilai yang diizinkan tertera di samping setiap kriteria; kosongkan (atau isi 0) jika belum berlaku/belum
        terjadi.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {materials.map((material) => (
          <UnitEventMaterialCard key={material.id} unitId={unitId} material={material} initialValues={initialValues} />
        ))}
      </div>
    </div>
  );
}
