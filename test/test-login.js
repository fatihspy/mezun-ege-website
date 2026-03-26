const axios = require('axios');

(async () => {
    try {
        const baseUrl = process.env.TEST_API_BASE_URL || 'http://localhost:3000';
        const email = process.env.TEST_EMAIL;
        const sifre = process.env.TEST_PASSWORD;

        if (!email || !sifre) {
            console.error('TEST_EMAIL ve TEST_PASSWORD env değişkenleri zorunlu.');
            process.exit(1);
        }

        const response = await axios.post(`${baseUrl}/api/auth/giris`, {
            email,
            sifre
        });

        console.log('Login başarılı:', {
            basarili: response.data?.basarili,
            rol: response.data?.kullanici?.rol,
            email: response.data?.kullanici?.email
        });
    } catch (error) {
        console.error('Login hatası:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
})();