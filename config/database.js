const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Парсим конфигурацию базы данных от Railway
console.log('🔍 Available environment variables:');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'present' : 'not set');
console.log('   PGHOST:', process.env.PGHOST || 'not set');
console.log('   PGPORT:', process.env.PGPORT || 'not set');
console.log('   PGDATABASE:', process.env.PGDATABASE || 'not set');
console.log('   PGUSER:', process.env.PGUSER || 'not set');
console.log('   PGPASSWORD:', process.env.PGPASSWORD ? '***' : 'not set');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || 'not set');

// Railway connection string (hardcoded for now)
const RAILWAY_DB_URL = 'postgresql://postgres:GxebDCtEXaMnwEHatMMDtgfqXefjQfFr@ballast.proxy.rlwy.net:40362/railway';

let dbConfig = {};

// Проверяем, есть ли развернутый DATABASE_URL (без переменных)
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('${{')) {
  // Railway предоставляет развернутый DATABASE_URL в формате: postgresql://user:password@host:port/database
  const url = new URL(process.env.DATABASE_URL);
  dbConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // убираем первый слеш
    user: url.username,
    password: url.password,
  };
  console.log('🔍 Database configuration from DATABASE_URL:');
  console.log('   DB_HOST:', dbConfig.host);
  console.log('   DB_PORT:', dbConfig.port);
  console.log('   DB_NAME:', dbConfig.database);
  console.log('   DB_USER:', dbConfig.user);
  console.log('   DB_PASSWORD:', dbConfig.password ? '***' : 'не задан');
} else if (process.env.PGHOST) {
  // Используем переменные окружения Railway
  dbConfig = {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  };
  console.log('🔍 Database configuration from Railway env vars:');
  console.log('   DB_HOST:', dbConfig.host);
  console.log('   DB_PORT:', dbConfig.port);
  console.log('   DB_NAME:', dbConfig.database);
  console.log('   DB_USER:', dbConfig.user);
  console.log('   DB_PASSWORD:', dbConfig.password ? '***' : 'не задан');
} else {
  // Fallback на Railway connection string
  const url = new URL(RAILWAY_DB_URL);
  dbConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // убираем первый слеш
    user: url.username,
    password: url.password,
  };
  console.log('🔍 Database configuration from Railway hardcoded URL:');
  console.log('   DB_HOST:', dbConfig.host);
  console.log('   DB_PORT:', dbConfig.port);
  console.log('   DB_NAME:', dbConfig.database);
  console.log('   DB_USER:', dbConfig.user);
  console.log('   DB_PASSWORD:', dbConfig.password ? '***' : 'не задан');
}

const pool = new Pool({
  ...dbConfig,
  max: Number(process.env.DB_POOL_MAX || 30),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 60000),
  connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS || 5000), 
});

// Дополнительная проверка конфигурации
console.log('🔍 Final database pool configuration:');
console.log('   host:', pool.options.host);
console.log('   port:', pool.options.port);
console.log('   database:', pool.options.database);
console.log('   user:', pool.options.user);
console.log('   password:', pool.options.password ? '***' : 'not set');

// Функция создания таблиц
const createTables = async () => {
  const client = await pool.connect();
  
  try {
    // Таблица ролей
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(100) NOT NULL
      )
    `);

    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'driver',
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
    // Гарантируем наличие всех новых колонок прав (для существующих БД)
    const addFlag = async (name, def) => {
      try { await client.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS ${name} BOOLEAN DEFAULT ${def}`); } catch (_) {}
    };
    await addFlag('can_view_dashboard_stats', 'true');
    await addFlag('can_view_dashboard_users_count', 'true');
    await addFlag('can_view_dashboard_vehicles_count', 'true');
    await addFlag('can_view_dashboard_orders_count', 'true');
    await addFlag('can_view_dashboard_completed_count', 'true');
    await addFlag('can_view_dashboard_recent_orders', 'true');
    await addFlag('can_view_dashboard_finances', 'true');
    await addFlag('can_view_menu_budget', 'true');
    await addFlag('can_view_menu_expenses', 'true');
    await addFlag('can_view_menu_salary', 'true');
    await addFlag('can_edit_salary', 'false');
    await addFlag('can_view_menu_vehicles', 'true');
    await addFlag('can_view_menu_maintenance', 'true');
    await addFlag('can_view_menu_tracking', 'true');
    await addFlag('can_view_menu_reports', 'true');
    await addFlag('can_delete_any', 'false');
    await addFlag('can_assign_drivers', 'false');
    await addFlag('can_create_orders', 'false');
    await addFlag('can_send_notifications', 'false');
    await addFlag('can_view_notifications', 'true');

    // Нормализуем NULL в true для роли admin (полный доступ)
    try {
      await client.query(`
        UPDATE role_permissions SET 
          can_view_dashboard = COALESCE(can_view_dashboard, true),
          can_view_orders = COALESCE(can_view_orders, true),
          can_edit_orders = COALESCE(can_edit_orders, true),
          can_view_reports = COALESCE(can_view_reports, true),
          can_edit_reports = COALESCE(can_edit_reports, true),
          can_view_vehicles = COALESCE(can_view_vehicles, true),
          can_edit_vehicles = COALESCE(can_edit_vehicles, true),
          can_view_tracking = COALESCE(can_view_tracking, true),
          can_edit_tracking = COALESCE(can_edit_tracking, true),
          can_view_settings = COALESCE(can_view_settings, true),
          can_edit_users = COALESCE(can_edit_users, true),
          can_manage_roles = COALESCE(can_manage_roles, true),
          can_view_dashboard_stats = COALESCE(can_view_dashboard_stats, true),
          can_view_dashboard_users_count = COALESCE(can_view_dashboard_users_count, true),
          can_view_dashboard_vehicles_count = COALESCE(can_view_dashboard_vehicles_count, true),
          can_view_dashboard_orders_count = COALESCE(can_view_dashboard_orders_count, true),
          can_view_dashboard_completed_count = COALESCE(can_view_dashboard_completed_count, true),
          can_view_dashboard_recent_orders = COALESCE(can_view_dashboard_recent_orders, true),
          can_view_dashboard_finances = COALESCE(can_view_dashboard_finances, true),
          can_view_menu_budget = COALESCE(can_view_menu_budget, true),
          can_view_menu_expenses = COALESCE(can_view_menu_expenses, true),
          can_view_menu_salary = COALESCE(can_view_menu_salary, true),
          can_edit_salary = COALESCE(can_edit_salary, true),
          can_view_menu_vehicles = COALESCE(can_view_menu_vehicles, true),
          can_view_menu_maintenance = COALESCE(can_view_menu_maintenance, true),
          can_view_menu_tracking = COALESCE(can_view_menu_tracking, true),
          can_view_menu_reports = COALESCE(can_view_menu_reports, true),
          can_delete_any = COALESCE(can_delete_any, true),
          can_assign_drivers = COALESCE(can_assign_drivers, true),
          can_send_notifications = COALESCE(can_send_notifications, true),
          can_view_notifications = COALESCE(can_view_notifications, true),
        WHERE role_key = 'admin'
      `);
    } catch (_) {}

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

    // Сидинг ролей по умолчанию
    await client.query(`INSERT INTO roles(key, title) VALUES ('admin','Администратор') ON CONFLICT (key) DO NOTHING`);
    await client.query(`INSERT INTO roles(key, title) VALUES ('driver','Водитель') ON CONFLICT (key) DO NOTHING`);
    
    // Таблица прав ролей (флаги доступа)
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_key VARCHAR(50) UNIQUE NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
        can_view_dashboard BOOLEAN DEFAULT true,
        can_view_orders BOOLEAN DEFAULT true,
        can_edit_orders BOOLEAN DEFAULT false,
        can_view_reports BOOLEAN DEFAULT true,
        can_edit_reports BOOLEAN DEFAULT false,
        can_view_vehicles BOOLEAN DEFAULT true,
        can_edit_vehicles BOOLEAN DEFAULT false,
        can_view_tracking BOOLEAN DEFAULT true,
        can_edit_tracking BOOLEAN DEFAULT false,
        can_view_settings BOOLEAN DEFAULT false,
        can_edit_users BOOLEAN DEFAULT false,
        can_manage_roles BOOLEAN DEFAULT false,
        can_view_dashboard_stats BOOLEAN DEFAULT true,
        can_view_dashboard_users_count BOOLEAN DEFAULT true,
        can_view_dashboard_vehicles_count BOOLEAN DEFAULT true,
        can_view_dashboard_orders_count BOOLEAN DEFAULT true,
        can_view_dashboard_completed_count BOOLEAN DEFAULT true,
        can_view_dashboard_recent_orders BOOLEAN DEFAULT true,
        can_view_dashboard_finances BOOLEAN DEFAULT true,
        can_view_menu_budget BOOLEAN DEFAULT true,
        can_view_menu_expenses BOOLEAN DEFAULT true,
        can_view_menu_salary BOOLEAN DEFAULT true,
        can_edit_salary BOOLEAN DEFAULT false,
        can_view_menu_vehicles BOOLEAN DEFAULT true,
        can_view_menu_maintenance BOOLEAN DEFAULT true,
        can_view_menu_tracking BOOLEAN DEFAULT true,
        can_view_menu_reports BOOLEAN DEFAULT true,
        can_delete_any BOOLEAN DEFAULT false,
        can_assign_drivers BOOLEAN DEFAULT false,
        can_create_orders BOOLEAN DEFAULT false,
        can_send_notifications BOOLEAN DEFAULT false,
        can_view_notifications BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица уведомлений
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


    // Сидинг прав по умолчанию для стандартных ролей
    await client.query(`
      INSERT INTO role_permissions (
        role_key, can_view_dashboard, can_view_orders, can_edit_orders,
        can_view_reports, can_edit_reports, can_view_vehicles, can_edit_vehicles,
        can_view_tracking, can_edit_tracking, can_view_settings, can_edit_users, can_manage_roles,
        can_view_dashboard_stats, can_view_dashboard_users_count, can_view_dashboard_vehicles_count,
        can_view_dashboard_orders_count, can_view_dashboard_completed_count, can_view_dashboard_recent_orders,
        can_view_dashboard_finances, can_view_menu_budget, can_view_menu_expenses, can_view_menu_salary,
        can_edit_salary, can_view_menu_vehicles, can_view_menu_maintenance, can_view_menu_tracking,
        can_view_menu_reports, can_delete_any, can_assign_drivers, can_create_orders, can_send_notifications, can_view_notifications
      ) VALUES (
        'admin', true, true, true, true, true, true, true, true, true, true, true, true,
        true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true
      ) ON CONFLICT (role_key) DO NOTHING
    `);
    await client.query(`
      INSERT INTO role_permissions (
        role_key, can_view_dashboard, can_view_orders, can_edit_orders,
        can_view_reports, can_edit_reports, can_view_vehicles, can_edit_vehicles,
        can_view_tracking, can_edit_tracking, can_view_settings, can_edit_users, can_manage_roles,
        can_view_dashboard_stats, can_view_dashboard_users_count, can_view_dashboard_vehicles_count,
        can_view_dashboard_orders_count, can_view_dashboard_completed_count, can_view_dashboard_recent_orders,
        can_view_dashboard_finances, can_view_menu_budget, can_view_menu_expenses, can_view_menu_salary,
        can_edit_salary, can_view_menu_vehicles, can_view_menu_maintenance, can_view_menu_tracking,
        can_view_menu_reports, can_delete_any, can_assign_drivers, can_create_orders, can_send_notifications, can_view_notifications
      ) VALUES (
        'driver', true, true, false, false, false, true, false, true, false, false, false, false,
        true, false, false, false, false, false, false, true, false, false, false, true, false, true, false, false, false, false, false, true
      ) ON CONFLICT (role_key) DO NOTHING
    `);
    
    logger.info('✅ Таблицы базы данных созданы успешно');
  } catch (error) {
    logger.error('❌ Ошибка создания таблиц:', error);
  } finally {
    client.release();
  }
};

const connectDB = async () => {
  try {
    const client = await pool.connect();
    logger.info('✅ База данных PostgreSQL подключена успешно');
    
    // Создаем таблицы если их нет
    await createTables();
    
    client.release();
  } catch (error) {
    logger.error('❌ Ошибка подключения к базе данных:', error);
    // Не падаем, а пытаемся реконнектиться с экспоненциальной задержкой
    let attempt = 1;
    const maxAttempts = 10;
    const retry = async () => {
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
      logger.warn(`🔁 Попытка переподключения к БД #${attempt} через ${Math.round(delay/1000)}с`);
      await new Promise(r => setTimeout(r, delay));
      try {
        const client = await pool.connect();
        logger.info('✅ Восстановлено подключение к БД');
        await createTables();
        client.release();
      } catch (e) {
        attempt += 1;
        if (attempt <= maxAttempts) return retry();
        logger.error('❌ Не удалось восстановить подключение к БД после множества попыток');
      }
    };
    retry();
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
