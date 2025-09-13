# 🚀 Руководство по развертыванию проекта 52 EXPRESS

## 📋 Обзор архитектуры

- **GitHub** - хранение кода
- **Railway** - бэкенд (Node.js + PostgreSQL)
- **Vercel** - фронтенд (React)

## 🔧 Шаг 1: Настройка GitHub

1. Создайте новый репозиторий на GitHub
2. Загрузите код:
   ```bash
   git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin master
   ```

## 🚂 Шаг 2: Настройка Railway (Backend)

1. Зайдите на [Railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project" → "Deploy from GitHub repo"
4. Выберите ваш репозиторий
5. Railway автоматически определит Node.js проект

### Настройка базы данных:
1. В панели проекта нажмите "New" → "Database" → "PostgreSQL"
2. Railway создаст базу данных и переменную `DATABASE_URL`

### Переменные окружения:
В настройках проекта добавьте:
- `NODE_ENV=production`
- `FRONTEND_URL=https://your-vercel-app.vercel.app` (замените на ваш Vercel URL)

## ⚡ Шаг 3: Настройка Vercel (Frontend)

1. Зайдите на [Vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите ваш репозиторий
5. Настройте проект:
   - **Framework Preset**: Create React App
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

### Переменные окружения:
В настройках проекта добавьте:
- `REACT_APP_API_URL=https://your-railway-app.railway.app` (замените на ваш Railway URL)

## 🔗 Шаг 4: Связывание сервисов

1. Скопируйте URL вашего Vercel приложения
2. В Railway добавьте переменную `FRONTEND_URL` с этим URL
3. Скопируйте URL вашего Railway приложения
4. В Vercel обновите переменную `REACT_APP_API_URL` с этим URL

## 🧪 Шаг 5: Тестирование

1. Откройте ваше Vercel приложение
2. Попробуйте зарегистрироваться (admin/admin)
3. Проверьте все функции приложения

## 🔧 Локальная разработка

1. Установите PostgreSQL
2. Создайте базу данных `transport_company`
3. Создайте файл `.env` в корне проекта:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=transport_company
   DB_USER=postgres
   DB_PASSWORD=your_password
   FRONTEND_URL=http://localhost:3000
   NODE_ENV=development
   ```
4. Запустите сервер: `npm start`
5. Запустите фронтенд: `cd web && npm start`

## 📝 Важные замечания

- Railway предоставляет бесплатный план с ограничениями
- Vercel предоставляет бесплатный план для личных проектов
- База данных Railway автоматически создает таблицы при первом запуске
- Все файлы загружаются в папку `uploads/` на сервере

## 🆘 Решение проблем

### Ошибка CORS:
- Проверьте, что `FRONTEND_URL` в Railway соответствует URL Vercel

### Ошибка подключения к БД:
- Проверьте переменную `DATABASE_URL` в Railway

### Ошибка API:
- Проверьте переменную `REACT_APP_API_URL` в Vercel

## 📞 Поддержка

При возникновении проблем проверьте логи в панелях Railway и Vercel.
