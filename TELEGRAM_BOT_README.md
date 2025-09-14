# Telegram Bot для создания заявок

Этот бот автоматически парсит заявки из Telegram и создает их в системе транспортной компании.

## Установка и настройка

### 1. Установите Python зависимости

```bash
pip install -r requirements.txt
```

### 2. Настройте конфигурацию

Откройте файл `telegram_bot.py` и измените следующие параметры:

```python
# Конфигурация
TELEGRAM_BOT_TOKEN = "7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE"  # Ваш токен бота
API_BASE_URL = "https://web-production-7cfec.up.railway.app"  # URL вашего API
ADMIN_USERNAME = "admin"  # Логин администратора
ADMIN_PASSWORD = "admin"  # Пароль администратора
```

### 3. Запустите бота

```bash
python telegram_bot.py
```

## Как использовать

1. Найдите вашего бота в Telegram по токену
2. Отправьте заявку в формате:

```
Груз: Ижевск → Владимир

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
791
```

## Что парсит бот

Бот автоматически извлекает из текста:

- **Направление**: "Ижевск → Владимир"
- **Вес**: "2.6 т"
- **Сумма**: "16000 руб Без НДС" (приоритет без НДС)
- **Компания**: "ГК Ижсинтез (Солекс Доставка, ООО), Ижевск"
- **Имя клиента**: "Андрей"
- **Телефон**: "+7(909)0607745 Билайн"
- **Email**: "miroshkin.av@izhsintez.ru"
- **Номер машины**: "791" (последние 3 цифры в конце)

## Структура создаваемой заявки

```json
{
  "date": "2025-01-14",
  "direction": "Ижевск → Владимир",
  "weight": 2.6,
  "amount": 16000.0,
  "company": "ГК Ижсинтез (Солекс Доставка, ООО), Ижевск",
  "clientName": "Андрей",
  "phone": "+7(909)0607745 Билайн",
  "email": "miroshkin.av@izhsintez.ru",
  "details": "Вес: 2.6 т\nНомер машины: 791\nГруз: Стройматериалы"
}
```

## Обработка ошибок

- Если заявка не распарсилась, бот отправит сообщение об ошибке
- Если не удалось создать заявку в системе, бот уведомит об этом
- Все ошибки логируются в консоль

## Автозапуск (опционально)

Для автозапуска бота на сервере создайте systemd service:

```bash
sudo nano /etc/systemd/system/telegram-bot.service
```

Содержимое файла:
```ini
[Unit]
Description=Telegram Bot for Transport Company
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/your/bot
ExecStart=/usr/bin/python3 /path/to/your/bot/telegram_bot.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl enable telegram-bot.service
sudo systemctl start telegram-bot.service
```

## Логи

Бот выводит подробные логи в консоль:
- ✅ Успешные операции
- ❌ Ошибки
- 📨 Полученные сообщения
- 📋 Созданные заявки
