const axios = require('axios');

(async () => {
    try {
        const baseUrl = process.env.TEST_API_BASE_URL || 'http://localhost:3000';
        const email = process.env.TEST_REGISTER_EMAIL;
        const sifre = process.env.TEST_REGISTER_PASSWORD;
        const istenenRol = process.env.TEST_REGISTER_ROLE || 'isveren';

        if (!email || !sifre) {
            console.error('TEST_REGISTER_EMAIL ve TEST_REGISTER_PASSWORD env değişkenleri zorunlu.');
            process.exit(1);
        }

        const response = await axios.post(`${baseUrl}/api/auth/kayit`, {
            email,
            sifre,
            istenenRol
        });

        console.log('Kayıt başarılı:', {
            basarili: response.data?.basarili,
            rol: response.data?.kullanici?.rol,
            yonlendirme: response.data?.yonlendirme
        });
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;

        if (status === 409) {
            console.log('Kayıt atlandı: kullanıcı zaten mevcut (409).');
            process.exit(0);
        }

        console.error('Kayıt hatası:', data || error.message);
        process.exit(1);
    }
})();