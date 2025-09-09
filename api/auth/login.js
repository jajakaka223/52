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
    // Forward request to Railway
    const railwayUrl = 'https://52express-transport-app-production.up.railway.app/api/auth/login';
    
    const response = await fetch(railwayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error forwarding to Railway:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
