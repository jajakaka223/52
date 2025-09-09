require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Тестирование подключения к базе данных...');
console.log('📊 Параметры подключения:');
console.log(`   Host: ${process.env.DB_HOST}`);
console.log(`   Port: ${process.env.DB_PORT}`);
console.log(`   Database: ${process.env.DB_NAME}`);
console.log(`   User: ${process.env.DB_USER}`);
console.log(`   Password: ${process.env.DB_PASSWORD ? '***' : 'не задан'}`);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'transport_company',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  max: 1,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 5000,
});

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
  }
}

testConnection();
