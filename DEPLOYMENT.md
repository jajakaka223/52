# Инструкция по развертыванию

## Railway (Backend)

1. Зайдите на [Railway.app](https://railway.app)
2. Создайте новый проект из GitHub репозитория
3. Добавьте PostgreSQL базу данных
4. Установите переменные окружения:
   - `DATABASE_URL` - автоматически создается Railway
   - `FRONTEND_URL` - URL вашего Vercel приложения
   - `NODE_ENV=production`

## Vercel (Frontend)

1. Зайдите на [Vercel.com](https://vercel.com)
2. Подключите GitHub репозиторий
3. Установите настройки:
   - Root Directory: `web`
   - Build Command: `npm run build`
   - Output Directory: `build`
4. Установите переменные окружения:
   - `REACT_APP_API_URL` - URL вашего Railway приложения

## Локальная разработка

1. Установите PostgreSQL
2. Создайте базу данных `transport_company`
3. Скопируйте `.env.example` в `.env` и настройте переменные
4. Запустите сервер: `npm start`
5. Запустите фронтенд: `cd web && npm start`

## Переменные окружения

### Backend (Railway)

- `DATABASE_URL` - строка подключения к PostgreSQL
- `FRONTEND_URL` - URL фронтенда для CORS
- `NODE_ENV=production`

### Frontend (Vercel)

- `REACT_APP_API_URL` - URL бэкенда API
