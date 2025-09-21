-- Создание таблицы уведомлений
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавление колонки fcm_token в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;
