const https = require('https');

function testAPI() {
  console.log('🔄 Тестируем API с помощью https модуля...');
  
  // Тестируем Vercel API
  console.log('1. Тестируем Vercel API...');
  const options = {
    hostname: '52express-transport-app.vercel.app',
    port: 443,
    path: '/api/login',
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
    console.log(`Vercel Status: ${res.statusCode}`);
    console.log(`Vercel Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Vercel Response:', data);
      
      // Тестируем Railway API
      console.log('\n2. Тестируем Railway API...');
      testRailway();
    });
  });

  req.on('error', (e) => {
    console.error('Vercel Error:', e.message);
    testRailway();
  });

  req.write(postData);
  req.end();
}

function testRailway() {
  const options = {
    hostname: '52express-transport-app-production.up.railway.app',
    port: 443,
    path: '/health',
    method: 'GET',
  };

  const req = https.request(options, (res) => {
    console.log(`Railway Status: ${res.statusCode}`);
    console.log(`Railway Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Railway Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Railway Error:', e.message);
  });

  req.end();
}

testAPI();
