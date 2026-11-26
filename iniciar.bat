@echo off
REM ============================================================
REM iniciar.bat — Arranca el bot y lo relanza solo si se cae.
REM
REM El bot ya reintenta solo hasta 10 veces si se cae la
REM conexión (backoff 5s -> 5 min). Cuando agota los reintentos,
REM sale con código 1, y este .bat lo vuelve a arrancar a los
REM 5 segundos, en bucle. Para pararlo: Ctrl+C.
REM
REM No necesitas instalar nada más: solo Node.js.
REM ============================================================
title Musulman-Bot
cd /d "%~dp0"

:reinicio
echo [iniciar] Arrancando el bot...
node index.js
echo [iniciar] El bot se cerro (codigo %ERRORLEVEL%). Lo relanzo en 5 segundos... (Ctrl+C para parar)
timeout /t 5 /nobreak >nul
goto reinicio
