const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { pool } = require('../config/database');
const admin = require('firebase-admin');

// Инициализация Firebase Admin SDK (если еще не инициализирован)
let firebaseInitialized = false;
if (!admin.apps.length) {
  try {
    // Проверяем наличие переменных окружения для Firebase
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    } else {
      console.warn('Firebase Admin SDK not initialized: missing environment variables');
    }
  } catch (error) {
    console.warn('Firebase Admin SDK not initialized:', error.message);
  }
} else {
  firebaseInitialized = true;
}

// Получение всех уведомлений
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    );
    
    res.json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при получении уведомлений' 
    });
  }
});

// Создание нового уведомления
router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { title, message, targetUsers = 'all' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Заголовок и сообщение обязательны'
      });
    }

    // Сохраняем уведомление в базу данных
    const result = await pool.query(
      'INSERT INTO notifications (title, message, target_users, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, message, targetUsers, req.user.userId]
    );

    const notification = result.rows[0];

    // Отправляем push-уведомление
    try {
      await sendPushNotification(title, message, targetUsers);
      
      // Обновляем статус уведомления
      await pool.query(
        'UPDATE notifications SET status = $1 WHERE id = $2',
        ['sent', notification.id]
      );
    } catch (pushError) {
      console.error('Push notification failed:', pushError);
      
      // Обновляем статус уведомления как неудачное
      await pool.query(
        'UPDATE notifications SET status = $1 WHERE id = $2',
        ['failed', notification.id]
      );
    }

    res.json({
      success: true,
      notification: notification,
      message: 'Уведомление создано и отправлено'
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при создании уведомления' 
    });
  }
});

// Отправка push-уведомления
async function sendPushNotification(title, message, targetUsers) {
  if (!firebaseInitialized) {
    console.warn('Firebase Admin SDK not initialized, skipping push notification');
    return;
  }

  try {
    // Получаем FCM токены пользователей
    let query = 'SELECT fcm_token FROM fcm_tokens WHERE fcm_token IS NOT NULL';
    let params = [];

    if (targetUsers !== 'all') {
      // Если указаны конкретные пользователи
      const userIds = Array.isArray(targetUsers) ? targetUsers : [targetUsers];
      query += ' AND user_id = ANY($1)';
      params = [userIds];
    }

    const result = await pool.query(query, params);
    const tokens = result.rows.map(row => row.fcm_token).filter(token => token);

    if (tokens.length === 0) {
      console.log('No FCM tokens found for notification');
      return;
    }

    // Создаем сообщение
    const notification = {
      title: title,
      body: message,
      data: {
        type: 'notification',
        timestamp: Date.now().toString()
      }
    };

    // Отправляем уведомление
    const response = await admin.messaging().sendMulticast({
      tokens: tokens,
      notification: notification,
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#2196F3',
          sound: 'default',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    });

    console.log(`Push notification sent to ${response.successCount} devices`);
    
    if (response.failureCount > 0) {
      console.log(`Failed to send to ${response.failureCount} devices`);
      
      // Удаляем недействительные токены
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (errorCode === 'messaging/invalid-registration-token' || 
              errorCode === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await pool.query(
          'DELETE FROM fcm_tokens WHERE fcm_token = ANY($1)',
          [invalidTokens]
        );
        console.log(`Removed ${invalidTokens.length} invalid FCM tokens`);
      }
    }

  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

// Получение статистики уведомлений
router.get('/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h
      FROM notifications
    `);

    const fcmResult = await pool.query(`
      SELECT COUNT(*) as total_tokens
      FROM fcm_tokens 
      WHERE fcm_token IS NOT NULL
    `);

    res.json({
      success: true,
      stats: {
        ...result.rows[0],
        total_tokens: parseInt(fcmResult.rows[0].total_tokens)
      }
    });

  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при получении статистики' 
    });
  }
});

module.exports = router;