const axios = require('axios');
const { google } = require('googleapis');

/**
 * Отправка уведомления в Telegram о выполненной заявке
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendTelegramNotification(emailAddress, routeInfo, orderData = {}) {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002419921277';
    const THREAD_ID = process.env.TELEGRAM_THREAD_ID || '12493';

    if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
      console.log('⚠️ TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не настроены, уведомление не отправлено');
      return { success: false, error: 'Telegram credentials not configured' };
    }

    const message = {
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      text: `✅ **ЗАЯВКА ВЫПОЛНЕНА**\n\n📧 **Email клиента:** ${emailAddress}\n🛣️ **Маршрут:** ${routeInfo}\n📅 **Дата выполнения:** ${new Date().toLocaleDateString('ru-RU')}\n${orderData.orderId ? `🆔 **ID заявки:** ${orderData.orderId}` : ''}\n${orderData.company ? `🏢 **Компания:** ${orderData.company}` : ''}\n${orderData.clientName ? `👤 **Клиент:** ${orderData.clientName}` : ''}\n${orderData.phone ? `📞 **Телефон:** ${orderData.phone}` : ''}\n\n📧 **Сообщение отправлено клиенту**`,
      parse_mode: 'Markdown'
    };

    console.log('📱 Отправляем уведомление о выполненной заявке в Telegram:', {
      emailAddress,
      routeInfo,
      orderId: orderData.orderId
    });

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    console.log('📤 Отправляем запрос в Telegram API:', {
      url: telegramUrl,
      message: message
    });
    
    const response = await axios.post(telegramUrl, message, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📥 Ответ от Telegram API:', {
      status: response.status,
      data: response.data
    });

    if (response.data.ok) {
      console.log('✅ Уведомление о выполненной заявке успешно отправлено в Telegram');
      return { success: true, messageId: response.data.result.message_id };
    } else {
      console.log('❌ Ошибка отправки уведомления в Telegram:', response.data);
      return { success: false, error: response.data.description || 'Unknown error' };
    }
  } catch (error) {
    console.log('❌ Ошибка при отправке уведомления в Telegram:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправка email с рекомендацией через Gmail API
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendRecommendationEmail(emailAddress, routeInfo, orderData = {}) {
  try {
    const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
    const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
    const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
    const GMAIL_USER_EMAIL = process.env.GMAIL_USER_EMAIL || 'gruzoperevozki436@gmail.com';

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      console.log('⚠️ Gmail API credentials не настроены, email не отправлен');
      return { success: false, error: 'Gmail API credentials not configured' };
    }

    console.log('📧 Отправляем email с рекомендацией через Gmail API:', {
      emailAddress,
      routeInfo,
      orderId: orderData.orderId,
      fromEmail: GMAIL_USER_EMAIL
    });

    // Настройка OAuth2 клиента
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Проверяем, с какого аккаунта отправляются письма
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('📧 Gmail профиль:', {
        emailAddress: profile.data.emailAddress,
        expectedEmail: GMAIL_USER_EMAIL,
        match: profile.data.emailAddress === GMAIL_USER_EMAIL
      });
    } catch (error) {
      console.log('⚠️ Не удалось получить профиль Gmail:', error.message);
    }

    // Создание email сообщения
    const emailSubject = `Заявка по маршруту ${routeInfo} выполнена`;
    const emailBody = `
    <html>
        <body>
            <p>Доброго времени суток, благодарим за проявленное доверие и надеемся на дальнейшее сотрудничество.</p>
            <p>Заявка по маршруту <strong>"${routeInfo}"</strong> выполнена успешно, оплату от Вас получили.</p>
            <br>
            <p><strong>Просим оставить рекомендацию на нашем профиле ATI - <a href="https://ati.su/firms/5308606">https://ati.su/firms/5308606</a>, так же от нас последует ответная рекомендация.</strong></p>
            <br>
            <p>Желаем успехов Вам и Вашему бизнесу.</p>
            <p><strong>С уважением команда "52 EXPRESS"</strong></p>
        </body>
    </html>
    `;

    // Правильное кодирование темы письма в UTF-8
    const encodedSubject = `=?UTF-8?B?${Buffer.from(emailSubject, 'utf8').toString('base64')}?=`;

    // Кодирование email в base64
    const emailLines = [
      `From: 52 EXPRESS <${GMAIL_USER_EMAIL}>`,
      `To: ${emailAddress}`,
      `Subject: ${encodedSubject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      emailBody
    ];

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Отправка email
    console.log('📤 Отправляем email через Gmail API:', {
      to: emailAddress,
      subject: emailSubject
    });
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log('📥 Ответ от Gmail API:', {
      messageId: result.data.id,
      result: result.data
    });

    console.log('✅ Email с рекомендацией успешно отправлен через Gmail API');
    return { success: true, messageId: result.data.id };

  } catch (error) {
    console.log('❌ Ошибка при отправке email через Gmail API:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция для отправки уведомления о выполненной заявке
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendCompletionNotification(emailAddress, routeInfo, orderData = {}) {
  try {
    // Отладочная информация о переменных окружения
    console.log('🔍 Переменные окружения для уведомлений:', {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'настроен' : 'не настроен',
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || 'не настроен',
      TELEGRAM_THREAD_ID: process.env.TELEGRAM_THREAD_ID || 'не настроен',
      GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? 'настроен' : 'не настроен',
      GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? 'настроен' : 'не настроен',
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? 'настроен' : 'не настроен',
      GMAIL_USER_EMAIL: process.env.GMAIL_USER_EMAIL || 'не настроен',
      PYTHON_BOT_SERVER: process.env.PYTHON_BOT_SERVER || 'не настроен'
    });

    // Отправляем уведомление в Telegram
    const telegramResult = await sendTelegramNotification(emailAddress, routeInfo, orderData);
    
    // Отправляем email с рекомендацией
    const emailResult = await sendRecommendationEmail(emailAddress, routeInfo, orderData);

    return {
      success: telegramResult.success && emailResult.success,
      telegram: telegramResult,
      email: emailResult
    };
  } catch (error) {
    console.log('❌ Ошибка при отправке уведомления о выполненной заявке:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправка уведомления о выполненной заявке (алиас для совместимости)
 * @param {string} emailAddress - email адрес клиента
 * @param {string} routeInfo - информация о маршруте
 * @param {Object} orderData - дополнительные данные заявки
 */
async function sendCompletionEmail(emailAddress, routeInfo, orderData = {}) {
  return await sendCompletionNotification(emailAddress, routeInfo, orderData);
}

/**
 * Тестовая функция для проверки Telegram API
 */
async function testTelegramAPI() {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002419921277';
    const THREAD_ID = process.env.TELEGRAM_THREAD_ID || '12493';

    if (!TELEGRAM_BOT_TOKEN) {
      console.log('❌ TELEGRAM_BOT_TOKEN не настроен');
      return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
    }

    console.log('🧪 Тестируем Telegram API...');
    console.log('🔍 Настройки:', { CHAT_ID, THREAD_ID });

    // Сначала проверим информацию о боте
    const botInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const botInfoResponse = await axios.get(botInfoUrl);
    console.log('🤖 Информация о боте:', botInfoResponse.data);

    // Проверим информацию о чате
    const chatInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`;
    const chatInfoResponse = await axios.post(chatInfoUrl, { chat_id: CHAT_ID });
    console.log('💬 Информация о чате:', chatInfoResponse.data);

    // Отправим тестовое сообщение
    const testMessage = {
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      text: '🧪 ТЕСТОВОЕ СООБЩЕНИЕ - проверка работы бота',
      parse_mode: 'Markdown'
    };

    const testUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const testResponse = await axios.post(testUrl, testMessage);
    console.log('📤 Тестовое сообщение отправлено:', testResponse.data);

    return { success: true, data: testResponse.data };
  } catch (error) {
    console.log('❌ Ошибка тестирования Telegram API:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

module.exports = {
  sendCompletionNotification,
  sendCompletionEmail,
  sendTelegramNotification,
  sendRecommendationEmail,
  testTelegramAPI
};