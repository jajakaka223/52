const https = require('https');

function testRailwayLogin() {
  console.log('🔄 Тестируем Railway API для логина...');
  
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
    console.log(`Railway Login Status: ${res.statusCode}`);
    console.log(`Railway Login Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Railway Login Response:', data);
      
      // Тестируем через Vercel
      console.log('\n🔄 Тестируем через Vercel...');
      testVercelProxy();
    });
  });

  req.on('error', (e) => {
    console.error('Railway Login Error:', e.message);
  });

  req.write(postData);
  req.end();
}

function testVercelProxy() {
  const options = {
    hostname: '52express-transport-app.vercel.app',
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
    console.log(`Vercel Proxy Status: ${res.statusCode}`);
    console.log(`Vercel Proxy Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Vercel Proxy Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Vercel Proxy Error:', e.message);
  });

  req.write(postData);
  req.end();
}

testRailwayLogin();
