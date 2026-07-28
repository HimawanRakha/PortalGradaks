import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { ScoreSource } from "@/app/generated/prisma/enums";

function toJson(value: number | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value;
}

/**
 * The single write path for Score — every mentor-scoring Server Action
 * and the import pipeline both go through this, never a bare
 * prisma.score.create/update. Upserts on the (student, parameter,
 * session) unique key (brief's non-negotiable anti-duplicate rule), and
 * writes an AuditLog row whenever an upsert actually changes an existing
 * differing value — a plain idempotent re-submit of the same value does
 * NOT get logged as a change, only genuine corrections do.
 */
export async function upsertScore(params: {
  studentId: string;
  parameterId: string;
  sessionId: string;
  value: number | null;
  actorUserId: string;
  source?: ScoreSource;
  importId?: string | null;
}) {
  const { studentId, parameterId, sessionId, value, actorUserId, importId } = params;
  const source = params.source ?? ScoreSource.MENTOR;
  const where = { studentId_parameterId_sessionId: { studentId, parameterId, sessionId } };

  const existing = await prisma.score.findUnique({ where });

  const score = await prisma.score.upsert({
    where,
    update: { value, enteredByUserId: actorUserId, source, importId: importId ?? null },
    create: { studentId, parameterId, sessionId, value, enteredByUserId: actorUserId, source, importId },
  });

  if (!existing) {
    await prisma.auditLog.create({
      data: {
        entityType: "Score",
        entityId: score.id,
        action: "CREATE",
        field: "value",
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  } else if (existing.value !== value) {
    await prisma.auditLog.create({
      data: {
        entityType: "Score",
        entityId: score.id,
        action: "UPDATE",
        field: "value",
        oldValue: toJson(existing.value),
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  }

  return score;
}

export async function upsertAttendance(params: {
  studentId: string;
  sessionId: string;
  status: "HADIR" | "IZIN" | "ALPA";
  participationScore: number | null;
  mode: "ONLINE" | "OFFLINE" | "NA";
  actorUserId: string;
  source?: ScoreSource;
  importId?: string | null;
}) {
  const { studentId, sessionId, status, participationScore, mode, actorUserId, importId } = params;
  const source = params.source ?? ScoreSource.MENTOR;
  const where = { studentId_sessionId: { studentId, sessionId } };

  const existing = await prisma.attendance.findUnique({ where });

  const attendance = await prisma.attendance.upsert({
    where,
    update: { status, participationScore, mode, enteredByUserId: actorUserId, source, importId: importId ?? null },
    create: { studentId, sessionId, status, participationScore, mode, enteredByUserId: actorUserId, source, importId },
  });

  if (existing && (existing.status !== status || existing.participationScore !== participationScore)) {
    await prisma.auditLog.create({
      data: {
        entityType: "Attendance",
        entityId: attendance.id,
        action: "UPDATE",
        oldValue: { status: existing.status, participationScore: existing.participationScore },
        newValue: { status, participationScore },
        changedByUserId: actorUserId,
      },
    });
  }

  return attendance;
}

export async function upsertGroupScore(params: {
  groupId: string;
  parameterId: string;
  value: number | null;
  actorUserId: string;
}) {
  const { groupId, parameterId, value, actorUserId } = params;
  const where = { groupId_parameterId: { groupId, parameterId } };

  const existing = await prisma.groupScore.findUnique({ where });

  const groupScore = await prisma.groupScore.upsert({
    where,
    update: { value, enteredByUserId: actorUserId },
    create: { groupId, parameterId, value, enteredByUserId: actorUserId },
  });

  if (existing && existing.value !== value) {
    await prisma.auditLog.create({
      data: {
        entityType: "GroupScore",
        entityId: groupScore.id,
        action: "UPDATE",
        field: "value",
        oldValue: toJson(existing.value),
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  }

  return groupScore;
}

/**
 * Write path for the Inclenation event scoreboard's unit-scoped values
 * (Teraktif/Terdisiplin/Pelanggaran entered by Mentor, Throne Battle entered
 * by Event) — see lib/scoring/event-calculate.ts for how these are read.
 * Deliberately its own table (not GroupScore): a unit here is the whole
 * mentoring cohort, not a mentor-curated sub-team.
 */
export async function upsertUnitEventScore(params: {
  unitId: string;
  parameterId: string;
  value: number | null;
  actorUserId: string;
}) {
  const { unitId, parameterId, value, actorUserId } = params;
  const where = { unitId_parameterId: { unitId, parameterId } };

  const existing = await prisma.unitEventScore.findUnique({ where });

  const unitEventScore = await prisma.unitEventScore.upsert({
    where,
    update: { value, enteredByUserId: actorUserId },
    create: { unitId, parameterId, value, enteredByUserId: actorUserId },
  });

  if (!existing) {
    await prisma.auditLog.create({
      data: {
        entityType: "UnitEventScore",
        entityId: unitEventScore.id,
        action: "CREATE",
        field: "value",
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  } else if (existing.value !== value) {
    await prisma.auditLog.create({
      data: {
        entityType: "UnitEventScore",
        entityId: unitEventScore.id,
        action: "UPDATE",
        field: "value",
        oldValue: toJson(existing.value),
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  }

  return unitEventScore;
}

/** Region-scoped counterpart of upsertUnitEventScore — Terkompak's 5 criteria, Event-entered. */
export async function upsertRegionEventScore(params: {
  regionId: string;
  parameterId: string;
  value: number | null;
  actorUserId: string;
}) {
  const { regionId, parameterId, value, actorUserId } = params;
  const where = { regionId_parameterId: { regionId, parameterId } };

  const existing = await prisma.regionEventScore.findUnique({ where });

  const regionEventScore = await prisma.regionEventScore.upsert({
    where,
    update: { value, enteredByUserId: actorUserId },
    create: { regionId, parameterId, value, enteredByUserId: actorUserId },
  });

  if (!existing) {
    await prisma.auditLog.create({
      data: {
        entityType: "RegionEventScore",
        entityId: regionEventScore.id,
        action: "CREATE",
        field: "value",
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  } else if (existing.value !== value) {
    await prisma.auditLog.create({
      data: {
        entityType: "RegionEventScore",
        entityId: regionEventScore.id,
        action: "UPDATE",
        field: "value",
        oldValue: toJson(existing.value),
        newValue: toJson(value),
        changedByUserId: actorUserId,
      },
    });
  }

  return regionEventScore;
}
