// bybit-api.js - интеграция с Bybit
class BybitAPI {
  constructor() {
    this.baseURL = 'https://api.bybit.com';
    this.apiKey = process.env.BYBIT_API_KEY;
    this.apiSecret = process.env.BYBIT_API_SECRET;
  }

  async getTickers() {
    try {
      const response = await fetch(`${this.baseURL}/v5/market/tickers?category=spot&symbol=BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT`);
      
      if (!response.ok) {
        throw new Error(`Bybit API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }
      
      return this.processTickerData(data.result.list);
    } catch (error) {
      console.error('Bybit API fetch failed:', error);
      // Fallback to mock data if API is down
      return this.getMockTickers();
    }
  }

  processTickerData(tickers) {
    const prices = {};
    
    tickers.forEach(ticker => {
      const symbol = ticker.symbol;
      const price = parseFloat(ticker.lastPrice);
      
      if (symbol.includes('USDT')) {
        const base = symbol.replace('USDT', '');
        prices[`${base}USDT`] = price;
        prices[`USDT${base}`] = 1 / price;
      }
    });

    // Calculate cross rates
    if (prices['BTCUSDT'] && prices['ETHUSDT']) {
      prices['BTCETH'] = prices['BTCUSDT'] / prices['ETHUSDT'];
      prices['ETHBTC'] = prices['ETHUSDT'] / prices['BTCUSDT'];
    }

    return prices;
  }

  getMockTickers() {
    // Fallback data when Bybit API is unavailable
    return {
      'BTCUSDT': 45000 + (Math.random() * 1000 - 500),
      'ETHUSDT': 2500 + (Math.random() * 100 - 50),
      'BNBUSDT': 320 + (Math.random() * 10 - 5),
      'SOLUSDT': 110 + (Math.random() * 5 - 2.5),
      'USDTBTC': 1/45000,
      'USDTETH': 1/2500,
      'BTCETH': 18,
      'ETHBTC': 1/18
    };
  }

  async getOrderBook(symbol) {
    try {
      const response = await fetch(`${this.baseURL}/v5/market/orderbook?category=spot&symbol=${symbol}&limit=10`);
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Bybit orderbook error:', error);
      return null;
    }
  }
}

module.exports = { BybitAPI };
