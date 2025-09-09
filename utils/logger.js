const winston = require('winston');
const path = require('path');

// Создаем папку для логов если её нет
const fs = require('fs');
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'transport-company' },
  transports: [
    // Записываем все логи с уровнем `error` и ниже в `error.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Записываем все логи с уровнем `info` и ниже в `combined.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    // Записываем все логи с уровнем `info` и ниже в `app.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log') 
    })
  ]
});

// Если мы не в продакшене, то логируем в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Функция для логирования действий пользователей (аудит)
const logUserAction = (userId, action, details, ipAddress) => {
  logger.info('User Action', {
    userId,
    action,
    details,
    ipAddress,
    timestamp: new Date().toISOString()
  });
};

// Функция для логирования ошибок
const logError = (error, context = {}) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};

// Функция для логирования GPS данных
const logGPSData = (userId, latitude, longitude, speed, heading) => {
  logger.info('GPS Tracking', {
    userId,
    latitude,
    longitude,
    speed,
    heading,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  logUserAction,
  logError,
  logGPSData
};
