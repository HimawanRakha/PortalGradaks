"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RubricValuePicker } from "./rubric-value-picker";
import { saveStudentScoresAction } from "@/app/(dashboard)/mentor/actions";
import { groupByCluster } from "@/lib/scoring/clusters";

type Parameter = {
  id: string;
  subCode: string;
  name: string;
  maxValue: number;
  rubricAnchors: unknown;
  clusterLabel: string | null;
  order: number;
};

type Material = {
  id: string;
  name: string;
  parameters: Parameter[];
};

export function StudentScoringCard({
  student,
  materials,
  initialValues,
  sessionId,
}: {
  student: { id: string; name: string; nrp: string };
  materials: Material[];
  initialValues: Record<string, number | null>;
  sessionId: string;
}) {
  const draftKey = `scoring-draft:${sessionId}:${student.id}`;
  const [values, setValues] = useState<Record<string, number | null>>(initialValues);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // Deliberately an effect, not a lazy useState initializer: localStorage
    // isn't available during SSR, so reading it in the initializer would
    // make the client's first render mismatch the server-rendered HTML.
    const raw = window.localStorage.getItem(draftKey);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as Record<string, number | null>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValues((prev) => ({ ...prev, ...draft }));
        setDirty(true);
      } catch {
        // corrupt draft, ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const materialsWithClusters = materials.map((m) => ({ ...m, clusters: groupByCluster(m.parameters) }));
  const totalClusters = materialsWithClusters.reduce((sum, m) => sum + m.clusters.length, 0);
  const filledClusters = materialsWithClusters.reduce(
    (sum, m) => sum + m.clusters.filter((c) => values[c.parameterIds[0]] !== null && values[c.parameterIds[0]] !== undefined).length,
    0,
  );

  function updateCluster(parameterIds: string[], value: number | null) {
    setValues((prev) => {
      const next = { ...prev };
      for (const id of parameterIds) next[id] = value;
      window.localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveStudentScoresAction(student.id, sessionId, values);
      if (result.ok) {
        window.localStorage.removeItem(draftKey);
        setDirty(false);
        toast.success(`Skor ${student.name} tersimpan.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{student.name}</p>
          <p className="text-xs text-muted-foreground">{student.nrp}</p>
        </div>
        <Badge variant={filledClusters >= totalClusters ? "default" : "secondary"}>
          {filledClusters}/{totalClusters}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {materialsWithClusters.map((material) => (
          <div key={material.id} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{material.name}</p>
            <div className="space-y-3">
              {material.clusters.map((cluster) => (
                <div key={cluster.key} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm">{cluster.label}</p>
                  <RubricValuePicker
                    value={values[cluster.parameterIds[0]] ?? null}
                    onChange={(v) => updateCluster(cluster.parameterIds, v)}
                    maxValue={cluster.maxValue}
                    anchors={cluster.rubricAnchors as Record<string, string> | null}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button onClick={handleSave} disabled={pending || !dirty} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" /> : dirty ? null : <Check className="size-4" />}
          {dirty ? "Simpan" : "Tersimpan"}
        </Button>
      </CardContent>
    </Card>
  );
}
