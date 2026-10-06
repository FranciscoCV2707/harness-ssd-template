# Harness SDD Architecture

> Plantilla canónica y versionada para arrancar proyectos nuevos con un arnés
> completo de trabajo autónomo con agentes de IA: Harness SDD (Spec-Driven
> Development), Clean Architecture, integración con Obsidian, coordinación
> multi-IA, jerarquía de agentes/skills, disciplina TDD, y trazabilidad
> Requisito → Test → Commit.

Referencia conceptual: repo `betta-tech/harness-sdd` ("Harness Engineering":
specs por feature en notación EARS, `feature_list.json` con estados
`pending → spec_ready → in_progress → done`, agentes por rol, estado
persistido en disco, `init.sh` como verificación de salud). Esta plantilla
consolida y generaliza el patrón, previamente reconstruido a mano y con
variaciones en los proyectos propios `Sistema-Reservas` y `Tracker-Sales-OS`.

---

## Los 8 componentes y dónde vive cada uno

| # | Componente | Dónde vive |
|---|---|---|
| 1 | Patrón Harness SDD (specs, estados, gate humano) | `template/specs/`, `template/docs/specs.md`, `template/feature_list.json` |
| 2 | Clean Architecture | `template/docs/architecture.md` |
| 3 | Integración con Obsidian | `template/docs/obsidian.md`, frontmatter + wikilinks en `specs/` y `progress/` |
| 4 | Coordinación multi-IA | `template/AGENTS.md` (entrada canónica), `template/CLAUDE.md` (wrapper para Claude Code) |
| 5 | Jerarquía de agentes/skills | `template/.claude/agents/` (5 roles fijos) + `template/.claude/skills/` (convención plana, ver su README) |
| 6 | Disciplina TDD | `template/docs/verification.md`, `template/specs/_template/tasks.md` |
| 7 | Trazabilidad Requisito→Test→Commit | `template/specs/_template/traceability.md`, `template/CHECKPOINTS.md` (C4, C5) |
| 8 | Automatización `init.sh` | `template/init.sh` + `template/init.config.sh` (comandos del proyecto) |

---

## Uso

```bash
./apply-template.sh <dir-proyecto-destino> <nombre-proyecto> [stack]
```

- `<dir-proyecto-destino>` debe **existir ya** (el script no lo crea).
- Copia todo `template/` (incluidos los archivos ocultos de `.claude/`) al
  destino, **sin sobrescribir** archivos existentes (los reporta como
  `SKIP: <archivo> ya existe`) — aplicar la plantilla dos veces es seguro
  (idempotente).
- Sustituye `{{PROJECT_NAME}}` y `{{STACK}}` en los archivos recién copiados.
  `[stack]` es opcional; por defecto se usa `"por definir"`.
- Deja `init.sh` ejecutable (`chmod +x`).

Próximos pasos tras aplicar la plantilla (el script los imprime al terminar):

1. Editar `init.config.sh` con las herramientas y comandos reales del proyecto.
2. Rellenar `docs/conventions.md`.
3. Ejecutar `./init.sh` dentro del proyecto destino.
4. Añadir features a `feature_list.json`.
5. Revisa `.gitignore` (ya incluye `.obsidian/`) y añade lo específico de tu stack (`node_modules/`, `dist/`, etc.).

---

## Cómo funciona el ciclo SDD

```
pending ──────────► spec_ready ──────────► in_progress ──────────► done
   │                    │                       │                    │
   │  spec_author       │  GATE HUMANO          │  implementer       │  reviewer
   │  escribe            │  aprueba requirements  │  TDD por R-id      │  valida
   │  requirements.md    │  .md (obligatorio)     │  actualiza          │  CHECKPOINTS
   │                    │                       │  traceability.md   │  C1..C7
```

- Ningún agente se auto-aprueba una spec: el humano marca la casilla
  "Aprobado por humano" en `specs/<feature>/requirements.md` antes de que
  cualquier agente pase la feature a `in_progress`.
- El `implementer` sigue TDD estricto por requisito (test rojo → verde →
  refactor) y actualiza `specs/<feature>/traceability.md` en cada commit.
- El `reviewer` no aprueba si queda alguna fila "pendiente" en
  `traceability.md`, si algún test no nombra su R-id, o si `init.sh` falla.

Detalle completo del proceso: `template/docs/specs.md`.

---

## Verificación de la plantilla

Este repositorio incluye comprobaciones de regresión para mantener coherentes
los documentos y archivos que se copian al proyecto destino:

```bash
bash tests/run.sh
```

Las pruebas no requieren dependencias externas aparte de Bash y las
herramientas POSIX utilizadas por los propios scripts.

GitHub Actions ejecuta esta suite y valida la sintaxis y el lint de los scripts
en Linux con GNU `sed` y macOS con BSD `sed`. La workflow también puede lanzarse
manualmente desde la pestaña Actions.

Además de probar el instalador, la suite verifica que `init.sh` haga cumplir los
gates de aprobación humana y trazabilidad definidos por el ciclo SDD, así como
la sincronización entre `STATUS.md` y `feature_list.json`.

---

## Multi-IA

`AGENTS.md` es el **punto de entrada canónico** — cualquier agente (Claude
Code, Codex CLI, Cursor, Gemini, etc.) empieza por ahí. `CLAUDE.md` es un
wrapper delgado que solo fija el rol `leader` para Claude Code y apunta de
vuelta a `AGENTS.md`.

Para integrar otra herramienta que requiera su propio archivo de entrada
(`GEMINI.md`, `.cursorrules`, etc.), cópialo o enlázalo (symlink) como puntero
a `AGENTS.md` — el contenido normativo no se duplica, vive en un solo lugar.

---

## Hooks opcionales

`template/.claude/settings.json` se instala vacío (`{}`) a propósito — no
impone ningún hook. Un hook útil y opcional para este harness es correr
`init.sh` automáticamente al iniciar una sesión de Claude Code:

```jsonc
// .claude/settings.json — ejemplo, añadir manualmente si se desea
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "./init.sh" }
        ]
      }
    ]
  }
}
```

No se incluye por defecto para no forzar un comportamiento que puede no
encajar con todos los flujos de trabajo (ej: sesiones que no quieren correr
build/tests en cada arranque).

---

## Skills opcionales

`template/.claude/skills/` se instala con la convención documentada en
`template/.claude/skills/README.md` y un único ejemplo
(`docs-readme-sync`). Claude Code sólo autodetecta skills a un nivel de
profundidad bajo `skills/` — por eso la convención es plana con prefijo de
track (`<track>-<nombre>/SKILL.md`), no carpetas anidadas por categoría.
Añade las skills reales del proyecto siguiendo ese patrón.

---

## Filosofía

- **Stack-agnóstico**: la plantilla no asume ningún framework. Los comandos
  de build/test/lint/instalación viven en `init.config.sh`, editado por
  proyecto. Para validar `feature_list.json`, el harness usa automáticamente
  `node` o `python3`, sin imponer uno como parte del stack de la aplicación. El
  ejemplo NestJS de `docs/architecture.md` es solo un apéndice ilustrativo.
- **El estado vive en disco, no en el chat**: `feature_list.json`,
  `progress/`, `specs/` — nunca en la memoria de una conversación.
- **Anti-teléfono-descompuesto**: los subagentes escriben su resultado en un
  archivo y devuelven solo la ruta. El contenido nunca viaja por chat.
- **No se evalúa el camino, se evalúa el destino**: `CHECKPOINTS.md` define
  criterios objetivos de "terminado", no pasos de proceso.
- **Placeholders mínimos**: solo `{{PROJECT_NAME}}` y `{{STACK}}`. Todo lo
  demás en la plantilla es contenido real, listo para usar o adaptar.

---
