export const BANCADAS: Record<string, string[]> = {
  "Base Gov": [
    "PT", "PSD", "MDB", "PP", "PV", "PCdoB", "SOLIDARIEDADE", "PSDB",
    "AVANTE", "PRD", "AGIR", "REDE", "PSB", "PDT",
  ],
  "Oposição": ["PL", "NOVO", "UNIÃO"],
  "Independente": [],
};

export function getBancada(siglaPartido: string): string {
  for (const [bancada, partidos] of Object.entries(BANCADAS)) {
    if (bancada === "Independente") continue;
    if (partidos.includes(siglaPartido.toUpperCase())) return bancada;
  }
  return "Independente";
}

export const BANCADA_OPTIONS = ["all", "Base Gov", "Oposição", "Independente"];
