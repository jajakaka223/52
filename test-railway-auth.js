const https = require('https');

function testRailwayAuth() {
  console.log('🔄 Тестируем Railway API auth endpoints...');
  
  // Тестируем корневой эндпоинт
  console.log('1. Тестируем корневой эндпоинт...');
  testEndpoint('/', (res, data) => {
    console.log(`Root Status: ${res.statusCode}`);
    console.log('Root Response:', data);
    
    // Тестируем /api/auth
    console.log('\n2. Тестируем /api/auth...');
    testEndpoint('/api/auth', (res, data) => {
      console.log(`Auth Status: ${res.statusCode}`);
      console.log('Auth Response:', data);
      
      // Тестируем /api/auth/login
      console.log('\n3. Тестируем /api/auth/login...');
      testLogin();
    });
  });
}

function testEndpoint(path, callback) {
  const options = {
    hostname: '52express-transport-app-production.up.railway.app',
    port: 443,
    path: path,
    method: 'GET',
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      callback(res, data);
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e.message);
  });

  req.end();
}

function testLogin() {
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
      
      if (res.statusCode === 200) {
        console.log('✅ Login работает!');
      } else {
        console.log('❌ Login не работает');
      }
    });
  });

  req.on('error', (e) => {
    console.error('Login Error:', e.message);
  });

  req.write(postData);
  req.end();
}

testRailwayAuth();
