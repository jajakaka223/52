# Vercel Environment Variables

## Переменные окружения для Vercel

Установите следующие переменные в панели Vercel:

### 1. Зайдите в панель Vercel

- Откройте [vercel.com](https://vercel.com)
- Выберите ваш проект `52`
- Перейдите в **Settings** → **Environment Variables**

### 2. Добавьте переменные:

| Name                | Value                                      | Environment                      |
| ------------------- | ------------------------------------------ | -------------------------------- |
| `REACT_APP_API_URL` | `https://web-production-7cfec.up.rail.app` | Production, Preview, Development |
| `NODE_ENV`          | `production`                               | Production                       |

### 3. Сохраните и пересоберите:

- Нажмите **Save**
- Вернитесь в **Deployments**
- Нажмите **Redeploy** на последнем деплое

## Локальная разработка

Для локальной разработки создайте файл `.env.local` в папке `web/`:

```env
REACT_APP_API_URL=http://localhost:3000
NODE_ENV=development
```

## Проверка

После настройки переменных:

1. Vercel пересоберет проект
2. Фронтенд будет обращаться к Railway API
3. Приложение заработает полностью
