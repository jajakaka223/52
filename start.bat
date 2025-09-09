@echo off
echo 🚚 Запуск приложения транспортной компании...
echo.

REM Проверяем наличие Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не установлен! Пожалуйста, установите Node.js 16+ с https://nodejs.org/
    pause
    exit /b 1
)

REM Проверяем наличие PostgreSQL
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  PostgreSQL не найден в PATH. Убедитесь, что PostgreSQL установлен и добавлен в PATH
    echo.
)

echo ✅ Node.js найден
echo.

REM Устанавливаем зависимости если нужно
if not exist "node_modules" (
    echo 📦 Установка зависимостей...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей
        pause
        exit /b 1
    )
)

REM Проверяем наличие .env файла
if not exist ".env" (
    echo ⚠️  Файл .env не найден. Копирую из примера...
    copy env.example .env
    echo.
    echo 📝 Пожалуйста, отредактируйте файл .env с вашими настройками базы данных
    echo.
)

echo 🚀 Запуск сервера...
echo.
echo 📱 API будет доступен по адресу: http://localhost:3000/api
echo 🌐 Веб-интерфейс: http://localhost:3000
echo.
echo Нажмите Ctrl+C для остановки сервера
echo.

npm run dev
