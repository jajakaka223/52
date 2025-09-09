const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, requireDriver, logRequest, checkUserActive } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить все заявки (для администратора) или только свои (для водителя)
router.get('/', async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin') {
      // Администратор видит все заявки
      query = `
        SELECT o.*, u.full_name as driver_name, u.username as driver_username
        FROM orders o
        LEFT JOIN users u ON o.driver_id = u.id
        ORDER BY o.date DESC, o.created_at DESC
      `;
    } else {
      // Водитель видит только свои заявки
      query = `
        SELECT o.*, u.full_name as driver_name, u.username as driver_username
        FROM orders o
        LEFT JOIN users u ON o.driver_id = u.id
        WHERE o.driver_id = $1
        ORDER BY o.date DESC, o.created_at DESC
      `;
      params = [req.user.userId];
    }

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      orders: result.rows
    });

  } catch (error) {
    logError(error, { route: '/orders', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении заявок' });
  }
});

// Получить заявку по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    let params = [id];

    if (req.user.role === 'admin') {
      query = `
        SELECT o.*, u.full_name as driver_name, u.username as driver_username
        FROM orders o
        LEFT JOIN users u ON o.driver_id = u.id
        WHERE o.id = $1
      `;
    } else {
      query = `
        SELECT o.*, u.full_name as driver_name, u.username as driver_username
        FROM orders o
        LEFT JOIN users u ON o.driver_id = u.id
        WHERE o.id = $1 AND o.driver_id = $2
      `;
      params = [id, req.user.userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({
      success: true,
      order: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/orders/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении заявки' });
  }
});

// Создать новую заявку (только администратор)
router.post('/', requireAdmin, async (req, res) => {
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
      driverId
    } = req.body;

    // Валидация обязательных полей
    if (!date || !direction || !company || !clientName) {
      return res.status(400).json({ 
        error: 'Обязательные поля: дата, направление, фирма, имя клиента' 
      });
    }

    const result = await pool.query(
      `INSERT INTO orders (date, direction, distance, weight, amount, company, client_name, phone, email, driver_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [date, direction, distance, weight, amount, company, clientName, phone, email, driverId]
    );

    // Логируем создание заявки
    logUserAction(req.user.userId, 'order_created', {
      orderId: result.rows[0].id,
      direction: result.rows[0].direction,
      driverId: result.rows[0].driver_id
    }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Заявка успешно создана',
      order: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/orders', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при создании заявки' });
  }
});

// Обновить заявку
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Проверяем права на редактирование
    if (req.user.role !== 'admin') {
      const orderCheck = await pool.query(
        'SELECT driver_id FROM orders WHERE id = $1',
        [id]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      if (orderCheck.rows[0].driver_id !== req.user.userId) {
        return res.status(403).json({ error: 'Нет прав на редактирование этой заявки' });
      }
    }

    // Формируем запрос на обновление
    const allowedFields = ['date', 'direction', 'distance', 'weight', 'amount', 'company', 'client_name', 'phone', 'email', 'status', 'driver_id'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Добавляем обновление времени и ID заявки
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE orders 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Логируем обновление
    logUserAction(req.user.userId, 'order_updated', {
      orderId: id,
      updatedFields: Object.keys(updateData)
    }, req.ip);

    res.json({
      success: true,
      message: 'Заявка успешно обновлена',
      order: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/orders/${req.params.id}`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при обновлении заявки' });
  }
});

// Назначить водителя заявке (только администратор)
router.post('/:id/assign-driver', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: 'ID водителя обязателен' });
    }

    // Проверяем существование водителя
    const driverCheck = await pool.query(
      'SELECT id, full_name, role FROM users WHERE id = $1 AND role = $2 AND is_active = $3',
      [driverId, 'driver', true]
    );

    if (driverCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Водитель не найден или неактивен' });
    }

    // Обновляем заявку
    const result = await pool.query(
      `UPDATE orders 
       SET driver_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [driverId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Логируем назначение водителя
    logUserAction(req.user.userId, 'driver_assigned', {
      orderId: id,
      driverId: driverId,
      driverName: driverCheck.rows[0].full_name
    }, req.ip);

    res.json({
      success: true,
      message: 'Водитель успешно назначен',
      order: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/orders/${req.params.id}/assign-driver`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при назначении водителя' });
  }
});

// Изменить статус заявки
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['new', 'assigned', 'in_progress', 'completed', 'cancelled'];
    
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Неверный статус. Разрешенные: ${allowedStatuses.join(', ')}` 
      });
    }

    // Проверяем права на изменение статуса
    if (req.user.role !== 'admin') {
      const orderCheck = await pool.query(
        'SELECT driver_id FROM orders WHERE id = $1',
        [id]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      if (orderCheck.rows[0].driver_id !== req.user.userId) {
        return res.status(403).json({ error: 'Нет прав на изменение статуса этой заявки' });
      }
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Если статус стал "completed" — отправляем уведомление на email из заявки
    try {
      if (status === 'completed') {
        const order = result.rows[0];
        const toEmail = order.email;
        if (toEmail) {
          // Извлекаем направление в формате Откуда → Куда
          const firstLine = String(order.direction || '').split('\n')[0] || '';
          const [fromCity, toCity] = firstLine.split(' → ');
          const subject = `Заявка по маршруту "${fromCity || ''} - ${toCity || ''}" выполнена успешно.`;
          const text = 'Спасибо.';

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'gruzoperevozki436@gmail.com',
              pass: 'epah mwoe ynia xfjc'
            }
          });

          await transporter.sendMail({
            from: 'gruzoperevozki436@gmail.com',
            to: toEmail,
            subject,
            text
          });
        }
      }
    } catch (mailErr) {
      // Не валим основной запрос из-за email; просто логируем
      logError(mailErr, { route: `/orders/${id}/status`, note: 'email_notify_failed' });
    }

    // Логируем изменение статуса
    logUserAction(req.user.userId, 'order_status_changed', {
      orderId: id,
      newStatus: status,
      oldStatus: result.rows[0].status
    }, req.ip);

    res.json({
      success: true,
      message: 'Статус заявки успешно изменен',
      order: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/orders/${req.params.id}/status`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при изменении статуса' });
  }
});

// Удалить заявку (только администратор)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    // Логируем удаление
    logUserAction(req.user.userId, 'order_deleted', {
      orderId: id,
      orderDirection: result.rows[0].direction
    }, req.ip);

    res.json({
      success: true,
      message: 'Заявка успешно удалена',
      deletedOrder: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/orders/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении заявки' });
  }
});

module.exports = router;
