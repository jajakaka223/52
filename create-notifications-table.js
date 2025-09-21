const { Pool } = require('pg');

// Настройки подключения к базе данных Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createNotificationsTable() {
  try {
    console.log('Creating notifications table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        target_users TEXT DEFAULT 'all',
        status VARCHAR(20) DEFAULT 'pending',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);
    
    console.log('Notifications table created successfully');
    
    // Создаем индексы для оптимизации
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
      ON notifications(created_at DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_status 
      ON notifications(status)
    `);
    
    console.log('Indexes created successfully');
    
  } catch (error) {
    console.error('Error creating notifications table:', error);
  } finally {
    await pool.end();
  }
}

createNotificationsTable();
