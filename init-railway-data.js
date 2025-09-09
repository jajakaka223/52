const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway база данных
const railwayPool = new Pool({
  connectionString: 'postgresql://postgres:CyBafKYUrbExtogaBgDIyDEPJLBIEkqk@switchyard.proxy.rlwy.net:25770/railway',
  ssl: { rejectUnauthorized: false }
});

async function initData() {
  console.log('🔄 Инициализация данных в Railway...');
  
  try {
    // Проверяем подключение
    await railwayPool.query('SELECT 1');
    console.log('✅ Подключение к Railway установлено');
    
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
        name: 'ГАЗ ГАЗель NEXT',
        model: 'ГАЗель NEXT',
        plate_number: 'А123БВ777',
        mileage: 50000,
        last_service_date: '2024-01-15'
      },
      {
        name: 'КАМАЗ 5320',
        model: '5320',
        plate_number: 'В456ГД777',
        mileage: 75000,
        last_service_date: '2024-02-20'
      },
      {
        name: 'МАЗ 6312',
        model: '6312',
        plate_number: 'С789ЕЖ777',
        mileage: 30000,
        last_service_date: '2024-03-10'
      }
    ];
    
    for (const vehicle of vehicles) {
      const vehicleQuery = `
        INSERT INTO vehicles (name, model, plate_number, mileage, last_service_date, created_at) 
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (plate_number) DO NOTHING
      `;
      
      await railwayPool.query(vehicleQuery, [
        vehicle.name,
        vehicle.model,
        vehicle.plate_number,
        vehicle.mileage,
        vehicle.last_service_date
      ]);
    }
    console.log('✅ Тестовые автомобили созданы');
    
    // Создаем тестовые заказы
    const orders = [
      {
        date: '2024-09-09',
        direction: 'Москва - Санкт-Петербург',
        distance: 635.5,
        weight: 500,
        amount: 15000,
        company: 'ООО "Рога и копыта"',
        client_name: 'Иванов И.И.',
        phone: '+7 (495) 123-45-67',
        email: 'ivanov@roga-kopyta.ru',
        status: 'new'
      },
      {
        date: '2024-09-10',
        direction: 'Санкт-Петербург - Москва',
        distance: 635.5,
        weight: 200,
        amount: 8000,
        company: 'ИП Сидоров',
        client_name: 'Сидоров С.С.',
        phone: '+7 (812) 234-56-78',
        email: 'sidorov@example.com',
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
        date: '2024-09-09',
        category: 'Топливо',
        mileage: 50000
      },
      {
        type: 'maintenance',
        amount: 15000,
        description: 'Техническое обслуживание',
        date: '2024-09-08',
        category: 'ТО',
        mileage: 49000
      }
    ];
    
    for (const expense of expenses) {
      const expenseQuery = `
        INSERT INTO accounting (type, amount, description, date, category, mileage, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await railwayPool.query(expenseQuery, [
        expense.type,
        expense.amount,
        expense.description,
        expense.date,
        expense.category,
        expense.mileage
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
  } finally {
    await railwayPool.end();
  }
}

initData();
