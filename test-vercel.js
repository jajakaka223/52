const axios = require('axios');

async function testVercel() {
  console.log('🔄 Тестируем Vercel...');
  
  try {
    // Тестируем корневой путь
    console.log('1. Тестируем корневой путь...');
    const rootResponse = await axios.get('https://52express-transport-app.vercel.app/');
    console.log('✅ Корневой путь:', rootResponse.status);
    
    // Тестируем API
    console.log('2. Тестируем API...');
    const apiResponse = await axios.post('https://52express-transport-app.vercel.app/api/auth/login', {
      username: 'admin',
      password: 'admin'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ API:', apiResponse.status, apiResponse.data);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

testVercel();
