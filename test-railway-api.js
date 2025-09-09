const https = require('https');

// Тестируем Railway API напрямую
const testRailwayAPI = () => {
  const postData = JSON.stringify({
    username: 'admin',
    password: 'admin'
  });

  const options = {
    hostname: '52express-transport-app-production.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('🔄 Тестируем Railway API...');
  console.log('URL:', `https://${options.hostname}${options.path}`);

  const req = https.request(options, (res) => {
    console.log('✅ Статус ответа:', res.statusCode);
    console.log('✅ Заголовки:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('✅ Тело ответа:', data);
      if (res.statusCode === 200) {
        console.log('🎉 Railway API работает!');
      } else {
        console.log('❌ Railway API не работает');
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Ошибка запроса:', e.message);
  });

  req.write(postData);
  req.end();
};

testRailwayAPI();

