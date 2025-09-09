const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Локальная база данных
const localPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'transport_company',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
});

// Railway база данных
const railwayPool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: process.env.DATABASE_PUBLIC_URL ? { rejectUnauthorized: false } : undefined,
});

async function exportData() {
  console.log('🔄 Экспорт данных из локальной базы...');
  
  try {
    // Получаем все таблицы
    const tables = ['users', 'vehicles', 'orders', 'expenses', 'reports'];
    const data = {};
    
    for (const table of tables) {
      try {
        const result = await localPool.query(`SELECT * FROM ${table}`);
        data[table] = result.rows;
        console.log(`✅ Таблица ${table}: ${result.rows.length} записей`);
      } catch (err) {
        console.log(`⚠️  Таблица ${table}: ${err.message}`);
        data[table] = [];
      }
    }
    
    // Сохраняем в файл
    fs.writeFileSync('data-export.json', JSON.stringify(data, null, 2));
    console.log('✅ Данные экспортированы в data-export.json');
    
    return data;
  } catch (err) {
    console.error('❌ Ошибка экспорта:', err.message);
    throw err;
  }
}

async function importData(data) {
  console.log('🔄 Импорт данных в Railway...');
  
  try {
    // Сначала очищаем таблицы в Railway
    const tables = ['reports', 'expenses', 'orders', 'vehicles', 'users'];
    for (const table of tables) {
      try {
        await railwayPool.query(`DELETE FROM ${table}`);
        console.log(`✅ Таблица ${table} очищена`);
      } catch (err) {
        console.log(`⚠️  Не удалось очистить ${table}: ${err.message}`);
      }
    }
    
    // Импортируем данные
    for (const table of tables) {
      if (data[table] && data[table].length > 0) {
        for (const row of data[table]) {
          try {
            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            
            const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
            await railwayPool.query(query, values);
          } catch (err) {
            console.log(`⚠️  Ошибка вставки в ${table}: ${err.message}`);
          }
        }
        console.log(`✅ Таблица ${table}: импортировано ${data[table].length} записей`);
      }
    }
    
    console.log('✅ Импорт завершен!');
  } catch (err) {
    console.error('❌ Ошибка импорта:', err.message);
    throw err;
  }
}

async function main() {
  try {
    // Проверяем подключение к локальной базе
    console.log('🔍 Проверка подключения к локальной базе...');
    await localPool.query('SELECT 1');
    console.log('✅ Локальная база подключена');
    
    // Проверяем подключение к Railway
    console.log('🔍 Проверка подключения к Railway...');
    await railwayPool.query('SELECT 1');
    console.log('✅ Railway база подключена');
    
    // Экспортируем данные
    const data = await exportData();
    
    // Импортируем данные
    await importData(data);
    
    console.log('🎉 Миграция завершена успешно!');
    
  } catch (err) {
    console.error('❌ Ошибка миграции:', err.message);
  } finally {
    await localPool.end();
    await railwayPool.end();
  }
}

main();

