# ⚡ Быстрый старт

## 🚀 Развертывание за 5 минут

### 1. GitHub
- Создайте репозиторий на GitHub
- Загрузите код: `git push origin master`

### 2. Railway (Backend)
1. Зайдите на [Railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Выберите репозиторий
4. Добавьте PostgreSQL базу данных
5. Установите переменные:
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-vercel-app.vercel.app`

### 3. Vercel (Frontend)
1. Зайдите на [Vercel.com](https://vercel.com)
2. "New Project" → выберите репозиторий
3. Настройки:
   - Root Directory: `web`
   - Build Command: `npm run build`
   - Output Directory: `build`
4. Установите переменную:
   - `REACT_APP_API_URL=https://your-railway-app.railway.app`

### 4. Связывание
- Скопируйте URL Vercel → вставьте в `FRONTEND_URL` в Railway
- Скопируйте URL Railway → вставьте в `REACT_APP_API_URL` в Vercel

## 🔑 Доступ по умолчанию
- **Логин**: admin
- **Пароль**: admin

## 📖 Подробная инструкция
Смотрите файл `SETUP_GUIDE.md` для детального руководства.
