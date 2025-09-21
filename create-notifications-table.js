const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Добавляем обработку ошибок пароля
  password: process.env.DB_PASSWORD || (process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).password : undefined)
});

async function createNotificationsTable() {
  try {
    console.log('Creating notifications table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Notifications table created successfully');
    
    // Добавляем колонку fcm_token в таблицу users если её нет
    console.log('Adding fcm_token column to users table...');
    
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS fcm_token TEXT
    `);

    console.log('FCM token column added to users table');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

createNotificationsTable();
