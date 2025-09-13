// API configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE_URL = isDevelopment
  ? 'http://localhost:3000'
  : 'https://web-production-7cfec.up.railway.app'; // Railway URL

// Helper function to create full API URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const fullUrl = `${API_BASE_URL}/${cleanEndpoint}`;
  
  // Отладочная информация
  console.log('🔗 API URL:', fullUrl);
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('🔧 REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
  
  return fullUrl;
};

export { API_BASE_URL };
