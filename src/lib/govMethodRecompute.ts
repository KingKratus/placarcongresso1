/**
 * Recompute analyses based on the selected gov-method.
 *
 * - "lider" (default): keeps the original score/classification (alignment vs the government leader's orientation).
 * - "partido-gov": replaces score with the *similarity to the government party's average score*
 *   (PT by default), and re-classifies using the same thresholds applied to that similarity.
 *
 * The thresholds match the ones used elsewhere in the app:
 *   Governo  >= 70
 *   Centro   36..69
 *   Oposição <= 35
 */

export type GovMethod = "lider" | "partido-gov";

const GOV_PARTY_DEFAULT = "PT";

function classify(score: number): "Governo" | "Centro" | "Oposição" {
  if (score >= 70) return "Governo";
  if (score <= 35) return "Oposição";
  return "Centro";
}

interface AnaliseLike {
  score: number | string;
  classificacao: string;
  [k: string]: any;
}

export function recomputeAnalises<T extends AnaliseLike>(
  analises: T[],
  govMethod: GovMethod,
  partyKey: "deputado_partido" | "senador_partido",
  govParty: string = GOV_PARTY_DEFAULT,
): T[] {
  if (govMethod !== "partido-gov") return analises;

  const govParlamentares = analises.filter(
    (a) => (a[partyKey] || "").toString().toUpperCase() === govParty &&
      a.classificacao !== "Sem Dados",
  );
  if (govParlamentares.length === 0) return analises;

  const govAvg =
    govParlamentares.reduce((s, a) => s + Number(a.score), 0) / govParlamentares.length;

  return analises.map((a) => {
    if (a.classificacao === "Sem Dados") return a;
    const raw = Number(a.score);
    const similarity = Math.max(0, Math.round((100 - Math.abs(raw - govAvg)) * 10) / 10);
    return { ...a, score: similarity, classificacao: classify(similarity) };
  });
}
