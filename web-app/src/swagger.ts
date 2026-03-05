/**
 * Swagger/OpenAPI Configuration
 * Generates OpenAPI 3.0 specification for the Market Watcher API
 */
import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Market Watcher API',
      description: 'Complete API for stock market monitoring, portfolio management, and financial news aggregation',
      version: '1.0.0',
      contact: {
        name: 'Market Watcher Support',
        url: 'https://github.com/Erick-Mafra-Edu/Market-Watcher',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.marketwatcher.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token. Include in Authorization header as: Bearer <token>',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User unique identifier' },
            email: { type: 'string', format: 'email', description: 'User email address' },
            password: { type: 'string', format: 'password', description: 'User password (only for registration/login)' },
            created_at: { type: 'string', format: 'date-time', description: 'Account creation timestamp' },
          },
          required: ['email', 'password'],
        },
        Stock: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Stock ticker symbol (e.g., PETR4, VALE3)' },
            name: { type: 'string', description: 'Company name' },
            price: { type: 'number', format: 'double', description: 'Current stock price' },
            previousClose: { type: 'number', format: 'double', description: 'Previous closing price' },
            change: { type: 'number', format: 'double', description: 'Price change in absolute value' },
            changePercent: { type: 'number', format: 'double', description: 'Price change percentage' },
            high52Week: { type: 'number', format: 'double', description: '52-week high price' },
            low52Week: { type: 'number', format: 'double', description: '52-week low price' },
            marketCap: { type: 'string', description: 'Market capitalization' },
            volume: { type: 'integer', description: 'Trading volume' },
            lastUpdate: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
          },
        },
        Watchlist: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Watchlist item identifier' },
            user_id: { type: 'string', description: 'User ID who owns this watchlist' },
            symbol: { type: 'string', description: 'Stock ticker symbol' },
            added_at: { type: 'string', format: 'date-time', description: 'Date when stock was added to watchlist' },
          },
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Alert identifier' },
            user_id: { type: 'string', description: 'User ID who owns this alert' },
            symbol: { type: 'string', description: 'Stock ticker symbol' },
            type: { type: 'string', enum: ['price_above', 'price_below', 'large_move', 'news'], description: 'Type of alert' },
            threshold: { type: 'number', format: 'double', description: 'Alert threshold value' },
            is_read: { type: 'boolean', description: 'Whether alert has been read' },
            created_at: { type: 'string', format: 'date-time', description: 'Alert creation timestamp' },
          },
        },
        News: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'News item identifier' },
            title: { type: 'string', description: 'News headline' },
            description: { type: 'string', description: 'News summary or body' },
            source: { type: 'string', description: 'News source' },
            url: { type: 'string', format: 'uri', description: 'Link to full article' },
            symbol: { type: 'string', description: 'Related stock symbol' },
            sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'], description: 'Sentiment analysis result' },
            sentiment_score: { type: 'number', format: 'double', description: 'Sentiment score from -1 to 1' },
            published_at: { type: 'string', format: 'date-time', description: 'Publication timestamp' },
          },
        },
        Portfolio: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Portfolio identifier' },
            user_id: { type: 'string', description: 'User ID who owns this portfolio' },
            total_value: { type: 'number', format: 'double', description: 'Total portfolio value' },
            total_cost: { type: 'number', format: 'double', description: 'Total cost basis' },
            total_gain: { type: 'number', format: 'double', description: 'Total gain/loss' },
            gain_percentage: { type: 'number', format: 'double', description: 'Total gain/loss percentage' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Transaction identifier' },
            portfolio_id: { type: 'string', description: 'Related portfolio ID' },
            symbol: { type: 'string', description: 'Stock ticker symbol' },
            type: { type: 'string', enum: ['buy', 'sell', 'dividend'], description: 'Transaction type' },
            quantity: { type: 'number', format: 'double', description: 'Number of shares' },
            price: { type: 'number', format: 'double', description: 'Price per share' },
            total_amount: { type: 'number', format: 'double', description: 'Total transaction amount' },
            transaction_date: { type: 'string', format: 'date-time', description: 'Date of transaction' },
          },
        },
        Asset: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Asset identifier' },
            user_id: { type: 'string', description: 'User ID who owns this asset' },
            symbol: { type: 'string', description: 'Stock ticker symbol' },
            quantity: { type: 'number', format: 'double', description: 'Number of shares owned' },
            average_price: { type: 'number', format: 'double', description: 'Average purchase price' },
            current_price: { type: 'number', format: 'double', description: 'Current market price' },
            total_value: { type: 'number', format: 'double', description: 'Total current value' },
            gain_loss: { type: 'number', format: 'double', description: 'Unrealized gain/loss' },
            gain_loss_percentage: { type: 'number', format: 'double', description: 'Unrealized gain/loss percentage' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            statusCode: { type: 'integer', description: 'HTTP status code' },
            timestamp: { type: 'string', format: 'date-time', description: 'Error timestamp' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        TooManyRequestsError: {
          description: 'Too many requests - rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check endpoint',
          description: 'Check if the API is running and healthy',
          tags: ['System'],
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      service: { type: 'string', example: 'web-app' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/register': {
        post: {
          summary: 'Register a new user',
          description: 'Create a new user account with email and password',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', format: 'password', example: 'SecurePassword123!' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User successfully registered',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'user-123' },
                      email: { type: 'string', example: 'user@example.com' },
                      message: { type: 'string', example: 'User registered successfully' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid input or user already exists' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Login user',
          description: 'Authenticate user and receive JWT token',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', format: 'password', example: 'SecurePassword123!' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string', description: 'JWT authentication token' },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Invalid credentials' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/watchlist': {
        get: {
          summary: 'Get user watchlist',
          description: 'Retrieve all stocks in the user\'s watchlist',
          tags: ['Watchlist'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Watchlist retrieved successfully',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Watchlist' } },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
        post: {
          summary: 'Add stock to watchlist',
          description: 'Add a new stock to the user\'s watchlist',
          tags: ['Watchlist'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['symbol'],
                  properties: {
                    symbol: { type: 'string', example: 'PETR4' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Stock added to watchlist',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Watchlist' },
                },
              },
            },
            '400': { description: 'Invalid symbol or already in watchlist' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/watchlist/{symbol}': {
        delete: {
          summary: 'Remove stock from watchlist',
          description: 'Remove a stock from the user\'s watchlist',
          tags: ['Watchlist'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'PETR4' },
            },
          ],
          responses: {
            '204': { description: 'Stock removed from watchlist' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/alerts': {
        get: {
          summary: 'Get user alerts',
          description: 'Retrieve all alerts for the authenticated user',
          tags: ['Alerts'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'is_read',
              in: 'query',
              schema: { type: 'boolean' },
              description: 'Filter by read status',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 50 },
              description: 'Number of alerts to return',
            },
          ],
          responses: {
            '200': {
              description: 'Alerts retrieved successfully',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Alert' } },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/alerts/{alertId}/read': {
        patch: {
          summary: 'Mark alert as read',
          description: 'Update alert status to read',
          tags: ['Alerts'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'alertId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Alert marked as read',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Alert' },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/news': {
        get: {
          summary: 'Get financial news',
          description: 'Retrieve latest financial news with sentiment analysis',
          tags: ['News'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 50 },
              description: 'Number of news items to return',
            },
            {
              name: 'sentiment',
              in: 'query',
              schema: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
              description: 'Filter by sentiment',
            },
          ],
          responses: {
            '200': {
              description: 'News retrieved successfully',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/News' } },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/news/stats': {
        get: {
          summary: 'Get sentiment statistics',
          description: 'Get aggregated sentiment statistics for financial news',
          tags: ['News'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Sentiment statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      positive_count: { type: 'integer' },
                      negative_count: { type: 'integer' },
                      neutral_count: { type: 'integer' },
                      average_sentiment: { type: 'number' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/news/stock/{symbol}': {
        get: {
          summary: 'Get news for specific stock',
          description: 'Retrieve news articles related to a specific stock',
          tags: ['News'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'PETR4' },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
          ],
          responses: {
            '200': {
              description: 'Stock news retrieved successfully',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/News' } },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/assets': {
        get: {
          summary: 'Get tracked assets',
          description: 'Retrieve all assets tracked by the user',
          tags: ['Assets'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Assets retrieved successfully',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Asset' } },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
        post: {
          summary: 'Add new asset',
          description: 'Add a new asset to track',
          tags: ['Assets'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['symbol', 'quantity'],
                  properties: {
                    symbol: { type: 'string', example: 'PETR4' },
                    quantity: { type: 'number', example: 100.5 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Asset added successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Asset' },
                },
              },
            },
            '400': { description: 'Invalid input' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/assets/{symbol}': {
        delete: {
          summary: 'Remove asset',
          description: 'Remove an asset from tracking',
          tags: ['Assets'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'PETR4' },
            },
          ],
          responses: {
            '204': { description: 'Asset removed successfully' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio': {
        get: {
          summary: 'Get portfolio summary',
          description: 'Retrieve portfolio overview with totals and statistics',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Portfolio summary retrieved',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Portfolio' },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio/transaction': {
        post: {
          summary: 'Add transaction',
          description: 'Record a buy, sell, or dividend transaction',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['symbol', 'type', 'quantity', 'price', 'transaction_date'],
                  properties: {
                    symbol: { type: 'string', example: 'PETR4' },
                    type: { type: 'string', enum: ['buy', 'sell', 'dividend'] },
                    quantity: { type: 'number', example: 100 },
                    price: { type: 'number', example: 28.5 },
                    transaction_date: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Transaction created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Transaction' },
                },
              },
            },
            '400': { description: 'Invalid transaction data' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio/transaction/{transactionId}': {
        put: {
          summary: 'Update transaction',
          description: 'Modify an existing transaction',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'transactionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transaction' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Transaction updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Transaction' },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
        delete: {
          summary: 'Delete transaction',
          description: 'Remove a transaction',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'transactionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '204': { description: 'Transaction deleted successfully' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio/transactions': {
        get: {
          summary: 'Get portfolio transactions',
          description: 'Retrieve all transactions for the user\'s portfolio',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by stock symbol',
            },
            {
              name: 'type',
              in: 'query',
              schema: { type: 'string', enum: ['buy', 'sell', 'dividend'] },
              description: 'Filter by transaction type',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 100 },
            },
          ],
          responses: {
            '200': {
              description: 'Transactions retrieved successfully',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio/position/{symbol}': {
        delete: {
          summary: 'Delete portfolio position',
          description: 'Remove all shares of a specific stock from portfolio',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'PETR4' },
            },
          ],
          responses: {
            '204': { description: 'Position deleted successfully' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio/performance': {
        get: {
          summary: 'Get portfolio performance',
          description: 'Retrieve performance metrics and statistics',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              schema: { type: 'string', enum: ['1d', '1w', '1m', '3m', '6m', '1y', 'all'], default: '1m' },
              description: 'Time period for performance',
            },
          ],
          responses: {
            '200': {
              description: 'Performance data retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total_return: { type: 'number' },
                      total_return_percentage: { type: 'number' },
                      best_position: { type: 'object' },
                      worst_position: { type: 'object' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/portfolio/dividends': {
        get: {
          summary: 'Get portfolio dividends',
          description: 'Retrieve dividend transactions and summary',
          tags: ['Portfolio'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Dividends retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total_dividends: { type: 'number' },
                      dividend_transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/stocks/{symbol}': {
        get: {
          summary: 'Get stock data',
          description: 'Retrieve current stock price and information from multiple providers',
          tags: ['Stocks'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'PETR4' },
            },
          ],
          responses: {
            '200': {
              description: 'Stock data retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Stock' },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
      '/api/stocks/{symbol}/history': {
        get: {
          summary: 'Get stock price history',
          description: 'Retrieve historical stock prices for a given period',
          tags: ['Stocks'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'symbol',
              in: 'path',
              required: true,
              schema: { type: 'string', example: 'PETR4' },
            },
            {
              name: 'period1',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'date-time' },
              description: 'Start date in ISO format',
            },
            {
              name: 'period2',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'date-time' },
              description: 'End date in ISO format',
            },
          ],
          responses: {
            '200': {
              description: 'Historical data retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string', format: 'date-time' },
                        open: { type: 'number' },
                        high: { type: 'number' },
                        low: { type: 'number' },
                        close: { type: 'number' },
                        volume: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '429': { $ref: '#/components/responses/TooManyRequestsError' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [],
};

const specs = swaggerJsdoc(options);

// Save OpenAPI specification to file
export const generateOpenAPIFile = () => {
  const outputPath = path.join(__dirname, '../public/openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));
  console.log(`✓ OpenAPI specification generated at ${outputPath}`);
};

export default specs;
