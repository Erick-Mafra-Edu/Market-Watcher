/**
 * CORS Configuration for Market Watcher API
 * Dynamically configured based on NODE_ENV
 */

export interface CorsConfig {
  development: {
    origin: string;
    credentials: boolean;
    description: string;
  };
  production: {
    origin: string[];
    credentials: boolean;
    description: string;
  };
}

/**
 * CORS Configuration by Environment
 * 
 * DEVELOPMENT:
 * - Allows all origins ('*')
 * - Credentials disabled
 * - Useful for local development with multiple tools (Swagger, Postman, etc)
 * 
 * PRODUCTION:
 * - Allows only specific origins from CORS_ORIGINS environment variable
 * - Falls back to configured allowed origins if variable not set
 * - Credentials enabled for authenticated requests
 */
const corsConfig: CorsConfig = {
  development: {
    origin: '*',
    credentials: false,
    description: 'Development: Allow all origins for testing',
  },
  production: {
    origin: (process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://marketed-watcher.example.com',
    ]),
    credentials: true,
    description: 'Production: Allow only configured origins',
  },
};

export const getCorsConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const config = corsConfig[env as keyof CorsConfig];

  if (!config) {
    console.warn(`Unknown environment: ${env}, falling back to development CORS`);
    return corsConfig.development;
  }

  return config;
};

export const getAllowedMethods = () => [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
];

export const getAllowedHeaders = () => [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
];

export default corsConfig;
