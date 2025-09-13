#!/usr/bin/env node

/**
 * Скрипт для проверки подключения к Railway
 */

const { Pool } = require('pg');

// Конфигурация Railway
const railwayConfig = {
  host: 'postgres.railway.internal',
  port: 5432,
  database: 'transport_company',
  user: 'postgres',
  password: 'GxebDCtEXaMnwEHatMMDtgfqXefjQfFr'
};

async function testRailwayConnection() {
  console.log('🔍 Тестируем подключение к Railway...');
  console.log(`📊 Railway БД: ${railwayConfig.host}:${railwayConfig.port}/${railwayConfig.database}`);
  
  const pool = new Pool(railwayConfig);
  
  try {
    const client = await pool.connect();
    console.log('✅ Успешное подключение к Railway!');
    
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
    
    // Проверяем пользователей
    try {
      const users = await client.query('SELECT COUNT(*) FROM users');
      console.log(`👥 Пользователей в базе: ${users.rows[0].count}`);
    } catch (error) {
      console.log('⚠️ Таблица users не найдена или пуста');
    }
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Railway база данных готова к работе!');
    
  } catch (error) {
    console.log(`❌ Ошибка подключения к Railway: ${error.message}`);
    console.log('\nПроверьте:');
    console.log('1. Railway сервис запущен');
    console.log('2. PostgreSQL база данных создана');
    console.log('3. Переменные окружения установлены');
  }
}

testRailwayConnection().catch(console.error);
