---
name: git-ops-commit-msg
description: Write conventional commit messages that include the R-ids satisfied (feat(scope): desc (R1,R2)). Use when committing during TDD cycles.
---

# git-ops-commit-msg

## Formato
```
feat(<scope>): <descripcion> (R1,R2)
fix(<scope>): <descripcion> (R3)
refactor(<scope>): <descripcion>
```

## Reglas
- `<scope>` = nombre de la feature o modulo.
- Los R-ids referencian requisitos de `specs/<feature>/requirements.md`.
- Un commit por ciclo rojo-verde-refactor; agrupa R-ids solo si se implementaron juntos.
- Mensaje en ingles, imperativo, sin punto final.
- Tras el commit, actualiza `specs/<feature>/traceability.md` con hash + mensaje.
