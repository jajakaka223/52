const axios = require('axios');

async function testVercelAPIDirect() {
  console.log('🔄 Тестируем Vercel API напрямую...');
  
  try {
    // Тестируем API напрямую
    console.log('1. Тестируем /api/test...');
    const testResponse = await axios.get('https://52express-transport-app.vercel.app/api/test');
    console.log('✅ /api/test:', testResponse.status, testResponse.data);
    
    // Тестируем API напрямую
    console.log('2. Тестируем /api/login...');
    const loginResponse = await axios.post('https://52express-transport-app.vercel.app/api/login', {
      username: 'admin',
      password: 'admin'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ /api/login:', loginResponse.status, loginResponse.data);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

testVercelAPIDirect();