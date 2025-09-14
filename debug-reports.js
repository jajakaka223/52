const { pool } = require('./config/database');

async function debugReports() {
  try {
    console.log('📊 Отладка API отчетов...');
    
    // Тестируем запрос orders-by-date с теми же параметрами, что в ошибке
    console.log('🔍 Тестируем /api/reports/orders-by-date с параметрами:');
    console.log('   startDate: 2025-09-01');
    console.log('   endDate: 2025-09-14');
    
    const result = await pool.query(`
      SELECT 
        DATE(o.date) as period,
        COUNT(*) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as revenue,
        SUM(CASE WHEN o.status NOT IN ('completed','cancelled') THEN o.amount ELSE 0 END) as expected_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_amount
      FROM orders o
      WHERE o.date BETWEEN $1 AND $2
      GROUP BY DATE(o.date)
      ORDER BY period ASC
    `, ['2025-09-01', '2025-09-14']);
    
    console.log('✅ Запрос orders-by-date выполнен успешно');
    console.log('📋 Результат:', result.rows);
    
    // Проверим, есть ли заявки в этом диапазоне дат
    const allOrders = await pool.query(`
      SELECT id, date, status, amount 
      FROM orders 
      WHERE date BETWEEN $1 AND $2
      ORDER BY date
    `, ['2025-09-01', '2025-09-14']);
    
    console.log('📋 Заявки в диапазоне дат:', allOrders.rows);
    
    // Проверим все заявки
    const allOrdersCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log('📊 Всего заявок в базе:', allOrdersCount.rows[0].count);
    
    const allOrdersList = await pool.query('SELECT id, date, status FROM orders ORDER BY date DESC LIMIT 5');
    console.log('📋 Последние 5 заявок:', allOrdersList.rows);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Детали:', error);
  } finally {
    await pool.end();
  }
}

debugReports();
