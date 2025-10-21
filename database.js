-- database.js - работа с базой
const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor() {
    this.db = new sqlite3.Database('./bvbit.db');
  }

  // Users
  createUser(username, email, passwordHash) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
        [username, email, passwordHash],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Transactions
  createTransaction(transaction) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO transactions (user_id, type, from_currency, to_currency, from_amount, to_amount, rate, fee, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.user_id,
          transaction.type,
          transaction.from_currency,
          transaction.to_currency,
          transaction.from_amount,
          transaction.to_amount,
          transaction.rate,
          transaction.fee,
          transaction.status
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  // Settings
  getSetting(key) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  }

  setSetting(key, value) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [key, value],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

module.exports = Database;
