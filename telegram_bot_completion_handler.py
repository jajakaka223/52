#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Пример обработчика уведомлений о выполненной заявке для вашего Telegram бота
Добавьте эту функцию в ваш существующий бот
"""

import asyncio
import aiohttp
import json
from datetime import datetime

async def send_completion_email(email_address, route_info, order_data=None):
    """
    Отправка уведомления о выполненной заявке с запросом рекомендации
    
    Args:
        email_address (str): email адрес клиента
        route_info (str): информация о маршруте (например, "Москва - Санкт-Петербург")
        order_data (dict): дополнительные данные заявки (опционально)
    """
    
    # Настройки вашего бота
    BOT_TOKEN = "7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE"
    CHAT_ID = "YOUR_CHAT_ID"  # Замените на ID чата, куда отправлять уведомления
    
    # Формируем сообщение
    message_text = f"""🎉 **ЗАЯВКА ВЫПОЛНЕНА!**

📧 **Email клиента:** {email_address}
🛣️ **Маршрут:** {route_info}
📅 **Дата выполнения:** {datetime.now().strftime('%d.%m.%Y %H:%M')}

{order_data.get('orderId', '') and f"🆔 **ID заявки:** {order_data['orderId']}"}
{order_data.get('company', '') and f"🏢 **Компания:** {order_data['company']}"}
{order_data.get('clientName', '') and f"👤 **Клиент:** {order_data['clientName']}"}
{order_data.get('phone', '') and f"📞 **Телефон:** {order_data['phone']}"}

**Действие:** Отправить уведомление клиенту о выполненной заявке и запросить рекомендацию

---
💡 **Рекомендации для клиента:**
- Оцените качество обслуживания
- Оставьте отзыв о работе
- Рекомендуйте нас друзьям и коллегам
- Свяжитесь с нами для новых заказов

📞 **Контакты:**
- Телефон: +7 (XXX) XXX-XX-XX
- Email: info@yourcompany.com
- Сайт: yourcompany.com"""

    try:
        # Отправляем сообщение в Telegram
        async with aiohttp.ClientSession() as session:
            url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
            
            data = {
                'chat_id': CHAT_ID,
                'text': message_text,
                'parse_mode': 'Markdown',
                'reply_markup': json.dumps({
                    'inline_keyboard': [
                        [
                            {
                                'text': '📧 Отправить email клиенту',
                                'callback_data': f'send_email_{email_address}'
                            }
                        ],
                        [
                            {
                                'text': '📊 Запросить отзыв',
                                'callback_data': f'request_review_{email_address}'
                            }
                        ],
                        [
                            {
                                'text': '✅ Отметить как обработанное',
                                'callback_data': f'mark_processed_{email_address}'
                            }
                        ]
                    ]
                })
            }
            
            async with session.post(url, json=data) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"✅ Уведомление отправлено в Telegram: {result['result']['message_id']}")
                    return True
                else:
                    print(f"❌ Ошибка отправки в Telegram: {response.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Ошибка при отправке уведомления: {e}")
        return False

# Пример использования в вашем боте
async def handle_completion_notification(update, context):
    """
    Обработчик уведомлений о выполненной заявке
    Добавьте этот обработчик в ваш бот
    """
    try:
        message = update.message
        text = message.text
        
        # Проверяем, что это уведомление о выполненной заявке
        if "ЗАЯВКА ВЫПОЛНЕНА!" in text and "Email клиента:" in text:
            # Извлекаем данные из сообщения
            lines = text.split('\n')
            email = None
            route = None
            
            for line in lines:
                if line.startswith('📧 **Email клиента:**'):
                    email = line.replace('📧 **Email клиента:**', '').strip()
                elif line.startswith('🛣️ **Маршрут:**'):
                    route = line.replace('🛣️ **Маршрут:**', '').strip()
            
            if email and route:
                print(f"📨 Получено уведомление о выполненной заявке:")
                print(f"   Email: {email}")
                print(f"   Маршрут: {route}")
                
                # Здесь вы можете добавить свою логику обработки
                # Например, отправить email клиенту, сохранить в базу данных и т.д.
                
                # Отправляем подтверждение
                await message.reply_text("✅ Уведомление о выполненной заявке получено и обработано!")
            else:
                await message.reply_text("❌ Не удалось извлечь данные из уведомления")
                
    except Exception as e:
        print(f"❌ Ошибка обработки уведомления: {e}")
        await message.reply_text("❌ Ошибка при обработке уведомления")

# Обработчик callback кнопок
async def handle_callback_query(update, context):
    """
    Обработчик нажатий на кнопки
    """
    query = update.callback_query
    data = query.data
    
    if data.startswith('send_email_'):
        email = data.replace('send_email_', '')
        await query.answer(f"Отправка email на {email}...")
        # Здесь добавьте логику отправки email
        
    elif data.startswith('request_review_'):
        email = data.replace('request_review_', '')
        await query.answer(f"Запрос отзыва от {email}...")
        # Здесь добавьте логику запроса отзыва
        
    elif data.startswith('mark_processed_'):
        email = data.replace('mark_processed_', '')
        await query.answer(f"Отмечено как обработанное для {email}")
        # Здесь добавьте логику отметки как обработанного

# Пример регистрации обработчиков в вашем боте
def setup_completion_handlers(application):
    """
    Регистрация обработчиков в вашем боте
    Добавьте этот вызов в функцию main() вашего бота
    """
    from telegram.ext import MessageHandler, CallbackQueryHandler, filters
    
    # Обработчик уведомлений о выполненной заявке
    application.add_handler(MessageHandler(
        filters.TEXT & filters.Regex(r'ЗАЯВКА ВЫПОЛНЕНА!'), 
        handle_completion_notification
    ))
    
    # Обработчик callback кнопок
    application.add_handler(CallbackQueryHandler(handle_callback_query))

# Тестирование
if __name__ == "__main__":
    async def test():
        # Тестовые данные
        test_email = "client@example.com"
        test_route = "Москва - Санкт-Петербург"
        test_order_data = {
            'orderId': '12345',
            'company': 'ООО Тест',
            'clientName': 'Иван Иванов',
            'phone': '+7(999)123-45-67'
        }
        
        print("🧪 Тестирование отправки уведомления...")
        result = await send_completion_email(test_email, test_route, test_order_data)
        print(f"Результат: {'✅ Успешно' if result else '❌ Ошибка'}")
    
    # Запуск теста
    asyncio.run(test())
