const axios = require('axios');

async function testVercelAPI() {
  console.log('🔄 Тестируем Vercel API...');
  
  try {
    // Тестируем корневой путь
    console.log('1. Тестируем корневой путь...');
    const rootResponse = await axios.get('https://52express-transport-app.vercel.app/');
    console.log('✅ Корневой путь:', rootResponse.status);
    
    // Тестируем API напрямую
    console.log('2. Тестируем API напрямую...');
    const apiResponse = await axios.get('https://52express-transport-app.vercel.app/api/test');
    console.log('✅ API:', apiResponse.status, apiResponse.data);
    
    // Тестируем API через переписывание
    console.log('3. Тестируем API через переписывание...');
    const loginResponse = await axios.post('https://52express-transport-app.vercel.app/api/auth/login', {
      username: 'admin',
      password: 'admin'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Login API:', loginResponse.status, loginResponse.data);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

testVercelAPI();
