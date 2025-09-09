const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway база данных
const railwayPool = new Pool({
  connectionString: 'postgresql://postgres:CyBafKYUrbExtogaBgDIyDEPJLBIEkqk@switchyard.proxy.rlwy.net:25770/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixPasswords() {
  try {
    console.log('🔄 Исправляем пароли в Railway...');
    
    // Хешируем пароли правильно
    const adminPasswordHash = await bcrypt.hash('admin', 10);
    const driverPasswordHash = await bcrypt.hash('driver123', 10);
    
    console.log('✅ Длина хеша admin:', adminPasswordHash.length);
    console.log('✅ Длина хеша driver:', driverPasswordHash.length);
    
    // Обновляем пароли
    await railwayPool.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [adminPasswordHash, 'admin']
    );
    console.log('✅ Пароль admin обновлен');
    
    await railwayPool.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [driverPasswordHash, 'driver1']
    );
    console.log('✅ Пароль driver1 обновлен');
    
    // Проверяем результат
    const adminResult = await railwayPool.query('SELECT password FROM users WHERE username = $1', ['admin']);
    console.log('✅ Новая длина хеша admin:', adminResult.rows[0].password.length);
    
    console.log('🎉 Пароли исправлены!');
    
  } catch (err) {
    console.error('❌ Ошибка исправления паролей:', err.message);
  } finally {
    await railwayPool.end();
  }
}

fixPasswords();

