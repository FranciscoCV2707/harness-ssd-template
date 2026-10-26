#!/usr/bin/env bash
# Lanza la interfaz web del harness SDD (servidor Node, sin dependencias)
cd "$(dirname "$0")"
# matar procesos node previos (evita servidores viejos en memoria)
pkill -f "gui/server.js" 2>/dev/null
sleep 1
if ! command -v node >/dev/null 2>&1; then
  echo "Se necesita node para la GUI web. Abre gui/index.html manualmente." >&2
  exit 1
fi
node gui/server.js &
SRV_PID=$!
# esperar a que arranque
for i in 1 2 3 4 5; do
  sleep 1
  if curl -s http://localhost:8765/ >/dev/null 2>&1; then break; fi
done
# abrir navegador si es posible
if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:8765 >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then open http://localhost:8765 >/dev/null 2>&1 &
fi
echo "Harness GUI: http://localhost:8765 (PID $SRV_PID)"
echo "Pulsa Ctrl+C para detener."
wait $SRV_PID