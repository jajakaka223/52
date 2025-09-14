#!/bin/bash

# Скрипт для запуска Telegram Recommendation Server на сервере 109.205.58.89

echo "=== Telegram Recommendation Server ==="
echo "Установка зависимостей..."

# Установка зависимостей
pip3 install -r recommendation_requirements.txt

echo "Проверка конфигурации..."
echo "Telegram Token: 7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE"
echo "Email User: gruzoperevozki436@gmail.com"

echo "Запуск Telegram Recommendation Server на порту 8000..."
echo "Доступные эндпоинты:"
echo "  POST /send-telegram-message - Отправка сообщения в Telegram"
echo "  POST /send-recommendation-email - Отправка email с запросом рекомендации"
echo "  POST /send-complete-notification - Полное уведомление (Telegram + Email)"
echo "  GET /health - Проверка состояния сервера"

# Запуск сервера
python3 telegram_recommendation_server.py
