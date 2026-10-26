---
name: context-pruning
description: Reduce context pressure before it becomes a problem: prefer symbol-level navigation (codebase-memory-mcp, token-savior, Semble) over reading whole files, compress noisy tool outputs with headroom, and keep critical rules in system prompt. Use when sessions grow long or tool outputs are bulky.
---

# context-pruning

## Cuándo aplicar
- La sesión supera ~60% del contexto.
- Un tool output (build/test/log) es mayor a ~2k tokens.
- Vas a leer más de 3 archivos para responder una pregunta.

## Pasos
1. Antes de `Read` de un archivo completo, pregunta: ¿puedo obtener solo el símbolo/función? Usa `codebase-memory-mcp` o `token-savior` si están instalados.
2. Para builds/tests/logs, pásalos por `headroom` o `context-mode` antes de pegarlos.
3. Si el contexto ya está saturado, compacta explícitamente y re-lee `progress/current.md` + `feature_list.json`.
4. Mueve cualquier regla crítica que hayas descubierto al `CLAUDE.md`/`AGENTS.md` (system prompt), no al chat.

## Anti-patrón
- Pegar el output completo de `npm test` "por si acaso".
- Leer 5 archivos para encontrar una función que un grep por símbolo resolvería.
