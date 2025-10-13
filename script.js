// Конфигурация обменника BVBIT
const CONFIG = {
    commission: 0.005, // 0.5% комиссия платформы
    defaultPairs: {
        'USDT-ETH': 0.00054,
        'USDT-BTC': 0.0000254,
        'ETH-BTC': 0.047,
        'USDT-TON': 0.31,
        'USDT-SOL': 0.042,
        'USDT-BNB': 0.0032,
        'BTC-ETH': 21.2,
        'ETH-USDT': 1850,
        'BTC-USDT': 39350,
        'TON-USDT': 3.2,
        'SOL-USDT': 23.8,
        'BNB-USDT': 312.5
    },
    userBalances: {
        'USDT': 1250.50,
        'BTC': 0.025,
        'ETH': 1.8,
        'TON': 45.2,
        'SOL': 8.5,
        'BNB': 3.2
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
    fromCurrencyLabel: document.getElementById('from-currency-label'),
    toCurrencyLabel: document.getElementById('to-currency-label')
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    updateCurrencyIcons();
    calculateExchange();
    updateBalanceDisplay();
    
    console.log('🚀 BVBIT Exchange initialized!');
    console.log('💱 Available pairs:', Object.keys(CONFIG.defaultPairs));
});

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
    
    // Обновляем иконки валют
    updateCurrencyIcons();
    
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

// Обновление иконок валют
function updateCurrencyIcons() {
    const fromCurrency = elements.fromCurrency.value;
    const toCurrency = elements.toCurrency.value;
    
    // Обновляем иконки в селекторах
    document.querySelectorAll('.currency-icon i').forEach(icon => {
        icon.style.display = 'none';
    });
    
    const fromIcon = document.querySelector(`.currency-icon i[data-currency="${fromCurrency}"]`);
    const toIcon = document.querySelector(`.currency-icon i[data-currency="${toCurrency}"]`);
    
    if (fromIcon) fromIcon.style.display = 'inline';
    if (toIcon) toIcon.style.display = 'inline';
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
    elements.fromCurrencyLabel.textContent = fromCurrency;
    elements.toBalance.textContent = formatNumber(CONFIG.userBalances[toCurrency] || 0, toCurrency);
    elements.toCurrencyLabel.textContent = toCurrency;
}

// Обновление состояния кнопки обмена
function updateExchangeButton(enabled) {
    if (enabled) {
        elements.exchangeButton.disabled = false;
        elements.exchangeButton.style.opacity = '1';
        elements.exchangeButton.querySelector('.btn-text').textContent = 'Начать обмен';
    } else {
        elements.exchangeButton.disabled = true;
        elements.exchangeButton.style.opacity = '0.6';
        elements.exchangeButton.querySelector('.btn-text').textContent = 'Недостаточно средств';
    }
}

// Форматирование чисел в зависимости от валюты
function formatNumber(num, currency = '') {
    if (!num || isNaN(num)) return '0.00';
    
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
    updateBalanceDisplay();
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
    elements.exchangeButton.querySelector('.btn-content').style.opacity = '0';
    elements.exchangeButton.querySelector('.btn-loader').style.display = 'block';
    
    try {
        // Имитация запроса к API Bybit
        await simulateApiCall(2000);
        
        // Обновляем балансы (в реальном приложении это делал бы бэкенд)
        CONFIG.userBalances[from] = (CONFIG.userBalances[from] || 0) - amount;
        CONFIG.userBalances[to] = (CONFIG.userBalances[to] || 0) + received;
        
        showNotification(`✅ Обмен успешно завершен! ${formatNumber(amount, from)} ${from} → ${formatNumber(received, to)} ${to}`, 'success');
        
        // Обновляем отображение
        updateBalanceDisplay();
        
        // Анимация успеха
        elements.exchangeButton.style.background = 'linear-gradient(135deg, var(--success) 0%, #00b359 100%)';
        
        setTimeout(() => {
            // Восстанавливаем кнопку
            elements.exchangeButton.disabled = false;
            elements.exchangeButton.querySelector('.btn-content').style.opacity = '1';
            elements.exchangeButton.querySelector('.btn-loader').style.display = 'none';
            elements.exchangeButton.style.background = 'linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-orange-dark) 100%)';
            
            // Очищаем форму
            elements.fromAmount.value = '';
            elements.toAmount.value = '';
            calculateExchange();
        }, 1500);
        
    } catch (error) {
        showNotification('❌ Ошибка при выполнении обмена. Попробуйте позже.', 'error');
        
        // Восстанавливаем кнопку при ошибке
        elements.exchangeButton.disabled = false;
        elements.exchangeButton.querySelector('.btn-content').style.opacity = '1';
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
    
    // Запрет ввода отрицательных чисел
    elements.fromAmount.addEventListener('keydown', (e) => {
        if (e.key === '-' || e.key === 'e') {
            e.preventDefault();
        }
    });
    
    // Анимация при фокусе
    elements.fromAmount.addEventListener('focus', function() {
        this.parentElement.style.transform = 'scale(1.02)';
    });
    
    elements.fromAmount.addEventListener('blur', function() {
        this.parentElement.style.transform = 'scale(1)';
    });
}

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
