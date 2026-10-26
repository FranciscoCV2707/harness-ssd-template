@echo off
cd /d "%~dp0"
:: matar procesos node previos del harness (evita servidores viejos en memoria)
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Se necesita node para la GUI web. Abre gui\index.html manualmente.
  pause
  exit /b 1
)
start /b node gui\server.js
timeout /t 2 /nobreak >nul
start http://localhost:8765
echo Harness GUI abierta en http://localhost:8765
echo Cierra esta ventana para detener el servidor (o usa el boton Salir de la GUI).
pause
taskkill /f /im node.exe /fi "WINDOWTITLE eq node gui\server.js" >nul 2>&1