/**
 * Market Watcher Web Application
 * User registration, authentication, and watchlist management
 */
import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import axios from 'axios';
import swaggerUi from 'swagger-ui-express';
import { AuthController } from './controllers/auth.controller';
import { WatchlistController } from './controllers/watchlist.controller';
import { AlertsController } from './controllers/alerts.controller';
import { NewsController } from './controllers/news.controller';
import { PortfolioController } from './controllers/portfolio.controller';
import { AssetsController } from './controllers/assets.controller';
import { authMiddleware } from './middleware/auth.middleware';
import swaggerSpecs, { generateOpenAPIFile } from './swagger';

const app = express();
const PORT = 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// Database connection
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'database',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'market_watcher',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

// Trust proxy — required when running behind a reverse proxy or Docker network
// so that express-rate-limit reads the correct client IP from X-Forwarded-For.
const trustProxySetting = process.env.TRUST_PROXY ?? '1';
if (trustProxySetting === 'true' || trustProxySetting === '1') {
  app.set('trust proxy', 1);
} else if (trustProxySetting !== 'false' && trustProxySetting !== '0') {
  app.set('trust proxy', trustProxySetting);
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS configuration - dynamic based on environment
const corsOptions = {
  origin: isDevelopment 
    ? '*' // Allow all origins in development
    : (process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      ]),
  credentials: !isDevelopment,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Log CORS configuration in development
if (isDevelopment) {
  console.log('✓ CORS: Allow all origins (Development mode)');
} else {
  console.log(`✓ CORS: Allowed origins: ${corsOptions.origin}`);
}

// Swagger UI documentation
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', swaggerUi.setup(swaggerSpecs, {
  swaggerOptions: {
    url: 'http://localhost:3000/openapi.json',
  },
  customCss: '.swagger-ui { background-color: #fafafa; }',
}));

// OpenAPI specification endpoint (without auth for documentation)
app.get('/openapi.json', (req: Request, res: Response) => {
  // Add CORS headers explicitly
  if (isDevelopment) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpecs);
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for API endpoints
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize controllers
const authController = new AuthController(pool);
const watchlistController = new WatchlistController(pool);
const alertsController = new AlertsController(pool);
const newsController = new NewsController(pool);
const portfolioController = new PortfolioController(pool);
const assetsController = new AssetsController(pool);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'web-app' });
});

// Authentication routes (rate limited)
app.post('/api/auth/register', authLimiter, (req, res) => authController.register(req, res));
app.post('/api/auth/login', authLimiter, (req, res) => authController.login(req, res));

// Watchlist routes (protected and rate limited)
app.get('/api/watchlist', authMiddleware, apiLimiter, (req, res) =>
  watchlistController.getWatchlist(req, res)
);
app.post('/api/watchlist', authMiddleware, apiLimiter, (req, res) =>
  watchlistController.addToWatchlist(req, res)
);
app.delete('/api/watchlist/:symbol', authMiddleware, apiLimiter, (req, res) =>
  watchlistController.removeFromWatchlist(req, res)
);

// Alerts routes (protected and rate limited)
app.get('/api/alerts', authMiddleware, apiLimiter, (req, res) =>
  alertsController.getAlerts(req, res)
);
app.patch('/api/alerts/:alertId/read', authMiddleware, apiLimiter, (req, res) =>
  alertsController.markAsRead(req, res)
);

// News routes (protected and rate limited)
app.get('/api/news', authMiddleware, apiLimiter, (req, res) =>
  newsController.getNews(req, res)
);
app.get('/api/news/stats', authMiddleware, apiLimiter, (req, res) =>
  newsController.getSentimentStats(req, res)
);
app.get('/api/news/stock/:symbol', authMiddleware, apiLimiter, (req, res) =>
  newsController.getStockNews(req, res)
);

// Tracked assets routes (protected and rate limited)
app.get('/api/assets', authMiddleware, apiLimiter, (req, res) =>
  assetsController.getAssets(req, res)
);
app.post('/api/assets', authMiddleware, apiLimiter, (req, res) =>
  assetsController.addAsset(req, res)
);
app.delete('/api/assets/:symbol', authMiddleware, apiLimiter, (req, res) =>
  assetsController.removeAsset(req, res)
);

// Portfolio routes (protected and rate limited)
app.get('/api/portfolio', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.getPortfolio(req, res)
);
app.post('/api/portfolio/transaction', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.addTransaction(req, res)
);
app.put('/api/portfolio/transaction/:transactionId', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.updateTransaction(req, res)
);
app.get('/api/portfolio/transactions', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.getTransactions(req, res)
);
app.delete('/api/portfolio/transaction/:transactionId', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.deleteTransaction(req, res)
);
app.delete('/api/portfolio/position/:symbol', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.deletePosition(req, res)
);
app.get('/api/portfolio/performance', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.getPerformance(req, res)
);
app.get('/api/portfolio/dividends', authMiddleware, apiLimiter, (req, res) =>
  portfolioController.getDividends(req, res)
);

// Stock data proxy (to api-handler) - protected and rate limited
const API_HANDLER_URL = process.env.API_HANDLER_URL || 'http://api-handler:3001';

app.get('/api/stocks/:symbol', authMiddleware, apiLimiter, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const response = await axios.get(`${API_HANDLER_URL}/api/stock/${symbol}`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching stock data:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch stock data',
    });
  }
});

app.get('/api/stocks/:symbol/history', authMiddleware, apiLimiter, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { period1, period2 } = req.query;
    const response = await axios.get(`${API_HANDLER_URL}/api/stock/${symbol}/history`, {
      params: { period1, period2 },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching stock history:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch stock history',
    });
  }
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');

    // Generate OpenAPI specification file
    generateOpenAPIFile();

    app.listen(PORT, () => {
      console.log(`Web App listening on port ${PORT}`);
      console.log(`📚 Swagger UI available at http://localhost:${PORT}/api/docs`);
      console.log(`📄 OpenAPI spec available at http://localhost:${PORT}/openapi.json`);
    });
  } catch (error) {
    console.error('Failed to start Web App:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Web App...');
  await pool.end();
  process.exit(0);
});

startServer();
