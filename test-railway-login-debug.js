const https = require('https');

function testRailwayLoginDebug() {
  console.log('🔄 Тестируем Railway login с отладкой...');
  
  const options = {
    hostname: '52express-transport-app-production.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const postData = JSON.stringify({
    username: 'admin',
    password: 'admin'
  });

  const req = https.request(options, (res) => {
    console.log(`Login Status: ${res.statusCode}`);
    console.log(`Login Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Login Response:', data);
      
      // Пробуем с неверными данными
      console.log('\n🔄 Тестируем с неверными данными...');
      testInvalidLogin();
    });
  });

  req.on('error', (e) => {
    console.error('Login Error:', e.message);
  });

  req.write(postData);
  req.end();
}

function testInvalidLogin() {
  const options = {
    hostname: '52express-transport-app-production.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const postData = JSON.stringify({
    username: 'wrong',
    password: 'wrong'
  });

  const req = https.request(options, (res) => {
    console.log(`Invalid Login Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Invalid Login Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Invalid Login Error:', e.message);
  });

  req.write(postData);
  req.end();
}

testRailwayLoginDebug();
