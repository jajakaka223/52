# Развертывание Telegram сервера

## Описание
Простой HTTP сервер на Python, который принимает запросы от Railway проекта и отправляет сообщения в Telegram через Python бота.

## Файлы
- `telegram_server.py` - основной сервер на Flask
- `telegram_requirements.txt` - зависимости Python
- `start_telegram_server.sh` - скрипт запуска

## Развертывание на сервере 109.205.58.89

### 1. Загрузка файлов на сервер
```bash
# Скопируйте файлы на сервер
scp telegram_server.py root@109.205.58.89:/root/
scp telegram_requirements.txt root@109.205.58.89:/root/
scp start_telegram_server.sh root@109.205.58.89:/root/
```

### 2. Подключение к серверу
```bash
ssh root@109.205.58.89
```

### 3. Установка зависимостей
```bash
cd /root
pip3 install -r telegram_requirements.txt
```

### 4. Запуск сервера
```bash
# Сделать скрипт исполняемым
chmod +x start_telegram_server.sh

# Запустить сервер
./start_telegram_server.sh
```

### 5. Запуск в фоновом режиме (рекомендуется)
```bash
# Запуск с nohup для работы в фоне
nohup python3 telegram_server.py > telegram_server.log 2>&1 &

# Проверка работы
ps aux | grep telegram_server
tail -f telegram_server.log
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
  "text": "Текст сообщения",
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

### GET /health
Проверка состояния сервера

**Ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T10:30:00",
  "telegram_bot_configured": true
}
```

## Мониторинг

### Проверка работы сервера
```bash
curl http://109.205.58.89:8000/health
```

### Просмотр логов
```bash
tail -f telegram_server.log
```

### Остановка сервера
```bash
pkill -f telegram_server.py
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
