/**
 * Read-only dump of everything the per-HMD development report needs, for the
 * whole cohort (so FTEIC comparison figures come from the same computation as
 * the recap page and its Excel export).
 *
 *   npx tsx --conditions=react-server scratch/export-hmd-report-data.ts <out.json>
 *
 * Writes nothing to the database.
 */
import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../lib/prisma";
import { loadRecapComputation } from "../lib/scoring/recap";
import { getActiveRecommendationRulesForEvaluation, evaluateRecommendation } from "../lib/scoring/recommendation";

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("usage: export-hmd-report-data.ts <out.json>");

  const { data, computedByNrp } = await loadRecapComputation();
  const rules = await getActiveRecommendationRulesForEvaluation();

  const [students, departments, regions, units, mentors, kareg, sessions, rulesFull, settings] = await Promise.all([
    prisma.student.findMany({
      where: { active: true },
      select: {
        nrp: true,
        name: true,
        unit: { select: { code: true, name: true } },
        personalityProfile: { select: { mbtiType: true, temperament: true } },
        questionnaireStatuses: { select: { code: true, submitted: true, submittedAt: true } },
        logbookEntries: { select: { periodLabel: true, status: true } },
        flags: { select: { message: true, status: true, createdAt: true } },
        raportSnapshot: { select: { recommendation: true, dataInsufficient: true, finalizedAt: true, personalScore: true, skillScore: true } },
      },
    }),
    prisma.department.findMany({ select: { code: true, name: true } }),
    prisma.region.findMany({ select: { code: true, name: true } }),
    prisma.unit.findMany({
      select: {
        code: true,
        name: true,
        region: { select: { name: true } },
        mentor: { select: { name: true, nrp: true, active: true, department: { select: { name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { name: true, nrp: true, active: true, unit: { select: { code: true } }, region: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { role: "KEPALA_REGION" },
      select: { name: true, nrp: true, active: true, region: { select: { name: true } } },
    }),
    prisma.activitySession.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        scheduledAt: true,
        mode: true,
        skillCategory: true,
        activity: { select: { code: true, name: true, attendanceCategory: true, order: true } },
      },
    }),
    prisma.recommendationRule.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.setting.findMany(),
  ]);

  const extra = new Map(students.map((s) => [s.nrp, s]));
  const rows = data.rows.map((r) => {
    const c = computedByNrp.get(r.nrp)!;
    const e = extra.get(r.nrp);
    const rec = c.eligibility.eligible ? evaluateRecommendation(c, rules) : null;
    return {
      ...r,
      unitCode: e?.unit.code ?? null,
      groups: c.personal.groups.map((g) => ({ code: g.code, label: g.label, score: g.score })),
      materiScore: c.personal.materiScore,
      skillDetail: c.skill.categories,
      personalItems: c.personal.items.map((i) => ({
        label: i.label,
        source: i.source,
        origin: i.origin,
        targets: i.targets,
        raw: i.rawValue,
        max: i.maxValue,
        norm: i.normalizedValue,
      })),
      skillItems: c.skill.items.map((i) => ({
        label: i.label,
        source: i.source,
        origin: i.origin,
        targets: i.targets,
        raw: i.rawValue,
        max: i.maxValue,
        norm: i.normalizedValue,
      })),
      attendanceDetail: c.attendance.map((sec) => ({
        category: sec.category,
        entries: sec.entries.map((en) => ({ sessionId: en.sessionId, code: en.sessionCode, name: en.sessionName, status: en.status, participation: en.participationScore, fromScores: en.derivedFromScores })),
        absences: sec.absences,
        izin: sec.izinCount,
        held: sec.heldCount,
        score: sec.score,
      })),
      eligibilityMessage: c.eligibility.message,
      recommendation: rec,
      personality: e?.personalityProfile ?? null,
      questionnaires: e?.questionnaireStatuses ?? [],
      logbook: e?.logbookEntries ?? [],
      flags: e?.flags ?? [],
      snapshot: e?.raportSnapshot ?? null,
    };
  });

  fs.writeFileSync(
    out,
    JSON.stringify(
      { meta: data.meta, rows, departments, regions, units, mentors, kareg, sessions, rules: rulesFull, settings },
      null,
      0,
    ),
  );
  console.log(`wrote ${rows.length} rows -> ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
