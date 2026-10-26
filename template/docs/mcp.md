# MCPs y herramientas recomendadas — {{PROJECT_NAME}}

> Referencia de herramientas externas (MCP servers, CLIs) que reducen consumo
> de tokens y aceleran la navegación del código. El harness no las impone: son
> opt-in. Instálalas cuando el proyecto crezca o cuando `init.sh` muestre
> presión de contexto.

## Navegación / reducción de tokens (mayor ROI)

| Herramienta | Qué hace | Ahorro típico | Cuándo usarla |
|---|---|---|---|
| `codebase-memory-mcp` (DeusData) | Grafo de conocimiento persistente (66 lenguajes, tree-sitter). Queries sub-ms en vez de grep+read. | ~120× tokens | Proyectos medianos/grandes, exploración frecuente |
| `context-mode` (mksglu) | Sandboxea outputs voluminosos (logs, snapshots) y recupera solo fragmentos vía BM25. | ~98% | Cuando los tool outputs saturan el contexto |
| `token-savior` (Mibayy) | Indexa por símbolo (funciones/clases/grafos de llamada). | ~77% | Navegación por símbolo en lugar de archivo completo |
| `headroom` (chopratejas) | Comprime tool outputs/logs/RAG antes de entrar al contexto. | 60-95% | Ruido de build/test en el contexto |
| `Semble` (MinishLab) | Búsqueda semántica reemplazando grep+read. | ~98% | Búsqueda por intención, no por texto exacto |
| `Context7` (upstash) | Inyecta docs actualizadas de librerías (evita APIs alucinadas). | variable | Cuando el stack usa libs con versiones recientes |

## Memoria / estado entre sesiones

| Herramienta | Qué hace |
|---|---|
| `OpenViking` (ByteDance) | DB de contexto con paradigma filesystem; self-evolving |
| `Trellis` (mindfold-ai) | Reemplaza CLAUDE.md inflado por specs progresivos; adaptador cross-plataforma |
| `Mirage` (strukto-ai) | Monta S3/Slack/Gmail/GitHub/Redis como FS virtual (menos tool-schema bloat) |

## Orquestación multi-agente

| Herramienta | Cuándo |
|---|---|
| `oh-my-opencode` | Plugin OpenCode: routing por modelo, agentes en background, LSP/AST |
| `oh-my-claudecode` | Equivalente para Claude Code (Ultrawork mode) |
| Claude Code Agent Teams | Paralelismo real cross-módulo (research preview) |
| GitHub Spec Kit | Comandos `/specify /plan /tasks /implement` cross-CLI |
| OpenSpec | Más rápido para proyectos existentes (brownfield) |

## Verificación / control de flujo

| Herramienta | Qué hace |
|---|---|
| `statewright` | State machines que restringen tools por fase del workflow |
| Anthropic Compaction | Resumen server-side; -84% tokens en sesiones largas |
| `LLMLingua` / `LLMLingua-2` | Compresión de prompts hasta 20× |

## Regla de instalación

Si una herramienta crea su propia carpeta de estado/cache en la raíz del
proyecto, añádela a `.gitignore` en el **mismo commit** que la instala
(ver `.claude/skills/README.md` §"Si la skill genera estado o cache local").

## Prompt caching (Anthropic)

Coloca `cache_control: { "type": "ephemeral" }` en:
- El system prompt (AGENTS.md resumido).
- La definición de tools (MCPs).
- Documentos largos reutilizados (docs/architecture.md).

Esto evita re-pagar el mismo prefijo en cada turno. Ver
`docs/verification.md` para la disciplina de verificación.
