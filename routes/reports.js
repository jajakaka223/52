const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить общую статистику (только для администраторов)
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE o.date BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN o.status = 'in_progress' THEN 1 END) as in_progress_orders,
        COUNT(CASE WHEN o.status = 'new' THEN 1 END) as new_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN o.status NOT IN ('completed','cancelled') THEN o.amount ELSE 0 END) as expected_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_order_amount,
        SUM(CASE WHEN o.status = 'completed' THEN o.distance ELSE 0 END) as total_distance,
        SUM(CASE WHEN o.status = 'completed' THEN o.weight ELSE 0 END) as total_weight
      FROM orders o
      ${dateFilter}
    `, params);

    res.json({
      success: true,
      stats: stats.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/reports/overview', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении статистики' });
  }
});

// Отчет по заявкам по датам
router.get('/orders-by-date', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Даты начала и окончания обязательны' });
    }

    let groupClause = '';
    switch (groupBy) {
      case 'day':
        groupClause = 'DATE(o.date)';
        break;
      case 'week':
        groupClause = 'DATE_TRUNC(\'week\', o.date)';
        break;
      case 'month':
        groupClause = 'DATE_TRUNC(\'month\', o.date)';
        break;
      default:
        groupClause = 'DATE(o.date)';
    }

    const result = await pool.query(`
      SELECT 
        ${groupClause} as period,
        COUNT(*) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as revenue,
        SUM(CASE WHEN o.status NOT IN ('completed','cancelled') THEN o.amount ELSE 0 END) as expected_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_amount,
        SUM(CASE WHEN o.status = 'completed' THEN o.distance ELSE 0 END) as total_distance
      FROM orders o
      WHERE o.date BETWEEN $1 AND $2
      GROUP BY ${groupClause}
      ORDER BY period ASC
    `, [startDate, endDate]);

    res.json({
      success: true,
      report: result.rows
    });

  } catch (error) {
    logError(error, { route: '/reports/orders-by-date', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении отчета' });
  }
});

// Отчет по водителям
router.get('/drivers-performance', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND o.date BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    const result = await pool.query(`
      SELECT 
        u.id,
        u.full_name,
        u.username,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_order_amount,
        SUM(CASE WHEN o.status = 'completed' THEN o.distance ELSE 0 END) as total_distance,
        SUM(CASE WHEN o.status = 'completed' THEN o.weight ELSE 0 END) as total_weight
      FROM users u
      LEFT JOIN orders o ON u.id = o.driver_id ${dateFilter}
      WHERE u.role = 'driver' AND u.is_active = true
      GROUP BY u.id, u.full_name, u.username
      ORDER BY total_revenue DESC
    `, params);

    res.json({
      success: true,
      report: result.rows
    });

  } catch (error) {
    logError(error, { route: '/reports/drivers-performance', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении отчета' });
  }
});

// Отчет по машинам
router.get('/vehicles-performance', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND o.date BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    const result = await pool.query(`
      SELECT 
        v.id,
        v.name,
        v.model,
        v.plate_number,
        u.full_name as driver_name,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_order_amount,
        SUM(CASE WHEN o.status = 'completed' THEN o.distance ELSE 0 END) as total_distance
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
      LEFT JOIN orders o ON u.id = o.driver_id ${dateFilter}
      WHERE v.is_active = true
      GROUP BY v.id, v.name, v.model, v.plate_number, u.full_name
      ORDER BY total_revenue DESC
    `, params);

    res.json({
      success: true,
      report: result.rows
    });

  } catch (error) {
    logError(error, { route: '/reports/vehicles-performance', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении отчета' });
  }
});

// Отчет по клиентам
router.get('/clients-analysis', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE o.date BETWEEN $1 AND $2';
      params = [startDate, endDate, parseInt(limit)];
    } else {
      params = [parseInt(limit)];
    }

    const result = await pool.query(`
      SELECT 
        o.company,
        o.client_name,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_order_amount,
        SUM(CASE WHEN o.status = 'completed' THEN o.distance ELSE 0 END) as total_distance,
        MAX(o.date) as last_order_date
      FROM orders o
      ${dateFilter}
      GROUP BY o.company, o.client_name
      ORDER BY total_revenue DESC
      LIMIT $${params.length}
    `, params);

    res.json({
      success: true,
      report: result.rows
    });

  } catch (error) {
    logError(error, { route: '/reports/clients-analysis', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении отчета' });
  }
});

// Отчет по маршрутам
router.get('/routes-analysis', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE o.date BETWEEN $1 AND $2';
      params = [startDate, endDate, parseInt(limit)];
    } else {
      params = [parseInt(limit)];
    }

    const result = await pool.query(`
      SELECT 
        o.direction,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_order_amount,
        AVG(CASE WHEN o.status = 'completed' THEN o.distance ELSE NULL END) as avg_distance,
        AVG(CASE WHEN o.status = 'completed' THEN o.weight ELSE NULL END) as avg_weight
      FROM orders o
      ${dateFilter}
      GROUP BY o.direction
      ORDER BY total_revenue DESC
      LIMIT $${params.length}
    `, params);

    res.json({
      success: true,
      report: result.rows
    });

  } catch (error) {
    logError(error, { route: '/reports/routes-analysis', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении отчета' });
  }
});

// Экспорт отчета в CSV формат
router.get('/export/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Даты начала и окончания обязательны для экспорта' });
    }

    let query = '';
    let params = [startDate, endDate];

    switch (type) {
      case 'orders':
        query = `
          SELECT 
            o.date,
            o.direction,
            o.distance,
            o.weight,
            o.amount,
            o.company,
            o.client_name,
            o.phone,
            o.email,
            o.status,
            u.full_name as driver_name
          FROM orders o
          LEFT JOIN users u ON o.driver_id = u.id
          WHERE o.date BETWEEN $1 AND $2
          ORDER BY o.date DESC
        `;
        break;
      
      case 'drivers':
        query = `
          SELECT 
            u.full_name,
            u.username,
            COUNT(o.id) as total_orders,
            COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
            SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_revenue
          FROM users u
          LEFT JOIN orders o ON u.id = o.driver_id AND o.date BETWEEN $1 AND $2
          WHERE u.role = 'driver' AND u.is_active = true
          GROUP BY u.id, u.full_name, u.username
          ORDER BY total_revenue DESC
        `;
        break;
      
      default:
        return res.status(400).json({ error: 'Неизвестный тип отчета' });
    }

    const result = await pool.query(query, params);

    // Логируем экспорт
    logUserAction(req.user.userId, 'report_exported', {
      reportType: type,
      startDate,
      endDate,
      recordCount: result.rows.length
    }, req.ip);

    // Устанавливаем заголовки для скачивания CSV
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${startDate}_${endDate}.csv`);

    // Формируем CSV
    if (result.rows.length > 0) {
      const headers = Object.keys(result.rows[0]).join(',');
      const csvData = result.rows.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      ).join('\n');
      
      res.send(`${headers}\n${csvData}`);
    } else {
      res.send('Нет данных для экспорта');
    }

  } catch (error) {
    logError(error, { route: `/reports/export/${req.params.type}`, query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при экспорте отчета' });
  }
});

module.exports = router;
