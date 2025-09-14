#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import requests
import json
from datetime import datetime
from typing import Dict, Optional, Tuple

# Конфигурация
TELEGRAM_BOT_TOKEN = "7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE"
API_BASE_URL = "https://web-production-7cfec.up.railway.app"
ADMIN_USERNAME = "admin"  # Замените на ваш логин админа
ADMIN_PASSWORD = "admin"  # Замените на ваш пароль админа

class TelegramBot:
    def __init__(self):
        self.bot_token = TELEGRAM_BOT_TOKEN
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.api_base = API_BASE_URL
        self.auth_token = None
        
    def authenticate(self) -> bool:
        """Аутентификация в API проекта"""
        try:
            response = requests.post(f"{self.api_base}/api/auth/login", json={
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                print(f"✅ Успешная аутентификация")
                return True
            else:
                print(f"❌ Ошибка аутентификации: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Ошибка подключения к API: {e}")
            return False
    
    def parse_order(self, text: str) -> Optional[Dict]:
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
            
            # Извлекаем имя клиента (ищем имя перед телефоном)
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
            
            # Добавляем информацию о грузе
            cargo_match = re.search(r'([А-Яа-яёЁ\s,]+)', text)
            if cargo_match and 'Стройматериалы' in text:
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
    
    def create_order(self, order_data: Dict) -> bool:
        """Создание заявки через API"""
        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.api_base}/api/orders",
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
    
    def send_message(self, chat_id: str, text: str):
        """Отправка сообщения в Telegram"""
        try:
            requests.post(f"{self.api_url}/sendMessage", json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            })
        except Exception as e:
            print(f"❌ Ошибка отправки сообщения: {e}")
    
    def process_message(self, message: Dict):
        """Обработка входящего сообщения"""
        try:
            chat_id = str(message["chat"]["id"])
            text = message.get("text", "")
            
            # Проверяем, что сообщение содержит заявку
            if "Груз:" in text and "→" in text:
                print(f"📨 Получена заявка от {chat_id}")
                
                # Парсим заявку
                order_data = self.parse_order(text)
                if not order_data:
                    self.send_message(chat_id, "❌ Не удалось распарсить заявку. Проверьте формат.")
                    return
                
                # Создаем заявку
                if self.create_order(order_data):
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
                
                self.send_message(chat_id, response_text)
            else:
                # Отправляем инструкцию
                help_text = """🤖 <b>Бот для создания заявок</b>

Отправьте заявку в формате:
<code>Груз: Ижевск → Владимир

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
791</code>

Бот автоматически извлечет:
• Направление
• Вес
• Сумму
• Компанию
• Имя клиента
• Телефон
• Email
• Номер машины"""
                
                self.send_message(chat_id, help_text)
                
        except Exception as e:
            print(f"❌ Ошибка обработки сообщения: {e}")
    
    def get_updates(self, offset: int = 0):
        """Получение обновлений от Telegram"""
        try:
            response = requests.get(f"{self.api_url}/getUpdates", params={
                "offset": offset,
                "timeout": 30
            })
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Ошибка получения обновлений: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Ошибка подключения к Telegram API: {e}")
            return None
    
    def run(self):
        """Запуск бота"""
        print("🚀 Запуск Telegram бота...")
        
        # Аутентификация
        if not self.authenticate():
            print("❌ Не удалось аутентифицироваться. Проверьте настройки.")
            return
        
        print("✅ Бот запущен и готов к работе!")
        print("📱 Отправьте заявку в формате, указанном в инструкции")
        
        last_update_id = 0
        
        while True:
            try:
                updates = self.get_updates(last_update_id)
                if not updates or not updates.get("ok"):
                    continue
                
                for update in updates.get("result", []):
                    last_update_id = update["update_id"] + 1
                    
                    if "message" in update:
                        self.process_message(update["message"])
                
            except KeyboardInterrupt:
                print("\n🛑 Остановка бота...")
                break
            except Exception as e:
                print(f"❌ Ошибка в основном цикле: {e}")
                continue

if __name__ == "__main__":
    bot = TelegramBot()
    bot.run()
