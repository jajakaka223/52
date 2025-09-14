const axios = require('axios');

/**
 * Отправка уведомления о выполненной заявке в Telegram бот
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendCompletionNotification(emailAddress, routeInfo, orderData = {}) {
  try {
    // URL вашего Telegram бота (замените на реальный)
    const TELEGRAM_BOT_URL = process.env.TELEGRAM_BOT_URL || 'https://api.telegram.org/bot7569282805:AAFQHAX-moIoTpVSLvNpOXWtrVbwepr31iE';
    
    // ID чата для отправки уведомлений
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002419921277';
    const THREAD_ID = process.env.TELEGRAM_THREAD_ID || '12493';
    
    if (!CHAT_ID) {
      console.log('⚠️ TELEGRAM_CHAT_ID не настроен, уведомление не отправлено');
      return { success: false, error: 'TELEGRAM_CHAT_ID not configured' };
    }
    
    // Формируем простое уведомление о выполненной заявке
    const message = {
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID, // Отправляем в конкретную тему
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

    console.log('📱 Отправляем уведомление о выполненной заявке в Telegram бот:', {
      emailAddress,
      routeInfo,
      orderId: orderData.orderId
    });

    // Отправляем уведомление в Telegram бот
    const response = await axios.post(`${TELEGRAM_BOT_URL}/sendMessage`, message, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.ok) {
      console.log('✅ Уведомление о выполненной заявке успешно отправлено в Telegram бот');
      return { success: true, messageId: response.data.result.message_id };
    } else {
      console.log('❌ Ошибка отправки уведомления в Telegram бот:', response.data);
      return { success: false, error: response.data };
    }

  } catch (error) {
    console.log('❌ Ошибка при отправке уведомления в Telegram бот:', error.message);
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
