"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudentScoringCard } from "./student-scoring-card";
import { groupByCluster } from "@/lib/scoring/clusters";
import { cn } from "@/lib/utils";

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

type Student = { id: string; name: string; nrp: string };

function countFilledClusters(materials: Material[], values: Record<string, number | null>) {
  let filled = 0;
  let total = 0;
  for (const material of materials) {
    for (const cluster of groupByCluster(material.parameters)) {
      total++;
      const v = values[cluster.parameterIds[0]];
      if (v !== null && v !== undefined) filled++;
    }
  }
  return { filled, total };
}

/**
 * One maba at a time instead of every maba's full card stacked on one page —
 * a unit's roster (6-9 maba × several materials each) made the old stacked
 * layout slow to scroll through. Base UI's Tabs.Panel keeps ALL panels
 * mounted by default (it only toggles a `hidden` attribute), so the actual
 * DOM-weight reduction comes from explicitly rendering only the active
 * student's StudentScoringCard as each panel's children below — the empty
 * panel wrapper for inactive tabs is cheap, the full rubric-picker tree
 * inside it is not.
 */
export function StudentScoringTabs({
  students,
  materials,
  initialValuesByStudent,
  sessionId,
}: {
  students: Student[];
  materials: Material[];
  initialValuesByStudent: Record<string, Record<string, number | null>>;
  sessionId: string;
}) {
  const [active, setActive] = useState<string>(students[0]?.id ?? "");

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as string)}>
      <div className="overflow-x-auto">
        <TabsList variant="line" className="w-full min-w-max justify-start">
          {students.map((student) => {
            const { filled, total } = countFilledClusters(materials, initialValuesByStudent[student.id] ?? {});
            const complete = total > 0 && filled >= total;
            return (
              <TabsTrigger key={student.id} value={student.id} className={cn("gap-1.5", complete && "text-foreground")}>
                {student.name}
                {complete ? <Check className="size-3.5 text-green-600 dark:text-green-400" /> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      {students.map((student) => (
        <TabsContent key={student.id} value={student.id} className="pt-4">
          {active === student.id ? (
            <StudentScoringCard
              student={student}
              materials={materials}
              initialValues={initialValuesByStudent[student.id] ?? {}}
              sessionId={sessionId}
            />
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
