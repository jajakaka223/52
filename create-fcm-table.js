const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function createFCMTable() {
  try {
    console.log('Creating FCM tokens table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token TEXT NOT NULL,
        platform VARCHAR(50) DEFAULT 'unknown',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform)
      );
    `);
    
    console.log('FCM tokens table created successfully!');
    
    // Создаем индекс для быстрого поиска
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON user_fcm_tokens(user_id);
    `);
    
    console.log('Index created successfully!');
    
  } catch (error) {
    console.error('Error creating FCM table:', error);
  } finally {
    await pool.end();
  }
}

createFCMTable();
