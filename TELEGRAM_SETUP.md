# Быстрая настройка интеграции с Telegram ботом

## 1. Настройка сервера

### Создайте файл `.env`:

```bash
cp env.example .env
```

### Установите API ключ в `.env`:

```env
TELEGRAM_API_KEY=your_secure_api_key_here
```

### Запустите сервер:

```bash
npm run dev
```

## 2. Тестирование API

### Запустите тест:

```bash
node test-telegram-api.js
```

## 3. Интеграция с вашим Telegram ботом

### Python (рекомендуется):

```python
import requests

API_URL = "http://localhost:3000/api/telegram/order"
API_KEY = "your_secure_api_key_here"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY
}

# Создание заявки
order_data = {
    "date": "2024-01-15",
    "direction": "Москва → Санкт-Петербург",
    "company": "ООО Рога и Копыта",
    "clientName": "Иван Петров",
    "phone": "+7 (999) 123-45-67",
    "email": "client@example.com"
}

response = requests.post(API_URL, json=order_data, headers=headers)
print(response.json())
```

### JavaScript/Node.js:

```javascript
const axios = require("axios");

const API_URL = "http://localhost:3000/api/telegram/order";
const API_KEY = "your_secure_api_key_here";

const headers = {
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
};

const orderData = {
  date: "2024-01-15",
  direction: "Москва → Санкт-Петербург",
  company: "ООО Рога и Копыта",
  clientName: "Иван Петров",
  phone: "+7 (999) 123-45-67",
  email: "client@example.com",
};

axios
  .post(API_URL, orderData, { headers })
  .then((response) => console.log(response.data))
  .catch((error) => console.error(error.response.data));
```

## 4. Доступные endpoints

- `POST /api/telegram/order` - Создание заявки
- `GET /api/telegram/order/:id/status` - Статус заявки
- `GET /api/telegram/orders` - Список заявок
- `POST /api/telegram/webhook/status-change` - Webhook для уведомлений

## 5. Безопасность

- Обязательно используйте надежный API ключ
- В продакшене используйте HTTPS
- Ограничьте доступ к API по IP адресам

## 6. Поддержка

При возникновении проблем проверьте:

1. Запущен ли сервер (`npm run dev`)
2. Правильный ли API ключ в заголовке `X-API-Key`
3. Корректный ли формат данных в запросе
4. Логи сервера в консоли
