#!/usr/bin/env python3
"""
Пример Telegram бота для интеграции с системой заявок 52 EXPRESS
"""

import requests
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TransportAPI:
    """Класс для работы с API транспортной компании"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        }
    
    def create_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создать новую заявку"""
        try:
            response = requests.post(
                f"{self.base_url}/order",
                headers=self.headers,
                json=order_data,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка создания заявки: {e}")
            raise
    
    def get_order_status(self, order_id: int) -> Dict[str, Any]:
        """Получить статус заявки"""
        try:
            response = requests.get(
                f"{self.base_url}/order/{order_id}/status",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка получения статуса заявки {order_id}: {e}")
            raise
    
    def get_orders(self, start_date: Optional[str] = None, 
                   end_date: Optional[str] = None, 
                   status: Optional[str] = None) -> Dict[str, Any]:
        """Получить список заявок"""
        try:
            params = {}
            if start_date:
                params['start_date'] = start_date
            if end_date:
                params['end_date'] = end_date
            if status:
                params['status'] = status
            
            response = requests.get(
                f"{self.base_url}/orders",
                headers=self.headers,
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка получения списка заявок: {e}")
            raise

# Пример использования с python-telegram-bot
def example_telegram_bot():
    """Пример интеграции с python-telegram-bot"""
    
    # Конфигурация
    API_BASE_URL = "http://localhost:3000/api/telegram"
    API_KEY = "your_telegram_api_key_here"  # Замените на ваш API ключ
    
    # Инициализация API
    transport_api = TransportAPI(API_BASE_URL, API_KEY)
    
    # Пример обработчика команды /new_order
    def handle_new_order(update, context):
        """Обработчик команды создания новой заявки"""
        try:
            # Получаем данные от пользователя
            # В реальном боте это может быть через inline клавиатуру или пошаговый ввод
            
            order_data = {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "direction": "Москва → Санкт-Петербург",  # Получаем от пользователя
                "distance": 635.5,  # Получаем от пользователя
                "weight": 2.5,  # Получаем от пользователя
                "amount": 15000,  # Получаем от пользователя
                "company": "ООО Рога и Копыта",  # Получаем от пользователя
                "clientName": "Иван Петров",  # Получаем от пользователя
                "phone": "+7 (999) 123-45-67",  # Получаем от пользователя
                "email": "client@example.com"  # Получаем от пользователя
            }
            
            # Создаем заявку
            result = transport_api.create_order(order_data)
            
            if result.get('success'):
                order = result['order']
                message = f"""
✅ Заявка создана успешно!

📋 Номер заявки: {order['id']}
📅 Дата: {order['date']}
🚛 Направление: {order['direction']}
🏢 Компания: {order['company']}
👤 Клиент: {order['client_name']}
📊 Статус: {order['status']}
                """
                update.message.reply_text(message)
            else:
                update.message.reply_text("❌ Ошибка создания заявки")
                
        except Exception as e:
            logger.error(f"Ошибка в handle_new_order: {e}")
            update.message.reply_text("❌ Произошла ошибка при создании заявки")
    
    # Пример обработчика команды /status
    def handle_status(update, context):
        """Обработчик команды проверки статуса заявки"""
        try:
            if not context.args:
                update.message.reply_text("Использование: /status <номер_заявки>")
                return
            
            order_id = int(context.args[0])
            result = transport_api.get_order_status(order_id)
            
            if result.get('success'):
                order = result['order']
                message = f"""
📋 Заявка #{order['id']}

🚛 Направление: {order['direction']}
🏢 Компания: {order['company']}
👤 Клиент: {order['client_name']}
📊 Статус: {order['status']}
📅 Создана: {order['created_at']}
                """
                update.message.reply_text(message)
            else:
                update.message.reply_text("❌ Заявка не найдена")
                
        except ValueError:
            update.message.reply_text("❌ Неверный номер заявки")
        except Exception as e:
            logger.error(f"Ошибка в handle_status: {e}")
            update.message.reply_text("❌ Произошла ошибка при получении статуса")
    
    # Пример обработчика команды /orders
    def handle_orders(update, context):
        """Обработчик команды получения списка заявок"""
        try:
            result = transport_api.get_orders()
            
            if result.get('success') and result.get('orders'):
                orders = result['orders']
                message = f"📋 Список заявок ({len(orders)} шт.):\n\n"
                
                for order in orders[:10]:  # Показываем только первые 10
                    message += f"#{order['id']} - {order['direction']} - {order['status']}\n"
                
                if len(orders) > 10:
                    message += f"\n... и еще {len(orders) - 10} заявок"
                
                update.message.reply_text(message)
            else:
                update.message.reply_text("📋 Заявок не найдено")
                
        except Exception as e:
            logger.error(f"Ошибка в handle_orders: {e}")
            update.message.reply_text("❌ Произошла ошибка при получении списка заявок")
    
    # Здесь бы был код инициализации бота с python-telegram-bot
    # from telegram.ext import Application, CommandHandler
    # 
    # application = Application.builder().token("YOUR_BOT_TOKEN").build()
    # 
    # application.add_handler(CommandHandler("new_order", handle_new_order))
    # application.add_handler(CommandHandler("status", handle_status))
    # application.add_handler(CommandHandler("orders", handle_orders))
    # 
    # application.run_polling()

# Пример прямого использования API
def example_direct_usage():
    """Пример прямого использования API без Telegram бота"""
    
    # Конфигурация
    API_BASE_URL = "http://localhost:3000/api/telegram"
    API_KEY = "your_telegram_api_key_here"  # Замените на ваш API ключ
    
    # Инициализация API
    transport_api = TransportAPI(API_BASE_URL, API_KEY)
    
    try:
        # Создание заявки
        order_data = {
            "date": "2024-01-15",
            "direction": "Москва → Санкт-Петербург",
            "distance": 635.5,
            "weight": 2.5,
            "amount": 15000,
            "company": "ООО Рога и Копыта",
            "clientName": "Иван Петров",
            "phone": "+7 (999) 123-45-67",
            "email": "client@example.com"
        }
        
        print("Создание заявки...")
        result = transport_api.create_order(order_data)
        print(f"Результат: {json.dumps(result, indent=2, ensure_ascii=False)}")
        
        if result.get('success'):
            order_id = result['order']['id']
            
            # Получение статуса
            print(f"\nПолучение статуса заявки #{order_id}...")
            status_result = transport_api.get_order_status(order_id)
            print(f"Статус: {json.dumps(status_result, indent=2, ensure_ascii=False)}")
            
            # Получение списка заявок
            print("\nПолучение списка заявок...")
            orders_result = transport_api.get_orders()
            print(f"Список заявок: {json.dumps(orders_result, indent=2, ensure_ascii=False)}")
    
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    print("Пример использования API транспортной компании")
    print("=" * 50)
    example_direct_usage()
