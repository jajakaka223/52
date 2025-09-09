// Simple test API function
export default async function handler(req, res) {
  res.json({ 
    message: 'Test API working',
    method: req.method,
    timestamp: new Date().toISOString()
  });
}
