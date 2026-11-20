@echo off
rem Neon Midnight: dang nhap Cloudflare va trien khai. Dat file nay cung thu muc voi worker.js va wrangler.toml.
cd /d "%~dp0"
if not exist worker.js (
  echo Khong thay worker.js. Hay dat deploy.cmd vao thu muc da giai nen goi neon-midnight.
  pause
  exit /b 1
)
call npx.cmd wrangler login
if errorlevel 1 goto fail
call npx.cmd wrangler deploy
if errorlevel 1 goto fail
echo.
echo Xong. Hay sao chep link workers.dev o tren va gui cho nguoi xem.
pause
exit /b 0
:fail
echo.
echo Co loi. Hay chup man hinh hoac sao chep thong bao loi de gui lai cho Claude.
pause
exit /b 1
