# New Features Documentation

## Overview

This document describes the new features added to Market Watcher based on user requirements.

## Features Implemented

### 1. News Screen with Sentiment Analysis 📰

**Location:** Dashboard → News Tab

**Features:**
- Real-time news feed from GNews API
- Sentiment analysis for each article:
  - 📈 **Positive** - Green badge (score > 0.2)
  - 📉 **Negative** - Red badge (score < -0.2)
  - ➖ **Neutral** - Gray badge (between -0.2 and 0.2)
- Filter by sentiment (All/Positive/Neutral/Negative)
- Sentiment statistics dashboard showing distribution
- Related stocks displayed for each article
- Click to open full article in new tab

**API Endpoints:**
```
GET /api/news?limit=50&sentiment=positive
GET /api/news/stats
GET /api/news/stock/:symbol
```

**Sentiment Analysis:**
- NLP-based algorithm using positive/negative word dictionaries
- Handles intensity modifiers (very, extremely, significantly)
- Supports negation (not, never, no)
- Score range: -1 (very negative) to +1 (very positive)
- Confidence scoring based on sentiment word density

### 2. Portfolio Tracking & Management 💼

**Location:** Dashboard → Portfolio Tab

**Features:**
- **Position Tracking:**
  - View all stock holdings with real-time prices
  - Profit/Loss calculations ($ and %)
  - Average cost basis tracking
  - Current market value
  - Dividend yield display

- **Transaction Management:**
  - Record BUY/SELL transactions
  - Track quantity, price, and date
  - Add optional notes
  - Complete transaction history

- **Portfolio Summary:**
  - Total invested amount
  - Current portfolio value
  - Total profit/loss
  - Return percentage

**API Endpoints:**
```
GET /api/portfolio
POST /api/portfolio/transaction
GET /api/portfolio/transactions?symbol=AAPL
GET /api/portfolio/dividends
```

**Database Tables:**
- `user_portfolio` - Transaction history
- `dividend_history` - Dividend tracking

### 3. Dividend History 💰

**Location:** Portfolio Tab → Dividend History Card

**Features:**
- Ex-dividend dates
- Dividend amount per share
- Estimated payment based on holdings
- Dividend type (Regular, Special, etc.)
- Integrated with StatusInvest scraping

### 4. Interactive Dashboard 📊

**Location:** Dashboard Tab

**Features:**
- **Portfolio Statistics:**
  - Total portfolio value
  - Total profit/loss
  - Watchlist stock count
  - Unread alerts count

- **Latest News:** 5 most recent articles with sentiment
- **Top Movers:** Stocks with significant price changes (ready for implementation)

### 5. Enhanced Watchlist 👀

**Location:** Watchlist Tab

**Features:**
- Add stocks with custom alert thresholds
- Remove stocks from watchlist
- View configured alert percentages
- Integration with Yahoo Finance API

### 6. Modern UI with Lucide Icons ✨

**Technology:**
- Lucide Icons (vanilla JS version, CDN)
- Chart.js for future chart visualizations
- Responsive grid layout
- Gradient color schemes
- Professional card-based design

**Icon Usage:**
- `trending-up` - Dashboard, positive trends
- `trending-down` - Negative trends
- `newspaper` - News section
- `briefcase` - Portfolio
- `eye` - Watchlist
- `bell` - Alerts
- `coins` - Dividends
- And many more throughout the interface

### 7. Comprehensive Testing 🧪

**Test Framework:** Jest + ts-jest + supertest

**Test Coverage:**
- **NewsController Tests** (8 tests)
  - News fetching with filters
  - Stock-specific news
  - Sentiment statistics
  - Error handling

- **PortfolioController Tests** (11 tests)
  - Portfolio retrieval
  - Transaction management
  - Buy/Sell operations
  - Dividend information
  - Stock creation on first transaction

- **SentimentAnalyzer Tests** (19 tests)
  - Positive/negative/neutral detection
  - Intensity modifiers
  - Negation handling
  - Edge cases
  - Confidence scoring

**Running Tests:**
```bash
# Web App Tests
cd web-app
npm test

# Notifier Service Tests
cd notifier-service
npm test

# Watch mode
npm run test:watch
```

## Technical Architecture

### Sentiment Analysis Algorithm

```typescript
// Example usage
const analyzer = new SentimentAnalyzer();
const result = analyzer.analyzeNews(
  "Stock surges with strong earnings",
  "Company reports record-breaking profits"
);

// Result: { score: 0.85, label: 'positive', confidence: 0.95 }
```

**How it works:**
1. Text is tokenized into words
2. Each word is checked against positive/negative dictionaries
3. Intensity modifiers adjust scores (e.g., "very strong" = 1.5x)
4. Negations flip sentiment (e.g., "not good" becomes negative)
5. Final score is normalized to -1 to +1 range
6. Label is assigned based on thresholds

### Database Schema

**New Tables:**

```sql
-- Portfolio transactions
CREATE TABLE user_portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    stock_id INTEGER REFERENCES stocks(id),
    quantity DECIMAL(15, 4),
    purchase_price DECIMAL(15, 2),
    purchase_date TIMESTAMP,
    transaction_type VARCHAR(10), -- BUY or SELL
    notes TEXT
);

-- Dividend tracking
CREATE TABLE dividend_history (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    dividend_amount DECIMAL(15, 4),
    ex_date DATE,
    payment_date DATE,
    dividend_type VARCHAR(50)
);
```

**Existing Tables Enhanced:**
- `news_articles.sentiment_score` - Now populated by sentiment analyzer
- Indexes added for optimal query performance

## UI Screenshots

### Dashboard
- 4 stat cards with gradient backgrounds
- Latest news with sentiment badges
- Portfolio summary
- Responsive grid layout

### News Screen
- Sentiment filter dropdown
- 3 stat cards showing positive/negative/neutral distribution
- News items with:
  - Sentiment badge
  - Related stocks
  - Source and date
  - Click to read full article

### Portfolio Screen
- 4 summary stat cards
- Position cards showing:
  - Stock symbol and name
  - Current price and P/L
  - Quantity and average cost
  - Current value and dividend yield
- Add transaction modal with form
- Dividend history table

## Usage Examples

### Adding a Stock Transaction

1. Go to Portfolio tab
2. Click "Add Transaction" button
3. Fill in the form:
   - Stock Symbol (e.g., AAPL)
   - Type (Buy/Sell)
   - Quantity
   - Price per share
   - Date
   - Notes (optional)
4. Click "Add Transaction"
5. Position appears in portfolio with calculated P/L

### Viewing News by Sentiment

1. Go to News tab
2. View sentiment statistics at top
3. Use dropdown to filter:
   - All Sentiment
   - Positive only
   - Neutral only
   - Negative only
4. Click any news item to read full article

### Checking Dividends

1. Go to Portfolio tab
2. Scroll to "Dividend History" section
3. View table with:
   - Stock symbol
   - Ex-date
   - Dividend amount
   - Estimated payment (based on your holdings)
   - Dividend type

## Future Enhancements

### Ready for Implementation

1. **Stock Charts** - Chart.js is already integrated, just need to add:
   - Historical price charts
   - Volume charts
   - Moving averages
   - Technical indicators

2. **Advanced Sentiment** - Current NLP can be enhanced with:
   - More sophisticated word analysis
   - Context awareness
   - Industry-specific terminology
   - Integration with external sentiment APIs

3. **Portfolio Analytics** - Data is available for:
   - Performance over time charts
   - Asset allocation pie charts
   - Risk metrics
   - Comparison with market indices

4. **Real-time Updates** - WebSocket integration for:
   - Live price updates
   - Real-time news feed
   - Instant alerts

## Dependencies Added

### web-app
```json
{
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.1"
  }
}
```

### notifier-service
```json
{
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1"
  }
}
```

### Frontend (CDN)
- Lucide Icons: https://unpkg.com/lucide@latest
- Chart.js: https://cdn.jsdelivr.net/npm/chart.js@4.4.0

## Configuration

No additional environment variables required. All features work with existing configuration.

## Testing

### Run All Tests
```bash
cd web-app && npm test
cd notifier-service && npm test
```

### Test Results
- ✅ 38 tests passing
- ✅ NewsController: 8/8 tests
- ✅ PortfolioController: 11/11 tests
- ✅ SentimentAnalyzer: 19/19 tests

## Known Limitations

1. **StatusInvest Scraper** - Currently uses mock data for dividends. Real HTML parsing needs to be implemented.
2. **Sentiment Analysis** - Simple NLP-based. More advanced ML models could improve accuracy.
3. **Chart.js** - Integrated but historical charts not yet implemented (data endpoints ready).

## Support

For issues or questions about the new features, please open a GitHub issue with the label "new-features".
