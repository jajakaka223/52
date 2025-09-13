#!/usr/bin/env node

/**
 * Скрипт для инициализации данных в Railway
 * Запускается на Railway сервере
 */

const { Pool } = require('pg');

// Конфигурация Railway (из переменных окружения)
const railwayConfig = {
  host: process.env.DB_HOST || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'ballast.proxy.rlwy.net',
  port: process.env.DB_PORT || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).port : 40362,
  database: process.env.DB_NAME || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : 'railway',
  user: process.env.DB_USER || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : 'postgres',
  password: process.env.DB_PASSWORD || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).password : 'GxebDCtEXaMnwEHatMMDtgfqXefjQfFr'
};

async function initData() {
  const pool = new Pool(railwayConfig);
  
  try {
    const client = await pool.connect();
    console.log('✅ Подключение к Railway установлено');
    
    // Проверяем, есть ли уже данные
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCount.rows[0].count);
    
    if (count > 0) {
      console.log(`👥 В базе уже есть ${count} пользователей`);
      console.log('✅ Данные уже инициализированы');
      return;
    }
    
    console.log('🚀 Инициализируем данные...');
    
    // Создаем администратора
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin', 10);
    
    await client.query(`
      INSERT INTO users (username, password, full_name, role, email)
      VALUES ('admin', $1, 'Администратор', 'admin', 'admin@company.com')
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    
    console.log('✅ Администратор создан (admin/admin)');
    
    // Создаем тестового водителя
    const driverPassword = await bcrypt.hash('driver', 10);
    
    await client.query(`
      INSERT INTO users (username, password, full_name, role, email)
      VALUES ('driver', $1, 'Тестовый Водитель', 'driver', 'driver@company.com')
      ON CONFLICT (username) DO NOTHING
    `, [driverPassword]);
    
    console.log('✅ Водитель создан (driver/driver)');
    
    // Создаем тестовую машину
    await client.query(`
      INSERT INTO vehicles (name, model, plate_number, is_active)
      VALUES ('Газель', 'ГАЗ-3302', 'А123БВ77', true)
      ON CONFLICT (plate_number) DO NOTHING
    `);
    
    console.log('✅ Тестовая машина создана');
    
    // Создаем тестовую заявку
    await client.query(`
      INSERT INTO orders (date, direction, distance, weight, amount, company, client_name, phone, status)
      VALUES (CURRENT_DATE, 'Москва - Санкт-Петербург', 635.5, 1500.0, 25000.0, 'ООО Тест', 'Иван Иванов', '+7-999-123-45-67', 'new')
    `);
    
    console.log('✅ Тестовая заявка создана');
    
    console.log('🎉 Инициализация данных завершена!');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем инициализацию
initData().catch(console.error);
