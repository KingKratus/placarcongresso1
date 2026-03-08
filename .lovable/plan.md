

# Plan: Fix broken Portal links + add reliable alternative sources

## Problem
The current link `https://www.camara.leg.br/internet/votacao/mostraVotacao.asp?ideVotacao={id_votacao}` is always broken because the `id_votacao` format (e.g. `2484059-7`) doesn't match that legacy URL pattern.

## Solution
Replace the single broken link with up to 3 reliable links per voting record:

1. **"Proposição"** -- When `proposicao_tipo` and `proposicao_numero` are available, link to the Câmara's legislative search:
   `https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada?q={tipo}+{numero}/{ano}`
   This always finds the exact bill.

2. **"API"** -- Link to the Dados Abertos API which always works:
   `https://dadosabertos.camara.leg.br/api/v2/votacoes/{id_votacao}`
   Shows the full JSON of the voting record (reliable, never broken).

3. **"Buscar"** -- Google search fallback with the bill info:
   `https://www.google.com/search?q=site:camara.leg.br+{tipo}+{numero}`
   Finds the bill on the Câmara website via Google.

## File to Change
- `src/pages/DeputadoDetail.tsx` -- Replace the single broken `<a>` tag (lines 495-504) with the 2-3 links above, conditionally rendered based on available metadata.

