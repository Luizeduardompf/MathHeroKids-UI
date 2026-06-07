# Decisões Técnicas Confirmadas

Padrões arquitecturais já decididos — seguir sem propor alternativas salvo justificação forte.

---

**Ler `docs/` antes de implementar qualquer coisa.**
O projecto tem PRD, architecture.md, database-schema.md e implementation-phases.md.
Desviar sem justificativa é desperdício.

---

**Não usar SQLite para offline.** AsyncStorage sync queue é a decisão tomada.
SQLite = overengineering (schema migration client-side, conflict resolution bi-direccional).
Ver `docs/architecture.md` §4.3. Phase 8 usa AsyncStorage queue para challenge sessions pendentes.

---

**Não usar tabelas pré-computadas para rankings.** Query indexada on-demand.
Premature optimization para o scale do MVP. Ver `docs/architecture.md` §6.
Rankings via JOIN em `child_xp_ledger`. Sem scheduled Edge Functions para rankings.

---

**Edge Functions apenas onde XP/progressão é mutada.** Leitura = query Supabase directa.
Segurança anti-cheat: XP mutations via EF são o mecanismo principal de integridade.
Ao implementar qualquer feature: escrita de progressão → Edge Function; leitura → TanStack Query.

---

**Telas não chamam `supabase` directamente.** Usar `src/services/` + TanStack Query.
Separação de concerns, testabilidade, loading/error handling consistente.
