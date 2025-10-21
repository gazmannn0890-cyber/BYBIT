// server.js - основной сервер
const express = require('express');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const { BybitAPI } = require('./bybit-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Инициализация Bybit API
const bybit = new BybitAPI();

// База данных
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
    type TEXT, -- 'exchange', 'deposit', 'withdraw'
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

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getPlatformStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', (req, res) => {
  db.all(`SELECT * FROM users ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/transactions', (req, res) => {
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

// Bybit цены
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
});

// WebSocket для реальных обновлений
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Отправляем обновления каждые 5 секунд
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
