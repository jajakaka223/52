const axios = require('axios');

/**
 * Отправка уведомления о выполненной заявке в Telegram бот
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendCompletionNotification(emailAddress, routeInfo, orderData = {}) {
  try {
    // URL сервера с Python ботом
    const PYTHON_BOT_SERVER = process.env.PYTHON_BOT_SERVER || 'http://109.205.58.89:8000';
    
    // ID чата для отправки уведомлений
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002419921277';
    const THREAD_ID = process.env.TELEGRAM_THREAD_ID || '12493';
    
    if (!CHAT_ID) {
      console.log('⚠️ TELEGRAM_CHAT_ID не настроен, уведомление не отправлено');
      return { success: false, error: 'TELEGRAM_CHAT_ID not configured' };
    }
    
    // Формируем данные для отправки на сервер с Python ботом
    const notificationData = {
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      text: `✅ **ЗАЯВКА ВЫПОЛНЕНА**

📧 **Email клиента:** ${emailAddress}
🛣️ **Маршрут:** ${routeInfo}
📅 **Дата выполнения:** ${new Date().toLocaleDateString('ru-RU')}
${orderData.orderId ? `🆔 **ID заявки:** ${orderData.orderId}` : ''}
${orderData.company ? `🏢 **Компания:** ${orderData.company}` : ''}
${orderData.clientName ? `👤 **Клиент:** ${orderData.clientName}` : ''}
${orderData.phone ? `📞 **Телефон:** ${orderData.phone}` : ''}

📧 **Сообщение отправлено клиенту**`,
      parse_mode: 'Markdown'
    };

    console.log('📱 Отправляем уведомление о выполненной заявке через Python бот сервер:', {
      emailAddress,
      routeInfo,
      orderId: orderData.orderId,
      server: PYTHON_BOT_SERVER
    });

    // Отправляем запрос на сервер с Python ботом
    const response = await axios.post(`${PYTHON_BOT_SERVER}/send-telegram-message`, notificationData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ Уведомление о выполненной заявке успешно отправлено через Python бот сервер');
      return { success: true, messageId: response.data.messageId };
    } else {
      console.log('❌ Ошибка отправки уведомления через Python бот сервер:', response.data);
      return { success: false, error: response.data.error || 'Unknown error' };
    }

  } catch (error) {
    console.log('❌ Ошибка при отправке уведомления через Python бот сервер:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправка уведомления о выполненной заявке в Telegram бот
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendCompletionEmail(emailAddress, routeInfo, orderData = {}) {
  // Вызываем функцию отправки уведомления в Telegram
  return await sendCompletionNotification(emailAddress, routeInfo, orderData);
}

module.exports = {
  sendCompletionNotification,
  sendCompletionEmail
};
