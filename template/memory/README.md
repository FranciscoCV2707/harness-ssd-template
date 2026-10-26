# Memoria persistente — {{PROJECT_NAME}}

> Carpeta para contexto que debe sobrevivir entre sesiones y entre agentes.
> El chat NO es memoria: lo que no está en disco se pierde al compactar o cerrar.

## Qué vive aquí

- `decisions.md` — decisiones de arquitectura tomadas (append-only, con fecha).
- `glossary.md` — términos del dominio y su significado (evita re-explicar).
- `pitfalls.md` — errores recurrentes y cómo evitarlos (alimenta el harness).
- `explore_<feature>.md`, `impl_<feature>.md`, `review_<feature>.md` — artefactos
  de sesión (también viven en `progress/`; duplicar aquí solo si se reutilizan).

## Reglas

1. Append-only: no se editan entradas anteriores; se añaden nuevas.
2. Cada entrada: fecha, autor (agente o humano), contexto breve, decisión/lección.
3. El lider lee `memory/` al arrancar (junto a `progress/current.md`).
4. Si una entrada contradice `docs/`, gana `docs/` y se marca la entrada como obsoleta.
5. No guardar secretos ni datos sensibles aquí (está versionado).

## Relación con otros mecanismos

- `progress/current.md` / `progress/history.md`: estado de sesión (corto plazo).
- `memory/`: conocimiento acumulado (largo plazo).
- MCPs de memoria (`OpenViking`, `codebase-memory-mcp`): aceleran la búsqueda;
  `memory/` sigue siendo la fuente de verdad humana.
