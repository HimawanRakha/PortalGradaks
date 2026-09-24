import "server-only";
import { prisma } from "@/lib/prisma";
import { InputMethod } from "@/app/generated/prisma/enums";

export type ChecklistItem = {
  key: string;
  label: string;
  kind: "PRESENSI" | "NILAI" | "KELOMPOK";
  doneCount: number;
  totalCount: number;
  /** Counted maba/kelompok; shown as "(8/10 Maba)" etc. */
  unitLabel: "Maba" | "Kelompok";
  isComplete: boolean;
};

export type ChecklistActivity = {
  code: string;
  name: string;
  /** False when every real session of this activity is scheduled in the future. */
  started: boolean;
  items: ChecklistItem[];
};

export type UnitChecklist = {
  unitCode: string;
  unitName: string;
  regionName: string;
  mentorName: string | null;
  mabaCount: number;
  activities: ChecklistActivity[];
  doneCount: number;
  totalCount: number;
  pct: number;
  incompleteItems: { activityName: string; label: string }[];
};

/**
 * Accepts the ways a maba will realistically type a Region-Unit code
 * ("R01-U01", "r1-u1", "1-1", "R01 U01", "R01U01") and maps them onto the
 * canonical seeded format `R{NN}-U{NN}`. Anything unparseable is returned
 * trimmed so a custom unit code can still match exactly.
 */
export function normalizeUnitCode(raw: string): string {
  const input = raw.trim();
  const m =
    input.match(/^R?\s*0*(\d{1,3})\s*[-_/. ]\s*U?\s*0*(\d{1,3})$/i) ?? input.match(/^R\s*0*(\d{1,3})\s*U\s*0*(\d{1,3})$/i);
  if (!m) return input;
  return `R${m[1].padStart(2, "0")}-U${m[2].padStart(2, "0")}`;
}

/**
 * Per-activity completeness checklist for ONE unit, for the public
 * /cek-unit page (Ketua Unit maba). Counts only — never exposes any maba's
 * name or score value.
 *
 * Unlike getUnitProgressList() (lib/scoring/unit-progress.ts), this only
 * counts what the unit's MENTOR is responsible for inputting, since the
 * point of the page is nudging the mentor: attendance per real session,
 * individual MENTOR parameters and GROUP parameters (per kelompok).
 * IMPORT / UNIT_EVENT / REGION_EVENT are filled by PSDM or the event
 * committee and would be an unfair "belum" for the mentor. UNIT_MENTOR
 * (Inclenation unit competition scores) is left out on purpose too — it's
 * a unit-level competition score, not part of the maba's penilaian.
 */
export async function getUnitChecklist(rawCode: string): Promise<UnitChecklist | null> {
  const candidates = Array.from(new Set([rawCode.trim(), normalizeUnitCode(rawCode)])).filter(Boolean);
  if (candidates.length === 0) return null;

  const unit = await prisma.unit.findFirst({
    where: { OR: candidates.map((c) => ({ code: { equals: c, mode: "insensitive" as const } })) },
    include: {
      region: { select: { name: true } },
      mentor: { select: { name: true } },
    },
  });
  if (!unit) return null;

  const activities = await prisma.activity.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      sessions: { select: { id: true, code: true, name: true, scheduledAt: true }, orderBy: { code: "asc" } },
      materials: {
        where: { active: true },
        orderBy: { order: "asc" },
        include: {
          parameters: {
            where: {
              active: true,
              inputMethod: { in: [InputMethod.MENTOR, InputMethod.GROUP] },
            },
            select: { id: true, inputMethod: true },
          },
        },
      },
    },
  });

  const sessionIds: string[] = [];
  const mentorParamIds: string[] = [];
  for (const act of activities) {
    for (const s of act.sessions) if (s.code !== "UMUM") sessionIds.push(s.id);
    for (const mat of act.materials)
      for (const p of mat.parameters) if (p.inputMethod === InputMethod.MENTOR) mentorParamIds.push(p.id);
  }

  const [students, groups] = await Promise.all([
    prisma.student.findMany({
      where: { unitId: unit.id, active: true },
      select: {
        id: true,
        attendances: { where: { sessionId: { in: sessionIds } }, select: { sessionId: true } },
        scores: { where: { value: { not: null }, parameterId: { in: mentorParamIds } }, select: { parameterId: true } },
      },
    }),
    prisma.group.findMany({
      where: { unitId: unit.id },
      select: {
        materialId: true,
        members: { select: { studentId: true } },
        groupScores: { where: { value: { not: null } }, select: { parameterId: true } },
      },
    }),
  ]);

  const mabaCount = students.length;
  const attendedBySession = new Map<string, number>();
  const scoredParamsByStudent = students.map((st) => new Set(st.scores.map((s) => s.parameterId)));
  for (const st of students) {
    for (const a of st.attendances) attendedBySession.set(a.sessionId, (attendedBySession.get(a.sessionId) ?? 0) + 1);
  }
  const now = new Date();

  const result: ChecklistActivity[] = [];
  for (const act of activities) {
    const realSessions = act.sessions.filter((s) => s.code !== "UMUM");
    const started = realSessions.length === 0 || realSessions.some((s) => !s.scheduledAt || s.scheduledAt <= now);
    const items: ChecklistItem[] = [];

    for (const s of realSessions) {
      const done = attendedBySession.get(s.id) ?? 0;
      items.push({
        key: `att:${s.id}`,
        label: `Presensi ${s.name}`,
        kind: "PRESENSI",
        doneCount: done,
        totalCount: mabaCount,
        unitLabel: "Maba",
        isComplete: mabaCount > 0 && done >= mabaCount,
      });
    }

    if (!act.isImportOnly) {
      for (const mat of act.materials) {
        const mentorParams = mat.parameters.filter((p) => p.inputMethod === InputMethod.MENTOR).map((p) => p.id);
        const groupParams = mat.parameters.filter((p) => p.inputMethod === InputMethod.GROUP).map((p) => p.id);

        if (mentorParams.length > 0) {
          const done = scoredParamsByStudent.filter((set) => mentorParams.every((id) => set.has(id))).length;
          items.push({
            key: `mat:${mat.id}`,
            label: `Penilaian ${mat.name}`,
            kind: "NILAI",
            doneCount: done,
            totalCount: mabaCount,
            unitLabel: "Maba",
            isComplete: mabaCount > 0 && done >= mabaCount,
          });
        }

        if (groupParams.length > 0) {
          const matGroups = groups.filter((g) => g.materialId === mat.id);
          const done = matGroups.filter((g) => {
            const scored = new Set(g.groupScores.map((s) => s.parameterId));
            return groupParams.every((id) => scored.has(id));
          }).length;
          const assigned = new Set(matGroups.flatMap((g) => g.members.map((m) => m.studentId))).size;
          // A group task isn't "lengkap" while some maba still has no kelompok.
          const allAssigned = mabaCount > 0 && assigned >= mabaCount;
          items.push({
            key: `grp:${mat.id}`,
            label: matGroups.length === 0 ? `Tugas Kelompok ${mat.name} (kelompok belum dibuat)` : `Tugas Kelompok ${mat.name}`,
            kind: "KELOMPOK",
            doneCount: done,
            totalCount: Math.max(matGroups.length, 1),
            unitLabel: "Kelompok",
            isComplete: matGroups.length > 0 && done >= matGroups.length && allAssigned,
          });
        }
      }
    }

    if (items.length > 0) result.push({ code: act.code, name: act.name, started, items });
  }

  let doneCount = 0;
  let totalCount = 0;
  const incompleteItems: UnitChecklist["incompleteItems"] = [];
  for (const act of result) {
    if (!act.started) continue;
    for (const it of act.items) {
      doneCount += Math.min(it.doneCount, it.totalCount);
      totalCount += it.totalCount;
      if (!it.isComplete) incompleteItems.push({ activityName: act.name, label: it.label });
    }
  }

  return {
    unitCode: unit.code,
    unitName: unit.name,
    regionName: unit.region.name,
    mentorName: unit.mentor?.name ?? null,
    mabaCount,
    activities: result,
    doneCount,
    totalCount,
    pct: totalCount > 0 ? Math.floor((doneCount / totalCount) * 100) : 0,
    incompleteItems,
  };
}
