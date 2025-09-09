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

    const [a, b] = await Promise.all([geocode(from), geocode(to)]);
    const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
    res.json({ success: true, km: Math.round(km) });
  } catch (error) {
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


