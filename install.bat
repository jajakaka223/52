@echo off
echo 🚚 Установка зависимостей приложения транспортной компании...
echo.

REM Проверяем наличие Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не установлен! Пожалуйста, установите Node.js 16+ с https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js найден
echo.

REM Устанавливаем основные зависимости
echo 📦 Установка основных зависимостей...
npm install
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки основных зависимостей
    pause
    exit /b 1
)

echo ✅ Основные зависимости установлены
echo.

REM Создаем папки если их нет
if not exist "logs" mkdir logs
if not exist "web" mkdir web
if not exist "mobile" mkdir mobile

echo 📁 Папки созданы
echo.

REM Копируем .env файл если его нет
if not exist ".env" (
    echo 📝 Копирование файла конфигурации...
    copy env.example .env
    echo ✅ Файл .env создан
    echo.
    echo ⚠️  ВАЖНО: Отредактируйте файл .env с вашими настройками базы данных!
    echo.
)

echo 🎉 Установка завершена успешно!
echo.
echo 📋 Следующие шаги:
echo 1. Отредактируйте файл .env с настройками базы данных
echo 2. Создайте базу данных PostgreSQL: transport_company
echo 3. Запустите start.bat для запуска приложения
echo.
pause
