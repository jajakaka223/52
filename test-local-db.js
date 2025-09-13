#!/usr/bin/env node

/**
 * Скрипт для проверки подключения к локальной базе данных
 */

const { Pool } = require('pg');

// Возможные конфигурации для локальной базы
const configs = [
  { host: 'localhost', port: 5432, database: 'transport_company', user: 'postgres', password: 'admin' },
  { host: 'localhost', port: 5432, database: 'transport_company', user: 'postgres', password: 'postgres' },
  { host: 'localhost', port: 5432, database: 'transport_company', user: 'postgres', password: 'password' },
  { host: 'localhost', port: 5432, database: 'transport_company', user: 'postgres', password: '123456' },
  { host: 'localhost', port: 5432, database: 'transport_company', user: 'postgres', password: '' },
];

async function testConnection() {
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    console.log(`🔍 Тестируем конфигурацию ${i + 1}: ${config.user}@${config.host}:${config.port}/${config.database}`);
    
    const pool = new Pool(config);
    
    try {
      const client = await pool.connect();
      console.log(`✅ Успешное подключение с паролем: "${config.password}"`);
      
      // Проверяем таблицы
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log(`📋 Найдено таблиц: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      client.release();
      await pool.end();
      
      console.log(`\n🎉 Рабочая конфигурация найдена!`);
      console.log(`Используйте эти настройки в migrate-to-railway.js:`);
      console.log(JSON.stringify(config, null, 2));
      
      return config;
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}`);
      await pool.end();
    }
  }
  
  console.log(`\n❌ Не удалось подключиться к локальной базе данных`);
  console.log(`Проверьте:`);
  console.log(`1. PostgreSQL запущен`);
  console.log(`2. База данных 'transport_company' создана`);
  console.log(`3. Пользователь 'postgres' существует`);
  console.log(`4. Пароль правильный`);
}

testConnection().catch(console.error);
