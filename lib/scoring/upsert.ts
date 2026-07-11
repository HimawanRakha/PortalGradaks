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
}) {
  const { studentId, sessionId, status, participationScore, mode, actorUserId } = params;
  const source = params.source ?? ScoreSource.MENTOR;
  const where = { studentId_sessionId: { studentId, sessionId } };

  const existing = await prisma.attendance.findUnique({ where });

  const attendance = await prisma.attendance.upsert({
    where,
    update: { status, participationScore, mode, enteredByUserId: actorUserId, source },
    create: { studentId, sessionId, status, participationScore, mode, enteredByUserId: actorUserId, source },
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
