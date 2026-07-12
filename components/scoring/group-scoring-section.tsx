"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RubricValuePicker } from "./rubric-value-picker";
import { createGroupAction, saveGroupScoresAction } from "@/app/(dashboard)/mentor/actions";
import { groupByCluster } from "@/lib/scoring/clusters";

type Parameter = { id: string; subCode: string; name: string; maxValue: number; rubricAnchors: unknown; clusterLabel: string | null; order: number };
type Student = { id: string; name: string; nrp: string };
type GroupData = {
  id: string;
  name: string;
  members: Array<{ student: Student }>;
  groupScores: Array<{ parameterId: string; value: number | null }>;
};

function CreateGroupForm({ materialId, unassigned }: { materialId: string; unassigned: Student[] }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!name.trim() || selected.size === 0) {
      toast.error("Nama kelompok dan minimal satu anggota wajib diisi.");
      return;
    }
    startTransition(async () => {
      const result = await createGroupAction(materialId, name.trim(), Array.from(selected));
      if (result.ok) {
        toast.success(`Kelompok "${name}" dibuat.`);
        setName("");
        setSelected(new Set());
      } else {
        toast.error(result.error);
      }
    });
  }

  if (unassigned.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-sm">Buat Kelompok Baru</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Nama kelompok, mis. Kelompok 2" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Maba belum berkelompok ({unassigned.length})</p>
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
            {unassigned.map((s) => (
              <label key={s.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-muted">
                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
        <Button onClick={submit} disabled={pending} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Buat Kelompok
        </Button>
      </CardContent>
    </Card>
  );
}

function GroupCard({ group, parameters }: { group: GroupData; parameters: Parameter[] }) {
  const initial: Record<string, number | null> = {};
  for (const gs of group.groupScores) initial[gs.parameterId] = gs.value;

  const [values, setValues] = useState<Record<string, number | null>>(initial);
  const [pending, startTransition] = useTransition();
  const clusters = groupByCluster(parameters);
  const filled = clusters.filter((c) => values[c.parameterIds[0]] !== null && values[c.parameterIds[0]] !== undefined).length;

  function updateCluster(parameterIds: string[], value: number | null) {
    setValues((prev) => {
      const next = { ...prev };
      for (const id of parameterIds) next[id] = value;
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveGroupScoresAction(group.id, values);
      if (result.ok) toast.success(`Skor ${group.name} tersimpan.`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">{group.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {group.members.map((m) => m.student.name).join(", ") || "Belum ada anggota"}
          </p>
        </div>
        <Badge variant={filled >= clusters.length ? "default" : "secondary"}>
          {filled}/{clusters.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {clusters.map((cluster) => (
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
        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan Nilai Kelompok
        </Button>
      </CardContent>
    </Card>
  );
}

export function GroupScoringSection({
  materialId,
  materialName,
  parameters,
  groups,
  allStudents,
}: {
  materialId: string;
  materialName: string;
  parameters: Parameter[];
  groups: GroupData[];
  allStudents: Student[];
}) {
  const assignedIds = new Set(groups.flatMap((g) => g.members.map((m) => m.student.id)));
  const unassigned = allStudents.filter((s) => !assignedIds.has(s.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{materialName} (Penilaian Kelompok)</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} parameters={parameters} />
        ))}
        <CreateGroupForm materialId={materialId} unassigned={unassigned} />
      </div>
    </div>
  );
}
