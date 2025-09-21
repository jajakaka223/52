const { Pool } = require('pg');

// Настройки подключения к Railway PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/your_db'
});

async function clearGPSTracking() {
  try {
    console.log('Подключение к базе данных...');
    
    // Проверяем количество записей до удаления
    const countBefore = await pool.query('SELECT COUNT(*) FROM gps_tracking');
    console.log(`Записей в таблице gps_tracking: ${countBefore.rows[0].count}`);
    
    if (countBefore.rows[0].count === '0') {
      console.log('Таблица уже пуста!');
      return;
    }
    
    // Удаляем все данные
    const result = await pool.query('DELETE FROM gps_tracking');
    console.log(`Удалено записей: ${result.rowCount}`);
    
    // Проверяем количество записей после удаления
    const countAfter = await pool.query('SELECT COUNT(*) FROM gps_tracking');
    console.log(`Записей в таблице после удаления: ${countAfter.rows[0].count}`);
    
    console.log('✅ Таблица gps_tracking успешно очищена!');
    
  } catch (error) {
    console.error('❌ Ошибка при очистке таблицы:', error);
  } finally {
    await pool.end();
  }
}

clearGPSTracking();
