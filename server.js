// Загружаем переменные окружения ПЕРЕД всеми импортами
const fs = require('fs');
const path = require('path');

// Простая загрузка .env файла
const envPath = path.join(__dirname, '.env');
console.log('🔍 Путь к .env файлу:', envPath);
console.log('🔍 Файл .env существует:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('🔍 Содержимое .env файла:');
  console.log(envContent);
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
      console.log(`🔍 Установлена переменная: ${key.trim()} = ${value}`);
    }
  });
}

console.log('🔍 Проверка переменных окружения после загрузки:');
console.log('   DB_HOST:', process.env.DB_HOST);
console.log('   DB_PORT:', process.env.DB_PORT);
console.log('   DB_NAME:', process.env.DB_NAME);
console.log('   DB_USER:', process.env.DB_USER);
console.log('   DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'не задан');

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
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
app.use('/api/telegram', require('./routes/telegram'));

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
});

module.exports = { app, server, io };
