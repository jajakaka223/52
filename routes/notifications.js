const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить уведомления пользователя
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, 
             s.username as sender_username, 
             s.full_name as sender_name
      FROM notifications n
      LEFT JOIN users s ON n.sender_id = s.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
    `, [req.user.userId]);

    res.json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    logError(error, { route: '/notifications', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении уведомлений' });
  }
});

// Получить количество непрочитанных уведомлений
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE recipient_id = $1 AND is_read = false
    `, [req.user.userId]);

    res.json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
  } catch (error) {
    logError(error, { route: '/notifications/unread-count', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении количества уведомлений' });
  }
});

// Отметить уведомление как прочитанное
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND recipient_id = $2
      RETURNING *
    `, [id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    res.json({
      success: true,
      message: 'Уведомление отмечено как прочитанное'
    });
  } catch (error) {
    logError(error, { route: `/notifications/${req.params.id}/read`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при обновлении уведомления' });
  }
});

// Отметить все уведомления как прочитанные
router.patch('/mark-all-read', async (req, res) => {
  try {
    await pool.query(`
      UPDATE notifications 
      SET is_read = true, updated_at = CURRENT_TIMESTAMP
      WHERE recipient_id = $1 AND is_read = false
    `, [req.user.userId]);

    res.json({
      success: true,
      message: 'Все уведомления отмечены как прочитанные'
    });
  } catch (error) {
    logError(error, { route: '/notifications/mark-all-read', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при обновлении уведомлений' });
  }
});

// Удалить уведомление
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      DELETE FROM notifications 
      WHERE id = $1 AND recipient_id = $2
      RETURNING *
    `, [id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    res.json({
      success: true,
      message: 'Уведомление удалено'
    });
  } catch (error) {
    logError(error, { route: `/notifications/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении уведомления' });
  }
});

// Отправить уведомление (только для администраторов)
router.post('/send', requireAdmin, async (req, res) => {
  try {
    const { title, message, recipientId } = req.body;

    if (!title || !message || !recipientId) {
      return res.status(400).json({ 
        error: 'Обязательные поля: title, message, recipientId' 
      });
    }

    // Проверяем, что получатель существует
    const recipient = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [recipientId]
    );

    if (recipient.rows.length === 0) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }

    // Создаем уведомление
    const result = await pool.query(`
      INSERT INTO notifications (title, message, recipient_id, sender_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, message, recipientId, req.user.userId]);

    // Логируем отправку уведомления
    logUserAction(req.user.userId, 'notification_sent', {
      recipientId,
      recipientUsername: recipient.rows[0].username,
      title
    }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Уведомление отправлено',
      notification: result.rows[0]
    });
  } catch (error) {
    logError(error, { route: '/notifications/send', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при отправке уведомления' });
  }
});

// Отправить уведомление всем пользователям (только для администраторов)
router.post('/send-all', requireAdmin, async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ 
        error: 'Обязательные поля: title, message' 
      });
    }

    // Получаем всех активных пользователей
    const users = await pool.query(
      'SELECT id FROM users WHERE is_active = true'
    );

    if (users.rows.length === 0) {
      return res.status(400).json({ error: 'Нет активных пользователей для отправки' });
    }

    // Создаем уведомления для всех пользователей
    const notifications = users.rows.map(user => ({
      title,
      message,
      recipient_id: user.id,
      sender_id: req.user.userId
    }));

    // Вставляем все уведомления одним запросом
    const values = notifications.map((_, index) => {
      const offset = index * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }).join(', ');

    const params = notifications.flatMap(n => [n.title, n.message, n.recipient_id, n.sender_id]);

    await pool.query(`
      INSERT INTO notifications (title, message, recipient_id, sender_id)
      VALUES ${values}
    `, params);

    // Логируем массовую отправку
    logUserAction(req.user.userId, 'notification_sent_all', {
      title,
      recipientCount: users.rows.length
    }, req.ip);

    res.json({
      success: true,
      message: `Уведомление отправлено ${users.rows.length} пользователям`,
      recipientCount: users.rows.length
    });
  } catch (error) {
    logError(error, { route: '/notifications/send-all', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при массовой отправке уведомлений' });
  }
});

module.exports = router;

