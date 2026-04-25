import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, Code2, Database, Globe, Server, Shield, BarChart2,
  GitCompareArrows, Target, Users, ExternalLink,
} from "lucide-react";

const Documentacao = () => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        partyFilter="all" onPartyFilterChange={() => {}}
        ano={new Date().getFullYear()} onAnoChange={() => {}}
        classFilter="all" onClassFilterChange={() => {}}
        partidos={[]} loading={false}
        onRefresh={() => {}} user={user} onSignIn={signInWithGoogle} onSignOut={signOut}
      />

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 py-8">
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
            Documentação
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
            Guia completo sobre o Monitor Legislativo: como funciona o projeto, as APIs utilizadas,
            a metodologia de classificação e a arquitetura técnica.
          </p>
        </div>

        <Tabs defaultValue="projeto" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="projeto" className="gap-2"><BookOpen size={14} /> Projeto</TabsTrigger>
            <TabsTrigger value="metodologia" className="gap-2"><BarChart2 size={14} /> Metodologia</TabsTrigger>
            <TabsTrigger value="apis" className="gap-2"><Globe size={14} /> APIs</TabsTrigger>
            <TabsTrigger value="agentes" className="gap-2"><Code2 size={14} /> Agentes IA</TabsTrigger>
            <TabsTrigger value="arquitetura" className="gap-2"><Server size={14} /> Arquitetura</TabsTrigger>
            <TabsTrigger value="banco" className="gap-2"><Database size={14} /> Banco de Dados</TabsTrigger>
          </TabsList>

          {/* ── PROJETO ── */}
          <TabsContent value="projeto" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen size={20} className="text-primary" /> O que é o Monitor Legislativo?
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none text-foreground space-y-4">
                <p>
                  O <strong>Monitor Legislativo</strong> é uma plataforma de transparência parlamentar que analisa o
                  <strong> alinhamento dos deputados federais e senadores</strong> com as orientações do líder do governo
                  em votações no plenário.
                </p>
                <p>
                  Inspirado na metodologia do <strong>Radar do Congresso em Foco</strong>, o projeto calcula um
                  <em> índice de governismo</em> para cada parlamentar, classificando-o como <strong>Governo</strong>,
                  <strong> Centro</strong> ou <strong>Oposição</strong>.
                </p>

                <h3 className="text-base font-bold mt-6">Funcionalidades</h3>
                <ul className="space-y-2 list-none pl-0">
                  {[
                    { icon: <Users size={16} />, text: "Dashboard de deputados e senadores com score de alinhamento" },
                    { icon: <BarChart2 size={16} />, text: "Ranking de alinhamento e gráficos por partido" },
                    { icon: <GitCompareArrows size={16} />, text: "Comparativo entre parlamentares" },
                    { icon: <Target size={16} />, text: "Análise de tendências do Centro (pendendo a Governo ou Oposição)" },
                    { icon: <Shield size={16} />, text: "Insights cruzados entre Câmara e Senado" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">{item.icon}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="text-base font-bold mt-6">Classificação dos Parlamentares</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-emerald-600 text-white">Governo ≥ 70%</Badge>
                  <Badge className="bg-indigo-600 text-white">Centro 36% – 69%</Badge>
                  <Badge className="bg-rose-600 text-white">Oposição ≤ 35%</Badge>
                  <Badge variant="secondary">Sem Dados — sem votos registrados</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── METODOLOGIA ── */}
          <TabsContent value="metodologia" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 size={20} className="text-primary" /> Metodologia de Cálculo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="formula">
                    <AccordionTrigger className="text-sm font-bold">Fórmula do Score</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                        Score (%) = (votos_alinhados / total_votos_relevantes) × 100
                      </div>
                      <p>
                        Cada votação em que o líder do governo emitiu uma orientação (Sim ou Não) conta como
                        um voto relevante. Se o parlamentar votou de acordo com a orientação, conta como alinhado.
                      </p>
                      <p>
                        <strong>Votos que não contam:</strong> Votações onde o governo orientou "Liberado"
                        são excluídas do cálculo.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="consenso">
                    <AccordionTrigger className="text-sm font-bold">Filtro de Consenso (Senado)</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p>
                        No Senado, votações em que <strong>governo e oposição orientaram da mesma forma</strong> são
                        excluídas (consideradas consensuais). Isso evita inflar artificialmente os scores, pois
                        votações unânimes não revelam posicionamento ideológico.
                      </p>
                      <div className="bg-muted p-3 rounded-lg text-xs">
                        <strong>Exemplo:</strong> Se governo orienta "Sim" e oposição orienta "Sim",
                        essa votação é classificada como consenso e ignorada no cálculo.
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="tendencias">
                    <AccordionTrigger className="text-sm font-bold">Tendências do Centro</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p>
                        Parlamentares classificados como Centro (35% &lt; score &lt; 70%) são subdivididos em:
                      </p>
                      <ul className="list-disc pl-6 space-y-1">
                        <li><strong>Pendendo a Governo:</strong> Score &gt; 55.5% (acima do ponto médio + 3pp)</li>
                        <li><strong>Neutro:</strong> Score entre 49.5% e 55.5%</li>
                        <li><strong>Pendendo a Oposição:</strong> Score &lt; 49.5% (abaixo do ponto médio - 3pp)</li>
                      </ul>
                      <p className="text-muted-foreground">
                        O ponto médio do Centro é 52.5% (média de 35% e 70%). A margem de ±3pp define a zona neutra.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="migracao">
                    <AccordionTrigger className="text-sm font-bold">Migração entre Anos</AccordionTrigger>
                    <AccordionContent>
                      <p>
                        A comparação ano-a-ano identifica parlamentares que mudaram de classificação
                        (ex: saíram do Centro para Governo) ou que tiveram variação de score superior a 3 pontos
                        percentuais, indicando uma tendência de migração ideológica.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── APIs ── */}
          <TabsContent value="apis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe size={20} className="text-primary" /> API da Câmara dos Deputados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>
                  A API de Dados Abertos da Câmara fornece informações sobre deputados, votações, orientações
                  e proposições legislativas. Documentação oficial:
                </p>
                <a
                  href="https://dadosabertos.camara.leg.br/swagger/api.html"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  dadosabertos.camara.leg.br <ExternalLink size={14} />
                </a>

                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="dep-list">
                    <AccordionTrigger className="text-sm font-bold">GET /deputados</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>Lista todos os deputados em exercício ou de uma legislatura específica.</p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        GET https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=57&ordem=ASC&ordenarPor=nome
                      </div>
                      <p className="text-muted-foreground">Retorna: id, nome, siglaPartido, siglaUf, urlFoto.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="orientacoes-bulk">
                    <AccordionTrigger className="text-sm font-bold">Arquivo Bulk: Orientações de Bancada</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>
                        Arquivo JSON com todas as orientações de bancada de um ano. Usado para identificar
                        em quais votações o governo emitiu orientação.
                      </p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        GET https://dadosabertos.camara.leg.br/arquivos/votacoesOrientacoes/json/votacoesOrientacoes-2025.json
                      </div>
                      <p className="text-muted-foreground">
                        Campo-chave: <code>siglaBancada</code> — filtramos por "Governo", "Gov.", "Líder do Governo", "LIDGOV".
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="votos-votacao">
                    <AccordionTrigger className="text-sm font-bold">GET /votacoes/&#123;id&#125;/votos</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>Retorna os votos individuais de cada deputado em uma votação específica.</p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        GET https://dadosabertos.camara.leg.br/api/v2/votacoes/&#123;idVotacao&#125;/votos
                      </div>
                      <p className="text-muted-foreground">
                        Retorna: deputado_.id, deputado_.nome, tipoVoto (Sim, Não, Abstenção, etc).
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="votacao-meta">
                    <AccordionTrigger className="text-sm font-bold">GET /votacoes/&#123;id&#125;</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>Metadados de uma votação: data, descrição, proposições afetadas.</p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        GET https://dadosabertos.camara.leg.br/api/v2/votacoes/&#123;idVotacao&#125;
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe size={20} className="text-primary" /> API do Senado Federal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>
                  A API de Dados Abertos do Senado fornece informações sobre senadores, votações nominais
                  e orientações de liderança. Documentação oficial:
                </p>
                <a
                  href="https://legis.senado.leg.br/dadosabertos/docs/"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  legis.senado.leg.br/dadosabertos <ExternalLink size={14} />
                </a>

                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="sen-list">
                    <AccordionTrigger className="text-sm font-bold">GET /senador/lista/atual</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>Lista os senadores em exercício com código, nome, partido, UF e foto.</p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        GET https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="sen-orientacoes">
                    <AccordionTrigger className="text-sm font-bold">GET /plenario/votacao/orientacaoBancada/&#123;dataIni&#125;/&#123;dataFim&#125;</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>
                        Retorna votações com orientações de liderança dentro de um período (máx. 60 dias por janela).
                        Inclui orientação do governo, oposição e demais bancadas, além dos votos individuais dos senadores.
                      </p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                        GET https://legis.senado.leg.br/dadosabertos/plenario/votacao/orientacaoBancada/20250101/20250228.json
                      </div>
                      <p className="text-muted-foreground">
                        Formato de data: YYYYMMDD. O endpoint retorna votações, orientações de bancada e votos em uma única chamada.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="sen-nome-matching">
                    <AccordionTrigger className="text-sm font-bold">Matching de Nomes (Fuzzy)</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p>
                        A API de votações do Senado retorna nomes que nem sempre correspondem ao cadastro oficial.
                        O sistema usa múltiplas estratégias de resolução:
                      </p>
                      <ol className="list-decimal pl-6 space-y-1">
                        <li><strong>Match exato</strong> — nome idêntico ao cadastro</li>
                        <li><strong>Aliases conhecidos</strong> — tabela de equivalência manual (ex: "Astr. Marcos Pontes" → "Astronauta Marcos Pontes")</li>
                        <li><strong>Normalizado</strong> — remove acentos, prefixos (Dr., Prof., Sen.) e compara</li>
                        <li><strong>Match parcial</strong> — verifica se o nome normalizado está contido no outro</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 size={20} className="text-primary" /> Normalização de Votos
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <p>
                  Os votos retornados pelas APIs são normalizados para um conjunto padrão antes do cálculo:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Câmara</h4>
                    <ul className="font-mono text-xs space-y-1">
                      <li>"Sim", "Yes" → <Badge variant="outline" className="text-emerald-600">sim</Badge></li>
                      <li>"Não", "Nao", "No" → <Badge variant="outline" className="text-rose-600">não</Badge></li>
                      <li>"Abstenção" → <Badge variant="secondary">abstencao</Badge></li>
                      <li>"Obstrução" → <Badge variant="secondary">obstrucao</Badge></li>
                      <li>"Ausente" → <Badge variant="secondary">ausente</Badge></li>
                    </ul>
                  </div>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Senado</h4>
                    <ul className="font-mono text-xs space-y-1">
                      <li>"SIM", "YES" → <Badge variant="outline" className="text-emerald-600">sim</Badge></li>
                      <li>"NÃO", "NAO" → <Badge variant="outline" className="text-rose-600">não</Badge></li>
                      <li>"ABSTENÇÃO" → <Badge variant="secondary">abstencao</Badge></li>
                      <li>"LIBERADO" → <Badge variant="secondary">liberado</Badge></li>
                      <li>"P-NRV", "AP", "LS" → <Badge variant="secondary">ausente</Badge></li>
                      <li>"PRESIDENTE" → <Badge variant="secondary">presidente</Badge> (ignorado)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="agentes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 size={20} className="text-primary" /> Tutorial: agente de IA com API pública
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <p>
                  Este roteiro cria um agente que consulta apenas dados públicos do Monitor Legislativo: rankings, votações e votos individuais por votação. Use uma chave gerada no Perfil e nunca coloque essa chave em sites de terceiros expostos ao público sem um backend intermediário.
                </p>

                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="passo-1">
                    <AccordionTrigger className="text-sm font-bold">1. Gerar a chave e definir o escopo</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <ol className="list-decimal pl-6 space-y-2">
                        <li>Entre no Perfil.</li>
                        <li>Crie uma API Key com um nome identificável, por exemplo “Agente ranking 2026”.</li>
                        <li>Copie a chave uma vez e guarde em cofre seguro.</li>
                        <li>Defina quais perguntas o agente pode responder: ranking, score, classificação, votações, voto por votação e filtros por partido/UF.</li>
                      </ol>
                      <div className="bg-muted p-3 rounded-lg text-xs">
                        Regra de segurança: o agente nunca deve pedir nem tentar acessar perfis, conversas, logs, chaves, papéis de usuário ou tabelas administrativas.
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="passo-2">
                    <AccordionTrigger className="text-sm font-bold">2. Autenticação e URL base</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p>Todos os requests usam header Bearer:</p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">{`Authorization: Bearer pk_sua_chave_aqui
GET ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-dados?casa=camara&ano=2026&tipo=analises&limit=50`}</div>
                      <p className="text-muted-foreground">Parâmetros principais: <code>casa</code>, <code>ano</code>, <code>tipo</code>, <code>limit</code>, <code>offset</code>, <code>partido</code>, <code>uf</code>, <code>classificacao</code> e <code>votacao_id</code>.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="passo-3">
                    <AccordionTrigger className="text-sm font-bold">3. Endpoints que o agente pode chamar</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">GET /api-dados?tipo=analises&casa=camara&ano=2026&partido=PT&limit=20</div>
                        <p className="text-muted-foreground">Retorna parlamentares ranqueados por score, com partido, UF, classificação, votos alinhados e total de votos.</p>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">GET /api-dados?tipo=votacoes&casa=senado&ano=2026&limit=50&offset=0</div>
                        <p className="text-muted-foreground">Retorna votações paginadas, descrição, data, matéria e resultado quando disponível.</p>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">GET /api-dados?tipo=votos&casa=camara&ano=2026&votacao_id=ID_DA_VOTACAO&partido=PL</div>
                        <p className="text-muted-foreground">Retorna votos individuais de uma votação específica. O campo <code>votacao_id</code> é obrigatório.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="passo-4">
                    <AccordionTrigger className="text-sm font-bold">4. Ferramenta do agente em JavaScript</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">{`async function consultarMonitor(params) {
  const qs = new URLSearchParams(params);
  const res = await fetch(
    "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-dados?" + qs,
    { headers: { Authorization: "Bearer " + process.env.MONITOR_API_KEY } }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Exemplo: top 10 deputados do PT
await consultarMonitor({ casa: "camara", ano: "2026", tipo: "analises", partido: "PT", limit: "10" });`}</div>
                      <p className="text-muted-foreground">Use a chave em variável de ambiente do seu servidor/agente, não diretamente em uma página pública.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="passo-5">
                    <AccordionTrigger className="text-sm font-bold">5. Prompt de sistema recomendado</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="bg-muted p-3 rounded-lg text-xs whitespace-pre-wrap">{`Você é um agente de análise legislativa. Use apenas os endpoints públicos autorizados do Monitor Legislativo. Não invente dados: se a API não retornar informação suficiente, diga que não há dados. Sempre cite ano, Casa, filtros usados e paginação. Nunca solicite chaves, dados pessoais, logs, perfis, conversas, user_roles ou api_keys. Para votos individuais, peça ou descubra primeiro o votacao_id por meio de tipo=votacoes.`}</div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="passo-6">
                    <AccordionTrigger className="text-sm font-bold">6. Boas práticas de produção</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Use paginação: <code>limit</code> máximo 1000 e <code>offset</code> incremental.</li>
                        <li>Faça cache curto para rankings e votações, especialmente em agentes com muitos usuários.</li>
                        <li>Trate erros 401/403 como chave ausente, inválida ou inativa.</li>
                        <li>Trate erros 400 como parâmetros inválidos e peça ao usuário para escolher Casa, ano ou tipo correto.</li>
                        <li>Não permita que usuários finais alterem livremente nomes de tabelas ou criem queries.</li>
                        <li>Se publicar uma API para terceiros, crie seu próprio backend intermediário para controlar rate limit e esconder a chave principal.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ARQUITETURA ── */}
          <TabsContent value="arquitetura" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server size={20} className="text-primary" /> Arquitetura do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="bg-muted p-4 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre">{`
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  React + Vite + TypeScript + Tailwind + shadcn/ui   │
│  Recharts (gráficos) · React Router (navegação)     │
└────────────────────┬────────────────────────────────┘
                     │ Supabase JS Client
                     ▼
┌─────────────────────────────────────────────────────┐
│                  Backend (Cloud)                     │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ sync-camara  │  │ sync-senado  │  Edge Functions │
│  │ (Deno)       │  │ (Deno)       │                 │
│  └──────┬───────┘  └──────┬───────┘                 │
│         │                 │                         │
│         ▼                 ▼                         │
│  ┌─────────────────────────────────┐                │
│  │     PostgreSQL (Supabase)       │                │
│  │  votacoes · orientacoes         │                │
│  │  analises_deputados             │                │
│  │  votacoes_senado                │                │
│  │  analises_senadores             │                │
│  │  votos_deputados                │                │
│  │  votos_senadores                │                │
│  │  profiles · user_roles          │                │
│  └─────────────────────────────────┘                │
└─────────────────────────────────────────────────────┘
                     ▲
                     │ HTTP (fetch)
                     ▼
┌─────────────────────────────────────────────────────┐
│              APIs Externas (Dados Abertos)           │
│  Câmara: dadosabertos.camara.leg.br                 │
│  Senado: legis.senado.leg.br/dadosabertos           │
└─────────────────────────────────────────────────────┘
`}</div>

                <h3 className="font-bold text-base mt-4">Fluxo de Dados</h3>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    <strong>Sincronização:</strong> As edge functions <code>sync-camara</code> e <code>sync-senado</code> são
                    chamadas manualmente ou via cron. Elas buscam votações, orientações e votos das APIs externas.
                  </li>
                  <li>
                    <strong>Processamento:</strong> Para cada votação com orientação do governo, os votos individuais
                    são comparados à orientação. Scores são calculados e classificações atribuídas.
                  </li>
                  <li>
                    <strong>Armazenamento:</strong> Os dados processados são salvos via upsert no banco PostgreSQL,
                    evitando duplicatas.
                  </li>
                  <li>
                    <strong>Frontend:</strong> O React consome os dados diretamente do banco via Supabase Client,
                    renderizando dashboards, rankings, gráficos e análises de tendências.
                  </li>
                </ol>

                <h3 className="font-bold text-base mt-4">Stack Tecnológica</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    "React 18", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui",
                    "Recharts", "React Router", "TanStack Query", "Deno (Edge Functions)",
                    "PostgreSQL", "Lovable Cloud",
                  ].map((tech) => (
                    <Badge key={tech} variant="secondary">{tech}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 size={20} className="text-primary" /> Edge Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Accordion type="multiple">
                  <AccordionItem value="sync-camara">
                    <AccordionTrigger className="text-sm font-bold">sync-camara</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p><strong>Objetivo:</strong> Sincronizar votações da Câmara dos Deputados.</p>
                      <p><strong>Parâmetro:</strong> <code>&#123;"ano": 2025&#125;</code></p>
                      <p><strong>Passos:</strong></p>
                      <ol className="list-decimal pl-6 space-y-1">
                        <li>Baixa orientações de bancada do arquivo bulk anual</li>
                        <li>Filtra votações com orientação do governo (não-liberado)</li>
                        <li>Busca metadados de cada votação via API REST</li>
                        <li>Busca votos individuais de cada deputado por votação</li>
                        <li>Calcula score de alinhamento e classifica cada deputado</li>
                        <li>Armazena tudo via upsert no banco</li>
                      </ol>
                      <p><strong>Retorno:</strong> <code>&#123;analyzed, votacoes_with_gov, votos_stored, year&#125;</code></p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="sync-senado">
                    <AccordionTrigger className="text-sm font-bold">sync-senado</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p><strong>Objetivo:</strong> Sincronizar votações do Senado Federal.</p>
                      <p><strong>Parâmetro:</strong> <code>&#123;"ano": 2025&#125;</code></p>
                      <p><strong>Passos:</strong></p>
                      <ol className="list-decimal pl-6 space-y-1">
                        <li>Busca votações com orientações de bancada em janelas de 60 dias</li>
                        <li>Carrega lista de senadores atuais para mapping de nomes → IDs</li>
                        <li>Filtra votações consensuais (governo = oposição)</li>
                        <li>Para cada votação relevante, compara votos individuais com orientação do governo</li>
                        <li>Resolve nomes via matching fuzzy (aliases, normalização, parcial)</li>
                        <li>Calcula score e classifica cada senador</li>
                      </ol>
                      <p><strong>Retorno:</strong> <code>&#123;analyzed, votacoes_total, votacoes_with_gov, consensus_skipped, unresolved_names, year&#125;</code></p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BANCO DE DADOS ── */}
          <TabsContent value="banco" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={20} className="text-primary" /> Esquema do Banco de Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                {[
                  {
                    name: "analises_deputados",
                    desc: "Score de alinhamento calculado por deputado por ano.",
                    cols: "deputado_id, deputado_nome, deputado_partido, deputado_uf, deputado_foto, ano, score, total_votos, votos_alinhados, classificacao",
                    key: "UNIQUE(deputado_id, ano)",
                  },
                  {
                    name: "analises_senadores",
                    desc: "Score de alinhamento calculado por senador por ano.",
                    cols: "senador_id, senador_nome, senador_partido, senador_uf, senador_foto, ano, score, total_votos, votos_alinhados, classificacao",
                    key: "UNIQUE(senador_id, ano)",
                  },
                  {
                    name: "votacoes",
                    desc: "Cache das votações da Câmara com metadados de proposição.",
                    cols: "id_votacao, data, descricao, ano, sigla_orgao, proposicao_tipo, proposicao_numero, proposicao_ementa, proposicao_ano",
                    key: "UNIQUE(id_votacao)",
                  },
                  {
                    name: "votacoes_senado",
                    desc: "Cache das votações do Senado.",
                    cols: "codigo_sessao_votacao, data, descricao, resultado, ano, sigla_materia, numero_materia, materia_ano, ementa",
                    key: "UNIQUE(codigo_sessao_votacao)",
                  },
                  {
                    name: "orientacoes",
                    desc: "Orientações de bancada por votação (Câmara).",
                    cols: "id_votacao, sigla_orgao_politico, orientacao_voto",
                    key: "UNIQUE(id_votacao, sigla_orgao_politico)",
                  },
                  {
                    name: "votos_deputados",
                    desc: "Votos individuais de cada deputado por votação.",
                    cols: "deputado_id, id_votacao, voto, ano",
                    key: "UNIQUE(deputado_id, id_votacao)",
                  },
                  {
                    name: "votos_senadores",
                    desc: "Votos individuais de cada senador por votação.",
                    cols: "senador_id, codigo_sessao_votacao, voto, ano",
                    key: "UNIQUE(senador_id, codigo_sessao_votacao)",
                  },
                  {
                    name: "profiles",
                    desc: "Perfil dos usuários logados (favoritos, avatar).",
                    cols: "user_id, display_name, avatar_url, favoritos",
                    key: "user_id (FK → auth.users)",
                  },
                  {
                    name: "user_roles",
                    desc: "Roles de acesso (admin, moderator, user).",
                    cols: "user_id, role",
                    key: "UNIQUE(user_id, role)",
                  },
                ].map((table) => (
                  <div key={table.name} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{table.name}</Badge>
                    </div>
                    <p className="text-muted-foreground">{table.desc}</p>
                    <div className="bg-muted p-3 rounded font-mono text-xs break-all">
                      {table.cols}
                    </div>
                    <p className="text-xs text-muted-foreground">🔑 {table.key}</p>
                  </div>
                ))}

                <div className="border border-border rounded-lg p-4 space-y-2">
                  <Badge variant="outline" className="font-mono">Enums</Badge>
                  <ul className="text-xs space-y-1 font-mono">
                    <li><strong>classificacao_tipo:</strong> 'Governo' | 'Centro' | 'Oposição' | 'Sem Dados'</li>
                    <li><strong>app_role:</strong> 'admin' | 'moderator' | 'user'</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="text-center py-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
          Monitor Legislativo • Documentação • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};

export default Documentacao;
