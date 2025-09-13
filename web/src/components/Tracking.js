import React, { useEffect, useRef } from 'react';
import { Card, Typography, message } from 'antd';
import api from '../config/http';

const { Title } = Typography;

const Tracking = () => {
  const mapRef = useRef(null);
  // убрал неиспользуемое состояние

  const initializedRef = useRef(false);
  const mapInstanceRef = useRef(null);

  const initMap = async () => {
    if (initializedRef.current) return; // защита от двойной инициализации в StrictMode
    try {
      const { data } = await api.get('/api/utils/public-config');
      const apiKey = data?.yandexKey;
      if (!apiKey) {
        message.warning('Yandex Maps API ключ не настроен. Отображается заглушка карты.');
        // Показываем заглушку вместо карты
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="
              height: 400px; 
              width: 100%; 
              background: #f5f5f5; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              border: 2px dashed #d9d9d9;
              color: #666;
              font-size: 16px;
              text-align: center;
            ">
              <div>
                <div style="font-size: 24px; margin-bottom: 10px;">🗺️</div>
                <div>Карта недоступна</div>
                <div style="font-size: 12px; margin-top: 5px;">Настройте YANDEX_MAPS_API_KEY в Railway</div>
              </div>
            </div>
          `;
        }
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
