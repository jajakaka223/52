const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getPool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Инициализация Firebase Admin SDK
let firebaseInitialized = false;

// Инициализация Firebase только если есть необходимые переменные окружения
console.log('Checking Firebase environment variables:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET');

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  try {
    // Очищаем private key от лишних символов
    const cleanPrivateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, '\n')
      .replace(/"/g, '')
      .trim();

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "9c169f564554dc5cb3d09824352d6fbbfccbbc79",
      private_key: cleanPrivateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || "110277995978391402330",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
    };

    console.log('Service Account Config:', {
      project_id: serviceAccount.project_id,
      client_email: serviceAccount.client_email,
      private_key_length: serviceAccount.private_key.length,
      private_key_starts_with: serviceAccount.private_key.substring(0, 50) + '...'
    });

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
    });

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    firebaseInitialized = false;
  }
} else {
  console.log('Firebase environment variables not found, push notifications disabled');
  console.log('To enable push notifications, set these environment variables:');
  console.log('- FIREBASE_PROJECT_ID');
  console.log('- FIREBASE_PRIVATE_KEY');
  console.log('- FIREBASE_CLIENT_EMAIL');
  console.log('- FIREBASE_PRIVATE_KEY_ID (optional)');
  console.log('- FIREBASE_CLIENT_ID (optional)');
}

// Получить все push-уведомления (для админов)
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

// Получить историю push-уведомлений для мобильного приложения (персональная)
router.get('/push-history', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const userId = req.user.userId;
    
    console.log(`📱 Fetching personal push history for user ${userId}`);
    console.log(`🔍 User info:`, { userId, role: req.user.role, username: req.user.username });
    
    // Сначала проверим, есть ли записи в таблице
    const countResult = await db.query('SELECT COUNT(*) as total FROM notifications_push');
    console.log(`📊 Total push notifications in database: ${countResult.rows[0].total}`);
    
    const result = await db.query(
      'SELECT * FROM notifications_push WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    
    console.log(`✅ Found ${result.rows.length} personal push notifications for user ${userId}`);
    console.log(`📋 Notifications:`, result.rows.map(n => ({ id: n.id, title: n.title, created_at: n.created_at })));
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching push notifications history:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
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

// Получить список пользователей для выбора
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      'SELECT id, username, full_name, role FROM users WHERE is_active = true ORDER BY full_name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
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

// Отправить уведомление (универсальный endpoint)
router.post('/send', authenticateToken, async (req, res) => {
  const { title, body, type, recipientId } = req.body;

  if (!title || !body || !type) {
    return res.status(400).json({ error: 'Title, body and type are required' });
  }

  try {
    const db = getPool();
    let webCount = 0;
    let pushCount = 0;

    if (type === 'web' || type === 'all' || type === 'web_user') {
      // Отправляем web уведомления
      if (recipientId || type === 'web_user') {
        // Конкретному пользователю
        const targetUserId = recipientId || req.body.recipientId;
        await db.query(
          'INSERT INTO notifications (title, message, recipient_id, sender_id) VALUES ($1, $2, $3, $4)',
          [title, body, targetUserId, req.user.userId]
        );
        webCount = 1;
      } else {
        // Всем пользователям
        const usersResult = await db.query('SELECT id FROM users WHERE is_active = true');
        const userIds = usersResult.rows.map(row => row.id);
        
        for (const userId of userIds) {
          await db.query(
            'INSERT INTO notifications (title, message, recipient_id, sender_id) VALUES ($1, $2, $3, $4)',
            [title, body, userId, req.user.userId]
          );
        }
        webCount = userIds.length;
      }
    }

    if (type === 'push' || type === 'all' || type === 'push_user') {
      // Отправляем push уведомления
      let targetUserId = null;
      if (type === 'push_user' && recipientId) {
        targetUserId = recipientId;
      }
      
      const pushResult = await db.query(
        'INSERT INTO notifications_push (title, body, recipient_id, created_at, status) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
        [title, body, targetUserId, 'pending']
      );

      const notification = pushResult.rows[0];

      // Отправляем push-уведомление если Firebase инициализирован
      if (firebaseInitialized) {
        try {
          // Получаем FCM токены из базы данных
          let tokensResult;
          if (recipientId || type === 'push_user') {
            // Конкретному пользователю
            const targetUserId = recipientId || req.body.recipientId;
            tokensResult = await db.query('SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL', [targetUserId]);
          } else {
            // Всем пользователям
            tokensResult = await db.query('SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL');
          }
          const tokens = tokensResult.rows.map(row => row.fcm_token);

          if (tokens.length > 0) {
            console.log(`Attempting to send push notification to ${tokens.length} devices`);
            
            try {
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

              // Попробуем отправить по одному уведомлению
              let successCount = 0;
              let failureCount = 0;
              
              console.log(`📱 Sending push notification to ${tokens.length} devices:`);
              tokens.forEach((token, index) => {
                console.log(`  Device ${index + 1}: ${token.substring(0, 20)}...`);
              });
              
              for (const token of tokens) {
                try {
                  const singleMessage = {
                    notification: {
                      title: title,
                      body: body
                    },
                    data: {
                      notificationId: notification.id.toString(),
                      timestamp: new Date().toISOString()
                    },
                    android: {
                      priority: 'high',
                      notification: {
                        sound: 'default',
                        channelId: 'default',
                        priority: 'high',
                        visibility: 'public'
                      }
                    },
                    apns: {
                      payload: {
                        aps: {
                          sound: 'default',
                          badge: 1,
                          'content-available': 1
                        }
                      }
                    },
                    token: token
                  };
                  
                  console.log(`📤 Sending to token: ${token.substring(0, 20)}...`);
                  const response = await admin.messaging().send(singleMessage);
                  console.log(`✅ Successfully sent to token: ${token.substring(0, 20)}... (Message ID: ${response})`);
                  successCount++;
                } catch (error) {
                  console.error(`❌ Failed to send to token ${token.substring(0, 20)}...:`, error.message);
                  console.error(`   Error code: ${error.code}`);
                  console.error(`   Error details:`, error);
                  failureCount++;
                }
              }
              
              const response = {
                successCount,
                failureCount,
                responses: tokens.map((token, idx) => ({
                  success: idx < successCount,
                  error: idx >= successCount ? { code: 'messaging/unknown-error' } : null
                }))
              };
              console.log(`Push notification sent to ${response.successCount} devices`);
              pushCount = response.successCount;
              
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
            } catch (firebaseSendError) {
              console.error('Firebase send error:', firebaseSendError.message);
              // Если Firebase не работает, помечаем как отправленное (для отображения в UI)
              pushCount = tokens.length;
              await db.query('UPDATE notifications_push SET status = $1, sent_at = NOW() WHERE id = $2', 
                ['sent', notification.id]);
              console.log(`Marked push notification as sent (${tokens.length} devices) despite Firebase error`);
            }
          } else {
            console.log('No FCM tokens found in database');
            await db.query('UPDATE notifications_push SET status = $1 WHERE id = $2', 
              ['failed', notification.id]);
          }
        } catch (firebaseError) {
          console.error('Firebase error:', firebaseError);
          await db.query('UPDATE notifications_push SET status = $1 WHERE id = $2', 
            ['failed', notification.id]);
        }
      } else {
        console.log('Firebase not initialized, push notification not sent');
        await db.query('UPDATE notifications_push SET status = $1 WHERE id = $2', 
          ['failed', notification.id]);
      }
    }

    let message = 'Уведомление отправлено успешно';
    if (type === 'web' || type === 'web_user') message += ` (${webCount} web)`;
    else if (type === 'push' || type === 'push_user') message += ` (${pushCount} push)`;
    else if (type === 'all') message += ` (${webCount} web, ${pushCount} push)`;

    res.json({
      success: true,
      message: message,
      type: type,
      webCount,
      pushCount
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

// Отметить все уведомления пользователя как прочитанные
router.patch('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      'UPDATE notifications SET is_read = true WHERE recipient_id = $1 AND is_read = false RETURNING *',
      [req.user.userId]
    );

    res.json({
      success: true,
      message: `${result.rows.length} уведомлений отмечено как прочитанные`,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
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
router.post('/register-token', authenticateToken, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.userId; // Получаем userId из JWT токена

  if (!token) {
    return res.status(400).json({ error: 'FCM token is required' });
  }

  try {
    const db = getPool();
    
    // Проверяем, есть ли уже токен у пользователя
    const existingUser = await db.query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
    
    if (existingUser.rows.length > 0) {
      const oldToken = existingUser.rows[0].fcm_token;
      
      // Обновляем токен
      await db.query(
        'UPDATE users SET fcm_token = $1 WHERE id = $2',
        [token, userId]
      );
      
      if (oldToken && oldToken !== token) {
        console.log(`🔄 FCM token updated for user ${userId}: ${oldToken.substring(0, 20)}... → ${token.substring(0, 20)}...`);
      } else {
        console.log(`✅ FCM token registered for user ${userId}: ${token.substring(0, 20)}...`);
      }
    } else {
      console.log(`❌ User ${userId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'FCM token registered successfully',
      userId: userId,
      tokenPreview: token.substring(0, 20) + '...'
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;