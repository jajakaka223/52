#!/usr/bin/env python3
"""
HTTP сервер для обработки запросов на отправку сообщений о рекомендации
Интегрируется с существующим Telegram ботом на сервере 109.205.58.89
"""

import os
import json
import logging
import asyncio
import smtplib
import email.utils
from datetime import datetime
from flask import Flask, request, jsonify
from telegram import Bot
from telegram.error import TelegramError
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Создаем Flask приложение
app = Flask(__name__)

# Конфигурация Telegram бота (из main.py)
TELEGRAM_TOKEN = '7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE'
bot = Bot(token=TELEGRAM_TOKEN)

# Конфигурация email (из main.py)
EMAIL_USER = 'gruzoperevozki436@gmail.com'
EMAIL_PASSWORD = 'epah mwoe ynia xfjc'

async def send_completion_email(email_address, route_info):
    """Отправляет email о завершении заявки с запросом рекомендации (из main.py)"""
    try:
        # Создаем сообщение
        email_msg = MIMEMultipart()
        email_msg['Subject'] = f"Заявка по маршруту {route_info} выполнена"
        email_msg['From'] = f"52 EXPRESS <{EMAIL_USER}>"
        email_msg['To'] = email_address
        email_msg['Date'] = email.utils.formatdate(localtime=True)
        email_msg['Message-ID'] = email.utils.make_msgid(domain='gmail.com')

        html_body = f"""
        <html>
            <body>
                <p>Доброго времени суток, благодарим за проявленное доверие и надеемся на дальнейшее сотрудничество.</p>
                <p>Заявка по маршруту <strong>"{route_info}"</strong> выполнена успешно, оплату от Вас получили.</p>
                <br>
                <p><strong>Просим оставить рекомендацию на нашем профиле ATI - <a href="https://ati.su/firms/5308606">https://ati.su/firms/5308606</a>, так же от нас последует ответная рекомендация.</strong></p>
                <br>
                <p>Желаем успехов Вам и Вашему бизнесу.</p>
                <p><strong>С уважением команда "52 EXPRESS"</strong></p>
            </body>
        </html>
        """
        email_msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        # Отправляем email
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(EMAIL_USER, EMAIL_PASSWORD)
            smtp.send_message(email_msg)

        logger.info(
            f"Email с запросом рекомендации успешно отправлен на {email_address} для маршрута {route_info}"
        )
        return True

    except Exception as e:
        logger.error(f"Ошибка при отправке email с запросом рекомендации: {e}")
        return False

async def send_telegram_message(chat_id, message_thread_id, text, parse_mode='Markdown'):
    """Отправляет сообщение в Telegram через бота"""
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

@app.route('/send-telegram-message', methods=['POST'])
def handle_telegram_message():
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
                message_id = await send_telegram_message(chat_id, message_thread_id, text, parse_mode)
                return message_id
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

@app.route('/send-recommendation-email', methods=['POST'])
def handle_recommendation_email():
    """
    Эндпоинт для отправки email с запросом рекомендации
    Принимает JSON с полями: email_address, route_info
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
        email_address = data.get('email_address')
        route_info = data.get('route_info')
        
        if not all([email_address, route_info]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: email_address, route_info'
            }), 400
        
        logger.info(f"Получен запрос на отправку email рекомендации на {email_address} для маршрута {route_info}")
        
        # Отправляем email с запросом рекомендации
        async def send_email():
            try:
                success = await send_completion_email(email_address, route_info)
                return success
            except Exception as e:
                logger.error(f"Ошибка при отправке email: {e}")
                raise e
        
        # Запускаем асинхронную функцию
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(send_email())
            
            if success:
                logger.info(f"Email с запросом рекомендации успешно отправлен на {email_address}")
                return jsonify({
                    'success': True,
                    'message': 'Email с запросом рекомендации отправлен',
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to send email'
                }), 500
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/send-complete-notification', methods=['POST'])
def handle_complete_notification():
    """
    Эндпоинт для полного уведомления: отправка в Telegram + email с рекомендацией
    Принимает JSON с полями: chat_id, message_thread_id, text, email_address, route_info
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
        email_address = data.get('email_address')
        route_info = data.get('route_info')
        parse_mode = data.get('parse_mode', 'Markdown')
        
        if not all([chat_id, text, email_address, route_info]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: chat_id, text, email_address, route_info'
            }), 400
        
        logger.info(f"Получен запрос на полное уведомление: Telegram {chat_id}, Email {email_address}")
        
        # Выполняем оба действия
        async def send_notifications():
            results = {}
            
            # Отправляем сообщение в Telegram
            try:
                telegram_message_id = await send_telegram_message(chat_id, message_thread_id, text, parse_mode)
                results['telegram'] = {'success': True, 'messageId': telegram_message_id}
                logger.info(f"Telegram сообщение отправлено, ID: {telegram_message_id}")
            except Exception as e:
                results['telegram'] = {'success': False, 'error': str(e)}
                logger.error(f"Ошибка отправки Telegram: {e}")
            
            # Отправляем email с рекомендацией
            try:
                email_success = await send_completion_email(email_address, route_info)
                results['email'] = {'success': email_success}
                if email_success:
                    logger.info(f"Email с рекомендацией отправлен на {email_address}")
                else:
                    logger.error(f"Ошибка отправки email на {email_address}")
            except Exception as e:
                results['email'] = {'success': False, 'error': str(e)}
                logger.error(f"Ошибка отправки email: {e}")
            
            return results
        
        # Запускаем асинхронную функцию
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            results = loop.run_until_complete(send_notifications())
            
            return jsonify({
                'success': True,
                'results': results,
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
        'telegram_bot_configured': bool(TELEGRAM_TOKEN),
        'email_configured': bool(EMAIL_USER and EMAIL_PASSWORD),
        'service': 'Telegram Recommendation Server'
    })

@app.route('/', methods=['GET'])
def root():
    """Главная страница"""
    return jsonify({
        'service': 'Telegram Recommendation Server',
        'version': '1.0.0',
        'endpoints': [
            'POST /send-telegram-message - Отправка сообщения в Telegram',
            'POST /send-recommendation-email - Отправка email с запросом рекомендации',
            'POST /send-complete-notification - Полное уведомление (Telegram + Email)',
            'GET /health - Проверка состояния сервера'
        ],
        'description': 'Сервер для обработки запросов на отправку уведомлений о выполненной заявке'
    })

if __name__ == '__main__':
    logger.info("Запуск Telegram Recommendation Server на порту 8000...")
    logger.info(f"Telegram Bot Token: {TELEGRAM_TOKEN[:10]}...")
    logger.info(f"Email User: {EMAIL_USER}")
    app.run(host='0.0.0.0', port=8000, debug=False)
