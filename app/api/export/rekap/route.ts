import { unstable_rethrow } from "next/navigation";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { getRecapSettings, loadRecapComputation } from "@/lib/scoring/recap";
import { buildRecapWorkbook } from "@/lib/scoring/recap-excel";

// Scoring the whole cohort + writing ~150k log rows can take a while.
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    await assertRole(Role.ADMIN);
    const dept = new URL(request.url).searchParams.get("dept");
    // Always computed fresh (not the 10-minute page cache): the raw value
    // log needs every maba's full result, which is too large to cache.
    const [{ data, computedByNrp }, settings] = await Promise.all([loadRecapComputation(), getRecapSettings()]);
    const { workbook, slug } = buildRecapWorkbook(data, settings, dept, computedByNrp);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=rekap_nilai_${slug}_${new Date().toISOString().split("T")[0]}.xlsx`,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Gagal mengekspor rekap." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
