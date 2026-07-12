"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, ParameterType, InputMethod, SessionMode } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

async function assertAdmin() {
  await assertRole(Role.ADMIN);
}

/**
 * A Prisma FK-constraint error (code P2003) IS an `instanceof Error`, so a
 * bare `error instanceof Error ? error.message : "..."` fallback NEVER
 * reaches its friendly branch for this exact case — it just surfaces the
 * raw Postgres constraint text. This turns that specific case into an
 * actionable message; everything else still falls through to the generic one.
 */
function friendlyDeleteError(error: unknown, whatKind: string, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    const field = typeof error.meta?.field_name === "string" ? error.meta.field_name : "";
    const referencedBy = field.includes("materialId")
      ? "parameter"
      : field.includes("activityId")
        ? "materi atau sesi"
        : field.includes("sessionId")
          ? "nilai, presensi, atau konfirmasi"
          : "data lain";
    return `${whatKind} ini masih dipakai oleh ${referencedBy} yang sudah ada, jadi tidak bisa dihapus (data yang sudah diisi mentor tidak boleh hilang begitu saja). Nonaktifkan saja agar tidak muncul lagi di form, tanpa menghapus riwayatnya.`;
  }
  return error instanceof Error ? error.message : fallback;
}

// ==========================================
// ACTIVITIES & SESSIONS ACTIONS
// ==========================================

export async function createActivityAction(data: {
  code: string;
  name: string;
  order: number;
  isImportOnly?: boolean;
  active?: boolean;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activity.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        order: Number(data.order),
        isImportOnly: !!data.isImportOnly,
        active: data.active ?? true,
      },
    });
    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membuat kegiatan." };
  }
}

export async function updateActivityAction(
  id: string,
  data: {
    code: string;
    name: string;
    order: number;
    isImportOnly?: boolean;
    active?: boolean;
  },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activity.update({
      where: { id },
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        order: Number(data.order),
        isImportOnly: !!data.isImportOnly,
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui kegiatan." };
  }
}

export async function setActivityActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activity.update({ where: { id }, data: { active } });
    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengubah status kegiatan." };
  }
}

export async function deleteActivityAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();

    // Find all sessions in this activity
    const sessions = await prisma.activitySession.findMany({ where: { activityId: id } });
    const sessionIds = sessions.map((s) => s.id);

    // Find all materials in this activity
    const materials = await prisma.material.findMany({ where: { activityId: id } });
    const materialIds = materials.map((m) => m.id);

    // Find all parameters under these materials
    const parameters = await prisma.parameter.findMany({ where: { materialId: { in: materialIds } } });
    const parameterIds = parameters.map((p) => p.id);

    // Find all groups under these materials
    const groups = await prisma.group.findMany({ where: { materialId: { in: materialIds } } });
    const groupIds = groups.map((g) => g.id);

    // 1. Delete scores, attendances, confirmations related to sessions
    await prisma.score.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.attendance.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.confirmation.deleteMany({ where: { sessionId: { in: sessionIds } } });

    // 2. Delete scores, group scores related to parameters
    await prisma.score.deleteMany({ where: { parameterId: { in: parameterIds } } });
    await prisma.groupScore.deleteMany({ where: { parameterId: { in: parameterIds } } });

    // 3. Delete group members, group scores related to groups
    await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.groupScore.deleteMany({ where: { groupId: { in: groupIds } } });

    // 4. Delete groups
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });

    // 5. Delete parameters
    await prisma.parameter.deleteMany({ where: { id: { in: parameterIds } } });

    // 6. Delete materials
    await prisma.material.deleteMany({ where: { id: { in: materialIds } } });

    // 7. Delete sessions
    await prisma.activitySession.deleteMany({ where: { id: { in: sessionIds } } });

    // 8. Finally delete the activity itself
    await prisma.activity.delete({ where: { id } });

    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyDeleteError(error, "Kegiatan", "Gagal menghapus kegiatan.") };
  }
}

export async function createSessionAction(data: {
  activityId: string;
  code: string;
  name: string;
  mode: SessionMode;
  quorumThresholdPct?: number | null;
  scheduledAt?: string | null;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activitySession.create({
      data: {
        activityId: data.activityId,
        code: data.code.trim(),
        name: data.name.trim(),
        mode: data.mode,
        quorumThresholdPct: data.quorumThresholdPct ? Number(data.quorumThresholdPct) : null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });
    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data/schedule");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membuat sesi." };
  }
}

export async function updateSessionAction(
  id: string,
  data: {
    code: string;
    name: string;
    mode: SessionMode;
    quorumThresholdPct?: number | null;
    scheduledAt?: string | null;
  },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activitySession.update({
      where: { id },
      data: {
        code: data.code.trim(),
        name: data.name.trim(),
        mode: data.mode,
        quorumThresholdPct: data.quorumThresholdPct ? Number(data.quorumThresholdPct) : null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });
    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data/schedule");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui sesi." };
  }
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();

    // Cascading delete related records
    await prisma.score.deleteMany({ where: { sessionId: id } });
    await prisma.attendance.deleteMany({ where: { sessionId: id } });
    await prisma.confirmation.deleteMany({ where: { sessionId: id } });

    await prisma.activitySession.delete({ where: { id } });

    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data/schedule");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyDeleteError(error, "Sesi", "Gagal menghapus sesi.") };
  }
}

// ==========================================
// MATERIALS ACTIONS
// ==========================================

export async function createMaterialAction(data: {
  activityId: string;
  code: string;
  name: string;
  order: number;
  active?: boolean;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.material.create({
      data: {
        activityId: data.activityId,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        order: Number(data.order),
        active: data.active ?? true,
      },
    });
    revalidatePath("/admin/master-data/materials");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membuat materi." };
  }
}

export async function updateMaterialAction(
  id: string,
  data: {
    activityId: string;
    code: string;
    name: string;
    order: number;
    active?: boolean;
  },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.material.update({
      where: { id },
      data: {
        activityId: data.activityId,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        order: Number(data.order),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
    revalidatePath("/admin/master-data/materials");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui materi." };
  }
}

export async function setMaterialActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.material.update({ where: { id }, data: { active } });
    revalidatePath("/admin/master-data/materials");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengubah status materi." };
  }
}

export async function deleteMaterialAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();

    const parameters = await prisma.parameter.findMany({ where: { materialId: id } });
    const parameterIds = parameters.map((p) => p.id);

    const groups = await prisma.group.findMany({ where: { materialId: id } });
    const groupIds = groups.map((g) => g.id);

    // 1. Delete scores & group scores for parameters
    await prisma.score.deleteMany({ where: { parameterId: { in: parameterIds } } });
    await prisma.groupScore.deleteMany({ where: { parameterId: { in: parameterIds } } });

    // 2. Delete group members & group scores for groups
    await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.groupScore.deleteMany({ where: { groupId: { in: groupIds } } });

    // 3. Delete groups
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });

    // 4. Delete parameters
    await prisma.parameter.deleteMany({ where: { id: { in: parameterIds } } });

    // 5. Delete material itself
    await prisma.material.delete({ where: { id } });

    revalidatePath("/admin/master-data/materials");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyDeleteError(error, "Materi", "Gagal menghapus materi.") };
  }
}

// ==========================================
// PARAMETERS ACTIONS
// ==========================================

export async function createParameterAction(data: {
  materialId: string;
  subCode: string;
  name: string;
  type: ParameterType;
  personalWeight: number | null;
  skillWeight: number | null;
  maxValue: number;
  inputMethod: InputMethod;
  order: number;
  clusterLabel?: string | null;
  rubricAnchors?: Record<string, string> | null;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.parameter.create({
      data: {
        materialId: data.materialId,
        subCode: data.subCode.toUpperCase().trim(),
        name: data.name.trim(),
        type: data.type,
        personalWeight: data.personalWeight,
        skillWeight: data.skillWeight,
        maxValue: Number(data.maxValue),
        inputMethod: data.inputMethod,
        order: Number(data.order),
        clusterLabel: data.clusterLabel?.trim() || null,
        rubricAnchors: data.rubricAnchors ?? undefined,
      },
    });
    revalidatePath("/admin/master-data/parameters");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membuat parameter." };
  }
}

export async function updateParameterAction(
  id: string,
  data: {
    materialId: string;
    subCode: string;
    name: string;
    type: ParameterType;
    personalWeight: number | null;
    skillWeight: number | null;
    maxValue: number;
    inputMethod: InputMethod;
    order: number;
    clusterLabel?: string | null;
    rubricAnchors?: Record<string, string> | null;
    active: boolean;
  },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.parameter.update({
      where: { id },
      data: {
        materialId: data.materialId,
        subCode: data.subCode.toUpperCase().trim(),
        name: data.name.trim(),
        type: data.type,
        personalWeight: data.personalWeight,
        skillWeight: data.skillWeight,
        maxValue: Number(data.maxValue),
        inputMethod: data.inputMethod,
        order: Number(data.order),
        clusterLabel: data.clusterLabel?.trim() || null,
        rubricAnchors: data.rubricAnchors ?? undefined,
        active: !!data.active,
      },
    });
    revalidatePath("/admin/master-data/parameters");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui parameter." };
  }
}

export async function deleteParameterAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();

    // Cascading delete related records
    await prisma.score.deleteMany({ where: { parameterId: id } });
    await prisma.groupScore.deleteMany({ where: { parameterId: id } });

    await prisma.parameter.delete({ where: { id } });

    revalidatePath("/admin/master-data/parameters");
    revalidatePath("/admin/master-data");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyDeleteError(error, "Parameter", "Gagal menghapus parameter.") };
  }
}

// ==========================================
// SCHEDULE & QUORUM ACTIONS
// ==========================================

export async function updateScheduleAction(
  id: string,
  scheduledAt: string | null,
  quorumThresholdPct: number | null,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activitySession.update({
      where: { id },
      data: {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        quorumThresholdPct,
      },
    });
    revalidatePath("/admin/master-data/schedule");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui jadwal." };
  }
}

// ==========================================
// ACCOUNTS (USER) ACTIONS
// ==========================================

export async function createUserAction(data: {
  nrp: string;
  name: string;
  role: Role;
  password?: string;
  regionId?: string | null;
  unitId?: string | null;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    const password = data.password || "gradaks2026";
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        nrp: data.nrp.toLowerCase().trim(),
        name: data.name.trim(),
        role: data.role,
        passwordHash,
        regionId: data.regionId || null,
        unitId: data.unitId || null,
      },
    });
    revalidatePath("/admin/master-data/accounts");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membuat akun." };
  }
}

export async function updateUserAction(
  id: string,
  data: {
    nrp: string;
    name: string;
    role: Role;
    password?: string;
    regionId?: string | null;
    unitId?: string | null;
    active: boolean;
  },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const passwordHash = data.password && data.password.trim() !== "" ? await bcrypt.hash(data.password, 10) : undefined;

    await prisma.user.update({
      where: { id },
      data: {
        nrp: data.nrp.toLowerCase().trim(),
        name: data.name.trim(),
        role: data.role,
        regionId: data.regionId || null,
        unitId: data.unitId || null,
        active: !!data.active,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    revalidatePath("/admin/master-data/accounts");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui akun." };
  }
}

// ==========================================
// SETTINGS (WEIGHTS & THRESHOLDS) ACTIONS
// ==========================================

export async function updateSettingsAction(settings: Record<string, number | boolean>): Promise<ActionResult> {
  try {
    await assertAdmin();
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
    revalidatePath("/admin/master-data/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui pengaturan." };
  }
}
