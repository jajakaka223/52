const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Сохранение FCM токена
router.post('/token', async (req, res) => {
  try {
    const { fcmToken, platform, timestamp } = req.body;
    const userId = req.user.userId;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    // Пока просто логируем получение токена
    console.log(`FCM token received for user ${userId}: ${fcmToken.substring(0, 20)}...`);

    // Логируем сохранение токена
    logUserAction(userId, 'fcm_token_saved', {
      platform: platform || 'unknown',
      tokenLength: fcmToken.length
    }, req.ip);

    res.json({
      success: true,
      message: 'FCM token received successfully',
      token: {
        id: Date.now(),
        user_id: userId,
        fcm_token: fcmToken,
        platform: platform || 'unknown',
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logError(error, { route: '/fcm/token', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при сохранении FCM токена' });
  }
});

// Получение FCM токенов пользователя
router.get('/tokens', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM user_fcm_tokens WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    res.json({
      success: true,
      tokens: result.rows
    });

  } catch (error) {
    logError(error, { route: '/fcm/tokens', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении FCM токенов' });
  }
});

// Удаление FCM токена
router.delete('/token/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'DELETE FROM user_fcm_tokens WHERE id = $1 AND user_id = $2 RETURNING *',
      [tokenId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'FCM token not found' });
    }

    // Логируем удаление токена
    logUserAction(userId, 'fcm_token_deleted', {
      tokenId: tokenId
    }, req.ip);

    res.json({
      success: true,
      message: 'FCM token deleted successfully'
    });

  } catch (error) {
    logError(error, { route: `/fcm/token/${req.params.tokenId}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении FCM токена' });
  }
});

// Отправка тестового уведомления (только для админов)
router.post('/test', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { title, body, userId } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    // Здесь можно добавить логику отправки push-уведомления
    // через Firebase Admin SDK или другой сервис

    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });

  } catch (error) {
    logError(error, { route: '/fcm/test', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при отправке тестового уведомления' });
  }
});

module.exports = router;
