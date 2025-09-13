const express = require('express');
const axios = require('axios');

const router = express.Router();

// Простейшая функция хаверсин расстояния в км
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Геокодирование адреса через Яндекс Геокодер
async function geocode(address) {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) throw new Error('YANDEX_MAPS_API_KEY is not configured');
  const url = `https://geocode-maps.yandex.ru/1.x/`;
  const params = { apikey: apiKey, format: 'json', geocode: address };
  const { data } = await axios.get(url, { params });
  const member = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = member?.Point?.pos;
  if (!pos) throw new Error('Address not found');
  const [lon, lat] = pos.split(' ').map(Number);
  return { lat, lon };
}

// GET /api/utils/distance?from=...&to=...
router.get('/distance', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Параметры from и to обязательны' });
    }

    const apiKey = process.env.YANDEX_MAPS_API_KEY;
    if (!apiKey) {
      // Если API ключ не настроен, возвращаем примерное расстояние на основе городов
      console.log('⚠️ YANDEX_MAPS_API_KEY не настроен, используем примерное расстояние');
      
      // Простая логика для примерного расчета расстояния между городами
      const cityDistances = {
        'москва': { 'санкт-петербург': 635, 'нижний новгород': 420, 'казань': 820, 'екатеринбург': 1400 },
        'санкт-петербург': { 'москва': 635, 'нижний новгород': 440, 'казань': 1200, 'екатеринбург': 1800 },
        'нижний новгород': { 'москва': 420, 'санкт-петербург': 440, 'казань': 400, 'екатеринбург': 1000 },
        'казань': { 'москва': 820, 'санкт-петербург': 1200, 'нижний новгород': 400, 'екатеринбург': 600 },
        'екатеринбург': { 'москва': 1400, 'санкт-петербург': 1800, 'нижний новгород': 1000, 'казань': 600 }
      };
      
      const fromCity = from.toLowerCase().trim();
      const toCity = to.toLowerCase().trim();
      
      // Ищем точное совпадение городов
      let distance = null;
      for (const [city1, distances] of Object.entries(cityDistances)) {
        if (fromCity.includes(city1) || city1.includes(fromCity)) {
          for (const [city2, dist] of Object.entries(distances)) {
            if (toCity.includes(city2) || city2.includes(toCity)) {
              distance = dist;
              break;
            }
          }
          if (distance) break;
        }
      }
      
      // Если не нашли точное совпадение, используем среднее расстояние
      if (!distance) {
        distance = 500; // Среднее расстояние между городами
      }
      
      return res.json({ success: true, km: distance, note: 'Примерное расстояние (API ключ не настроен)' });
    }

    const [a, b] = await Promise.all([geocode(from), geocode(to)]);
    const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
    res.json({ success: true, km: Math.round(km) });
  } catch (error) {
    console.error('Ошибка расчета расстояния:', error);
    res.status(500).json({ error: 'Не удалось вычислить расстояние' });
  }
});

// Публичная конфигурация (например, ключ для карт)
router.get('/public-config', (req, res) => {
  res.json({
    success: true,
    yandexKey: process.env.YANDEX_MAPS_API_KEY || null,
    yandexRoutingKey: process.env.YANDEX_ROUTING_API_KEY || null
  });
});

module.exports = router;


