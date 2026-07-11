"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, FlagStatus } from "@/app/generated/prisma/enums";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function resolveFlagAction(flagId: string): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);

    const flag = await prisma.flag.findUniqueOrThrow({
      where: { id: flagId },
      include: { unit: true },
    });

    // Check scope if role is KEPALA_REGION
    if (user.role === Role.KEPALA_REGION && flag.unit?.regionId !== user.regionId) {
      return { ok: false, error: "Anda tidak berwenang menyelesaikan flag dari region lain." };
    }

    await prisma.flag.update({
      where: { id: flagId },
      data: {
        status: FlagStatus.RESOLVED,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
      },
    });

    revalidatePath("/kepala-region/escalation");
    revalidatePath("/mentor/flags");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyelesaikan flag." };
  }
}
