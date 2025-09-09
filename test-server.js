const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Test Server Running', 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Test login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login request:', req.body);
  
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin') {
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: 1,
        username: 'admin',
        role: 'admin',
        full_name: 'Администратор'
      },
      token: 'test-token-123'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
