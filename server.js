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
    balance_usdt REAL DEFAULT 1000,
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

  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    currency TEXT,
    amount REAL,
    payment_method TEXT,
    status TEXT DEFAULT 'pending',
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Создаем тестового пользователя если нет
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (row.count === 0) {
      const hashedPassword = bcrypt.hashSync('password123', 10);
      db.run(
        'INSERT INTO users (username, email, password_hash, balance_usdt) VALUES (?, ?, ?, ?)',
        ['demo', 'demo@bvbit.com', hashedPassword, 1000]
      );
    }
  });
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
      'BTCUSDT': 43250 + (Math.random() * 1000 - 500),
      'ETHUSDT': 2380 + (Math.random() * 100 - 50),
      'BNBUSDT': 315 + (Math.random() * 10 - 5),
      'SOLUSDT': 105 + (Math.random() * 5 - 2.5),
      'USDTBTC': 1/43250,
      'USDTETH': 1/2380,
      'BTCETH': 43250/2380,
      'ETHBTC': 2380/43250
    };
  }

  async createOrder(symbol, side, quantity, price) {
    // В реальном приложении здесь будет вызов API Bybit для создания ордера
    // Для демо симулируем успешный ордер
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          orderId: 'BYBIT_' + Math.random().toString(36).substr(2, 9),
          executedQty: quantity,
          executedPrice: price
        });
      }, 1000);
    });
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
        'INSERT INTO users (username, email, password_hash, balance_usdt) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, 1000],
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
            user: { 
              id: this.lastID, 
              username, 
              email,
              balance_usdt: 1000,
              balance_btc: 0,
              balance_eth: 0,
              balance_rub: 0
            }
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
          balance_usdt: user.balance_usdt,
          balance_btc: user.balance_btc,
          balance_eth: user.balance_eth
        }
      });
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, balance_rub, balance_usdt, balance_btc, balance_eth FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    
    res.json({ success: true, user });
  });
});

// Finance Routes - Пополнения и выводы
app.post('/api/finance/deposit', authenticateToken, async (req, res) => {
  try {
    const { currency, amount, paymentMethod } = req.body;
    const userId = req.user.userId;

    // Валидация
    if (!['RUB', 'USDT', 'BTC', 'ETH'].includes(currency)) {
      return res.status(400).json({ error: 'Неверная валюта' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть больше 0' });
    }

    // Создаем запись о пополнении
    db.run(
      `INSERT INTO payments (user_id, type, currency, amount, payment_method, status, details) 
       VALUES (?, 'deposit', ?, ?, ?, 'pending', ?)`,
      [userId, currency, amount, paymentMethod, JSON.stringify({
        description: `Пополнение ${currency} через ${paymentMethod}`,
        timestamp: new Date().toISOString()
      })],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const paymentId = this.lastID;

        // Симулируем обработку платежа (в реальном приложении здесь будет интеграция с платежной системой)
        setTimeout(() => {
          // Обновляем баланс пользователя
          const balanceField = `balance_${currency.toLowerCase()}`;
          db.run(
            `UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE id = ?`,
            [amount, userId],
            (err) => {
              if (err) return;

              // Обновляем статус платежа
              db.run(
                'UPDATE payments SET status = ?, completed_at = datetime("now") WHERE id = ?',
                ['completed', paymentId],
                (err) => {
                  // Логируем успешное пополнение
                  console.log(`User ${userId} deposited ${amount} ${currency}`);
                }
              );
            }
          );
        }, 2000); // Симуляция обработки платежа за 2 секунды

        res.json({
          success: true,
          paymentId,
          message: 'Платеж принят в обработку',
          estimatedCompletion: new Date(Date.now() + 120000).toISOString() // +2 минуты
        });
      }
    );
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/withdraw', authenticateToken, async (req, res) => {
  try {
    const { currency, amount, walletAddress, paymentMethod } = req.body;
    const userId = req.user.userId;

    // Валидация
    if (!['USDT', 'BTC', 'ETH'].includes(currency)) {
      return res.status(400).json({ error: 'Неверная валюта' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть больше 0' });
    }

    // Проверяем баланс пользователя
    const balanceField = `balance_${currency.toLowerCase()}`;
    db.get(
      `SELECT ${balanceField} as balance FROM users WHERE id = ?`,
      [userId],
      (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user || user.balance < amount) {
          return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // Создаем запись о выводе
        db.run(
          `INSERT INTO payments (user_id, type, currency, amount, payment_method, status, details) 
           VALUES (?, 'withdraw', ?, ?, ?, 'pending', ?)`,
          [userId, currency, amount, paymentMethod, JSON.stringify({
            walletAddress: walletAddress,
            description: `Вывод ${currency} на ${paymentMethod}`,
            timestamp: new Date().toISOString()
          })],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const paymentId = this.lastID;

            // Резервируем средства (списываем сразу)
            db.run(
              `UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`,
              [amount, userId],
              (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Симулируем обработку вывода
                setTimeout(() => {
                  db.run(
                    'UPDATE payments SET status = ?, completed_at = datetime("now") WHERE id = ?',
                    ['completed', paymentId],
                    (err) => {
                      console.log(`User ${userId} withdrew ${amount} ${currency} to ${walletAddress}`);
                    }
                  );
                }, 5000); // Симуляция обработки вывода за 5 секунд

                res.json({
                  success: true,
                  paymentId,
                  message: 'Запрос на вывод принят в обработку',
                  estimatedCompletion: new Date(Date.now() + 300000).toISOString() // +5 минут
                });
              }
            );
          }
        );
      }
    );
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить историю платежей пользователя
app.get('/api/finance/payments', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  db.all(`
    SELECT * FROM payments 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `, [req.user.userId, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Exchange Routes
app.post('/api/exchange/create', authenticateToken, async (req, res) => {
  try {
    const { fromCurrency, toCurrency, fromAmount, toAmount, rate } = req.body;
    const userId = req.user.userId;

    // Проверяем баланс пользователя
    const balanceField = `balance_${fromCurrency.toLowerCase()}`;
    db.get(
      `SELECT ${balanceField} as balance FROM users WHERE id = ?`,
      [userId],
      async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user || user.balance < fromAmount) {
          return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // Рассчитываем комиссию (0.5%)
        const fee = fromAmount * 0.005;
        const amountAfterFee = fromAmount - fee;

        // Создаем транзакцию
        db.run(
          `INSERT INTO transactions (user_id, type, from_currency, to_currency, from_amount, to_amount, rate, fee, status) 
           VALUES (?, 'exchange', ?, ?, ?, ?, ?, ?, 'pending')`,
          [userId, fromCurrency, toCurrency, fromAmount, toAmount, rate, fee],
          async function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const transactionId = this.lastID;

            try {
              // Симулируем создание ордера на Bybit
              const symbol = `${fromCurrency}${toCurrency}`;
              const orderResult = await bybit.createOrder(symbol, 'sell', fromAmount, rate);

              if (orderResult.success) {
                // Обновляем балансы пользователя
                const fromBalanceField = `balance_${fromCurrency.toLowerCase()}`;
                const toBalanceField = `balance_${toCurrency.toLowerCase()}`;

                db.run(
                  `UPDATE users SET 
                    ${fromBalanceField} = ${fromBalanceField} - ?,
                    ${toBalanceField} = ${toBalanceField} + ?
                   WHERE id = ?`,
                  [fromAmount, toAmount, userId],
                  (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Обновляем статус транзакции
                    db.run(
                      'UPDATE transactions SET status = ? WHERE id = ?',
                      ['completed', transactionId],
                      (err) => {
                        if (err) return res.status(500).json({ error: err.message });

                        res.json({
                          success: true,
                          transactionId,
                          orderId: orderResult.orderId,
                          fromAmount,
                          toAmount,
                          fee,
                          newBalance: {
                            [fromCurrency]: user.balance - fromAmount,
                            [toCurrency]: toAmount
                          }
                        });
                      }
                    );
                  }
                );
              } else {
                db.run(
                  'UPDATE transactions SET status = ? WHERE id = ?',
                  ['failed', transactionId],
                  (err) => {
                    res.status(400).json({ error: 'Ошибка при создании ордера на бирже' });
                  }
                );
              }
            } catch (error) {
              db.run(
                'UPDATE transactions SET status = ? WHERE id = ?',
                ['failed', transactionId],
                (err) => {
                  res.status(500).json({ error: error.message });
                }
              );
            }
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить историю транзакций пользователя
app.get('/api/transactions/my', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  db.all(`
    SELECT * FROM transactions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `, [req.user.userId, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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
  db.all('SELECT id, username, email, balance_rub, balance_usdt, balance_btc, balance_eth, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
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

app.get('/api/payments', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  db.all(`
    SELECT p.*, u.username 
    FROM payments p 
    LEFT JOIN users u ON p.user_id = u.id 
    ORDER BY p.created_at DESC 
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

// Получить баланс пользователя
app.get('/api/user/balance', authenticateToken, (req, res) => {
  db.get('SELECT balance_rub, balance_usdt, balance_btc, balance_eth FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    
    res.json({
      success: true,
      balances: {
        RUB: user.balance_rub,
        USDT: user.balance_usdt,
        BTC: user.balance_btc,
        ETH: user.balance_eth
      }
    });
  });
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
        SUM(balance_btc) as total_volume_btc,
        SUM(balance_eth) as total_volume_eth,
        (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as total_transactions,
        (SELECT SUM(fee) FROM transactions WHERE status = 'completed') as total_fees,
        (SELECT COUNT(*) FROM payments WHERE type = 'deposit' AND status = 'completed') as total_deposits,
        (SELECT COUNT(*) FROM payments WHERE type = 'withdraw' AND status = 'completed') as total_withdrawals
      FROM users
    `, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
