#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from telegram_bot import TelegramBot

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

def test_parser():
    bot = TelegramBot()
    
    print("🧪 Тестирование парсера заявок...")
    print("=" * 50)
    
    # Тестируем парсинг
    order_data = bot.parse_order(test_text)
    
    if order_data:
        print("✅ Заявка успешно распарсена!")
        print("\n📋 Извлеченные данные:")
        for key, value in order_data.items():
            print(f"  {key}: {value}")
    else:
        print("❌ Ошибка парсинга заявки")
    
    print("\n" + "=" * 50)
    
    # Тестируем аутентификацию
    print("🔐 Тестирование аутентификации...")
    if bot.authenticate():
        print("✅ Аутентификация успешна!")
        
        # Тестируем создание заявки
        if order_data:
            print("📤 Тестирование создания заявки...")
            if bot.create_order(order_data):
                print("✅ Заявка успешно создана в системе!")
            else:
                print("❌ Ошибка создания заявки")
    else:
        print("❌ Ошибка аутентификации")

if __name__ == "__main__":
    test_parser()
