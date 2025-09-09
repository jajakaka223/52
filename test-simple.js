const axios = require('axios');

async function testSimple() {
  console.log('🔄 Тестируем простой API...');
  
  try {
    const response = await axios.get('https://52express-transport-app.vercel.app/api/test');
    console.log('✅ Статус:', response.status);
    console.log('✅ Данные:', response.data);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

testSimple();
