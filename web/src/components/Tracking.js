import React, { useEffect, useRef } from 'react';
import { Card, Typography, message } from 'antd';
import axios from 'axios';

const { Title } = Typography;

const Tracking = () => {
  const mapRef = useRef(null);
  // убрал неиспользуемое состояние

  const initializedRef = useRef(false);
  const mapInstanceRef = useRef(null);

  const initMap = async () => {
    if (initializedRef.current) return; // защита от двойной инициализации в StrictMode
    try {
      const { data } = await axios.get('/api/utils/public-config');
      const apiKey = data?.yandexKey;
      if (!apiKey) {
        message.error('YANDEX_MAPS_API_KEY не настроен');
        return;
      }

      await new Promise((resolve, reject) => {
        if (window.ymaps) return resolve();
        const existing = document.getElementById('ymaps-sdk');
        if (existing) return existing.addEventListener('load', resolve);
        const s = document.createElement('script');
        s.id = 'ymaps-sdk';
        s.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${apiKey}`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('YM load failed'));
        document.body.appendChild(s);
      });

      window.ymaps.ready(() => {
        if (mapRef.current) {
          mapRef.current.innerHTML = '';
        }
        mapInstanceRef.current = new window.ymaps.Map(mapRef.current, {
          center: [55.751244, 37.618423],
          zoom: 9
        });
        // Заглушка: тут можно будет рисовать метки водителей из /api/tracking
        initializedRef.current = true;
      });
    } catch (_) {
      message.error('Не удалось инициализировать карту');
    }
  };

  useEffect(() => { initMap(); }, []);

  return (
    <div>
      <Title level={2}>GPS Мониторинг</Title>
      <Card>
        <div ref={mapRef} style={{ height: 400, width: '100%' }} />
      </Card>
    </div>
  );
};

export default Tracking;
