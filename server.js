// Загружаем переменные окружения
require('dotenv').config();

// Настройка переменных окружения для Railway
const dbConfig = {
  host: process.env.DB_HOST || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'localhost',
  port: process.env.DB_PORT || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).port : 5432,
  database: process.env.DB_NAME || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : 'transport_company',
  user: process.env.DB_USER || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).username : 'postgres',
  password: process.env.DB_PASSWORD || process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).password : 'your_password'
};

// Устанавливаем переменные для database.js
process.env.DB_HOST = dbConfig.host;
process.env.DB_PORT = dbConfig.port;
process.env.DB_NAME = dbConfig.database;
process.env.DB_USER = dbConfig.user;
process.env.DB_PASSWORD = dbConfig.password;

console.log('🔍 Конфигурация базы данных:');
console.log('   DB_HOST:', dbConfig.host);
console.log('   DB_PORT:', dbConfig.port);
console.log('   DB_NAME:', dbConfig.database);
console.log('   DB_USER:', dbConfig.user);
console.log('   DB_PASSWORD:', dbConfig.password ? '***' : 'не задан');

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
// CORS настройки для поддержки Vercel домена
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) return callback(null, true);
    
    // Разрешаем Vercel домен с слэшем и без
    const allowedOrigins = [
      'https://52-tau.vercel.app',
      'https://52-tau.vercel.app/',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Для разработки разрешаем все
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

const io = socketIo(server, {
  cors: corsOptions
});

// Middleware
app.use(helmet());

// CORS middleware с отладкой
app.use((req, res, next) => {
  console.log('🌐 CORS Request:', {
    origin: req.headers.origin,
    method: req.method,
    url: req.url
  });
  next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (с щадящими лимитами, чтобы не ловить 429 при активной работе)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 1000,               // до 1000 запросов в минуту на IP
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Доверять заголовкам прокси для корректной работы rate-limit и X-Forwarded-For
app.set('trust proxy', 1);

// Static files (временно отключено)
// app.use(express.static(path.join(__dirname, 'web/build')));

// Database connection
const { connectDB } = require('./config/database');
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/utils', require('./routes/utils'));
app.use('/api/notifications', require('./routes/notifications'));

// Socket.io connection handling
require('./socket/socketHandler')(io);

// Serve React app (временно отключено)
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'web/build', 'index.html'));
// });

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚚 Сервер транспортной компании запущен на порту ${PORT}`);
  console.log(`📱 API доступен по адресу: http://localhost:${PORT}/api`);
  console.log(`🌐 Веб-интерфейс: http://localhost:${PORT}`);
  console.log('🔄 Server restarted at:', new Date().toISOString());
});

module.exports = { app, server, io };
