# Интеграция вашего Telegram бота с приложением

## Что нужно добавить в ваш существующий бот

### 1. Установите зависимости

```bash
pip install requests
```

### 2. Добавьте в ваш бот файл `api_client.py`

Скопируйте файл `api_client.py` в папку с вашим ботом.

### 3. Импортируйте и настройте API клиент

В начале вашего бота добавьте:

```python
from api_client import TransportCompanyAPI

# Настройки API
API_URL = "https://web-production-7cfec.up.railway.app"
API_USERNAME = "admin"
API_PASSWORD = "admin"

# Создаем клиент API
api_client = TransportCompanyAPI(API_URL, API_USERNAME, API_PASSWORD)
```

### 4. Добавьте функцию парсинга заявки

```python
def parse_order_from_telegram(text: str) -> dict:
    """Парсинг заявки из текста Telegram"""
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
```

### 5. Добавьте обработку заявок в ваш бот

В функции обработки сообщений вашего бота добавьте:

```python
def handle_message(message):
    """Обработка входящего сообщения"""
    text = message.get("text", "")
    chat_id = message["chat"]["id"]
    
    # Проверяем, что сообщение содержит заявку
    if "Груз:" in text and "→" in text:
        print(f"📨 Получена заявка от {chat_id}")
        
        # Парсим заявку
        order_data = parse_order_from_telegram(text)
        if not order_data:
            bot.send_message(chat_id, "❌ Не удалось распарсить заявку. Проверьте формат.")
            return
        
        # Создаем заявку через API
        result = api_client.create_order(order_data)
        if result:
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
        
        bot.send_message(chat_id, response_text, parse_mode='HTML')
    else:
        # Отправляем инструкцию
        help_text = """🤖 <b>Бот для создания заявок</b>

Отправьте заявку в формате:
<code>Груз: Ижевск → Владимир
...
791</code>

Бот автоматически извлечет данные и создаст заявку в системе."""
        
        bot.send_message(chat_id, help_text, parse_mode='HTML')
```

## Структура данных заявки

API ожидает следующие поля:

```json
{
  "date": "2025-01-14",           // Дата заявки (YYYY-MM-DD)
  "direction": "Ижевск → Владимир", // Направление
  "weight": 2.6,                  // Вес в тоннах (опционально)
  "amount": 16000.0,              // Сумма в рублях (опционально)
  "company": "Название компании",  // Компания (опционально)
  "clientName": "Имя клиента",     // Имя клиента (опционально)
  "phone": "+7(909)0607745",      // Телефон (опционально)
  "email": "email@example.com",   // Email (опционально)
  "details": "Дополнительные детали" // Детали заявки (опционально)
}
```

## Обработка ошибок

- Если парсинг не удался, отправьте пользователю сообщение об ошибке
- Если создание заявки не удалось, попробуйте повторную аутентификацию
- Все ошибки логируйте для отладки

## Тестирование

Создайте тестовый файл `test_integration.py`:

```python
from api_client import TransportCompanyAPI

# Настройки
API_URL = "https://web-production-7cfec.up.railway.app"
USERNAME = "admin"
PASSWORD = "admin"

# Тестируем
api_client = TransportCompanyAPI(API_URL, USERNAME, PASSWORD)

# Тестовый текст
test_text = "ваш тестовый текст заявки..."

# Парсим и создаем
order_data = api_client.parse_order_from_text(test_text)
if order_data:
    result = api_client.create_order(order_data)
    print("Результат:", result)
```

## Безопасность

- Храните учетные данные API в переменных окружения
- Не коммитьте пароли в репозиторий
- Используйте HTTPS для всех запросов

## Поддержка

Если возникнут проблемы:
1. Проверьте подключение к API
2. Убедитесь в правильности формата данных
3. Проверьте логи ошибок
4. Убедитесь, что все обязательные поля заполнены
