const jwt = require('jsonwebtoken');
const { logUserAction, logGPSData, logError } = require('../utils/logger');

module.exports = (io) => {
  // Middleware для аутентификации Socket.io
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Токен не предоставлен'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', (socket) => {
    try {
      const { userId, username, role } = socket.user;
      
      // Логируем подключение
      logUserAction(userId, 'socket_connected', {
        username,
        role,
        socketId: socket.id
      });

      // Водители подключаются к комнате для получения заявок
      if (role === 'driver') {
        socket.join(`driver_${userId}`);
        socket.join('all_drivers');
        
        // Отправляем подтверждение подключения
        socket.emit('connected', {
          message: 'Подключение к системе трекинга установлено',
          userId,
          role
        });

        console.log(`🚗 Водитель ${username} (ID: ${userId}) подключился к системе трекинга`);

      } else if (role === 'admin') {
        // Администратор подключается к комнате для мониторинга
        socket.join('admin_monitoring');
        
        socket.emit('connected', {
          message: 'Подключение к панели мониторинга установлено',
          userId,
          role
        });

        console.log(`👨‍💼 Администратор ${username} подключился к панели мониторинга`);
      }

      // Обработка GPS данных от водителей
      socket.on('gps_update', async (data) => {
        try {
          if (role !== 'driver') {
            socket.emit('error', { message: 'Только водители могут отправлять GPS данные' });
            return;
          }

          const { latitude, longitude, speed, heading, accuracy } = data;

          // Валидация данных
          if (!latitude || !longitude) {
            socket.emit('error', { message: 'Координаты обязательны' });
            return;
          }

          // Логируем GPS данные
          logGPSData(userId, latitude, longitude, speed, heading);

          // Отправляем GPS данные администратору в реальном времени
          socket.to('admin_monitoring').emit('driver_location_update', {
            driverId: userId,
            driverName: username,
            latitude,
            longitude,
            speed,
            heading,
            accuracy,
            timestamp: new Date().toISOString()
          });

          // Отправляем подтверждение водителю
          socket.emit('gps_confirmed', {
            message: 'GPS данные получены и переданы администратору',
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logError(error, { 
            event: 'gps_update', 
            data, 
            userId, 
            socketId: socket.id 
          });
          socket.emit('error', { message: 'Ошибка при обработке GPS данных' });
        }
      });

      // Обработка изменения статуса заявки
      socket.on('order_status_update', (data) => {
        try {
          const { orderId, newStatus, orderDetails } = data;

          // Логируем изменение статуса
          logUserAction(userId, 'order_status_changed_socket', {
            orderId,
            newStatus,
            orderDetails
          });

          // Уведомляем всех водителей об изменении
          socket.to('all_drivers').emit('order_status_changed', {
            orderId,
            newStatus,
            updatedBy: username,
            timestamp: new Date().toISOString()
          });

          // Уведомляем администратора
          socket.to('admin_monitoring').emit('order_status_changed', {
            orderId,
            newStatus,
            updatedBy: username,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logError(error, { 
            event: 'order_status_update', 
            data, 
            userId, 
            socketId: socket.id 
          });
        }
      });

      // Обработка новых заявок (от администратора)
      socket.on('new_order_created', (data) => {
        try {
          if (role !== 'admin') {
            socket.emit('error', { message: 'Только администраторы могут создавать заявки' });
            return;
          }

          const { orderId, driverId, orderDetails } = data;

          // Логируем создание заявки
          logUserAction(userId, 'new_order_created_socket', {
            orderId,
            driverId,
            orderDetails
          });

          // Уведомляем конкретного водителя о новой заявке
          if (driverId) {
            socket.to(`driver_${driverId}`).emit('new_order_assigned', {
              orderId,
              orderDetails,
              assignedBy: username,
              timestamp: new Date().toISOString()
            });
          }

          // Уведомляем всех водителей о новой заявке
          socket.to('all_drivers').emit('new_order_available', {
            orderId,
            orderDetails,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logError(error, { 
            event: 'new_order_created', 
            data, 
            userId, 
            socketId: socket.id 
          });
        }
      });

      // Обработка отключения
      socket.on('disconnect', () => {
        try {
          // Логируем отключение
          logUserAction(userId, 'socket_disconnected', {
            username,
            role,
            socketId: socket.id
          });

          if (role === 'driver') {
            console.log(`🚗 Водитель ${username} отключился от системы трекинга`);
          } else if (role === 'admin') {
            console.log(`👨‍💼 Администратор ${username} отключился от панели мониторинга`);
          }

        } catch (error) {
          logError(error, { 
            event: 'disconnect', 
            userId, 
            socketId: socket.id 
          });
        }
      });

      // Обработка ошибок
      socket.on('error', (error) => {
        logError(error, { 
          event: 'socket_error', 
          userId, 
          socketId: socket.id 
        });
      });

    } catch (error) {
      logError(error, { 
        event: 'connection_error', 
        socketId: socket.id 
      });
      socket.emit('error', { message: 'Ошибка подключения к серверу' });
    }
  });

  // Глобальные обработчики ошибок
  io.on('error', (error) => {
    logError(error, { event: 'io_error' });
  });

  // Экспортируем io для использования в других модулях
  global.io = io;
};
