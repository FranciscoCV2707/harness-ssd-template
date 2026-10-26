# Multi-CLI — {{PROJECT_NAME}}

> Cómo usar el mismo arnés (AGENTS.md) con cada herramienta del stack:
> KiloCode, OpenCode, Claude, Codex, Mistral Vibe, Antigravity.
> **Regla**: el contenido normativo vive en `AGENTS.md`. Las configs de cada
> herramienta solo fijan modelo/routing y apuntan a `AGENTS.md`.

## Tabla de entrada

| Herramienta | Archivo de entrada que lee | Config de modelo | Notas |
|---|---|---|---|
| Claude Code | `CLAUDE.md` (wrapper) → `AGENTS.md` | `~/.claude/settings.json` o `.claude/settings.json` | Líder: Opus medium (ver §Model routing) |
| OpenCode | `AGENTS.md` (nativo) | `.opencode/opencode.json` (incluido) | Routing por agente listo |
| Codex CLI | `AGENTS.md` (nativo) | `~/.codex/config.toml` o `.codex/config.toml` | Ver ejemplo abajo |
| KiloCode | `AGENTS.md` (nativo) | `kilo.json` / `.kilocode/config.json` | Ver ejemplo abajo |
| Mistral Vibe | `AGENTS.md` en raíz (nativo) | `~/.vibe/config.toml` o `.vibe/config.toml` | Ver ejemplo abajo |
| Antigravity | `AGENTS.md` | Settings de la app | Lee AGENTS.md directamente |
| Cursor | `.cursorrules` (puntero incluido) → `AGENTS.md` | Settings de Cursor | Stub incluido |


## Model routing por herramienta

Mantén la regla: **líder = Claude Opus medium**; workers en modelos más baratos.
Cada herramienta configura su propio modelo por defecto; usa los archivos de
ejemplo incluidos para no heredar un modelo caro en subagentes.

### Codex CLI — `.codex/config.example.toml`
```toml
model = "gpt-5-codex"
# esfuerzo razonable por defecto; usa "high" solo en decisiones arquitectónicas
model_reasoning_effort = "medium"
```
Copia a `~/.codex/config.toml` o `.codex/config.toml` y ajusta.

### KiloCode — `.kilocode/config.example.json`
```json
{
  "model": "anthropic/claude-opus-4-7",
  "smallModel": "anthropic/claude-haiku-4-5"
}
```
KiloCode hace auto-routing; fija `smallModel` barato para exploración.

### Mistral Vibe — `.vibe/config.example.toml`
```toml
active_model = "devstral-2"

[[providers]]
name = "mistral"
api_key_env = "MISTRAL_API_KEY"
```
Usa Vibe para tareas de código con Devstral; el líder sigue siendo Claude Opus.

## Memoria compartida entre todas las IAs

Todas las herramientas leen el mismo `AGENTS.md` y la misma carpeta `memory/`.
Para que compartan contexto acumulado:

1. **Fuente de verdad en disco**: `memory/` (decisiones, glosario, pitfalls) +
   `progress/` (sesión actual/historial) + `specs/`. Ninguna IA guarda contexto
   "en su cabeza"; todo se escribe aquí.
2. **Formato común**: entradas append-only con fecha + autor (agente/herramienta)
   + contexto. Cualquier IA puede leerlas y añadir.
3. **MCP de memoria** (opcional, compartido): `codebase-memory-mcp` o
   `OpenViking` expone el mismo grafo a todas las IAs via MCP. Configúralo una
   vez en cada herramienta (ver `docs/mcp.md`).
4. **Graphify** (ver abajo): genera un grafo de conocimiento del codebase que
   todas las IAs consultan en vez de re-explorar.

## Graphify (grafo de conocimiento del codebase)

Graphify convierte el codebase (código, docs, imágenes) en un knowledge graph
interactivo (HTML + JSON + informe) con comunidades y god-nodes. Sirve para que
cualquier IA entienda la estructura sin leer archivos enteros.

- Skill disponible: `graphify` / `graphify-windows`.
- Salida: `graphify-out/` (HTML, JSON, GRAPH_REPORT.md). Añadido a `.gitignore`.
- Uso: ejecuta `/graphify` sobre el repo; luego las IAs consultan
  `graphify-out/GRAPH_REPORT.md` y el JSON en vez de re-explorar.
- Actualiza el grafo cuando cambie la estructura (nuevo módulo, refactor grande).

### .gitignore
`graphify-out/` ya está (o añádelo) en `.gitignore` — es artefacto local, no
contenido del proyecto.
