const express = require('express');
const { pool } = require('../config/database');
const { logError } = require('../utils/logger');

const router = express.Router();

// Middleware для проверки API ключа
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.TELEGRAM_API_KEY || 'your_telegram_api_key_here';
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: 'Неверный или отсутствующий API ключ' 
    });
  }
  
  next();
};

// Применяем проверку API ключа ко всем роутам
router.use(checkApiKey);

// Создать заявку от Telegram бота
router.post('/order', async (req, res) => {
  try {
    const {
      date,
      direction,
      distance,
      weight,
      amount,
      company,
      clientName,
      phone,
      email,
      source = 'telegram' // Источник заявки
    } = req.body;

    // Валидация обязательных полей
    if (!date || !direction || !company || !clientName) {
      return res.status(400).json({ 
        error: 'Обязательные поля: date, direction, company, clientName',
        received: {
          date: !!date,
          direction: !!direction,
          company: !!company,
          clientName: !!clientName
        }
      });
    }

    // Проверяем формат даты
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ 
        error: 'Неверный формат даты. Используйте YYYY-MM-DD' 
      });
    }

    const result = await pool.query(
      `INSERT INTO orders (date, direction, distance, weight, amount, company, client_name, phone, email, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', CURRENT_TIMESTAMP)
       RETURNING *`,
      [date, direction, distance, weight, amount, company, clientName, phone, email]
    );

    res.status(201).json({
      success: true,
      message: 'Заявка успешно создана из Telegram',
      order: {
        id: result.rows[0].id,
        date: result.rows[0].date,
        direction: result.rows[0].direction,
        company: result.rows[0].company,
        client_name: result.rows[0].client_name,
        status: result.rows[0].status,
        created_at: result.rows[0].created_at
      }
    });

  } catch (error) {
    logError(error, { 
      route: '/telegram/order', 
      body: req.body,
      source: 'telegram_bot'
    });
    res.status(500).json({ 
      error: 'Ошибка сервера при создании заявки',
      details: error.message
    });
  }
});

// Получить статус заявки по ID (для уведомлений в боте)
router.get('/order/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, status, direction, company, client_name, created_at, updated_at
       FROM orders 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({
      success: true,
      order: result.rows[0]
    });

  } catch (error) {
    logError(error, { 
      route: `/telegram/order/${req.params.id}/status`,
      source: 'telegram_bot'
    });
    res.status(500).json({ error: 'Ошибка сервера при получении статуса заявки' });
  }
});

// Получить список заявок за период (для отчетов в боте)
router.get('/orders', async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    
    let query = `
      SELECT id, date, direction, company, client_name, status, amount, created_at
      FROM orders 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      orders: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logError(error, { 
      route: '/telegram/orders',
      query: req.query,
      source: 'telegram_bot'
    });
    res.status(500).json({ error: 'Ошибка сервера при получении заявок' });
  }
});

// Webhook для получения уведомлений об изменении статуса заявки
router.post('/webhook/status-change', async (req, res) => {
  try {
    const { orderId, newStatus, oldStatus } = req.body;

    if (!orderId || !newStatus) {
      return res.status(400).json({ 
        error: 'Обязательные поля: orderId, newStatus' 
      });
    }

    // Здесь можно добавить логику для отправки уведомлений в Telegram
    // Например, отправить сообщение в чат бота о том, что статус заявки изменился
    
    res.json({
      success: true,
      message: 'Webhook обработан успешно',
      orderId,
      newStatus,
      oldStatus
    });

  } catch (error) {
    logError(error, { 
      route: '/telegram/webhook/status-change',
      body: req.body,
      source: 'telegram_bot'
    });
    res.status(500).json({ error: 'Ошибка сервера при обработке webhook' });
  }
});

module.exports = router;
