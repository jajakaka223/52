#!/usr/bin/env node

/**
 * Скрипт для экспорта данных из локальной базы в SQL файл
 * Запуск: node export-local-data.js
 */

const { Pool } = require('pg');
const fs = require('fs');

// Конфигурация локальной базы данных
const localConfig = {
  host: 'localhost',
  port: 5432,
  database: 'transport_company',
  user: 'postgres',
  password: 'your_password' // Замените на ваш пароль
};

console.log('📤 Экспорт данных из локальной базы...');

async function exportData() {
  const localPool = new Pool(localConfig);

  try {
    const client = await localPool.connect();
    console.log('✅ Подключение к локальной базе установлено');

    // Список таблиц для экспорта
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

    let sqlContent = '-- Экспорт данных из локальной базы\n';
    sqlContent += '-- Создано: ' + new Date().toISOString() + '\n\n';

    for (const table of tables) {
      try {
        console.log(`📋 Экспорт таблицы: ${table}`);
        
        // Получаем данные из таблицы
        const result = await client.query(`SELECT * FROM ${table}`);
        const rows = result.rows;
        
        if (rows.length === 0) {
          console.log(`   ⚠️ Таблица ${table} пуста`);
          continue;
        }

        // Получаем названия колонок
        const columns = Object.keys(rows[0]);
        const columnNames = columns.join(', ');

        sqlContent += `-- Таблица: ${table}\n`;
        sqlContent += `-- Количество записей: ${rows.length}\n\n`;

        // Генерируем INSERT запросы
        for (const row of rows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            return value;
          }).join(', ');

          sqlContent += `INSERT INTO ${table} (${columnNames}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        }

        sqlContent += '\n';
        console.log(`   ✅ Экспортировано ${rows.length} записей`);

      } catch (error) {
        console.log(`   ❌ Ошибка экспорта ${table}:`, error.message);
      }
    }

    // Сохраняем в файл
    const filename = `local-data-export-${new Date().toISOString().split('T')[0]}.sql`;
    fs.writeFileSync(filename, sqlContent);
    console.log(`💾 Данные сохранены в файл: ${filename}`);

  } catch (error) {
    console.error('❌ Ошибка экспорта:', error);
  } finally {
    await localPool.end();
  }
}

// Запускаем экспорт
exportData().catch(console.error);
