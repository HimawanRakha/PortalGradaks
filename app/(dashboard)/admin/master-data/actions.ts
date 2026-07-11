"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, ParameterType, InputMethod, SessionMode } from "@/app/generated/prisma/enums";

type ActionResult = { ok: true } | { ok: false; error: string };

async function assertAdmin() {
  await assertRole(Role.ADMIN);
}

// ==========================================
// ACTIVITIES & SESSIONS ACTIONS
// ==========================================

export async function createActivityAction(data: {
  code: string;
  name: string;
  order: number;
  isImportOnly?: boolean;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activity.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        order: Number(data.order),
        isImportOnly: !!data.isImportOnly,
      },
    });
    revalidatePath("/admin/master-data/activities");
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
      },
    });
    revalidatePath("/admin/master-data/activities");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui kegiatan." };
  }
}

export async function deleteActivityAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.activity.delete({ where: { id } });
    revalidatePath("/admin/master-data/activities");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menghapus kegiatan. Kemungkinan ada materi atau sesi yang bergantung." };
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
    await prisma.activitySession.delete({ where: { id } });
    revalidatePath("/admin/master-data/activities");
    revalidatePath("/admin/master-data/schedule");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menghapus sesi." };
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
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.material.create({
      data: {
        activityId: data.activityId,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        order: Number(data.order),
      },
    });
    revalidatePath("/admin/master-data/materials");
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
      },
    });
    revalidatePath("/admin/master-data/materials");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memperbarui materi." };
  }
}

export async function deleteMaterialAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    await prisma.material.delete({ where: { id } });
    revalidatePath("/admin/master-data/materials");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menghapus materi. Kemungkinan ada parameter yang bergantung." };
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
    const updateData: any = {
      nrp: data.nrp.toLowerCase().trim(),
      name: data.name.trim(),
      role: data.role,
      regionId: data.regionId || null,
      unitId: data.unitId || null,
      active: !!data.active,
    };

    if (data.password && data.password.trim() !== "") {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
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
