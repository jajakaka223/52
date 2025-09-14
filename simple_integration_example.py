#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Простой пример интеграции вашего Telegram бота с приложением
Скопируйте этот код в ваш существующий бот
"""

import requests
import re
from datetime import datetime

# ===== НАСТРОЙКИ API =====
API_URL = "https://web-production-7cfec.up.railway.app"
API_USERNAME = "admin"
API_PASSWORD = "admin"

# Глобальная переменная для токена
auth_token = None

def authenticate_api():
    """Аутентификация в API"""
    global auth_token
    try:
        response = requests.post(f"{API_URL}/api/auth/login", json={
            "username": API_USERNAME,
            "password": API_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            auth_token = data.get('token')
            print("✅ Успешная аутентификация в API")
            return True
        else:
            print(f"❌ Ошибка аутентификации: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка подключения к API: {e}")
        return False

def parse_telegram_order(text):
    """Парсинг заявки из текста Telegram"""
    try:
        # Извлекаем направление
        direction_match = re.search(r'Груз:\s*([^→]+)→\s*([^\n]+)', text)
        if not direction_match:
            return None
        
        from_city = direction_match.group(1).strip()
        to_city = direction_match.group(2).strip()
        direction = f"{from_city} → {to_city}"
        
        # Извлекаем вес
        weight_match = re.search(r'(\d+\.?\d*)\s*т', text)
        weight = float(weight_match.group(1)) if weight_match else None
        
        # Извлекаем сумму (приоритет: без НДС, затем с НДС)
        amount = None
        amount_match = re.search(r'(\d+)\s*руб\s*Без НДС', text)
        if not amount_match:
            amount_match = re.search(r'(\d+)\s*руб\s*С НДС', text)
        if amount_match:
            amount = float(amount_match.group(1))
        
        # Извлекаем компанию
        company_match = re.search(r'ФИРМА:\s*([^\n]+)', text)
        company = company_match.group(1).strip() if company_match else None
        
        # Извлекаем имя клиента
        name_match = re.search(r'рейтинг:[^\n]*\n([А-Яа-яёЁ\s]+)\s*\nтел:', text)
        client_name = name_match.group(1).strip() if name_match else None
        
        # Извлекаем телефон
        phone_match = re.search(r'тел:\s*([+\d\s\(\)\-]+)', text)
        phone = phone_match.group(1).strip() if phone_match else None
        
        # Извлекаем email
        email_match = re.search(r'e-mail:\s*([^\s]+)', text)
        email = email_match.group(1).strip() if email_match else None
        
        # Извлекаем номер машины (в конце)
        vehicle_match = re.search(r'(\d{3})\s*$', text.strip())
        vehicle_number = vehicle_match.group(1) if vehicle_match else None
        
        # Создаем детали заявки
        details = []
        if weight:
            details.append(f"Вес: {weight} т")
        if vehicle_number:
            details.append(f"Номер машины: {vehicle_number}")
        if 'Стройматериалы' in text:
            details.append("Груз: Стройматериалы")
        
        details_text = "\n".join(details) if details else "Детали не указаны"
        
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "direction": direction,
            "weight": weight,
            "amount": amount,
            "company": company,
            "clientName": client_name,
            "phone": phone,
            "email": email,
            "details": details_text
        }
        
    except Exception as e:
        print(f"❌ Ошибка парсинга заявки: {e}")
        return None

def create_order_in_app(order_data):
    """Создание заявки в приложении"""
    global auth_token
    
    if not auth_token:
        if not authenticate_api():
            return False
    
    try:
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{API_URL}/api/orders",
            json=order_data,
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            order_id = data.get('order', {}).get('id') if 'order' in data else data.get('id')
            print(f"✅ Заявка создана: ID {order_id}")
            return True
        else:
            print(f"❌ Ошибка создания заявки: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка при создании заявки: {e}")
        return False

# ===== ИНТЕГРАЦИЯ С ВАШИМ БОТОМ =====
# Добавьте эту функцию в обработчик сообщений вашего бота

def handle_telegram_message(message):
    """Обработка сообщения от Telegram (добавьте в ваш бот)"""
    text = message.get("text", "")
    chat_id = message["chat"]["id"]
    
    # Проверяем, что сообщение содержит заявку
    if "Груз:" in text and "→" in text:
        print(f"📨 Получена заявка от {chat_id}")
        
        # Парсим заявку
        order_data = parse_telegram_order(text)
        if not order_data:
            # Отправляем сообщение об ошибке (замените на ваш метод отправки)
            # bot.send_message(chat_id, "❌ Не удалось распарсить заявку. Проверьте формат.")
            return
        
        # Создаем заявку в приложении
        if create_order_in_app(order_data):
            response_text = f"""✅ <b>Заявка успешно создана!</b>

📋 <b>Направление:</b> {order_data['direction']}
🏢 <b>Компания:</b> {order_data['company'] or 'Не указана'}
👤 <b>Клиент:</b> {order_data['clientName'] or 'Не указан'}
📞 <b>Телефон:</b> {order_data['phone'] or 'Не указан'}
📧 <b>Email:</b> {order_data['email'] or 'Не указан'}
⚖️ <b>Вес:</b> {order_data['weight'] or 'Не указан'} т
💰 <b>Сумма:</b> {order_data['amount'] or 'Не указана'} руб

<i>Заявка добавлена в систему и готова к редактированию.</i>"""
        else:
            response_text = "❌ Ошибка при создании заявки. Попробуйте позже."
        
        # Отправляем ответ (замените на ваш метод отправки)
        # bot.send_message(chat_id, response_text, parse_mode='HTML')

# ===== ТЕСТИРОВАНИЕ =====
if __name__ == "__main__":
    # Тестовый текст заявки
    test_text = """Груз: Ижевск → Владимир

RUS, 1005 км
• Ижевск, Россия, 12 сен, пт
• Владимир (235 км от Нижний Новгород, Россия), Россия

2.6 т / - 
Стройматериалы, палеты — 5 шт., возм.догруз

Все закр.+изотерм
Загрузка, выгрузка: задняя

20000 руб  С НДС (19.9 руб/км)
16000 руб  Без НДС (15.9 руб/км)
Без торга

ФИРМА: ГК Ижсинтез (Солекс Доставка, ООО), Ижевск
Код в ATI.SU: 453700
рейтинг: 5 , р131

Андрей 
тел: +7(909)0607745 Билайн
тел: +7(912)7425245 МТС
e-mail: miroshkin.av@izhsintez.ru
факс +7 (3412) 507607

Ссылка на груз:
https://loads.ati.su/loadinfo/49e65551-a7a9-4af9-815f-84d269dbcda0?utm_source=atiapp
791"""
    
    print("🧪 Тестирование интеграции...")
    
    # Парсим заявку
    order_data = parse_telegram_order(test_text)
    if order_data:
        print("📋 Извлеченные данные:")
        for key, value in order_data.items():
            print(f"  {key}: {value}")
        
        # Создаем заявку
        if create_order_in_app(order_data):
            print("✅ Заявка успешно создана в системе!")
        else:
            print("❌ Ошибка создания заявки")
    else:
        print("❌ Ошибка парсинга заявки")
