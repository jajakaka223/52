// API configuration
export const API_BASE_URL = ''; // Use relative URLs for Vercel API functions

// Helper function to create full API URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `/${cleanEndpoint}`;
};
