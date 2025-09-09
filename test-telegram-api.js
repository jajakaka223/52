const axios = require('axios');

// Конфигурация
const API_BASE_URL = 'http://localhost:3000/api/telegram';
const API_KEY = 'your_telegram_api_key_here'; // Замените на ваш API ключ

const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
};

// Тестовые данные заявки
const testOrder = {
    date: '2024-01-15',
    direction: 'Москва → Санкт-Петербург',
    distance: 635.5,
    weight: 2.5,
    amount: 15000,
    company: 'ООО Рога и Копыта',
    clientName: 'Иван Петров',
    phone: '+7 (999) 123-45-67',
    email: 'client@example.com'
};

async function testTelegramAPI() {
    console.log('🧪 Тестирование Telegram API...\n');

    try {
        // 1. Тест создания заявки
        console.log('1️⃣ Создание заявки...');
        const createResponse = await axios.post(`${API_BASE_URL}/order`, testOrder, { headers });
        console.log('✅ Заявка создана:', createResponse.data);
        
        const orderId = createResponse.data.order.id;
        console.log(`📋 ID заявки: ${orderId}\n`);

        // 2. Тест получения статуса заявки
        console.log('2️⃣ Получение статуса заявки...');
        const statusResponse = await axios.get(`${API_BASE_URL}/order/${orderId}/status`, { headers });
        console.log('✅ Статус заявки:', statusResponse.data);
        console.log('');

        // 3. Тест получения списка заявок
        console.log('3️⃣ Получение списка заявок...');
        const ordersResponse = await axios.get(`${API_BASE_URL}/orders`, { headers });
        console.log('✅ Список заявок:', ordersResponse.data);
        console.log('');

        // 4. Тест webhook
        console.log('4️⃣ Тест webhook...');
        const webhookData = {
            orderId: orderId,
            newStatus: 'assigned',
            oldStatus: 'new'
        };
        const webhookResponse = await axios.post(`${API_BASE_URL}/webhook/status-change`, webhookData, { headers });
        console.log('✅ Webhook обработан:', webhookResponse.data);
        console.log('');

        console.log('🎉 Все тесты прошли успешно!');

    } catch (error) {
        console.error('❌ Ошибка тестирования:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n💡 Проверьте API ключ в переменной TELEGRAM_API_KEY');
        }
    }
}

// Запуск тестов
if (require.main === module) {
    testTelegramAPI();
}

module.exports = { testTelegramAPI };
