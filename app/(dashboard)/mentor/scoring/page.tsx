import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit, getActivitiesOverview, getUmumSession, getScoresForSession, getGroupsForMaterial } from "@/lib/data/mentor";
import { InputMethod } from "@/app/generated/prisma/enums";
import { ActivityPickerForm } from "@/components/scoring/activity-picker-form";
import { StudentScoringTabs } from "@/components/scoring/student-scoring-tabs";
import { GroupScoringSection } from "@/components/scoring/group-scoring-section";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Scoring" };

export default async function MentorScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const { activity: activityCode } = await searchParams;
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);
  const activities = await getActivitiesOverview();

  const scorableActivities = activities.filter((a) => !a.isImportOnly);
  const selected = scorableActivities.find((a) => a.code === activityCode) ?? scorableActivities[0];

  if (!selected) {
    return <p className="text-sm text-muted-foreground">Belum ada kegiatan yang dikonfigurasi.</p>;
  }

  const umumSession = await getUmumSession(selected.code);
  const students = unit.students;
  const studentIds = students.map((s) => s.id);

  // Client components only need these fields — picking them explicitly
  // (rather than spreading the raw Prisma parameter) also drops the
  // personalWeight/skillWeight Decimal instances, which React's server/client
  // boundary refuses to serialize as props.
  const plainMaterials = selected.materials.map((m) => ({
    id: m.id,
    name: m.name,
    parameters: m.parameters.map((p) => ({
      id: p.id,
      subCode: p.subCode,
      name: p.name,
      maxValue: p.maxValue,
      rubricAnchors: p.rubricAnchors,
      clusterLabel: p.clusterLabel,
      order: p.order,
      inputMethod: p.inputMethod,
    })),
  }));
  const individualMaterials = plainMaterials
    .map((m) => ({ ...m, parameters: m.parameters.filter((p) => p.inputMethod !== InputMethod.GROUP) }))
    .filter((m) => m.parameters.length > 0);
  const groupMaterials = plainMaterials
    .map((m) => ({ ...m, parameters: m.parameters.filter((p) => p.inputMethod === InputMethod.GROUP) }))
    .filter((m) => m.parameters.length > 0);

  const individualParamIds = individualMaterials.flatMap((m) => m.parameters.map((p) => p.id));
  const scoresMap = await getScoresForSession(studentIds, individualParamIds, umumSession.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scoring — {selected.name}</h2>
          <p className="text-sm text-muted-foreground">{unit.name} · {students.length} maba</p>
        </div>
        <ActivityPickerForm
          action="/mentor/scoring"
          paramName="activity"
          value={selected.code}
          options={scorableActivities.map((a) => ({ value: a.code, label: a.name }))}
        />
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Belum ada maba terdaftar di unit ini.
          </CardContent>
        </Card>
      ) : null}

      {individualMaterials.length > 0 && students.length > 0 ? (
        <StudentScoringTabs
          students={students}
          materials={individualMaterials}
          initialValuesByStudent={Object.fromEntries(
            students.map((student) => [student.id, Object.fromEntries(scoresMap.get(student.id) ?? [])]),
          )}
          sessionId={umumSession.id}
        />
      ) : null}

      {groupMaterials.map((material) => (
        <GroupMaterialSection key={material.id} unitId={unit.id} material={material} allStudents={students} />
      ))}
    </div>
  );
}

async function GroupMaterialSection({
  unitId,
  material,
  allStudents,
}: {
  unitId: string;
  material: {
    id: string;
    name: string;
    parameters: Array<{ id: string; subCode: string; name: string; maxValue: number; rubricAnchors: unknown; clusterLabel: string | null; order: number }>;
  };
  allStudents: Array<{ id: string; name: string; nrp: string }>;
}) {
  const groups = await getGroupsForMaterial(unitId, material.id);
  return (
    <GroupScoringSection
      materialId={material.id}
      materialName={material.name}
      parameters={material.parameters}
      groups={groups}
      allStudents={allStudents}
    />
  );
}
