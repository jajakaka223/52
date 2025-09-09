const https = require('https');

function testRailwayEnv() {
  console.log('🔄 Тестируем Railway переменные окружения...');
  
  // Создаем простой эндпоинт для проверки переменных окружения
  const options = {
    hostname: '52express-transport-app-production.up.railway.app',
    port: 443,
    path: '/api/utils/public-config',
    method: 'GET',
  };

  const req = https.request(options, (res) => {
    console.log(`Env Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Env Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Env Error:', e.message);
  });

  req.end();
}

testRailwayEnv();
