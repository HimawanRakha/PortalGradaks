import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { computeScores, type ComputedScores } from "@/lib/scoring/calculate";
import { getRecapSettings } from "@/lib/scoring/recap";
import { SETTING_KEYS, DEFAULT_RAPORT_THANK_YOU_MESSAGE } from "@/lib/scoring/setting-keys";
import { RaportPdf } from "@/lib/raport-pdf";

/**
 * Public, NRP-keyed PDF raport — the same exposure as the /cek-raport page
 * itself (and rate-limited alongside it in proxy.ts). Once PSDM finalizes,
 * the frozen RaportSnapshot values and its recommendation are used, so the
 * PDF never disagrees with the official result; before that it's the live
 * estimate, clearly labelled as such.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nrp = url.searchParams.get("nrp")?.trim();
  if (!nrp) return new Response("NRP wajib diisi.", { status: 400 });

  const student = await prisma.student.findFirst({
    where: { nrp: { equals: nrp, mode: "insensitive" } },
    include: { unit: { include: { region: true } }, department: true, raportSnapshot: true },
  });
  if (!student) return new Response("NRP tidak ditemukan.", { status: 404 });

  const snapshot = student.raportSnapshot;
  const frozen = snapshot?.breakdown as unknown as ComputedScores | undefined;
  // Snapshots written before the attendance-based formula lack these fields.
  const computed = frozen?.personal?.components && frozen.attendance ? frozen : await computeScores(student.id);

  const [recapSettings, thankYouSetting, logo] = await Promise.all([
    getRecapSettings(),
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.raportThankYouMessage } }),
    fetch(new URL("/BEMFTEIC.png", url.origin))
      .then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null))
      .catch(() => null),
  ]);
  const thankYouMessage =
    typeof thankYouSetting?.value === "string" && thankYouSetting.value.trim() ? thankYouSetting.value : DEFAULT_RAPORT_THANK_YOU_MESSAGE;

  const element = createElement(RaportPdf, {
    student: {
      name: student.name,
      nrp: student.nrp,
      department: student.department?.name ?? "-",
      unit: student.unit.name,
      region: student.unit.region.name,
    },
    computed,
    final: snapshot
      ? {
          recommendation: snapshot.recommendation,
          description: snapshot.description,
          dataInsufficient: snapshot.dataInsufficient,
          finalizedAt: snapshot.finalizedAt,
        }
      : null,
    thankYouMessage,
    thresholds: recapSettings.thresholds,
    logo,
    generatedAt: new Date(),
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const safeNrp = student.nrp.replace(/[^A-Za-z0-9_-]/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=raport_gradaks_${safeNrp}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
