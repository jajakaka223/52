const https = require('https');

function testRailwayServer() {
  console.log('🔄 Тестируем Railway сервер...');
  
  // Тестируем health endpoint
  console.log('1. Тестируем /health...');
  testEndpoint('/health', (res, data) => {
    console.log(`Health Status: ${res.statusCode}`);
    console.log('Health Response:', data);
    
    // Тестируем /api/users
    console.log('\n2. Тестируем /api/users...');
    testEndpoint('/api/users', (res, data) => {
      console.log(`Users Status: ${res.statusCode}`);
      console.log('Users Response:', data);
      
      // Тестируем /api/orders
      console.log('\n3. Тестируем /api/orders...');
      testEndpoint('/api/orders', (res, data) => {
        console.log(`Orders Status: ${res.statusCode}`);
        console.log('Orders Response:', data);
        
        // Тестируем /api/vehicles
        console.log('\n4. Тестируем /api/vehicles...');
        testEndpoint('/api/vehicles', (res, data) => {
          console.log(`Vehicles Status: ${res.statusCode}`);
          console.log('Vehicles Response:', data);
        });
      });
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

testRailwayServer();
