/**
 * Kuesioner 1 (Pemetaan Minat & Potensi) result of one maba, as stored in
 * QuestionnaireStatus(code K1).raw.pemetaan by scratch/import-k1-pemetaan.ts.
 * Only what the raport needs: whether the answer is usable (straight-liners
 * excluded) and the bidang with the highest stated interest (ties keep all).
 */
export type K1Interest = { valid: boolean; minatDominan: string[] };

export function parseK1Interest(raw: unknown): K1Interest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = (raw as Record<string, unknown>).pemetaan;
  if (!p || typeof p !== "object") return null;
  const valid = (p as Record<string, unknown>).valid === true;
  const dom = (p as Record<string, unknown>).minatDominan;
  return { valid, minatDominan: Array.isArray(dom) ? dom.map(String) : [] };
}
