const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function safeFetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const yearMonth = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Fetch Câmara events for today
    const camaraEventsUrl = `https://dadosabertos.camara.leg.br/api/v2/eventos?dataInicio=${todayStr}&dataFim=${todayStr}&ordem=ASC&ordenarPor=dataHoraInicio&itens=50`;
    const camaraVotacoesUrl = `https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=${todayStr}&dataFim=${todayStr}&ordem=DESC&ordenarPor=dataHoraRegistro&itens=20`;

    // Fetch Senado agenda for this month
    const senadoAgendaUrl = `https://legis.senado.leg.br/dadosabertos/plenario/agenda/mes/${yearMonth}.json`;

    const [camaraEvents, camaraVotacoes, senadoAgenda] = await Promise.all([
      safeFetchJson(camaraEventsUrl),
      safeFetchJson(camaraVotacoesUrl),
      safeFetchJson(senadoAgendaUrl),
    ]);

    // Process Câmara events
    const eventosCamara = (camaraEvents?.dados || []).map((e: any) => ({
      id: e.id,
      titulo: e.descricaoTipo || "",
      descricao: e.descricao || "",
      dataInicio: e.dataHoraInicio,
      dataFim: e.dataHoraFim,
      situacao: e.situacao || "",
      orgaos: (e.orgaos || []).map((o: any) => o.sigla || o.nome || ""),
      localCamara: e.localCamara?.nome || "",
      urlPauta: e.uri ? `${e.uri}/pauta` : null,
    }));

    // Process today's votações from Câmara
    const votacoesHoje = (camaraVotacoes?.dados || []).map((v: any) => ({
      id: v.id,
      data: v.dataHoraRegistro,
      descricao: v.descricao || "",
      siglaOrgao: v.siglaOrgao || "",
      aprovacao: v.aprovacao,
    }));

    // Process Senado agenda - filter to today
    let senadoItems: any[] = [];
    try {
      const agendaData = senadoAgenda?.AgendaPlenario?.Sessoes?.Sessao;
      if (agendaData) {
        const sessoes = Array.isArray(agendaData) ? agendaData : [agendaData];
        senadoItems = sessoes
          .filter((s: any) => {
            const sessaoDate = (s.DataSessao || "").substring(0, 10);
            return sessaoDate === todayStr;
          })
          .map((s: any) => ({
            dataSessao: s.DataSessao,
            tipo: s.TipoSessao || "",
            situacao: s.SituacaoSessao || "",
            materias: (Array.isArray(s.Materias?.Materia) ? s.Materias.Materia : s.Materias?.Materia ? [s.Materias.Materia] : [])
              .map((m: any) => ({
                sigla: m.SiglaMateria || "",
                numero: m.NumeroMateria || "",
                ano: m.AnoMateria || "",
                ementa: m.EmentaMateria || "",
                resultado: m.ResultadoVotacao || "",
              })),
          }));
      }
    } catch {}

    // Determine status
    const now = today.getTime();
    const emAndamento = eventosCamara.filter((e: any) => {
      if (!e.dataInicio) return false;
      const start = new Date(e.dataInicio).getTime();
      const end = e.dataFim ? new Date(e.dataFim).getTime() : start + 4 * 60 * 60 * 1000;
      return start <= now && now <= end;
    });

    const proximos = eventosCamara.filter((e: any) => {
      if (!e.dataInicio) return false;
      return new Date(e.dataInicio).getTime() > now;
    });

    return jsonResponse({
      atualizado_em: today.toISOString(),
      camara: {
        eventos_hoje: eventosCamara.length,
        em_andamento: emAndamento,
        proximos: proximos.slice(0, 10),
        votacoes_hoje: votacoesHoje,
      },
      senado: {
        sessoes_hoje: senadoItems,
      },
    });
  } catch (error) {
    console.error("[agenda-live] Error:", error.message);
    return jsonResponse({ error: "Erro ao buscar agenda." }, 500);
  }
});
