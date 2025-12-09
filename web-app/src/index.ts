/**
 * Market Watcher Web Application
 * User registration, authentication, and watchlist management
 */
import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import { AuthController } from './controllers/auth.controller';
import { WatchlistController } from './controllers/watchlist.controller';
import { AlertsController } from './controllers/alerts.controller';
import { authMiddleware } from './middleware/auth.middleware';

const app = express();
const PORT = 3000;

// Database connection
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'database',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'market_watcher',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize controllers
const authController = new AuthController(pool);
const watchlistController = new WatchlistController(pool);
const alertsController = new AlertsController(pool);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'web-app' });
});

// Authentication routes
app.post('/api/auth/register', (req, res) => authController.register(req, res));
app.post('/api/auth/login', (req, res) => authController.login(req, res));

// Watchlist routes (protected)
app.get('/api/watchlist', authMiddleware, (req, res) =>
  watchlistController.getWatchlist(req, res)
);
app.post('/api/watchlist', authMiddleware, (req, res) =>
  watchlistController.addToWatchlist(req, res)
);
app.delete('/api/watchlist/:symbol', authMiddleware, (req, res) =>
  watchlistController.removeFromWatchlist(req, res)
);

// Alerts routes (protected)
app.get('/api/alerts', authMiddleware, (req, res) =>
  alertsController.getAlerts(req, res)
);
app.patch('/api/alerts/:alertId/read', authMiddleware, (req, res) =>
  alertsController.markAsRead(req, res)
);

// Stock data proxy (to api-handler)
const API_HANDLER_URL = process.env.API_HANDLER_URL || 'http://api-handler:3001';

app.get('/api/stocks/:symbol', authMiddleware, async (req: Request, res: Response) => {
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

app.get('/api/stocks/:symbol/history', authMiddleware, async (req: Request, res: Response) => {
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

    app.listen(PORT, () => {
      console.log(`Web App listening on port ${PORT}`);
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
