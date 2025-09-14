# Развертывание Telegram Recommendation Server

## Описание
HTTP сервер на Python, который интегрируется с существующим Telegram ботом и обрабатывает запросы на отправку уведомлений о выполненной заявке. Включает отправку сообщений в Telegram и email с запросом рекомендации.

## Файлы
- `telegram_recommendation_server.py` - основной сервер на Flask
- `recommendation_requirements.txt` - зависимости Python
- `start_recommendation_server.sh` - скрипт запуска

## Развертывание на сервере 109.205.58.89

### 1. Загрузка файлов на сервер
```bash
# Скопируйте файлы на сервер
scp telegram_recommendation_server.py root@109.205.58.89:/root/
scp recommendation_requirements.txt root@109.205.58.89:/root/
scp start_recommendation_server.sh root@109.205.58.89:/root/
```

### 2. Подключение к серверу
```bash
ssh root@109.205.58.89
```

### 3. Установка зависимостей
```bash
cd /root
pip3 install -r recommendation_requirements.txt
```

### 4. Запуск сервера
```bash
# Сделать скрипт исполняемым
chmod +x start_recommendation_server.sh

# Запустить сервер
./start_recommendation_server.sh
```

### 5. Запуск в фоновом режиме (рекомендуется)
```bash
# Запуск с nohup для работы в фоне
nohup python3 telegram_recommendation_server.py > recommendation_server.log 2>&1 &

# Проверка работы
ps aux | grep telegram_recommendation_server
tail -f recommendation_server.log
```

## Настройка Railway проекта

### Переменные окружения
Добавьте в Railway проект переменную:
```
PYTHON_BOT_SERVER=http://109.205.58.89:8000
```

## API эндпоинты

### POST /send-telegram-message
Отправка сообщения в Telegram

**Параметры:**
```json
{
  "chat_id": "-1002419921277",
  "message_thread_id": "12493",
  "text": "✅ ЗАЯВКА ВЫПОЛНЕНА\n\n📧 Email клиента: client@example.com\n🛣️ Маршрут: Москва - Санкт-Петербург",
  "parse_mode": "Markdown"
}
```

**Ответ:**
```json
{
  "success": true,
  "messageId": 12345,
  "timestamp": "2025-01-14T10:30:00"
}
```

### POST /send-recommendation-email
Отправка email с запросом рекомендации

**Параметры:**
```json
{
  "email_address": "client@example.com",
  "route_info": "Москва - Санкт-Петербург"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Email с запросом рекомендации отправлен",
  "timestamp": "2025-01-14T10:30:00"
}
```

### POST /send-complete-notification
Полное уведомление (Telegram + Email)

**Параметры:**
```json
{
  "chat_id": "-1002419921277",
  "message_thread_id": "12493",
  "text": "✅ ЗАЯВКА ВЫПОЛНЕНА\n\n📧 Email клиента: client@example.com\n🛣️ Маршрут: Москва - Санкт-Петербург\n\n📧 Сообщение отправлено клиенту",
  "email_address": "client@example.com",
  "route_info": "Москва - Санкт-Петербург",
  "parse_mode": "Markdown"
}
```

**Ответ:**
```json
{
  "success": true,
  "results": {
    "telegram": {
      "success": true,
      "messageId": 12345
    },
    "email": {
      "success": true
    }
  },
  "timestamp": "2025-01-14T10:30:00"
}
```

### GET /health
Проверка состояния сервера

**Ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T10:30:00",
  "telegram_bot_configured": true,
  "email_configured": true,
  "service": "Telegram Recommendation Server"
}
```

## Интеграция с Railway проектом

### Обновление utils/telegram_notifier.js
Railway проект уже настроен для обращения к серверу по адресу `http://109.205.58.89:8000/send-telegram-message`

### Тестирование интеграции
```bash
# Проверка работы сервера
curl http://109.205.58.89:8000/health

# Тест отправки сообщения в Telegram
curl -X POST http://109.205.58.89:8000/send-telegram-message \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "-1002419921277",
    "message_thread_id": "12493",
    "text": "Тестовое сообщение от сервера"
  }'

# Тест отправки email с рекомендацией
curl -X POST http://109.205.58.89:8000/send-recommendation-email \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "test@example.com",
    "route_info": "Москва - Санкт-Петербург"
  }'
```

## Мониторинг

### Проверка работы сервера
```bash
curl http://109.205.58.89:8000/health
```

### Просмотр логов
```bash
tail -f recommendation_server.log
```

### Остановка сервера
```bash
pkill -f telegram_recommendation_server.py
```

## Безопасность

1. Сервер принимает запросы только с определенных IP (можно настроить в Flask)
2. Рекомендуется использовать HTTPS в продакшене
3. Добавить аутентификацию через API ключи

## Устранение неполадок

### Порт 8000 занят
```bash
# Найти процесс
lsof -i :8000
# Убить процесс
kill -9 <PID>
```

### Ошибки Telegram API
- Проверить токен бота
- Проверить права бота в чате
- Проверить корректность chat_id и message_thread_id

### Ошибки Email
- Проверить настройки Gmail SMTP
- Проверить правильность email адресов
- Проверить подключение к интернету

## Логирование

Сервер ведет подробные логи всех операций:
- Успешные отправки сообщений
- Ошибки Telegram API
- Ошибки отправки email
- Входящие запросы

Логи сохраняются в файл `recommendation_server.log`
