const { Pool } = require('pg');

// Тестируем подключение к Railway базе данных
async function testRailwayDB() {
  console.log('🔄 Тестируем подключение к Railway базе данных...');
  
  // Используем DATABASE_URL из Railway
  const connectionString = 'postgresql://postgres:CyBafKYUrbExtogaBgDIyDEPJLBIEkqk@switchyard.proxy.rlwy.net:25770/railway';
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('1. Подключаемся к базе данных...');
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных успешно!');
    
    console.log('2. Проверяем таблицы...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Таблицы в базе данных:', tablesResult.rows.map(r => r.table_name));
    
    console.log('3. Проверяем пользователей...');
    const usersResult = await client.query('SELECT id, username, role FROM users LIMIT 5');
    console.log('Пользователи:', usersResult.rows);
    
    console.log('4. Тестируем аутентификацию...');
    const authResult = await client.query('SELECT id, username, password FROM users WHERE username = $1', ['admin']);
    if (authResult.rows.length > 0) {
      console.log('✅ Пользователь admin найден');
      console.log('Пароль (хеш):', authResult.rows[0].password);
    } else {
      console.log('❌ Пользователь admin не найден');
    }
    
    client.release();
    console.log('✅ Тест базы данных завершен успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    console.error('Детали ошибки:', error);
  } finally {
    await pool.end();
  }
}

testRailwayDB();
