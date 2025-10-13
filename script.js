// Конфигурация обменника BVBIT
const CONFIG = {
    commission: 0.005, // 0.5% комиссия платформы
    defaultPairs: {
        'USDT-ETH': 0.00054,
        'USDT-BTC': 0.0000254,
        'ETH-BTC': 0.047,
        'RUB-USDT': 0.0092,
        'USD-USDT': 0.98,
        'TON-USDT': 3.2,
        'BTC-ETH': 21.2,
        'ETH-USDT': 1850,
        'BTC-USDT': 39350,
        'USDT-RUB': 108.5,
        'USDT-USD': 1.02,
        'USDT-TON': 0.31
    },
    userBalances: {
        'USDT': 1250.50,
        'BTC': 0.025,
        'ETH': 1.8,
        'TON': 45.2,
        'RUB': 0,
        'USD': 500
    }
};

// Элементы DOM
const elements = {
    // Форма обмена
    fromAmount: document.getElementById('from-amount'),
    toAmount: document.getElementById('to-amount'),
    fromCurrency: document.getElementById('from-currency'),
    toCurrency: document.getElementById('to-currency'),
    swapBtn: document.getElementById('swap-currencies'),
    exchangeRate: document.getElementById('exchange-rate'),
    feeAmount: document.getElementById('fee-amount'),
    totalAmount: document.getElementById('total-amount'),
    finalAmount: document.getElementById('final-amount'),
    exchangeButton: document.getElementById('exchange-button'),
    
    // Балансы
    fromBalance: document.getElementById('from-balance'),
    toBalance: document.getElementById('to-balance'),
    fromBalanceCurrency: document.getElementById('from-balance-currency'),
    toBalanceCurrency: document.getElementById('to-balance-currency'),
    
    // Кнопки
    loginBtn: document.getElementById('login-btn'),
    registerBtn: document.getElementById('register-btn')
};

// Получение курса обмена
function getExchangeRate(from, to) {
    if (from === to) return 1;
    
    const directPair = `${from}-${to}`;
    const reversePair = `${to}-${from}`;
    
    // Прямая пара
    if (CONFIG.defaultPairs[directPair]) {
        return CONFIG.defaultPairs[directPair];
    }
    
    // Обратная пара
    if (CONFIG.defaultPairs[reversePair]) {
        return 1 / CONFIG.defaultPairs[reversePair];
    }
    
    // Через USDT как базовую валюту
    if (from !== 'USDT' && to !== 'USDT') {
        const fromToUSDT = CONFIG.defaultPairs[`${from}-USDT`] || (1 / (CONFIG.defaultPairs[`USDT-${from}`] || 1));
        const usdtToTarget = CONFIG.defaultPairs[`USDT-${to}`] || (1 / (CONFIG.defaultPairs[`${to}-USDT`] || 1));
        return fromToUSDT * usdtToTarget;
    }
    
    return 1;
}

// Расчет обмена
function calculateExchange() {
    const from = elements.fromCurrency.value;
    const to = elements.toCurrency.value;
    const amount = parseFloat(elements.fromAmount.value) || 0;
    
    // Обновляем отображение балансов
    updateBalanceDisplay();
    
    if (amount <= 0) {
        elements.toAmount.value = '';
        updateExchangeInfo(0, from, to);
        updateExchangeButton(false);
        return;
    }

    // Проверяем достаточность баланса
    const hasSufficientBalance = amount <= (CONFIG.userBalances[from] || 0);
    updateExchangeButton(hasSufficientBalance);

    const rate = getExchangeRate(from, to);
    const fee = amount * CONFIG.commission;
    const amountAfterFee = amount - fee;
    const receivedAmount = amountAfterFee * rate;

    // Форматирование и отображение
    elements.toAmount.value = formatNumber(receivedAmount, to);
    updateExchangeInfo(amount, from, to, rate, fee, receivedAmount);
}

// Обновление информации об обмене
function updateExchangeInfo(amount, from, to, rate = 0, fee = 0, received = 0) {
    if (amount <= 0) {
        const currentRate = getExchangeRate(from, to);
        elements.exchangeRate.textContent = `1 ${from} = ${formatNumber(currentRate, to)} ${to}`;
        elements.feeAmount.textContent = '0.5%';
        elements.totalAmount.textContent = `0.0 ${to}`;
        elements.finalAmount.textContent = `0.0 ${to}`;
        return;
    }

    elements.exchangeRate.textContent = `1 ${from} = ${formatNumber(rate, to)} ${to}`;
    elements.feeAmount.textContent = `${(CONFIG.commission * 100).toFixed(1)}% (${formatNumber(fee, from)} ${from})`;
    elements.totalAmount.textContent = `${formatNumber(received, to)} ${to}`;
    elements.finalAmount.textContent = `${formatNumber(received, to)} ${to}`;
}

// Обновление отображения балансов
function updateBalanceDisplay() {
    const fromCurrency = elements.fromCurrency.value;
    const toCurrency = elements.toCurrency.value;
    
    elements.fromBalance.textContent = formatNumber(CONFIG.userBalances[fromCurrency] || 0, fromCurrency);
    elements.fromBalanceCurrency.textContent = fromCurrency;
    elements.toBalance.textContent = formatNumber(CONFIG.userBalances[toCurrency] || 0, toCurrency);
    elements.toBalanceCurrency.textContent = toCurrency;
}

// Обновление состояния кнопки обмена
function updateExchangeButton(enabled) {
    if (enabled) {
        elements.exchangeButton.disabled = false;
        elements.exchangeButton.style.opacity = '1';
    } else {
        elements.exchangeButton.disabled = true;
        elements.exchangeButton.style.opacity = '0.6';
    }
}

// Форматирование чисел в зависимости от валюты
function formatNumber(num, currency = '') {
    if (!num || isNaN(num)) return '0.00';
    
    // Для фиатных валют
    if (['USD', 'RUB'].includes(currency)) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }
    
    // Для криптовалют
    if (num >= 1000) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    } else if (num >= 1) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        }).format(num);
    } else if (num >= 0.01) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 6,
            maximumFractionDigits: 6
        }).format(num);
    } else {
        return num.toFixed(8).replace(/\.?0+$/, '');
    }
}

// Обмен валют местами
function swapCurrencies() {
    const tempFrom = elements.fromCurrency.value;
    const tempTo = elements.toCurrency.value;
    
    elements.fromCurrency.value = tempTo;
    elements.toCurrency.value = tempFrom;
    
    // Сохраняем значения
    const tempAmount = elements.fromAmount.value;
    elements.fromAmount.value = elements.toAmount.value;
    elements.toAmount.value = tempAmount;
    
    // Пересчитываем
    calculateExchange();
}

// Валидация обмена
function validateExchange() {
    const amount = parseFloat(elements.fromAmount.value);
    const from = elements.fromCurrency.value;
    const to = elements.toCurrency.value;
    
    if (!amount || amount <= 0) {
        showNotification('Пожалуйста, введите корректную сумму для обмена', 'error');
        return false;
    }
    
    if (from === to) {
        showNotification('Нельзя обменять одинаковые валюты', 'error');
        return false;
    }
    
    const userBalance = CONFIG.userBalances[from] || 0;
    if (amount > userBalance) {
        showNotification(`Недостаточно средств. Доступно: ${formatNumber(userBalance, from)} ${from}`, 'error');
        return false;
    }
    
    return true;
}

// Показ уведомлений
function showNotification(message, type = 'info') {
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Удаляем через 4 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

// Процесс обмена
async function processExchange() {
    if (!validateExchange()) return;
    
    const from = elements.fromCurrency.value;
    const to = elements.toCurrency.value;
    const amount = parseFloat(elements.fromAmount.value);
    const received = parseFloat(elements.toAmount.value);
    
    // Блокируем интерфейс
    elements.exchangeButton.disabled = true;
    elements.exchangeButton.querySelector('.btn-text').textContent = 'Обработка...';
    elements.exchangeButton.querySelector('.btn-loader').style.display = 'inline';
    
    try {
        // Имитация запроса к API Bybit
        await simulateApiCall(2000);
        
        // Обновляем балансы (в реальном приложении это делал бы бэкенд)
        CONFIG.userBalances[from] = (CONFIG.userBalances[from] || 0) - amount;
        CONFIG.userBalances[to] = (CONFIG.userBalances[to] || 0) + received;
        
        showNotification(`✅ Обмен успешно завершен! ${formatNumber(amount, from)} ${from} → ${formatNumber(received, to)} ${to}`, 'success');
        
        // Обновляем отображение
        updateBalanceDisplay();
        
        // Можно очистить форму
        setTimeout(() => {
            elements.fromAmount.value = '';
            elements.toAmount.value = '';
            calculateExchange();
        }, 1000);
        
    } catch (error) {
        showNotification('❌ Ошибка при выполнении обмена. Попробуйте позже.', 'error');
    } finally {
        // Восстанавливаем кнопку
        elements.exchangeButton.disabled = false;
        elements.exchangeButton.querySelector('.btn-text').textContent = 'Обменять';
        elements.exchangeButton.querySelector('.btn-loader').style.display = 'none';
    }
}

// Имитация API вызова
function simulateApiCall(delay) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

// Инициализация событий
function initEventListeners() {
    // События формы обмена
    elements.fromAmount.addEventListener('input', calculateExchange);
    elements.fromCurrency.addEventListener('change', calculateExchange);
    elements.toCurrency.addEventListener('change', calculateExchange);
    elements.swapBtn.addEventListener('click', swapCurrencies);
    elements.exchangeButton.addEventListener('click', processExchange);
    
    // События кнопок авторизации
    elements.loginBtn.addEventListener('click', () => {
        showNotification('Функция авторизации будет реализована в ближайшее время', 'info');
    });
    
    elements.registerBtn.addEventListener('click', () => {
        showNotification('Функция регистрации будет реализована в ближайшее время', 'info');
    });
    
    // Запрет ввода отрицательных чисел
    elements.fromAmount.addEventListener('keydown', (e) => {
        if (e.key === '-' || e.key === 'e') {
            e.preventDefault();
        }
    });
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    calculateExchange();
    updateBalanceDisplay();
    
    console.log('🚀 BVBIT Exchange initialized!');
    console.log('💱 Available pairs:', Object.keys(CONFIG.defaultPairs));
    console.log('👤 User balances:', CONFIG.userBalances);
});

// Глобальные функции для отладки
window.debugExchange = {
    getRate: (from, to) => getExchangeRate(from, to),
    setBalance: (currency, amount) => {
        CONFIG.userBalances[currency] = amount;
        updateBalanceDisplay();
        calculateExchange();
    },
    getConfig: () => CONFIG
};
