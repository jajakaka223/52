// API configuration
export const API_BASE_URL = 'https://52express-transport-app-production.up.railway.app';

// Helper function to create full API URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};
