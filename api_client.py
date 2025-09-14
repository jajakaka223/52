#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
from datetime import datetime
from typing import Dict, Optional

class TransportCompanyAPI:
    """Клиент для работы с API транспортной компании"""
    
    def __init__(self, api_url: str, username: str, password: str):
        self.api_url = api_url.rstrip('/')
        self.username = username
        self.password = password
        self.auth_token = None
        
    def authenticate(self) -> bool:
        """Аутентификация в API"""
        try:
            response = requests.post(f"{self.api_url}/api/auth/login", json={
                "username": self.username,
                "password": self.password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                print(f"✅ Успешная аутентификация в API")
                return True
            else:
                print(f"❌ Ошибка аутентификации: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Ошибка подключения к API: {e}")
            return False
    
    def create_order(self, order_data: Dict) -> Optional[Dict]:
        """Создание заявки через API"""
        if not self.auth_token:
            if not self.authenticate():
                return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.api_url}/api/orders",
                json=order_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                order_id = data.get('order', {}).get('id') if 'order' in data else data.get('id')
                print(f"✅ Заявка создана: ID {order_id}")
                return data
            else:
                print(f"❌ Ошибка создания заявки: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Ошибка при создании заявки: {e}")
            return None
    
    def parse_order_from_text(self, text: str) -> Optional[Dict]:
        """Парсинг заявки из текста (адаптируйте под ваш формат)"""
        import re
        
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
            
            # Добавляем информацию о грузе
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

# Пример использования
if __name__ == "__main__":
    # Настройки API
    API_URL = "https://web-production-7cfec.up.railway.app"
    USERNAME = "admin"
    PASSWORD = "admin"
    
    # Создаем клиент
    api_client = TransportCompanyAPI(API_URL, USERNAME, PASSWORD)
    
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
    
    # Парсим и создаем заявку
    order_data = api_client.parse_order_from_text(test_text)
    if order_data:
        print("📋 Извлеченные данные:")
        for key, value in order_data.items():
            print(f"  {key}: {value}")
        
        result = api_client.create_order(order_data)
        if result:
            print("✅ Заявка успешно создана в системе!")
        else:
            print("❌ Ошибка создания заявки")
    else:
        print("❌ Ошибка парсинга заявки")
