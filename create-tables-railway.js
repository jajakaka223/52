#!/usr/bin/env node

/**
 * Скрипт для создания таблиц в Railway
 */

const { Pool } = require('pg');

// Конфигурация Railway
const railwayConfig = {
  host: 'ballast.proxy.rlwy.net',
  port: 40362,
  database: 'railway',
  user: 'postgres',
  password: 'GxebDCtEXaMnwEHatMMDtgfqXefjQfFr'
};

async function createTables() {
  console.log('🚀 Создание таблиц в Railway...');
  
  const pool = new Pool(railwayConfig);
  
  try {
    const client = await pool.connect();
    console.log('✅ Подключение к Railway установлено');
    
    // SQL для создания таблиц
    const createTablesSQL = `
      -- Создание таблицы пользователей
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'driver',
        email VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Создание таблицы машин
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        model VARCHAR(100),
        plate_number VARCHAR(20) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Создание таблицы заявок
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        direction VARCHAR(255) NOT NULL,
        distance DECIMAL(10,2),
        weight DECIMAL(10,2),
        amount DECIMAL(12,2),
        company VARCHAR(255),
        client_name VARCHAR(255),
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'new',
        vehicle_id INTEGER REFERENCES vehicles(id),
        driver_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Создание таблицы уведомлений
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Создание таблицы расходов
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Создание таблицы зарплат
      CREATE TABLE IF NOT EXISTS salaries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await client.query(createTablesSQL);
    console.log('✅ Таблицы созданы успешно');
    
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
    
    console.log('🎉 Инициализация завершена!');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем создание таблиц
createTables().catch(console.error);
