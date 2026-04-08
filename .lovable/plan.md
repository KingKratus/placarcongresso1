

# Plano: Aba Admin + Correção de Bugs

## Bugs Identificados

1. **Runtime Error: "Rendered more hooks than during the previous render"** em `Senado.tsx` (linha 104). Provavelmente causado por hook condicional ou ordem de hooks alterada em edição anterior. Precisa investigar e corrigir.

2. **15 sync_runs presas com status "running"** há mais de 30 minutos. Devem ser marcadas como "error" ou "stale". A aba Admin terá um botão para limpar esses registros.

3. **Câmara 2024 sem dados**: Não há registros em `analises_deputados` para 2024 com sync completa (query mostra 572 registros, 0 sem dados - OK, mas não há sync_runs para 2024). Precisa sync 2024.

4. **Câmara 2026 tem 40 erros e 12 running presos** nos sync_runs.

## Nova Página: `/admin`

Uma página dedicada para administradores com as seguintes seções:

### Seção 1: Visão Geral do Sistema
- Contagem de registros por tabela (analises, votacoes, votos)
- Cobertura por ano/casa (deputados analisados, sem dados, etc.)
- Sync runs com status breakdown

### Seção 2: Gerenciamento de Syncs
- Mover o `AdminBulkSync` existente para esta página (remover das sidebars de Index/Senado)
- Adicionar botão "Limpar syncs presas" (marcar running > 30min como error)
- Histórico completo de syncs (não apenas últimos 30)

### Seção 3: Gerenciamento de Usuários
- Lista de admins atuais
- (Futuro: adicionar/remover admins)

### Seção 4: Diagnóstico de Dados
- Parlamentares "Sem Dados" por ano com detalhes
- Botão de re-sync individual por ano

## Alterações Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Admin.tsx` | Nova página com tabs: Visão Geral, Syncs, Dados, Usuários |
| `src/pages/Senado.tsx` | Corrigir bug de hooks (investigar linha 104) |
| `src/pages/Index.tsx` | Remover AdminBulkSync da sidebar (mover para Admin) |
| `src/pages/Senado.tsx` | Remover AdminBulkSync da sidebar |
| `src/components/Navbar.tsx` | Adicionar link "Admin" visível apenas para admins |
| `src/App.tsx` | Adicionar rota `/admin` |
| Migration SQL | Nenhuma necessária - usaremos `has_role` existente |

## Sugestões de Novas Funcionalidades

1. **Limpeza automática de sync_runs presas** - trigger ou cron que marca como error após timeout
2. **Notificações de sync** - alertar admin quando sync falha
3. **Dashboard de cobertura temporal** - visualizar gaps de dados por mês
4. **Export de dados administrativos** - CSV com relatório de saúde do sistema
5. **Rate limiting visual** - mostrar cooldown restante para cada casa/ano

