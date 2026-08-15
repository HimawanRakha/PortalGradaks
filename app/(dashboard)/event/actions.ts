"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { assertCanScoreInclenationEvent } from "@/lib/auth/dal";
import { upsertUnitEventScore, upsertRegionEventScore } from "@/lib/scoring/upsert";

export type ActionResult = { ok: true } | { ok: false; error: string };

const valuesSchema = z.record(z.string(), z.number().nullable());

/** Terkompak's 5 criteria for one region, saved together (they read as one checklist). */
export async function saveTerkompakAction(regionId: string, rawValues: Record<string, number | null>): Promise<ActionResult> {
  try {
    const user = await assertCanScoreInclenationEvent();
    const values = valuesSchema.parse(rawValues);

    for (const [parameterId, value] of Object.entries(values)) {
      await upsertRegionEventScore({ regionId, parameterId, value, actorUserId: user.id });
    }

    revalidatePath("/event/scoring");
    revalidatePath("/event/leaderboard");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan nilai Terkompak." };
  }
}

/** Winner Throne Battle is a single boolean per unit — saved immediately on toggle. */
export async function saveThroneBattleAction(unitId: string, parameterId: string, value: number | null): Promise<ActionResult> {
  try {
    const user = await assertCanScoreInclenationEvent();
    await upsertUnitEventScore({ unitId, parameterId, value, actorUserId: user.id });

    revalidatePath("/event/scoring");
    revalidatePath("/event/leaderboard");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan Throne Battle." };
  }
}
