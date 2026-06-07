# Permissões de Sessão

Pedir **logo no início de cada sessão**, antes de qualquer trabalho.

## request_access obrigatório

```
apps: ["Simulator", "Google Chrome", "Terminal"]
clipboardRead: true
clipboardWrite: true
reason: "Trabalho no MathHeroKids: testar no Simulator, Supabase dashboard no Chrome, verificar Terminal."
```

## Tiers resultantes

| App | Tier | Como usar |
|-----|------|-----------|
| Simulator | **full** | Cliques, teclado, screenshots — tudo |
| Google Chrome | **read** | Só screenshots — interacção via Claude-in-Chrome |
| Terminal | **click** | Só cliques — comandos via Bash tool |
| Clipboard | read + write | Colar URLs no Simulator, etc. |

## Claude-in-Chrome extension
Já instalada. Funciona automaticamente para: navegação, cliques, JS, Supabase dashboard, GitHub.

## Ordem de inicialização

```
1. request_access(["Simulator", "Google Chrome", "Terminal"], clipboard=true)
2. bash: .scripts/session-setup.sh
3. cat .ai/session-handoff.md
4. trabalho
```
