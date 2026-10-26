#!/usr/bin/env bash
# init.sh — Verificación e inicialización del proyecto (stack-agnóstico)
# Debe terminar con exit code 0 para que el harness esté en estado válido.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="full"
case "${1:-}" in
  --fast) MODE="fast" ;;
  --full|"") MODE="full" ;;
  *) echo "Uso: $0 [--fast|--full]"; exit 2 ;;
esac

# shellcheck source=./init.config.sh
source ./init.config.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo ""
echo "══════════════════════════════════════════"
echo "  INIT — ${PROJECT_NAME} (Harness SDD)"
echo "══════════════════════════════════════════"
echo ""

# ── 1. ENTORNO ──────────────────────────────
echo "→ Verificando entorno..."

for tool in "${REQUIRED_TOOLS[@]}"; do
  command -v "$tool" > /dev/null 2>&1 || fail "${tool} no encontrado. Instálalo antes de continuar"
  ok "${tool} disponible ($(command -v "$tool"))"
done

# ── 2. VARIABLES DE ENTORNO ─────────────────
echo ""
echo "→ Verificando variables de entorno..."

if [ "${#REQUIRED_ENV_VARS[@]}" -eq 0 ]; then
  warn "Sin variables de entorno requeridas configuradas en init.config.sh"
else
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      warn ".env no encontrado. Copiando desde .env.example..."
      cp .env.example .env
      warn "Edita .env con tus credenciales antes de continuar"
    else
      fail ".env no encontrado y no existe .env.example"
    fi
  else
    ok ".env encontrado"
  fi

  check_env() {
    local var=$1
    if grep -q "^${var}=" .env 2>/dev/null; then
      ok "  ${var} definida"
    else
      warn "  ${var} no definida en .env (puede causar errores en runtime)"
    fi
  }

  for var in "${REQUIRED_ENV_VARS[@]}"; do
    check_env "$var"
  done
fi

# ── 3. DEPENDENCIAS ─────────────────────────
echo ""
echo "→ Instalando dependencias..."
if [ -n "$INSTALL_CMD" ]; then
  eval "$INSTALL_CMD"
  ok "Dependencias instaladas"
else
  warn "INSTALL_CMD vacío en init.config.sh — se salta instalación"
fi

# ── 4. HARNESS — coherencia del arnés ───────
echo ""
echo "→ Verificando coherencia del harness..."

[ -f AGENTS.md ]             || fail "AGENTS.md no encontrado"
[ -f CLAUDE.md ]             || fail "CLAUDE.md no encontrado"
[ -f CHECKPOINTS.md ]        || fail "CHECKPOINTS.md no encontrado"
[ -f STATUS.md ]             || fail "STATUS.md no encontrado"
[ -f feature_list.json ]     || fail "feature_list.json no encontrado"
[ -f init.config.sh ]        || fail "init.config.sh no encontrado"
[ -f scripts/feature-list-query ] || fail "scripts/feature-list-query no encontrado"
[ -f scripts/validate-feature-gates ] || fail "scripts/validate-feature-gates no encontrado"
[ -f progress/current.md ]   || fail "progress/current.md no encontrado"
[ -d memory ]                || fail "memory/ no encontrado"
[ -f memory/README.md ]      || fail "memory/README.md no encontrado"
[ -d specs ]                 || fail "specs/ no encontrado"
[ -d specs/_template ]       || fail "specs/_template/ no encontrado"
[ -f specs/_template/requirements.md ] || fail "specs/_template/requirements.md no encontrado"
[ -f specs/_template/design.md ]       || fail "specs/_template/design.md no encontrado"
[ -f specs/_template/tasks.md ]        || fail "specs/_template/tasks.md no encontrado"
[ -f specs/_template/traceability.md ] || fail "specs/_template/traceability.md no encontrado"
[ -f docs/architecture.md ]  || fail "docs/architecture.md no encontrado"
[ -f docs/conventions.md ]   || fail "docs/conventions.md no encontrado"
[ -f docs/verification.md ]  || fail "docs/verification.md no encontrado"
[ -f docs/specs.md ]         || fail "docs/specs.md no encontrado"
[ -f docs/obsidian.md ]      || fail "docs/obsidian.md no encontrado"

for agent in leader spec_author explorer implementer reviewer; do
  [ -f ".claude/agents/${agent}.md" ] || fail ".claude/agents/${agent}.md no encontrado"
done
ok "Archivos del harness presentes"

# Validar schema y seleccionar automáticamente node o python3 como runtime JSON
FEATURE_QUERY=(bash scripts/feature-list-query)
"${FEATURE_QUERY[@]}" validate ||
  fail "feature_list.json no cumple el schema documentado en docs/specs.md"
ok "feature_list.json válido"

# Verificar máximo 1 feature in_progress
IN_PROGRESS=$("${FEATURE_QUERY[@]}" count in_progress)

if [ "$IN_PROGRESS" = "0" ]; then
  ok "Sin features en progreso (sesión limpia)"
elif [ "$IN_PROGRESS" = "1" ]; then
  FEATURE_NAME=$("${FEATURE_QUERY[@]}" first in_progress name)
  warn "Feature en progreso: ${FEATURE_NAME}"
else
  fail "Más de 1 feature en in_progress (${IN_PROGRESS}). Resolver antes de continuar."
fi

# Verificar aprobación de specs listas/activas y trazabilidad de las completadas
while IFS='|' read -r name status; do
  [ -z "$name" ] && continue
  bash scripts/validate-feature-gates "$name" "$status" ||
    fail "Feature '${name}' no supera los gates de aprobación/trazabilidad"
  ok "Feature '${name}' supera los gates para ${status}"
done < <("${FEATURE_QUERY[@]}" active)

# Verificar que STATUS.md refleja el conteo real de feature_list.json
DONE_COUNT=$("${FEATURE_QUERY[@]}" count done)
TOTAL=$("${FEATURE_QUERY[@]}" count all)
DECLARED_COUNTS=$(sed -n 's/.*Features completadas\*\*:[[:space:]]*\([0-9][0-9]*\)\/\([0-9][0-9]*\).*/\1\/\2/p' STATUS.md)

if [ -z "$DECLARED_COUNTS" ]; then
  STATUS_SYNC="NO_MATCH"
elif [ "$DECLARED_COUNTS" = "${DONE_COUNT}/${TOTAL}" ]; then
  STATUS_SYNC="OK"
else
  STATUS_SYNC="MISMATCH:${DECLARED_COUNTS} declarado vs ${DONE_COUNT}/${TOTAL} real"
fi

if [ "$STATUS_SYNC" = "OK" ]; then
  ok "STATUS.md sincronizado con feature_list.json"
elif [ "$STATUS_SYNC" = "NO_MATCH" ]; then
  fail "STATUS.md no tiene la línea 'Features completadas: X/Y' en el formato esperado"
else
  fail "STATUS.md desactualizado (${STATUS_SYNC#MISMATCH:})"
fi

if [ "$MODE" = "full" ]; then
  # ── 5. BUILD ─────────────────────────────────
  echo ""
  echo "→ Build..."
  if [ -n "$BUILD_CMD" ]; then
    eval "$BUILD_CMD" 2>&1
    ok "Build exitoso"
  else
    warn "BUILD_CMD vacío en init.config.sh — se salta build"
  fi

  # ── 6. TESTS ─────────────────────────────────
  echo ""
  echo "→ Ejecutando tests..."
  if [ -n "$TEST_CMD" ]; then
    eval "$TEST_CMD" 2>&1
    ok "Tests pasados"
  else
    warn "TEST_CMD vacío en init.config.sh — se salta tests"
  fi

  if [ -n "$LINT_CMD" ]; then
    echo ""
    echo "→ Lint..."
    eval "$LINT_CMD" 2>&1
    ok "Lint sin errores"
  else
    warn "LINT_CMD vacío en init.config.sh — se salta lint"
  fi

  if [ -n "$TYPECHECK_CMD" ]; then
    echo ""
    echo "→ Typecheck..."
    eval "$TYPECHECK_CMD" 2>&1
    ok "Typecheck sin errores"
  else
    warn "TYPECHECK_CMD vacío en init.config.sh — se salta typecheck"
  fi
else
  warn "Modo --fast: se salta build/tests/lint/typecheck"
fi

# ── 7. RESUMEN ───────────────────────────────
echo ""
echo "══════════════════════════════════════════"

PENDING_COUNT=$("${FEATURE_QUERY[@]}" count pending)

echo -e "${GREEN}✅ Todo verde. Listo para trabajar.${NC}"
echo ""
echo "  Features: ${DONE_COUNT}/${TOTAL} completadas | ${PENDING_COUNT} pendientes"
echo ""

if [ "$PENDING_COUNT" -gt 0 ]; then
  echo "  Próxima feature:"
  NEXT_ID=$("${FEATURE_QUERY[@]}" first pending id)
  NEXT_NAME=$("${FEATURE_QUERY[@]}" first pending name)
  NEXT_PRIORITY=$("${FEATURE_QUERY[@]}" first pending priority)
  echo "  [#${NEXT_ID}] ${NEXT_NAME} (${NEXT_PRIORITY:-sin prioridad})"
fi

echo ""
