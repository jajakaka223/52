const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logUserAction, logError } = require('../utils/logger');
const crypto = require('crypto');

const router = express.Router();

// Функция шифрования данных
const encryptData = (data) => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default32charEncryptionKey123', 'utf8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

// Функция расшифровки данных
const decryptData = (encryptedData) => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default32charEncryptionKey123', 'utf8');
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Регистрация нового пользователя (только для администраторов)
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, role, email, phone } = req.body;
    const adminToken = req.headers.authorization?.split(' ')[1];

    if (!adminToken) {
      return res.status(401).json({ error: 'Требуется авторизация администратора' });
    }

    // Проверяем, что токен принадлежит администратору
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET || 'default_secret');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }

    // Проверяем, что пользователь не существует
    const userExists = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }

    // Шифруем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const newUser = await pool.query(
      `INSERT INTO users (username, password, full_name, role, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, role, email, phone`,
      [username, hashedPassword, fullName, role, email, phone]
    );

    // Логируем действие
    logUserAction(decoded.userId, 'user_created', {
      newUserId: newUser.rows[0].id,
      username: newUser.rows[0].username,
      role: newUser.rows[0].role
    }, req.ip);

    res.status(201).json({
      message: 'Пользователь успешно создан',
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        fullName: newUser.rows[0].full_name,
        role: newUser.rows[0].role,
        email: newUser.rows[0].email,
        phone: newUser.rows[0].phone
      }
    });

  } catch (error) {
    logError(error, { route: '/register', body: req.body });
    res.status(500).json({ error: 'Ошибка сервера при создании пользователя' });
  }
});

// Вход в систему
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Находим пользователя
    const user = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Создаем JWT токен
    const token = jwt.sign(
      {
        userId: user.rows[0].id,
        username: user.rows[0].username,
        role: user.rows[0].role
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '24h' }
    );

    // Логируем успешный вход
    logUserAction(user.rows[0].id, 'login_success', {
      username: user.rows[0].username,
      role: user.rows[0].role
    }, req.ip);

    // Получим человеко-читаемое название роли
    let roleTitle = null;
    try {
      const r = await pool.query('SELECT title FROM roles WHERE key = $1', [user.rows[0].role]);
      roleTitle = r.rows[0]?.title || null;
    } catch (_) {}

    res.json({
      message: 'Вход выполнен успешно',
      token,
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        fullName: user.rows[0].full_name,
        role: user.rows[0].role,
        role_title: roleTitle,
        email: user.rows[0].email,
        phone: user.rows[0].phone
      }
    });

  } catch (error) {
    logError(error, { route: '/login', body: req.body });
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Проверка токена
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    // Получаем актуальные данные пользователя
    const user = await pool.query(
      'SELECT id, username, full_name, role, email, phone FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }

    // Присвоим title роли
    let roleTitle = null;
    try {
      const r = await pool.query('SELECT title FROM roles WHERE key = $1', [user.rows[0].role]);
      roleTitle = r.rows[0]?.title || null;
    } catch (_) {}

    res.json({
      valid: true,
      user: { ...user.rows[0], role_title: roleTitle }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истек' });
    }
    
    logError(error, { route: '/verify' });
    res.status(500).json({ error: 'Ошибка сервера при проверке токена' });
  }
});

// Выход из системы
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      
      // Логируем выход
      logUserAction(decoded.userId, 'logout', {
        username: decoded.username
      }, req.ip);
    }

    res.json({ message: 'Выход выполнен успешно' });

  } catch (error) {
    logError(error, { route: '/logout' });
    res.status(500).json({ error: 'Ошибка сервера при выходе' });
  }
});

module.exports = router;
