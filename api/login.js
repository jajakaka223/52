// Vercel API function for login
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Try to connect to Railway first
    const railwayUrl = 'https://52express-transport-app-production.up.railway.app/api/auth/login';
    
    try {
      const response = await fetch(railwayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body)
      });
      
      if (response.ok) {
        const data = await response.json();
        res.json(data);
        return;
      }
    } catch (railwayError) {
      console.log('Railway not available, using local auth');
    }

    // Fallback to local authentication
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
        token: 'vercel-test-token-123'
      });
    } else if (username === 'driver1' && password === 'driver123') {
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: 2,
          username: 'driver1',
          role: 'driver',
          full_name: 'Иван Петров'
        },
        token: 'vercel-test-token-456'
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Error handling login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
