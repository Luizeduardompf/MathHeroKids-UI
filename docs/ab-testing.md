# A/B Testing — Adaptive Rules

## Como funciona

A função `getRulesForChild(childId)` em `_shared/adaptive-rules.ts` faz atribuição estável 50/50 por `child_id`:

```
hash(child_id) % 2 === 0  →  rulesV1 (controlo)
hash(child_id) % 2 === 1  →  rulesV2 (experimental)
```

A mesma `child_id` sempre recebe a mesma versão. A versão usada fica gravada em `challenge_sessions.rules_version`.

## Ativar o teste

1. No Supabase Dashboard → Edge Functions → `start_challenge` → Environment Variables:
   ```
   AB_TEST_ENABLED=true
   ```
2. Fazer o mesmo em `complete_challenge`.
3. Monitorar `rules_version` em `challenge_sessions` para confirmar distribuição.

## Desativar

Remover ou definir `AB_TEST_ENABLED=false`. Todos os novos desafios recebem v1.
Desafios existentes com v2 não são afetados (mastery já foi computada com aquelas regras).

## Adicionar/modificar variante

1. Editar `backend/config/adaptive-rules-v2.json`.
2. Incrementar `"version"` no JSON.
3. Copiar para `supabase/config/adaptive-rules-v2.json`.
4. Fazer deploy das EFs que importam `_shared/adaptive-rules.ts`.
5. Abrir PR — CI valida o schema automaticamente.

## Ficheiros envolvidos

| Ficheiro | Papel |
|---|---|
| `backend/config/adaptive-rules.json` | Controlo (v1) |
| `backend/config/adaptive-rules-v2.json` | Experimental (v2) |
| `backend/config/adaptive-rules.schema.json` | Validação JSON Schema |
| `backend/functions/_shared/adaptive-rules.ts` | Loader + A/B harness |

## Invariante: `rules_version` em `challenge_sessions`

Cada sessão grava a versão que foi usada. Para analisar resultados:

```sql
-- Distribuição de versões
select rules_version, count(*) from challenge_sessions group by 1;

-- Acertos médios por versão
select cs.rules_version, avg(cs.correct_count::float / cs.total_questions) as avg_accuracy
from challenge_sessions cs
where cs.status = 'completed' and cs.rules_version is not null
group by 1;
```
