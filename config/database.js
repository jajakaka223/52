const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Prefer single connection string from Railway if provided
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

/**
 * Create PG pool. If DATABASE_URL/DATABASE_PUBLIC_URL is present (Railway), use it.
 * Otherwise use discrete DB_* vars for local/dev.
 */
const pool = connectionString
  ? new Pool({
      connectionString,
      // Public proxy URLs usually require SSL; internal service URL does not.
      ssl: /proxy\.rlwy\.net/i.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'transport_company',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'your_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

// Функция создания таблиц
const createTables = async () => {
  const client = await pool.connect();
  
  try {
    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'driver',
        email VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица заявок
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        direction TEXT NOT NULL,
        distance DECIMAL(10,2),
        weight DECIMAL(10,2),
        amount DECIMAL(10,2),
        company VARCHAR(100),
        client_name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        driver_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица машин
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        model VARCHAR(100),
        plate_number VARCHAR(20) UNIQUE,
        driver_id INTEGER REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        mileage INTEGER,
        last_service_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // На случай существующей таблицы — добавляем недостающие колонки
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage INTEGER`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_date DATE`);

    // Таблица GPS координат
    await client.query(`
      CREATE TABLE IF NOT EXISTS gps_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(10,8) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        speed DECIMAL(5,2),
        heading INTEGER,
        accuracy DECIMAL(5,2)
      )
    `);

    // Таблица учета (расходы, топливо, поломки, ТО)
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounting (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        vehicle_id INTEGER REFERENCES vehicles(id),
        date DATE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100),
        mileage INTEGER,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // История обслуживания/пробега
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_maintenance_history (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        mileage INTEGER,
        last_service_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем администратора по умолчанию
    await createDefaultAdmin(client);
    
    logger.info('✅ Таблицы базы данных созданы успешно');
  } catch (error) {
    logger.error('❌ Ошибка создания таблиц:', error);
  } finally {
    client.release();
  }
};

const connectDB = async () => {
  const redact = (str) => (str ? str.replace(/:(.*?)@/, ':***@') : '');
  const isProxy = !!connectionString && /proxy\.rlwy\.net/i.test(connectionString);
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      logger.info(
        `🗄️  Подключение к PostgreSQL (попытка ${attempt}) — ` +
          (connectionString
            ? `connectionString=${redact(connectionString)} ssl=${isProxy ? 'on' : 'off'}`
            : `host=${process.env.DB_HOST || 'localhost'} db=${process.env.DB_NAME || 'transport_company'}`)
      );

      const client = await pool.connect();
      logger.info('✅ База данных PostgreSQL подключена успешно');

      // Создаем таблицы если их нет
      await createTables();

      client.release();
      break; // успех, выходим из цикла
    } catch (error) {
      const delayMs = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5))); // эксп. бэкофф до 30с
      logger.error(`❌ Ошибка подключения к базе данных (попытка ${attempt}): ${error.message}. Повтор через ${Math.round(delayMs/1000)}с`);
      await new Promise((res) => setTimeout(res, delayMs));
      // не завершаем процесс, продолжаем пытаться — Railway успеет поднять БД/сеть
    }
  }
};

const createDefaultAdmin = async (client) => {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin', 10);
    
    await client.query(`
      INSERT INTO users (username, password, full_name, role, email)
      VALUES ('admin', $1, 'Администратор', 'admin', 'admin@company.com')
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    
    logger.info('✅ Администратор по умолчанию создан (admin/admin)');
  } catch (error) {
    logger.error('❌ Ошибка создания администратора:', error);
  }
};

module.exports = { pool, connectDB };
