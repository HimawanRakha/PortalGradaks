import "server-only";
import { InputMethod } from "@/app/generated/prisma/enums";

/**
 * Parameters that hold one Score row PER MABA — the only ones that count
 * toward a maba's scoring completeness. GROUP (GroupScore, per kelompok),
 * UNIT_MENTOR/UNIT_EVENT (UnitEventScore, per unit) and REGION_EVENT
 * (RegionEventScore, per region) are stored elsewhere, so counting them
 * against per-student Score rows made scoring un-completable (e.g.
 * Inclenation stuck at 19/36 even when fully filled).
 */
export const PER_STUDENT_INPUT_METHODS = [InputMethod.MENTOR, InputMethod.IMPORT];
