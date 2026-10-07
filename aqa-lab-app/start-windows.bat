@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите его с https://nodejs.org ^(кнопка LTS^) и запустите этот файл снова.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Первый запуск: устанавливаю зависимости, это займёт несколько минут...
  call npm ci || (pause ^& exit /b 1)
)
echo Собираю приложение...
call npm run build || (pause ^& exit /b 1)
echo.
echo Приложение откроется в браузере: http://localhost:4173
echo Не закрывайте это окно, пока пользуетесь приложением.
call npm run preview -- --open
pause
