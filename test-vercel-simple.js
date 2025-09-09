const axios = require('axios');

async function testVercelSimple() {
  console.log('🔄 Тестируем простую Vercel API...');
  
  try {
    // Тестируем простую API функцию
    console.log('1. Тестируем /api/hello...');
    const helloResponse = await axios.get('https://52express-transport-app.vercel.app/api/hello');
    console.log('✅ /api/hello:', helloResponse.status, helloResponse.data);
    
    // Тестируем API логина
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

testVercelSimple();