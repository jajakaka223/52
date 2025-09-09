const { Pool } = require('pg');

// Railway база данных
const railwayPool = new Pool({
  connectionString: 'postgresql://postgres:CyBafKYUrbExtogaBgDIyDEPJLBIEkqk@switchyard.proxy.rlwy.net:25770/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    console.log('🔍 Проверяем пользователей в Railway...');
    
    const result = await railwayPool.query('SELECT id, username, role, email, created_at FROM users ORDER BY id');
    
    console.log(`✅ Найдено пользователей: ${result.rows.length}`);
    
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Username: ${user.username}, Role: ${user.role}, Email: ${user.email}, Created: ${user.created_at}`);
    });
    
    // Проверим пароль admin
    const adminResult = await railwayPool.query('SELECT password FROM users WHERE username = $1', ['admin']);
    if (adminResult.rows.length > 0) {
      console.log('✅ Пароль admin найден, длина хеша:', adminResult.rows[0].password.length);
    } else {
      console.log('❌ Пользователь admin не найден');
    }
    
  } catch (err) {
    console.error('❌ Ошибка проверки пользователей:', err.message);
  } finally {
    await railwayPool.end();
  }
}

checkUsers();

