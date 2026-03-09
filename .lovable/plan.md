

# Corrigir Classificação de Senadores — Filtrar Votações Consensuais

## Problema Identificado

A raiz do problema **não é o endpoint** — o endpoint `orientacaoBancada` está correto e retorna os dados esperados. O problema está na **metodologia de cálculo**.

Analisando os dados reais da API, vi que na maioria das votações, tanto "Governo" quanto "Oposição" orientam **a mesma coisa** (ex: ambos orientam "SIM"). Isso são votações consensuais. Como o código atual conta TODAS as votações onde o governo orientou "sim" ou "não", senadores de oposição como Flávio Bolsonaro, Rogério Marinho, Damares Alves (PL) acabam com scores altos (70-88%) porque votaram igual ao governo nessas votações consensuais.

Exemplos concretos no banco:
- Marcos Rogério (PL): 70.59% → classificado como "Governo"
- Cleitinho (Republicanos): 70.27% → classificado como "Governo"  
- Dra. Eudócia (PL): 87.88% → classificado como "Governo"

## Solução

Filtrar votações onde **governo e oposição divergem**. Somente votações onde a orientação do "Governo" é diferente da orientação da "Oposição" devem contar para o cálculo de alinhamento. Votações consensuais (governo e oposição orientam igual) não discriminam posição política e devem ser excluídas.

Esta é a mesma abordagem do Radar do Congresso / Estadão Dados para evitar inflação de scores.

## Alterações Técnicas

### 1. Edge Function `sync-senado/index.ts`

Modificar a lógica de filtragem de votações (linhas ~154-170):

- Além de extrair `govOrient`, também extrair a orientação da "Oposição" do array `orientacoesLideranca`
- Adicionar condição: **pular votações onde `govOrient === opoOrient`** (ambos "sim" ou ambos "não")
- Manter a condição existente de pular quando governo orienta "liberado"
- Adicionar logging de quantas votações foram filtradas por consenso

Pseudocódigo:
```text
Para cada votação:
  1. Buscar orientação "Governo" → govOrient
  2. Buscar orientação "Oposição" → opoOrient  
  3. Se govOrient == null ou não é "sim"/"não" → pular
  4. Se opoOrient existe e govOrient == opoOrient → pular (consenso)
  5. Caso contrário → contar para alinhamento
```

### 2. Re-sincronizar dados

Após deploy da edge function corrigida, será necessário rodar uma nova sincronização para recalcular os scores de todos os senadores.

## Impacto Esperado

- Senadores de oposição (PL, NOVO) que votam contra o governo nas votações divergentes terão scores mais baixos e serão corretamente classificados como "Oposição" ou "Centro"
- Senadores da base (PT, MDB, PSD) que votam com o governo nas votações divergentes manterão scores altos
- O número de votações consideradas será menor, mas muito mais significativo

