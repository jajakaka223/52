const { Pool } = require('pg');

console.log('🔍 Тестирование подключения к базе данных...');

// Параметры подключения напрямую
const config = {
  host: 'localhost',
  port: 5432,
  database: 'transport_company',
  user: 'postgres',
  password: '123321',
  max: 1,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 5000,
};

console.log('📊 Параметры подключения:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.database}`);
console.log(`   User: ${config.user}`);
console.log(`   Password: ${config.password ? '***' : 'не задан'}`);

const pool = new Pool(config);

async function testConnection() {
  try {
    console.log('\n🔄 Попытка подключения...');
    const client = await pool.connect();
    console.log('✅ Подключение успешно!');
    
    const result = await client.query('SELECT version()');
    console.log('📋 Версия PostgreSQL:', result.rows[0].version);
    
    client.release();
    await pool.end();
    console.log('✅ Тест завершен успешно!');
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
    console.error('🔍 Код ошибки:', error.code);
    console.error('📝 Детали:', error.detail);
    
    if (error.code === '28P01') {
      console.log('\n💡 Возможные решения:');
      console.log('   1. Проверьте пароль пользователя postgres');
      console.log('   2. Убедитесь, что база данных transport_company существует');
      console.log('   3. Проверьте права доступа пользователя postgres');
    }
  }
}

testConnection();
