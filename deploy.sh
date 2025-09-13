#!/bin/bash

# Скрипт для развертывания проекта 52 EXPRESS

echo "🚀 Начинаем развертывание проекта 52 EXPRESS..."

# Проверяем, что мы в правильной директории
if [ ! -f "server.js" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой директории проекта"
    exit 1
fi

# Собираем фронтенд
echo "📦 Собираем фронтенд..."
cd web
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при сборке фронтенда"
    exit 1
fi
cd ..

# Коммитим изменения
echo "💾 Коммитим изменения..."
git add .
git commit -m "Deploy to production"
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при коммите"
    exit 1
fi

# Отправляем на GitHub
echo "📤 Отправляем на GitHub..."
git push origin master
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при отправке на GitHub"
    exit 1
fi

echo "✅ Развертывание завершено!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте Railway для бэкенда"
echo "2. Настройте Vercel для фронтенда"
echo "3. Установите переменные окружения"
echo "4. Проверьте работу приложения"
echo ""
echo "📖 Подробная инструкция в файле SETUP_GUIDE.md"
