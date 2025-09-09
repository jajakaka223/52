# Интеграция с Telegram ботом

## Обзор

API для интеграции с Telegram ботом позволяет создавать заявки напрямую из бота и получать уведомления об изменении статуса заявок.

## Настройка

### 1. Переменные окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Установите API ключ для Telegram бота:

```env
TELEGRAM_API_KEY=your_secure_api_key_here
```

### 2. Запуск сервера

```bash
npm run dev
```

## API Endpoints

### Создание заявки

**POST** `/api/telegram/order`

Создает новую заявку из Telegram бота.

#### Заголовки:

```
Content-Type: application/json
X-API-Key: your_telegram_api_key_here
```

#### Тело запроса:

```json
{
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
```

#### Обязательные поля:

- `date` - дата заявки (YYYY-MM-DD)
- `direction` - направление перевозки
- `company` - название компании
- `clientName` - имя клиента

#### Опциональные поля:

- `distance` - расстояние в км
- `weight` - вес груза в тоннах
- `amount` - сумма в рублях
- `phone` - телефон клиента
- `email` - email клиента

#### Ответ:

```json
{
  "success": true,
  "message": "Заявка успешно создана из Telegram",
  "order": {
    "id": 123,
    "date": "2024-01-15",
    "direction": "Москва → Санкт-Петербург",
    "company": "ООО Рога и Копыта",
    "client_name": "Иван Петров",
    "status": "new",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Получение статуса заявки

**GET** `/api/telegram/order/:id/status`

Получает текущий статус заявки по ID.

#### Заголовки:

```
X-API-Key: your_telegram_api_key_here
```

#### Ответ:

```json
{
  "success": true,
  "order": {
    "id": 123,
    "status": "assigned",
    "direction": "Москва → Санкт-Петербург",
    "company": "ООО Рога и Копыта",
    "client_name": "Иван Петров",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

### Получение списка заявок

**GET** `/api/telegram/orders`

Получает список заявок с возможностью фильтрации.

#### Параметры запроса:

- `start_date` - начальная дата (YYYY-MM-DD)
- `end_date` - конечная дата (YYYY-MM-DD)
- `status` - статус заявки (new, assigned, in_progress, completed, cancelled)

#### Пример:

```
GET /api/telegram/orders?start_date=2024-01-01&end_date=2024-01-31&status=completed
```

#### Ответ:

```json
{
  "success": true,
  "orders": [
    {
      "id": 123,
      "date": "2024-01-15",
      "direction": "Москва → Санкт-Петербург",
      "company": "ООО Рога и Копыта",
      "client_name": "Иван Петров",
      "status": "completed",
      "amount": 15000,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

### Webhook для уведомлений

**POST** `/api/telegram/webhook/status-change`

Webhook для получения уведомлений об изменении статуса заявки.

#### Тело запроса:

```json
{
  "orderId": 123,
  "newStatus": "completed",
  "oldStatus": "in_progress"
}
```

## Статусы заявок

- `new` - новая заявка
- `assigned` - назначена водителю
- `in_progress` - в пути
- `completed` - выполнена
- `cancelled` - отменена

## Примеры использования

### Python (для Telegram бота)

```python
import requests
import json

API_BASE_URL = "http://localhost:3000/api/telegram"
API_KEY = "your_telegram_api_key_here"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY
}

# Создание заявки
def create_order(order_data):
    response = requests.post(
        f"{API_BASE_URL}/order",
        headers=headers,
        json=order_data
    )
    return response.json()

# Получение статуса заявки
def get_order_status(order_id):
    response = requests.get(
        f"{API_BASE_URL}/order/{order_id}/status",
        headers=headers
    )
    return response.json()

# Пример создания заявки
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

result = create_order(order_data)
print(result)
```

### JavaScript (Node.js)

```javascript
const axios = require("axios");

const API_BASE_URL = "http://localhost:3000/api/telegram";
const API_KEY = "your_telegram_api_key_here";

const headers = {
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
};

// Создание заявки
async function createOrder(orderData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/order`, orderData, {
      headers,
    });
    return response.data;
  } catch (error) {
    console.error(
      "Ошибка создания заявки:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Получение статуса заявки
async function getOrderStatus(orderId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/order/${orderId}/status`,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Ошибка получения статуса:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Пример использования
const orderData = {
  date: "2024-01-15",
  direction: "Москва → Санкт-Петербург",
  distance: 635.5,
  weight: 2.5,
  amount: 15000,
  company: "ООО Рога и Копыта",
  clientName: "Иван Петров",
  phone: "+7 (999) 123-45-67",
  email: "client@example.com",
};

createOrder(orderData)
  .then((result) => console.log("Заявка создана:", result))
  .catch((error) => console.error("Ошибка:", error));
```

## Безопасность

1. **API ключ**: Обязательно используйте надежный API ключ и храните его в переменных окружения
2. **HTTPS**: В продакшене используйте HTTPS для всех запросов
3. **Rate limiting**: API защищен от злоупотреблений с помощью rate limiting
4. **Валидация**: Все входящие данные валидируются на сервере

## Обработка ошибок

API возвращает стандартные HTTP коды статуса:

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Неверный запрос (неверные данные)
- `401` - Неавторизован (неверный API ключ)
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

Пример ответа с ошибкой:

```json
{
  "error": "Обязательные поля: date, direction, company, clientName",
  "received": {
    "date": true,
    "direction": false,
    "company": true,
    "clientName": true
  }
}
```
