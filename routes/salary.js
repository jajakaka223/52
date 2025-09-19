const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить данные о зарплате
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    let query = `
      SELECT 
        u.id as user_id,
        u.username,
        u.full_name,
        u.role,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END), 0) as total_earnings,
        COUNT(CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders,
        COUNT(o.id) as total_orders,
        COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.amount END), 0) as avg_order_amount,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) * 0.1, 0) as commission
      FROM users u
      LEFT JOIN orders o ON u.id = o.driver_id
      WHERE u.role = 'driver'
    `;
    
    let params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      paramCount++;
      const fromIdx = paramCount;
      params.push(startDate);
      paramCount++;
      const toIdx = paramCount;
      params.push(endDate);
      query += ` AND o.date BETWEEN $${fromIdx} AND $${toIdx}`;
    }

    if (userId) {
      paramCount++;
      query += ` AND u.id = $${paramCount}`;
      params.push(userId);
    }

    // Проверяем права доступа
    if (req.user.role !== 'admin') {
      paramCount++;
      query += ` AND u.id = $${paramCount}`;
      params.push(req.user.userId);
    }

    query += ` GROUP BY u.id, u.username, u.full_name, u.role ORDER BY total_earnings DESC`;

    const result = await pool.query(query, params);
    
    // Формируем данные для фронтенда
    const salaryData = result.rows.map(row => ({
      id: row.user_id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      baseSalary: 0, // Базовая зарплата (можно добавить в таблицу users)
      totalEarnings: parseFloat(row.total_earnings),
      completedOrders: parseInt(row.completed_orders),
      totalOrders: parseInt(row.total_orders),
      avgOrderAmount: parseFloat(row.avg_order_amount),
      commission: parseFloat(row.commission),
      total: parseFloat(row.total_earnings) + parseFloat(row.commission)
    }));

    res.json({
      success: true,
      salary: salaryData
    });

  } catch (error) {
    logError(error, { route: '/salary', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении данных о зарплате' });
  }
});

// Получить детали зарплаты по пользователю
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Нет прав на просмотр данных о зарплате' });
    }

    let query = `
      SELECT 
        o.id,
        o.order_number,
        o.from_location,
        o.to_location,
        o.amount,
        o.status,
        o.date,
        o.completed_at,
        c.name as client_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.driver_id = $1
    `;
    
    let params = [userId];
    let paramCount = 1;

    if (startDate && endDate) {
      paramCount++;
      const fromIdx = paramCount;
      params.push(startDate);
      paramCount++;
      const toIdx = paramCount;
      params.push(endDate);
      query += ` AND o.date BETWEEN $${fromIdx} AND $${toIdx}`;
    }

    query += ` ORDER BY o.date DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      orders: result.rows
    });

  } catch (error) {
    logError(error, { route: `/salary/${req.params.userId}`, query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении деталей зарплаты' });
  }
});

module.exports = router;
