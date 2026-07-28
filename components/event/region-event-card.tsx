"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Users2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { saveTerkompakAction, saveThroneBattleAction } from "@/app/(dashboard)/event/actions";

type TerkompakParam = { id: string; subCode: string; name: string };
type Unit = { id: string; code: string; name: string };

export function RegionEventCard({
  region,
  units,
  terkompakParams,
  throneParam,
  initialTerkompakValues,
  initialThroneValues,
}: {
  region: { id: string; code: string; name: string };
  units: Unit[];
  terkompakParams: TerkompakParam[];
  throneParam: { id: string; name: string };
  initialTerkompakValues: Record<string, number | null>;
  initialThroneValues: Record<string, number | null>;
}) {
  const [terkompak, setTerkompak] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of terkompakParams) init[p.id] = (initialTerkompakValues[p.id] ?? 0) > 0;
    return init;
  });
  const [throne, setThrone] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const u of units) init[u.id] = (initialThroneValues[u.id] ?? 0) > 0;
    return init;
  });
  const [savingTerkompak, startTerkompakSave] = useTransition();
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);

  const raw = Object.values(terkompak).filter(Boolean).length;
  const score = terkompakParams.length > 0 && raw === terkompakParams.length ? raw * 2 : raw;

  function saveTerkompak() {
    startTerkompakSave(async () => {
      const values = Object.fromEntries(terkompakParams.map((p) => [p.id, terkompak[p.id] ? 1 : 0]));
      const result = await saveTerkompakAction(region.id, values);
      if (result.ok) toast.success(`Nilai Terkompak ${region.name} tersimpan.`);
      else toast.error(result.error);
    });
  }

  function toggleThrone(unitId: string, checked: boolean) {
    setThrone((prev) => ({ ...prev, [unitId]: checked }));
    setSavingUnitId(unitId);
    saveThroneBattleAction(unitId, throneParam.id, checked ? 1 : 0)
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error);
          setThrone((prev) => ({ ...prev, [unitId]: !checked }));
        }
      })
      .finally(() => setSavingUnitId(null));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{region.name}</CardTitle>
        <CardDescription className="font-mono text-[11px]">{region.code}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Users2 className="size-3.5" /> Terkompak
            </p>
            <Badge variant={score >= terkompakParams.length ? "default" : "secondary"}>Nilai: {score}</Badge>
          </div>
          <div className="space-y-1.5 rounded-lg border p-2.5">
            {terkompakParams.map((p) => (
              <label key={p.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={terkompak[p.id]}
                  onCheckedChange={(v) => setTerkompak((prev) => ({ ...prev, [p.id]: !!v }))}
                />
                {p.name}
              </label>
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={saveTerkompak} disabled={savingTerkompak}>
            {savingTerkompak ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Simpan Terkompak
          </Button>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Crown className="size-3.5" /> Winner Throne Battle
          </p>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border p-2.5 sm:grid-cols-2">
            {units.map((unit) => (
              <label key={unit.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={throne[unit.id]}
                  disabled={savingUnitId === unit.id}
                  onCheckedChange={(v) => toggleThrone(unit.id, !!v)}
                />
                <span className="truncate">{unit.name}</span>
                {savingUnitId === unit.id ? <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" /> : null}
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
