#!/bin/bash

# Скрипт для запуска Telegram сервера на сервере 109.205.58.89

echo "Установка зависимостей..."
pip3 install -r telegram_requirements.txt

echo "Запуск Telegram Bot Server..."
python3 telegram_server.py
