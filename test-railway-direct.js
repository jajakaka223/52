const https = require('https');

function testRailwayDirect() {
  console.log('🔄 Тестируем Railway API напрямую...');
  
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
      
      if (res.statusCode === 200) {
        console.log('✅ Railway API работает!');
      } else {
        console.log('❌ Railway API не работает');
      }
    });
  });

  req.on('error', (e) => {
    console.error('Railway Login Error:', e.message);
  });

  req.write(postData);
  req.end();
}

testRailwayDirect();
