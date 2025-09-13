const jwt = require('jsonwebtoken');
const { logUserAction, logError } = require('../utils/logger');

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔍 Auth token check:', {
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      url: req.url
    });

    if (!token) {
      return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded) => {
      if (err) {
        console.log('❌ JWT verification error:', err.message);
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Токен доступа истек' });
        }
        return res.status(403).json({ error: 'Недействительный токен доступа' });
      }

      console.log('✅ JWT verified for user:', decoded.userId, 'role:', decoded.role);
      req.user = decoded;
      next();
    });

  } catch (error) {
    console.log('❌ Error in authenticateToken:', error.message);
    logError(error, { middleware: 'authenticateToken', headers: req.headers });
    res.status(500).json({ error: 'Ошибка сервера при проверке токена' });
  }
};

// Middleware для проверки роли администратора
const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    if (req.user.role !== 'admin') {
      logUserAction(req.user.userId, 'access_denied', {
        route: req.originalUrl,
        userRole: req.user.role,
        requiredRole: 'admin'
      }, req.ip);

      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }

    next();

  } catch (error) {
    logError(error, { middleware: 'requireAdmin', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при проверке прав доступа' });
  }
};

// Middleware для проверки роли водителя
const requireDriver = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    if (req.user.role !== 'driver' && req.user.role !== 'admin') {
      logUserAction(req.user.userId, 'access_denied', {
        route: req.originalUrl,
        userRole: req.user.role,
        requiredRole: 'driver'
      }, req.ip);

      return res.status(403).json({ error: 'Доступ запрещен. Требуются права водителя' });
    }

    next();

  } catch (error) {
    logError(error, { middleware: 'requireDriver', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при проверке прав доступа' });
  }
};

// Middleware для логирования всех запросов
const logRequest = (req, res, next) => {
  if (req.user) {
    logUserAction(req.user.userId, 'api_request', {
      method: req.method,
      route: req.originalUrl,
      body: req.body,
      query: req.query
    }, req.ip);
  }
  next();
};

// Middleware для проверки активности пользователя
const checkUserActive = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    console.log('🔍 Checking user active status for user:', req.user.userId);
    
    const { pool } = require('../config/database');
    const userCheck = await pool.query(
      'SELECT is_active FROM users WHERE id = $1',
      [req.user.userId]
    );

    console.log('🔍 User check result:', userCheck.rows);

    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_active) {
      return res.status(403).json({ error: 'Аккаунт деактивирован' });
    }

    next();

  } catch (error) {
    console.log('❌ Error in checkUserActive:', error.message);
    logError(error, { middleware: 'checkUserActive', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при проверке активности пользователя' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireDriver,
  logRequest,
  checkUserActive,
  logUserAction,
  logError
};
