"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, VerificationLayer, VerificationStatus } from "@/app/generated/prisma/enums";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function verifyDamenLayerAction(
  studentId: string,
  status: "VERIFIED" | "REJECTED",
  note: string,
): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.DAMEN, Role.ADMIN);

    await prisma.verification.upsert({
      where: { studentId_layer: { studentId, layer: VerificationLayer.DAMEN } },
      update: { status: status as VerificationStatus, note: note || null, verifiedByUserId: user.id, verifiedAt: new Date() },
      create: {
        studentId,
        layer: VerificationLayer.DAMEN,
        status: status as VerificationStatus,
        note: note || null,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
      },
    });

    revalidatePath("/damen/verification");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memverifikasi." };
  }
}
