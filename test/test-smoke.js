const axios = require('axios');

(async () => {
    const baseUrl = process.env.TEST_API_BASE_URL || 'http://localhost:3000';

    try {
        // Token olmadan /ben endpoint'inin 401 dönmesi auth middleware'in çalıştığını doğrular.
        await axios.get(`${baseUrl}/api/auth/ben`, { timeout: 5000 });
        console.error('Smoke test başarısız: /api/auth/ben token olmadan başarılı döndü.');
        process.exit(1);
    } catch (error) {
        const status = error.response?.status;
        if (status === 401) {
            console.log('Smoke test başarılı: auth middleware beklenen şekilde 401 döndü.');
            process.exit(0);
        }

        console.error('Smoke test hatası:', error.response?.data || error.message);
        process.exit(1);
    }
})();
