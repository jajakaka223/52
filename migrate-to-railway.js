#!/usr/bin/env node

/**
 * Скрипт для миграции данных из локальной базы в Railway
 * Запуск: node migrate-to-railway.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Конфигурация локальной базы данных
const localConfig = {
  host: 'localhost',
  port: 5432,
  database: 'transport_company',
  user: 'postgres',
  password: 'admin' // Попробуйте стандартные пароли
};

// Конфигурация Railway (из переменных окружения)
const railwayConfig = {
  host: process.env.DB_HOST || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'postgres.railway.internal',
  port: process.env.DB_PORT || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).port : 5432,
  database: process.env.DB_NAME || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : 'transport_company',
  user: process.env.DB_USER || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : 'postgres',
  password: process.env.DB_PASSWORD || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).password : 'GxebDCtEXaMnwEHatMMDtgfqXefjQfFr'
};

console.log('🚀 Начинаем миграцию данных в Railway...');
console.log('📊 Локальная БД:', localConfig.host + ':' + localConfig.port + '/' + localConfig.database);
console.log('☁️ Railway БД:', railwayConfig.host + ':' + railwayConfig.port + '/' + railwayConfig.database);

async function migrateData() {
  const localPool = new Pool(localConfig);
  const railwayPool = new Pool(railwayConfig);

  try {
    // Подключаемся к локальной базе
    console.log('🔌 Подключение к локальной базе...');
    const localClient = await localPool.connect();
    console.log('✅ Локальная база подключена');

    // Подключаемся к Railway
    console.log('🔌 Подключение к Railway...');
    const railwayClient = await railwayPool.connect();
    console.log('✅ Railway база подключена');

    // Список таблиц для миграции (в правильном порядке)
    const tables = [
      'roles',
      'users', 
      'vehicles',
      'orders',
      'gps_tracking',
      'accounting',
      'vehicle_maintenance_history',
      'role_permissions',
      'notifications'
    ];

    for (const table of tables) {
      try {
        console.log(`📋 Миграция таблицы: ${table}`);
        
        // Получаем данные из локальной таблицы
        const result = await localClient.query(`SELECT * FROM ${table}`);
        const rows = result.rows;
        
        if (rows.length === 0) {
          console.log(`   ⚠️ Таблица ${table} пуста, пропускаем`);
          continue;
        }

        // Получаем названия колонок
        const columns = Object.keys(rows[0]);
        const columnNames = columns.join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Очищаем таблицу в Railway (если она существует)
        await railwayClient.query(`DELETE FROM ${table}`);

        // Вставляем данные в Railway
        for (const row of rows) {
          const values = columns.map(col => row[col]);
          const query = `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
          await railwayClient.query(query, values);
        }

        console.log(`   ✅ Мигрировано ${rows.length} записей в ${table}`);
      } catch (error) {
        console.log(`   ❌ Ошибка миграции ${table}:`, error.message);
        // Продолжаем с другими таблицами
      }
    }

    console.log('🎉 Миграция завершена!');
    
    // Проверяем результат
    console.log('🔍 Проверка результата...');
    const userCount = await railwayClient.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Пользователей в Railway: ${userCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await localPool.end();
    await railwayPool.end();
  }
}

// Запускаем миграцию
migrateData().catch(console.error);
