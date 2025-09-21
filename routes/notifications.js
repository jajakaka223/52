const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const admin = require('firebase-admin');

// Инициализация Firebase Admin SDK
let firebaseInitialized = false;
let db;

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

// Инициализация подключения к базе данных
try {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('Database connection established for notifications');
} catch (error) {
  console.error('Database connection error:', error);
}

// Получить все уведомления
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отправить push-уведомление
router.post('/send', async (req, res) => {
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    // Сохраняем уведомление в базу данных
    const result = await db.query(
      'INSERT INTO notifications (title, body, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [title, body]
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

// Удалить уведомление
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
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