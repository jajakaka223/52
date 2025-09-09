const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireDriver, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logGPSData, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Отправить GPS координаты (для водителей)
router.post('/location', requireDriver, async (req, res) => {
  try {
    const { latitude, longitude, speed, heading, accuracy } = req.body;

    // Валидация координат
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Координаты обязательны' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Некорректные координаты' });
    }

    // Сохраняем GPS данные
    const result = await pool.query(
      `INSERT INTO gps_tracking (user_id, latitude, longitude, speed, heading, accuracy)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.userId, latitude, longitude, speed, heading, accuracy]
    );

    // Логируем GPS данные
    logGPSData(req.user.userId, latitude, longitude, speed, heading);

    res.json({
      success: true,
      message: 'GPS координаты успешно сохранены',
      tracking: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/tracking/location', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при сохранении GPS данных' });
  }
});

// Получить текущее местоположение водителя
router.get('/location/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Нет прав на просмотр местоположения' });
    }

    // Получаем последние GPS координаты
    const result = await pool.query(
      `SELECT gt.*, u.full_name, u.username
       FROM gps_tracking gt
       JOIN users u ON gt.user_id = u.id
       WHERE gt.user_id = $1
       ORDER BY gt.timestamp DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'GPS данные не найдены' });
    }

    res.json({
      success: true,
      location: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/tracking/location/${req.params.userId}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении местоположения' });
  }
});

// Получить историю перемещений водителя
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Нет прав на просмотр истории перемещений' });
    }

    let query = `
      SELECT gt.*, u.full_name, u.username
      FROM gps_tracking gt
      JOIN users u ON gt.user_id = u.id
      WHERE gt.user_id = $1
    `;
    let params = [userId];
    let paramCount = 1;

    // Добавляем фильтры по датам если указаны
    if (startDate) {
      paramCount++;
      query += ` AND gt.timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND gt.timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY gt.timestamp DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      history: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    logError(error, { route: `/tracking/history/${req.params.userId}`, query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении истории перемещений' });
  }
});

// Получить местоположения всех активных водителей (для администратора)
router.get('/all-drivers', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }

    // Получаем последние GPS координаты всех активных водителей
    const result = await pool.query(
      `SELECT DISTINCT ON (gt.user_id) 
         gt.*, u.full_name, u.username, u.role
       FROM gps_tracking gt
       JOIN users u ON gt.user_id = u.id
       WHERE u.role = 'driver' AND u.is_active = true
       ORDER BY gt.user_id, gt.timestamp DESC`
    );

    res.json({
      success: true,
      drivers: result.rows
    });

  } catch (error) {
    logError(error, { route: '/tracking/all-drivers', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении местоположений водителей' });
  }
});

// Получить статистику по перемещениям водителя
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Нет прав на просмотр статистики' });
    }

    let query = `
      SELECT 
        COUNT(*) as total_points,
        MIN(gt.timestamp) as first_point,
        MAX(gt.timestamp) as last_point,
        AVG(gt.speed) as avg_speed,
        MAX(gt.speed) as max_speed,
        MIN(gt.latitude) as min_lat,
        MAX(gt.latitude) as max_lat,
        MIN(gt.longitude) as min_lng,
        MAX(gt.longitude) as max_lng
      FROM gps_tracking gt
      WHERE gt.user_id = $1
    `;
    let params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND gt.timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND gt.timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Статистика не найдена' });
    }

    res.json({
      success: true,
      stats: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/tracking/stats/${req.params.userId}`, query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении статистики' });
  }
});

// Очистить старые GPS данные (для администратора)
router.delete('/cleanup', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }

    const { days = 30 } = req.query;

    // Удаляем GPS данные старше указанного количества дней
    const result = await pool.query(
      `DELETE FROM gps_tracking 
       WHERE timestamp < NOW() - INTERVAL '${days} days'`
    );

    // Логируем очистку
    logUserAction(req.user.userId, 'gps_cleanup', {
      deletedRows: result.rowCount,
      daysOld: days
    }, req.ip);

    res.json({
      success: true,
      message: `Удалено ${result.rowCount} записей GPS данных старше ${days} дней`
    });

  } catch (error) {
    logError(error, { route: '/tracking/cleanup', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при очистке GPS данных' });
  }
});

module.exports = router;
