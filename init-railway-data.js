const { Pool } = require('pg');

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
    
    // Создаем администратора
    const adminPassword = 'admin'; // В реальном проекте нужно хешировать
    const adminQuery = `
      INSERT INTO users (username, password, email, role, full_name, phone, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (username) DO NOTHING
    `;
    
    await railwayPool.query(adminQuery, [
      'admin',
      adminPassword,
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
      'driver123',
      'driver@52express.com',
      'driver',
      'Иван Петров',
      '+7 (999) 234-56-78'
    ]);
    console.log('✅ Водитель создан (driver1/driver123)');
    
    // Создаем тестовые автомобили
    const vehicles = [
      {
        make: 'ГАЗ',
        model: 'ГАЗель NEXT',
        year: 2022,
        license_plate: 'А123БВ777',
        capacity: 1500,
        status: 'available'
      },
      {
        make: 'КАМАЗ',
        model: '5320',
        year: 2021,
        license_plate: 'В456ГД777',
        capacity: 8000,
        status: 'available'
      },
      {
        make: 'МАЗ',
        model: '6312',
        year: 2023,
        license_plate: 'С789ЕЖ777',
        capacity: 12000,
        status: 'maintenance'
      }
    ];
    
    for (const vehicle of vehicles) {
      const vehicleQuery = `
        INSERT INTO vehicles (make, model, year, license_plate, capacity, status, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (license_plate) DO NOTHING
      `;
      
      await railwayPool.query(vehicleQuery, [
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.license_plate,
        vehicle.capacity,
        vehicle.status
      ]);
    }
    console.log('✅ Тестовые автомобили созданы');
    
    // Создаем тестовые заказы
    const orders = [
      {
        customer_name: 'ООО "Рога и копыта"',
        customer_phone: '+7 (495) 123-45-67',
        pickup_address: 'Москва, ул. Ленина, 1',
        delivery_address: 'Санкт-Петербург, Невский проспект, 100',
        cargo_description: 'Мебель',
        weight: 500,
        status: 'pending'
      },
      {
        customer_name: 'ИП Сидоров',
        customer_phone: '+7 (812) 234-56-78',
        pickup_address: 'Санкт-Петербург, ул. Пушкина, 10',
        delivery_address: 'Москва, ул. Тверская, 50',
        cargo_description: 'Электроника',
        weight: 200,
        status: 'in_progress'
      }
    ];
    
    for (const order of orders) {
      const orderQuery = `
        INSERT INTO orders (customer_name, customer_phone, pickup_address, delivery_address, 
                           cargo_description, weight, status, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;
      
      await railwayPool.query(orderQuery, [
        order.customer_name,
        order.customer_phone,
        order.pickup_address,
        order.delivery_address,
        order.cargo_description,
        order.weight,
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
        INSERT INTO expenses (type, amount, description, date, created_at) 
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
  } finally {
    await railwayPool.end();
  }
}

initData();
