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

---

**Workflow do Simulator iOS:**
- O utilizador corre `npx expo start` no Terminal do Mac (projecto em `~/Documents/Claude/Projects/MathHeroKids-UI`)
- Metro URL: `exp://192.168.1.247:8081` (IP pode mudar, porta 8081 é fixa)
- Expo Go está instalado no Simulator (iPhone 17, iOS 26.5)
- **Atenção:** Expo Go no Simulator precisa de estar actualizado para SDK 56 — se der erro "incompatible", pressionar `i` no terminal do `expo start` para reinstalar automaticamente
- Depois de arrancado, o Claude navega a app autonomamente via computer-use (Simulator tem acesso full ✅)
- O Bash sandbox não consegue manter o processo Expo vivo entre chamadas — o utilizador tem de iniciar o servidor

---

**Scripts de automação do agente ficam em `.scripts/` (gitignored).**
Quando o Claude precisar de criar scripts para clicar/executar tarefas no Mac, guarda em `.scripts/`. A pasta está no `.gitignore` — não entra no repositório. Manter organizado com nomes descritivos (ex: `open-simulator.sh`, `run-migrations.sh`).

---

**Todo o git é feito via Bash tool (command line) — nunca via GitHub Desktop.**
GitHub Desktop a correr em simultâneo com o Bash tool causa git lock conflicts no mount virtiofs (sandbox Linux + macOS partilham o mesmo `.git/`). Já configurado: `gc.auto=0`, `maintenance.auto=false`, `core.lockTimeout=600`. Se lock ficar preso: `git fix-locks`.
