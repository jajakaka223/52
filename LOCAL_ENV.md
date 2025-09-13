# Local Development Environment

## Для локальной разработки

### 1. Создайте файл `.env.local` в папке `web/`:

```env
REACT_APP_API_URL=http://localhost:3000
NODE_ENV=development
```

### 2. Создайте файл `.env` в корневой папке:

```env
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transport_company
DB_USER=postgres
DB_PASSWORD=your_password

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Node environment
NODE_ENV=development
```

### 3. Запустите приложение:

```bash
# Запуск бэкенда
npm start

# Запуск фронтенда (в другом терминале)
cd web
npm start
```

## Переменные для продакшена

### Railway (Backend):
- `NODE_ENV=production`
- `FRONTEND_URL=https://52-jq5l.vercel.app`
- `DATABASE_URL` (автоматически создается Railway)

### Vercel (Frontend):
- `REACT_APP_API_URL=https://web-production-7cfec.up.railway.app`
- `NODE_ENV=production`
