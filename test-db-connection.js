const { Pool } = require('pg');

// Railway база данных
const railwayPool = new Pool({
  connectionString: 'postgresql://postgres:CyBafKYUrbExtogaBgDIyDEPJLBIEkqk@switchyard.proxy.rlwy.net:25770/railway',
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('🔍 Тестируем подключение к Railway...');
    
    // Простой запрос
    const result = await railwayPool.query('SELECT NOW() as current_time');
    console.log('✅ Время сервера:', result.rows[0].current_time);
    
    // Проверяем пользователей
    const users = await railwayPool.query('SELECT COUNT(*) as count FROM users');
    console.log('✅ Количество пользователей:', users.rows[0].count);
    
    // Проверяем конкретного пользователя
    const admin = await railwayPool.query('SELECT username, role, password FROM users WHERE username = $1', ['admin']);
    if (admin.rows.length > 0) {
      console.log('✅ Пользователь admin найден:');
      console.log('   Username:', admin.rows[0].username);
      console.log('   Role:', admin.rows[0].role);
      console.log('   Password hash length:', admin.rows[0].password.length);
    } else {
      console.log('❌ Пользователь admin не найден');
    }
    
    console.log('🎉 Подключение к базе данных работает!');
    
  } catch (err) {
    console.error('❌ Ошибка подключения:', err.message);
  } finally {
    await railwayPool.end();
  }
}

testConnection();

