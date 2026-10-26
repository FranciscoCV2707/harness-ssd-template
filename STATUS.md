# harness-sdd-template — Status

**Última actualización**: 2026-07-28
**Componentes del template**: 8/8 base + skills/ (nuevo)
**En producción**: n/a (es una plantilla, no un proyecto desplegable)

---

## Qué es este proyecto

Plantilla canónica versionada para arrancar proyectos nuevos con el arnés
Harness SDD (Spec-Driven Development). Ver `README.md` para los 8
componentes y `apply-template.sh` para instalarla en un proyecto destino.

---

## Cómo arrancar

```bash
./apply-template.sh <dir-proyecto-destino> <nombre-proyecto> [stack]
```

Este repo no tiene build — es documentación + shell scripts. Sus pruebas de
regresión se ejecutan con `bash tests/run.sh`. `template/init.sh` es el
`init.sh` que se copia al proyecto destino, no algo que se corre aquí.

---

## Estado actual

- Los 8 componentes originales (specs, Clean Architecture, Obsidian,
  multi-IA, agentes, TDD, trazabilidad, `init.sh`) — estables desde
  `f76ff3f`, con 4 hardenings menores aplicados esta sesión (ver abajo).
- `template/.claude/skills/` — convención de skills reutilizables, plana con
  prefijo de track (`<track>-<nombre>/SKILL.md`). Ver
  `template/.claude/skills/README.md`. Detalle de la decisión y por qué no
  se anida por categoría: `plans/001-flat-skills-taxonomy.md`.
- `template/.gitignore` — **nuevo**, seed con `.obsidian/` + ruido de OS.
  Antes no existía ninguno (plan 009).
- `tests/` — pruebas de regresión del propio template; comprueban, entre otras
  cosas, que las referencias al rango de checkpoints no diverjan de
  `template/CHECKPOINTS.md`.
- `.github/workflows/ci.yml` — CI en Ubuntu y macOS para cubrir GNU/BSD `sed`;
  ejecuta validación sintáctica, las pruebas de regresión y ShellCheck.
- `template/scripts/feature-list-query` — validación y consultas de
  `feature_list.json` con autodetección de `node` o `python3`; el arnés ya no
  impone Node como herramienta del stack destino.
- `template/scripts/validate-feature-gates` — convierte en comprobaciones
  ejecutables la aprobación humana de specs y la trazabilidad completa de toda
  feature marcada `done`; `spec_ready` e `in_progress` también exigen aprobación.
- `template/init.sh` trata la divergencia entre `STATUS.md` y
  `feature_list.json` como error bloqueante, no como aviso.
- `plans/` — usado por el skill `/improve` para planes de mejora de este
  mismo repo (plantilla). Planes 001-010 ejecutados y mergeados a `main`.

---

## Última sesión

**2026-07-28** — Se detectó que Claude Code no autodetecta skills anidadas
en subcarpetas por categoría (solo escanea `.claude/skills/<nombre>/SKILL.md`,
un nivel — anthropics/claude-code#28266, #40640, feature request abierto sin
shippear). Se descartó replicar la estructura anidada de una captura de
referencia ("loopkit" vault) y en su lugar se definió convención plana con
prefijo de track. Se agregó `template/.claude/skills/README.md` (convención
+ 9 tracks sugeridos) y un skill de ejemplo (`docs-readme-sync`). Se
actualizaron `README.md` y `template/AGENTS.md` para reflejar la nueva
ubicación (plan 001).

Más tarde en la misma fecha: self-audit directo de este repo (sin
subagentes, tamaño lo permite) via `/improve`, 4 findings encontrados y
planeados (007-010):
- **007**: `feature_list.json` no tenía schema documentado — se agregó
  sección "Schema de una entrada" en `docs/specs.md`.
- **008**: `apply-template.sh` usaba `sed -i` estilo GNU, rompía en
  macOS/BSD sed por defecto — ahora detecta el flavor y rama la invocación.
- **009**: no existía ningún `.gitignore` pese a que README/docs/obsidian.md
  instruían añadir `.obsidian/` — se agregó `template/.gitignore` seed.
- **010**: `init.sh` §4 (coherencia del arnés) no cubría 2 de los 5 docs que
  `CHECKPOINTS.md` C1 promete, ni `specs/_template/` — ahora los cubre.

Los 4 ejecutados vía `/improve execute` (4 executors en worktrees aislados,
uno por plan), revisados y aprobados individualmente, mergeados a `main`
secuencialmente (008 y 009 auto-mergearon limpio en `apply-template.sh`,
hunks no solapados). Smoke test de integración final
(`apply-template.sh` + `init.sh` corridos juntos contra un proyecto
scratch) confirmó todo verde post-merge. Worktrees y branches temporales
(4 `advisor/*` + 4 `worktree-agent-*`) limpiados. Resultado: verde.
Próximos pasos: ninguno pendiente de esta sesión — quedan 2 ideas de
dirección sin planear (ver `plans/README.md` §"Direction findings
surfaced"), no bloqueantes.

---

## Stack

N/A — este repo es la plantilla en sí (bash + markdown). El stack real vive
en cada proyecto destino, configurado en su `init.config.sh`.

## Cambios recientes (mejora multi-agente)

- Añadido .opencode/opencode.json con model routing por agente (Opus medium lider).
- Añadidos stubs multi-CLI: GEMINI.md, .cursorrules.
- Añadido docs/mcp.md con MCPs opt-in para reduccion de tokens.
- Añadida skill context-pruning, model-routing, git-ops-commit-msg.
- init.sh soporta --fast/--full.
- CHECKPOINTS.md ampliado a C9 (model routing + contexto/tokens).
- AGENTS.md §9 (model routing) y §10 (contexto/tokens).
- CLAUDE.md con model routing y prompt caching.


## Cambios recientes (multi-CLI, memoria, Graphify)

- Añadido `docs/multi-cli.md` + configs de ejemplo para Codex, KiloCode, Mistral Vibe.
- Añadida memoria compartida en disco: `memory/` (append-only, todas las IAs).
- Integrado Graphify: `graphify-out/` en .gitignore + documentacion.
- MCP de memoria compartido documentado (codebase-memory-mcp / OpenViking).
