---
name: model-routing
description: Route each subagent to the cheapest model that can do the job: Opus medium for leader/spec_author, Sonnet for implementer/reviewer, Haiku for explorer. Use when launching subagents or configuring agents.
---

# model-routing

## Tabla
| Rol | Modelo | Effort |
|---|---|---|
| leader | Claude Opus | medium |
| spec_author | Claude Opus | medium |
| reviewer | Claude Sonnet (Opus en features criticas) | medium |
| implementer | Claude Sonnet | low/medium |
| explorer | Claude Haiku | low |

## Reglas
- Nunca dejes que un subagente de bajo coste herede Opus por defecto: declara `model` en el frontmatter de `.claude/agents/*.md` o en `.opencode/opencode.json`.
- El lider siempre es Opus medium (no high por defecto; high solo en decisiones arquitectonicas).
- Para tareas mecanicas (rename, formato), usa el modelo mas barato disponible.
- Diversifica: Gemini para docs, GPT para review si reduce coste sin perder calidad (ver `oh-my-opencode`).

## Verificacion
- `grep -R "model:" .claude/agents/` debe mostrar modelo explicito en cada agente.
- `.opencode/opencode.json` debe existir con routing por agente.
