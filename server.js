const express = require('express');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Инициализация базы данных
const db = new sqlite3.Database('./bvbit.db');

// Создаем таблицы при запуске
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    balance_rub REAL DEFAULT 0,
    balance_usdt REAL DEFAULT 0,
    balance_btc REAL DEFAULT 0,
    balance_eth REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    from_currency TEXT,
    to_currency TEXT,
    from_amount REAL,
    to_amount REAL,
    rate REAL,
    fee REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
});

// Bybit API Integration
class BybitAPI {
  async getTickers() {
    try {
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT');
      
      if (!response.ok) throw new Error(`Bybit API error: ${response.status}`);
      
      const data = await response.json();
      if (data.retCode !== 0) throw new Error(`Bybit API error: ${data.retMsg}`);
      
      return this.processTickerData(data.result.list);
    } catch (error) {
      console.error('Bybit API fetch failed:', error);
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

    if (prices['BTCUSDT'] && prices['ETHUSDT']) {
      prices['BTCETH'] = prices['BTCUSDT'] / prices['ETHUSDT'];
      prices['ETHBTC'] = prices['ETHUSDT'] / prices['BTCUSDT'];
    }

    return prices;
  }

  getMockTickers() {
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
}

const bybit = new BybitAPI();

// Auth Middleware
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) return res.status(401).json({ error: 'Токен отсутствует' });
  
  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Неверный токен' });
  }
}

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(400).json({ error: 'Пользователь уже существует' });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const token = jwt.sign(
            { userId: this.lastID, username }, 
            'your-secret-key', 
            { expiresIn: '24h' }
          );
          
          res.json({ 
            success: true, 
            token,
            user: { id: this.lastID, username, email }
          });
        }
      );
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
      
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) return res.status(400).json({ error: 'Неверный пароль' });
      
      const token = jwt.sign(
        { userId: user.id, username: user.username }, 
        'your-secret-key', 
        { expiresIn: '24h' }
      );
      
      res.json({ 
        success: true, 
        token,
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          balance_rub: user.balance_rub,
          balance_usdt: user.balance_usdt 
        }
      });
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, balance_rub, balance_usdt FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    
    res.json({ success: true, user });
  });
});

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getPlatformStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', authenticateToken, (req, res) => {
  db.all('SELECT id, username, email, balance_rub, balance_usdt, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/transactions', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  db.all(`
    SELECT t.*, u.username 
    FROM transactions t 
    LEFT JOIN users u ON t.user_id = u.id 
    ORDER BY t.created_at DESC 
    LIMIT ?
  `, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/prices', async (req, res) => {
  try {
    const prices = await bybit.getTickers();
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 BVBIT Server running on port ${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`💱 Exchange: http://localhost:${PORT}/index.html`);
  console.log(`🔐 Register: http://localhost:${PORT}/register.html`);
});

// WebSocket для реальных обновлений
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  const interval = setInterval(async () => {
    try {
      const prices = await bybit.getTickers();
      const stats = await getPlatformStats();
      
      ws.send(JSON.stringify({
        type: 'update',
        prices,
        stats
      }));
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  }, 5000);
  
  ws.on('close', () => {
    clearInterval(interval);
    console.log('WebSocket client disconnected');
  });
});

async function getPlatformStats() {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as total_users,
        SUM(balance_rub) as total_volume_rub,
        SUM(balance_usdt) as total_volume_usdt,
        (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as total_transactions,
        (SELECT SUM(fee) FROM transactions WHERE status = 'completed') as total_fees
      FROM users
    `, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
