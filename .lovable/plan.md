

# Monitor Legislativo — Plano de Implementação

## Visão Geral
Um webapp de transparência legislativa que analisa o alinhamento dos deputados federais com a orientação do líder do governo, com backend Supabase para cache, autenticação e histórico.

---

## 1. Backend Supabase (Lovable Cloud)

### Banco de Dados
- **Tabela `votacoes`**: Cache das votações buscadas da API da Câmara (id_votacao, data, descrição, ano)
- **Tabela `orientacoes`**: Orientação do líder do governo por votação (evita re-buscar da API)
- **Tabela `analises_deputados`**: Score de alinhamento calculado por deputado por ano (deputado_id, ano, score, total_votos, classificação)
- **Tabela `profiles`**: Perfil dos usuários logados (nome, avatar, favoritos)
- **Tabela `user_roles`**: Roles de acesso dos usuários

### Edge Function: Sincronização com API da Câmara
- Uma edge function que busca votações e orientações da API da Câmara e salva no Supabase
- Resolve o problema de rate limit (429) centralizando as chamadas no servidor
- Sempre prioriza buscar a orientação do **líder do governo** (GOV./GOVERNO/LIDGOV)
- Aceita parâmetro de **ano** para filtrar o período de busca

### Autenticação
- Login com Google via Supabase Auth
- Usuários logados podem salvar deputados favoritos e acessar exportação

---

## 2. Página Principal — Dashboard

### Barra Superior
- Logo e título "Monitor Legislativo"
- Busca por nome de deputado
- Filtro por partido (dropdown)
- **Filtro por ano** (2024, 2025, 2026) — altera o período de consulta
- **Filtro por classificação**: Governo / Centro / Oposição / Todos
- Botão de login com Google

### Painel Lateral (Estatísticas)
- Contadores: Governo, Centro, Oposição, Por Analisar
- Barra de progresso da análise
- Botão "Analisar Filtro Atual"
- Card de Metodologia (critérios de classificação)

### Grid de Deputados
- Cards com foto, nome, partido, UF e score de alinhamento
- Cores por classificação (verde/governo, azul/centro, vermelho/oposição)
- Indicador de loading individual por card durante análise
- Clique abre página de detalhes

---

## 3. Ranking de Alinhamento
- Lista ordenada dos deputados mais e menos alinhados com o governo
- Filtro por ano e partido
- Top 10 mais alinhados e top 10 mais oposicionistas em destaque

---

## 4. Gráficos por Partido
- Gráfico de barras com alinhamento médio de cada partido com o governo
- Comparação visual entre partidos usando Recharts
- Filtro por ano para ver evolução

---

## 5. Página de Detalhes do Deputado
- Foto, nome completo, partido, UF
- Score de alinhamento com barra visual
- Lista das votações analisadas mostrando: voto do deputado vs. orientação do líder do governo
- Classificação geral (Governo/Centro/Oposição)

---

## 6. Exportação de Dados
- Botão para exportar ranking e análises em CSV
- Disponível para usuários logados
- Inclui nome, partido, UF, score, classificação, total de votos

---

## 7. Design e UX
- Design moderno com Tailwind CSS, cards arredondados, sombras sutis
- Paleta: indigo como cor primária, emerald para governo, rose para oposição
- Responsivo (mobile e desktop)
- Modo claro (como no código original)
- Feedback visual durante processamento (spinners por card e global)

