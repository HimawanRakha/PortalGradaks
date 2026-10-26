import { unstable_rethrow } from "next/navigation";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { getRecapData } from "@/lib/scoring/recap";
import { buildRecapWorkbook } from "@/lib/scoring/recap-excel";

export async function GET(request: Request) {
  try {
    await assertRole(Role.ADMIN);
    const dept = new URL(request.url).searchParams.get("dept");
    const { workbook, slug } = buildRecapWorkbook(await getRecapData(), dept);
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
