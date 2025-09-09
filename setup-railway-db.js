const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway база данных
const railwayPool = new Pool({
  connectionString: 'postgresql://postgres:CyBafKYUrbExtogaBgDIyDEPJLBIEkqk@switchyard.proxy.rlwy.net:25770/railway',
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  console.log('🔄 Создание таблиц в Railway...');
  
  const client = await railwayPool.connect();
  
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
    console.log('✅ Таблица users создана');

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
    console.log('✅ Таблица orders создана');

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
    console.log('✅ Таблица vehicles создана');

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
    console.log('✅ Таблица gps_tracking создана');

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
    console.log('✅ Таблица accounting создана');

    // История обслуживания/пробега
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_maintenance_history (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        mileage INTEGER,
        service_date DATE NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        description TEXT,
        cost DECIMAL(10,2),
        next_service_mileage INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица vehicle_maintenance_history создана');

    // Добавляем недостающие колонки если нужно
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage INTEGER`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_date DATE`);

    console.log('✅ Все таблицы созданы успешно!');
    
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function initData() {
  console.log('🔄 Инициализация данных в Railway...');
  
  try {
    // Хешируем пароли
    const adminPasswordHash = await bcrypt.hash('admin', 10);
    const driverPasswordHash = await bcrypt.hash('driver123', 10);
    
    // Создаем администратора
    const adminQuery = `
      INSERT INTO users (username, password, email, role, full_name, phone, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (username) DO NOTHING
    `;
    
    await railwayPool.query(adminQuery, [
      'admin',
      adminPasswordHash,
      'admin@52express.com',
      'admin',
      'Администратор',
      '+7 (999) 123-45-67'
    ]);
    console.log('✅ Администратор создан (admin/admin)');
    
    // Создаем тестового водителя
    const driverQuery = `
      INSERT INTO users (username, password, email, role, full_name, phone, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (username) DO NOTHING
    `;
    
    await railwayPool.query(driverQuery, [
      'driver1',
      driverPasswordHash,
      'driver@52express.com',
      'driver',
      'Иван Петров',
      '+7 (999) 234-56-78'
    ]);
    console.log('✅ Водитель создан (driver1/driver123)');
    
    // Создаем тестовые автомобили
    const vehicles = [
      {
        name: 'ГАЗель NEXT',
        model: 'ГАЗ-3302',
        plate_number: 'А123БВ777',
        mileage: 50000
      },
      {
        name: 'КАМАЗ 5320',
        model: '5320',
        plate_number: 'В456ГД777',
        mileage: 120000
      },
      {
        name: 'МАЗ 6312',
        model: '6312',
        plate_number: 'С789ЕЖ777',
        mileage: 80000
      }
    ];
    
    for (const vehicle of vehicles) {
      const vehicleQuery = `
        INSERT INTO vehicles (name, model, plate_number, mileage, created_at) 
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (plate_number) DO NOTHING
      `;
      
      await railwayPool.query(vehicleQuery, [
        vehicle.name,
        vehicle.model,
        vehicle.plate_number,
        vehicle.mileage
      ]);
    }
    console.log('✅ Тестовые автомобили созданы');
    
    // Создаем тестовые заказы
    const orders = [
      {
        date: new Date(),
        direction: 'Москва - Санкт-Петербург',
        distance: 635,
        weight: 500,
        amount: 25000,
        company: 'ООО "Рога и копыта"',
        client_name: 'Иванов И.И.',
        phone: '+7 (495) 123-45-67',
        email: 'ivanov@company.com',
        status: 'pending'
      },
      {
        date: new Date(),
        direction: 'Санкт-Петербург - Москва',
        distance: 635,
        weight: 200,
        amount: 18000,
        company: 'ИП Сидоров',
        client_name: 'Сидоров С.С.',
        phone: '+7 (812) 234-56-78',
        email: 'sidorov@mail.ru',
        status: 'in_progress'
      }
    ];
    
    for (const order of orders) {
      const orderQuery = `
        INSERT INTO orders (date, direction, distance, weight, amount, company, 
                           client_name, phone, email, status, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `;
      
      await railwayPool.query(orderQuery, [
        order.date,
        order.direction,
        order.distance,
        order.weight,
        order.amount,
        order.company,
        order.client_name,
        order.phone,
        order.email,
        order.status
      ]);
    }
    console.log('✅ Тестовые заказы созданы');
    
    // Создаем тестовые расходы
    const expenses = [
      {
        type: 'fuel',
        amount: 5000,
        description: 'Заправка топливом',
        date: new Date()
      },
      {
        type: 'maintenance',
        amount: 15000,
        description: 'Техническое обслуживание',
        date: new Date()
      }
    ];
    
    for (const expense of expenses) {
      const expenseQuery = `
        INSERT INTO accounting (type, amount, description, date, created_at) 
        VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await railwayPool.query(expenseQuery, [
        expense.type,
        expense.amount,
        expense.description,
        expense.date
      ]);
    }
    console.log('✅ Тестовые расходы созданы');
    
    console.log('🎉 Инициализация данных завершена!');
    console.log('📋 Данные для входа:');
    console.log('   Администратор: admin / admin');
    console.log('   Водитель: driver1 / driver123');
    
  } catch (err) {
    console.error('❌ Ошибка инициализации:', err.message);
    throw err;
  }
}

async function main() {
  try {
    // Проверяем подключение к Railway
    console.log('🔍 Проверка подключения к Railway...');
    await railwayPool.query('SELECT 1');
    console.log('✅ Railway база подключена');
    
    // Создаем таблицы
    await createTables();
    
    // Инициализируем данные
    await initData();
    
    console.log('🎉 Настройка базы данных завершена успешно!');
    
  } catch (err) {
    console.error('❌ Ошибка настройки:', err.message);
  } finally {
    await railwayPool.end();
  }
}

main();
