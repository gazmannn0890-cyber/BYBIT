// Base configuration
const CONFIG = {
    commission: 0.005, // 0.5%
    defaultPairs: {
        'USDT-ETH': 0.0004,
        'USDT-BTC': 0.000025,
        'ETH-BTC': 0.062,
        'RUB-USDT': 0.011
    }
};

// DOM Elements
const fromAmount = document.getElementById('from-amount');
const toAmount = document.getElementById('to-amount');
const fromCurrency = document.getElementById('from-currency');
const toCurrency = document.getElementById('to-currency');
const swapBtn = document.getElementById('swap-currencies');
const exchangeRate = document.getElementById('exchange-rate');
const feeAmount = document.getElementById('fee-amount');
const totalAmount = document.getElementById('total-amount');
const exchangeButton = document.getElementById('exchange-button');

// Mock function to get exchange rate (will be replaced with Bybit API)
function getExchangeRate(from, to) {
    const pair = `${from}-${to}`;
    return CONFIG.defaultPairs[pair] || 1 / (CONFIG.defaultPairs[`${to}-${from}`] || 1);
}

// Calculate exchange
function calculateExchange() {
    const from = fromCurrency.value;
    const to = toCurrency.value;
    const amount = parseFloat(fromAmount.value) || 0;
    
    if (amount <= 0) {
        toAmount.value = '';
        updateExchangeInfo(0, from, to);
        return;
    }

    const rate = getExchangeRate(from, to);
    const fee = amount * CONFIG.commission;
    const amountAfterFee = amount - fee;
    const receivedAmount = amountAfterFee * rate;

    toAmount.value = receivedAmount.toFixed(8);
    updateExchangeInfo(amount, from, to, rate, fee, receivedAmount);
}

// Update exchange information
function updateExchangeInfo(amount, from, to, rate = 0, fee = 0, received = 0) {
    if (amount <= 0) {
        exchangeRate.textContent = `1 ${from} = ${getExchangeRate(from, to).toFixed(8)} ${to}`;
        feeAmount.textContent = '0.5%';
        totalAmount.textContent = `0.0 ${to}`;
        return;
    }

    exchangeRate.textContent = `1 ${from} = ${rate.toFixed(8)} ${to}`;
    feeAmount.textContent = `${(CONFIG.commission * 100).toFixed(1)}% (${(fee).toFixed(6)} ${from})`;
    totalAmount.textContent = `${received.toFixed(8)} ${to}`;
}

// Swap currencies
function swapCurrencies() {
    const tempFrom = fromCurrency.value;
    const tempTo = toCurrency.value;
    
    fromCurrency.value = tempTo;
    toCurrency.value = tempFrom;
    
    // Swap amounts
    const tempAmount = fromAmount.value;
    fromAmount.value = toAmount.value;
    toAmount.value = tempAmount;
    
    calculateExchange();
}

// Validate exchange
function validateExchange() {
    const amount = parseFloat(fromAmount.value);
    if (!amount || amount <= 0) {
        alert('Пожалуйста, введите корректную сумму для обмена');
        return false;
    }
    return true;
}

// Mock exchange process
function processExchange() {
    if (!validateExchange()) return;
    
    exchangeButton.disabled = true;
    exchangeButton.textContent = 'Обработка...';
    
    // Simulate API call delay
    setTimeout(() => {
        alert(`Обмен успешно создан!\nВы отдаете: ${fromAmount.value} ${fromCurrency.value}\nВы получаете: ${toAmount.value} ${toCurrency.value}`);
        exchangeButton.disabled = false;
        exchangeButton.textContent = 'Обменять';
        
        // Reset form
        fromAmount.value = '';
        toAmount.value = '';
        calculateExchange();
    }, 2000);
}

// Event Listeners
fromAmount.addEventListener('input', calculateExchange);
fromCurrency.addEventListener('change', calculateExchange);
toCurrency.addEventListener('change', calculateExchange);
swapBtn.addEventListener('click', swapCurrencies);
exchangeButton.addEventListener('click', processExchange);

// Initialize
calculateExchange();
