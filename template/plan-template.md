# Plan: {{PROJECT_NAME}}

> Plantilla oficial del orquestador. Claude DEBE leer este archivo y seguir su
> estructura EXACTA al generar un plan.md. El orquestador web parsea solo las
> lineas de tarea (ver "Reglas de parseo" al final).

## Objetivo

<1 a 3 lineas: que se va a construir y por que.>

## Contexto

<Stack, repositorios implicados, restricciones, decisiones ya tomadas.
Lista breve de fuentes: rutas, SDKs, herramientas disponibles.>

## Fase 1 — <nombre de la fase>

<Objetivo de la fase en 1 linea.>

### Tareas

- [ ] Tarea 1.1: descripcion concreta y verificable (agente sugerido: implementer)
- [ ] Tarea 1.2: descripcion concreta y verificable (agente sugerido: reviewer)
- [ ] Tarea 1.3: descripcion concreta y verificable (agente sugerido: explorer)

## Fase 2 — <nombre de la fase>

<Objetivo de la fase en 1 linea.>

### Tareas

- [ ] Tarea 2.1: descripcion concreta y verificable (agente sugerido: spec_author)
- [ ] Tarea 2.2: descripcion concreta y verificable (agente sugerido: implementer)

## Fase 3 — <nombre de la fase>

### Tareas

- [ ] Tarea 3.1: descripcion concreta y verificable (agente sugerido: leader)

## Notas

- Dependencias entre tareas/fases.
- Riesgos conocidos y mitigaciones.
- Decisiones abiertas que requieren gate humano.

---

## Reglas de parseo (el orquestador web usa estas)

El parser (`parseTasks` en `gui/index.html`) extrae tareas con estas reglas:

1. **Secciones de tareas**: cualquier encabezado `##`/`###` cuyo titulo contenga
   `tarea`, `task`, `fase`, `phase`, `paso` o `step` se considera seccion de
   tareas. Tambien se acepta `## Tareas` / `## Tasks`.
2. **Lineas de tarea**: dentro de una seccion de tareas, toda linea a nivel
   superior (sin indentacion) que empiece con `-`, `*`, `- [ ]`, `- [x]` o
   numero seguido de `.`/`)` se considera tarea.
3. **Agente sugerido**: si la linea contiene `(agente sugerido: <rol>)`, ese
   rol se asigna a la tarea (implementer, reviewer, explorer, spec_author,
   leader). Si no, se asigna `implementer` por defecto.
4. **Sub-tareas**: lineas indentadas (2+ espacios) se ignoran como tareas
   sueltas (pero se pueden mencionar dentro de la descripcion).
5. **Encabezados `#`/`##`/`###`**: nunca son tareas.
6. **Secciones excluidas**: `## Notas`, `## Notes`, `## Objetivo`,
   `## Objective`, `## Contexto`, `## Context` no aportan tareas (sus bullets
   se ignoran).
7. **Fallback**: si no se detecta ninguna seccion de tareas, se toman todos los
   bullets de nivel superior que contengan `(agente sugerido:`.

### Ejemplo minimo valido

\`\`\`markdown
## Tareas

- [ ] Implementar parser de escenas (agente sugerido: implementer)
- [ ] Revisar compatibilidad PS2 (agente sugerido: reviewer)
- [ ] Explorar SDKs disponibles (agente sugerido: explorer)
\`\`\`

### Anti-patrones (NO hacer)

- Poner dos tareas en la misma linea.
- Usar bullets indentados para tareas principales.
- Omitir el parentesis de agente sugerido (el parser asigna implementer por
  defecto, pero es mejor ser explicito).
- Mezclar tareas con notas en la misma seccion.
PY