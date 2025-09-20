const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireDriver, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logGPSData, logError } = require('../utils/logger');
const { io } = require('../socket/socketHandler');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Отправить GPS координаты (для водителей)
router.post('/location', requireDriver, async (req, res) => {
  try {
    const { latitude, longitude, speed, heading, accuracy, timestamp } = req.body;

    // Валидация координат
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Координаты обязательны' });
    }

    // Проверяем, что координаты являются числами
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Координаты должны быть числами' });
    }

    // Проверяем на NaN и Infinity
    if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
      return res.status(400).json({ error: 'Координаты содержат недопустимые значения' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Некорректные координаты' });
    }

    // Нормализуем скорость: если пришла в м/с (редко), конвертируем; если уже км/ч, оставляем
    let normalizedSpeed = null;
    if (typeof speed === 'number' && !isNaN(speed) && isFinite(speed)) {
      // Если скорость выглядит как м/с (обычно < 60), умножаем на 3.6
      normalizedSpeed = speed < 60 ? speed * 3.6 : speed;
      if (normalizedSpeed < 0) normalizedSpeed = 0;
    }

    // Валидация и нормализация heading
    let normalizedHeading = null;
    if (typeof heading === 'number' && !isNaN(heading) && isFinite(heading)) {
      normalizedHeading = heading;
      // Нормализуем угол в диапазон 0-360
      while (normalizedHeading < 0) normalizedHeading += 360;
      while (normalizedHeading >= 360) normalizedHeading -= 360;
    }

    // Валидация и нормализация accuracy
    let normalizedAccuracy = null;
    if (typeof accuracy === 'number' && !isNaN(accuracy) && isFinite(accuracy) && accuracy > 0) {
      normalizedAccuracy = accuracy;
    }

    // Преобразуем timestamp в Date объект
    let timestampDate = new Date();
    if (timestamp) {
      // Если timestamp в миллисекундах (число), преобразуем в Date
      if (typeof timestamp === 'number') {
        timestampDate = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        timestampDate = new Date(timestamp);
      }
    }

    // Логируем данные перед сохранением
    console.log('Saving GPS data:', {
      userId: req.user.userId,
      latitude,
      longitude,
      speed: normalizedSpeed,
      heading: normalizedHeading,
      accuracy: normalizedAccuracy,
      timestamp: timestampDate
    });

    // Сохраняем GPS данные
    const result = await pool.query(
      `INSERT INTO gps_tracking (user_id, latitude, longitude, speed, heading, accuracy, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.userId, latitude, longitude, normalizedSpeed, normalizedHeading, normalizedAccuracy, timestampDate]
    );

    // Логируем GPS данные
    logGPSData(req.user.userId, latitude, longitude, normalizedSpeed, normalizedHeading);

    res.json({
      success: true,
      message: 'GPS координаты успешно сохранены',
      tracking: result.rows[0]
    });

  } catch (error) {
    console.error('GPS tracking error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    logError(error, { route: '/tracking/location', body: req.body, user: req.user });
    res.status(500).json({ 
      error: 'Ошибка сервера при сохранении GPS данных',
      details: error.message 
    });
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

    // Форматируем данные для нового интерфейса
    const drivers = result.rows.map(driver => ({
      id: driver.user_id,
      name: driver.full_name || driver.username,
      last_location: {
        latitude: driver.latitude,
        longitude: driver.longitude,
        speed: driver.speed,
        heading: driver.heading,
        accuracy: driver.accuracy,
        timestamp: driver.timestamp
      }
    }));

    res.json(drivers);

  } catch (error) {
    logError(error, { route: '/tracking/all-drivers', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении местоположений водителей' });
  }
});

// Получить историю GPS данных водителя с лимитом (для нового интерфейса)
router.get('/driver-history/:driverId', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }

    const { driverId } = req.params;
    const { limit = 10 } = req.query;

    // Получаем историю GPS данных водителя
    const result = await pool.query(
      `SELECT gt.*, u.full_name, u.username
       FROM gps_tracking gt
       JOIN users u ON gt.user_id = u.id
       WHERE gt.user_id = $1
       ORDER BY gt.timestamp DESC
       LIMIT $2`,
      [driverId, parseInt(limit)]
    );

    const locationHistory = result.rows.map(row => ({
      latitude: row.latitude,
      longitude: row.longitude,
      speed: row.speed,
      heading: row.heading,
      accuracy: row.accuracy,
      timestamp: row.timestamp
    }));

    res.json(locationHistory);

  } catch (error) {
    logError(error, { route: `/tracking/driver-history/${req.params.driverId}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении истории водителя' });
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

// Запрос обновления координат у Android устройств (для web)
router.post('/request-coordinates', async (req, res) => {
  try {
    // Отправляем WebSocket сообщение всем подключенным Android устройствам
    if (io) {
      io.emit('request_coordinates', {
        timestamp: new Date().toISOString(),
        requestedBy: req.user.id,
        requestedByRole: req.user.role
      });
      
      logUserAction(req.user.id, 'requested_coordinates_update', {
        requestedBy: req.user.id,
        requestedByRole: req.user.role
      });
    }

    res.json({
      success: true,
      message: 'Запрос на обновление координат отправлен всем устройствам'
    });

  } catch (error) {
    logError(error, { route: '/tracking/request-coordinates', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при отправке запроса координат' });
  }
});

module.exports = router;
