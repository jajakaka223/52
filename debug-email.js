const { pool } = require('./config/database');
const nodemailer = require('nodemailer');

async function debugEmail() {
  try {
    console.log('🔍 Отладка отправки email...');
    
    // Получаем заявку с email
    const orders = await pool.query(`
      SELECT * FROM orders 
      WHERE email IS NOT NULL AND email != '' 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (orders.rows.length === 0) {
      console.log('❌ Нет заявок с email в базе данных');
      return;
    }
    
    const order = orders.rows[0];
    console.log('📋 Найдена заявка с email:', {
      id: order.id,
      status: order.status,
      email: order.email,
      direction: order.direction,
      company: order.company,
      client_name: order.client_name
    });
    
    // Тестируем отправку email точно как в коде
    console.log('📧 Тестируем отправку email...');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'gruzoperevozki436@gmail.com',
        pass: 'epah mwoe ynia xfjc'
      }
    });

    // Извлекаем направление в формате Откуда → Куда (как в коде)
    const firstLine = String(order.direction || '').split('\n')[0] || '';
    const [fromCity, toCity] = firstLine.split(' → ');
    const subject = `Заявка по маршруту "${fromCity || ''} - ${toCity || ''}" выполнена успешно.`;
    const text = 'Спасибо.';

    console.log('📝 Данные для email:', {
      from: 'gruzoperevozki436@gmail.com',
      to: order.email,
      subject,
      text,
      firstLine,
      fromCity,
      toCity
    });

    const mailOptions = {
      from: 'gruzoperevozki436@gmail.com',
      to: order.email,
      subject,
      text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email отправлен успешно:', info.messageId);
    console.log('📧 Email отправлен на:', order.email);
    
  } catch (error) {
    console.error('❌ Ошибка отправки email:', error.message);
    console.error('Детали:', error);
  } finally {
    await pool.end();
  }
}

debugEmail();
