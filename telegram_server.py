#!/usr/bin/env python3
"""
Простой HTTP сервер для отправки сообщений в Telegram через Python бота
Запускается на порту 8000
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from flask import Flask, request, jsonify
from telegram import Bot
from telegram.error import TelegramError

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Создаем Flask приложение
app = Flask(__name__)

# Конфигурация Telegram бота
TELEGRAM_TOKEN = '7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE'
bot = Bot(token=TELEGRAM_TOKEN)

@app.route('/send-telegram-message', methods=['POST'])
def send_telegram_message():
    """
    Эндпоинт для отправки сообщения в Telegram
    Принимает JSON с полями: chat_id, message_thread_id, text, parse_mode
    """
    try:
        # Получаем данные из запроса
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        # Извлекаем необходимые поля
        chat_id = data.get('chat_id')
        message_thread_id = data.get('message_thread_id')
        text = data.get('text')
        parse_mode = data.get('parse_mode', 'Markdown')
        
        if not all([chat_id, text]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: chat_id, text'
            }), 400
        
        logger.info(f"Получен запрос на отправку сообщения в чат {chat_id}, топик {message_thread_id}")
        
        # Отправляем сообщение через Telegram бота
        async def send_message():
            try:
                message = await bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    parse_mode=parse_mode,
                    message_thread_id=message_thread_id
                )
                return message.message_id
            except TelegramError as e:
                logger.error(f"Ошибка Telegram API: {e}")
                raise e
        
        # Запускаем асинхронную функцию
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            message_id = loop.run_until_complete(send_message())
            
            logger.info(f"Сообщение успешно отправлено, ID: {message_id}")
            return jsonify({
                'success': True,
                'messageId': message_id,
                'timestamp': datetime.now().isoformat()
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Проверка состояния сервера"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'telegram_bot_configured': bool(TELEGRAM_TOKEN)
    })

@app.route('/', methods=['GET'])
def root():
    """Главная страница"""
    return jsonify({
        'service': 'Telegram Bot Server',
        'version': '1.0.0',
        'endpoints': [
            'POST /send-telegram-message - Отправка сообщения в Telegram',
            'GET /health - Проверка состояния сервера'
        ]
    })

if __name__ == '__main__':
    logger.info("Запуск Telegram Bot Server на порту 8000...")
    app.run(host='0.0.0.0', port=8000, debug=False)
