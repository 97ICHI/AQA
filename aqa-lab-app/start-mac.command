#!/bin/bash
# Запуск AQA Lab на macOS/Linux: двойной щелчок (macOS) или ./start-mac.command в терминале.
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo "Node.js не найден. Установите его с https://nodejs.org (кнопка LTS)."; read -p "Enter — закрыть"; exit 1; fi
if [ ! -d node_modules ]; then echo "Первый запуск: устанавливаю зависимости, это займёт несколько минут..."; npm ci || exit 1; fi
echo "Собираю приложение..."; npm run build || exit 1
echo; echo "Приложение откроется в браузере: http://localhost:4173"; echo "Не закрывайте это окно, пока пользуетесь приложением."
npm run preview -- --open
