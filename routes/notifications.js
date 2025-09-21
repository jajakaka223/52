const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getPool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Инициализация Firebase Admin SDK
let firebaseInitialized = false;

// Инициализация Firebase только если есть необходимые переменные окружения
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  try {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    firebaseInitialized = false;
  }
} else {
  console.log('Firebase environment variables not found, push notifications disabled');
}

// Получить все push-уведомления
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      'SELECT * FROM notifications_push ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching push notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить обычные уведомления пользователя
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT n.*, u.username as sender_name 
       FROM notifications n 
       LEFT JOIN users u ON n.sender_id = u.id 
       WHERE n.recipient_id = $1 
       ORDER BY n.created_at DESC 
       LIMIT 50`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить количество непрочитанных push-уведомлений
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications_push WHERE created_at > NOW() - INTERVAL \'7 days\''
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить количество непрочитанных обычных уведомлений пользователя
router.get('/user/unread-count', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = $1 AND is_read = false',
      [req.user.userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching user unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отправить push-уведомление
router.post('/send', authenticateToken, async (req, res) => {
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    // Сохраняем push-уведомление в базу данных
    const db = getPool();
    const result = await db.query(
      'INSERT INTO notifications_push (title, body, created_at, status) VALUES ($1, $2, NOW(), $3) RETURNING *',
      [title, body, 'pending']
    );

    const notification = result.rows[0];

    // Отправляем push-уведомление если Firebase инициализирован
    if (firebaseInitialized) {
      try {
        // Получаем все FCM токены из базы данных
        const tokensResult = await db.query('SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL');
        const tokens = tokensResult.rows.map(row => row.fcm_token);

        if (tokens.length > 0) {
          const message = {
            notification: {
              title: title,
              body: body
            },
            data: {
              notificationId: notification.id.toString(),
              timestamp: new Date().toISOString()
            },
            tokens: tokens
          };

          const response = await admin.messaging().sendMulticast(message);
          console.log(`Push notification sent to ${response.successCount} devices`);
          
          // Обновляем статус уведомления
          await db.query('UPDATE notifications_push SET status = $1, sent_at = NOW() WHERE id = $2', 
            ['sent', notification.id]);
          
          if (response.failureCount > 0) {
            console.log(`Failed to send to ${response.failureCount} devices`);
            // Удаляем недействительные токены
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success && resp.error) {
                if (resp.error.code === 'messaging/invalid-registration-token' || 
                    resp.error.code === 'messaging/registration-token-not-registered') {
                  invalidTokens.push(tokens[idx]);
                }
              }
            });

            if (invalidTokens.length > 0) {
              await db.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = ANY($1)', [invalidTokens]);
              console.log(`Removed ${invalidTokens.length} invalid FCM tokens`);
            }
          }
        } else {
          console.log('No FCM tokens found in database');
        }
      } catch (firebaseError) {
        console.error('Error sending push notification:', firebaseError);
        // Не возвращаем ошибку, так как уведомление уже сохранено в БД
      }
    } else {
      console.log('Firebase not initialized, notification saved to database only');
    }

    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      notification: notification
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отметить уведомление как прочитанное
router.put('/user/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const db = getPool();
    const result = await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2 RETURNING *',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить push-уведомление
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const db = getPool();
    const result = await db.query('DELETE FROM notifications_push WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить обычное уведомление пользователя
router.delete('/user/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const db = getPool();
    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND recipient_id = $2 RETURNING *',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting user notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отправить уведомление всем пользователям (для настроек)
router.post('/send-all', authenticateToken, async (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  try {
    const db = getPool();
    
    // Получаем всех активных пользователей
    const usersResult = await db.query('SELECT id FROM users WHERE is_active = true');
    const userIds = usersResult.rows.map(row => row.id);
    
    if (userIds.length === 0) {
      return res.status(400).json({ error: 'No active users found' });
    }

    // Создаем уведомления для всех пользователей
    const notifications = userIds.map(userId => ({
      title,
      message,
      recipient_id: userId,
      sender_id: req.user.userId
    }));

    // Вставляем уведомления в базу данных
    for (const notification of notifications) {
      await db.query(
        'INSERT INTO notifications (title, message, recipient_id, sender_id) VALUES ($1, $2, $3, $4)',
        [notification.title, notification.message, notification.recipient_id, notification.sender_id]
      );
    }

    res.json({ 
      success: true, 
      message: `Уведомление отправлено ${userIds.length} пользователям`,
      count: userIds.length
    });
  } catch (error) {
    console.error('Error sending notifications to all users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Сохранить FCM токен пользователя
router.post('/register-token', async (req, res) => {
  const { token, userId } = req.body;

  if (!token || !userId) {
    return res.status(400).json({ error: 'Token and userId are required' });
  }

  try {
    const db = getPool();
    await db.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [token, userId]
    );

    res.json({ success: true, message: 'FCM token registered successfully' });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;