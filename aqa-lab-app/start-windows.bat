@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
if exist node_modules goto build
echo Первый запуск: устанавливаю зависимости, это займёт несколько минут...
call npm ci
if errorlevel 1 goto fail
:build
echo Собираю приложение...
call npm run build
if errorlevel 1 goto fail
echo.
echo Приложение откроется в браузере: http://localhost:4173
echo Не закрывайте это окно, пока пользуетесь приложением.
call npm run preview -- --open
pause
exit /b 0
:nonode
echo Node.js не найден. Установите его с https://nodejs.org (кнопка LTS) и запустите этот файл снова.
pause
exit /b 1
:fail
echo Что-то пошло не так — сообщение об ошибке выше.
pause
exit /b 1
