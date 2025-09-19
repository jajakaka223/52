import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, message, Button, Space, Table, Tag, Spin, Row, Col, Statistic } from 'antd';
import { ReloadOutlined, EnvironmentOutlined, ClockCircleOutlined, CarOutlined } from '@ant-design/icons';
import api from '../config/http';

const { Title } = Typography;

const Tracking = () => {
  // Безопасное приведение к числу
  const toNumber = (value, fallback = 0) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return Number.isFinite(n) ? n : fallback;
  };

  const mapRef = useRef(null);
  const initializedRef = useRef(false);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const resizeObserverRef = useRef(null);
  
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Загрузка данных водителей
  const loadDriversData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/tracking/all-drivers');
      const raw = Array.isArray(data?.drivers) ? data.drivers : [];
      // Нормализуем приходящие данные (Postgres numeric может быть строкой)
      const normalized = raw
        .map(d => ({
          ...d,
          latitude: toNumber(d.latitude, null),
          longitude: toNumber(d.longitude, null),
          speed: toNumber(d.speed, 0),
          accuracy: toNumber(d.accuracy, 0),
          timestamp: d.timestamp || Date.now(),
        }))
        .filter(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

      setDrivers(normalized);
      setLastUpdate(new Date());
      
      // Обновляем карту
      if (mapInstanceRef.current) {
        updateMapMarkers(normalized);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных водителей:', error);
      const detail = error?.response?.data?.error || error?.message || '';
      // Частая причина: нет прав администратора или отсутствует токен
      if (error?.response?.status === 403) {
        message.error('Доступ запрещен. Войдите как администратор');
      } else if (error?.response?.status === 401) {
        message.error('Требуется авторизация. Выполните вход.');
      } else {
        message.error('Не удалось загрузить данные водителей' + (detail ? `: ${detail}` : ''));
      }
    } finally {
      setLoading(false);
    }
  };

  // Обновление меток на карте
  const updateMapMarkers = (driversData) => {
    if (!mapInstanceRef.current || !window.ymaps) return;

    // Удаляем старые метки
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.geoObjects.remove(marker);
    });
    markersRef.current = [];

    // Добавляем новые метки
    driversData.forEach(driver => {
      const lat = toNumber(driver.latitude, null);
      const lng = toNumber(driver.longitude, null);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const spd = toNumber(driver.speed, 0);
      const acc = toNumber(driver.accuracy, 0);
      const marker = new window.ymaps.Placemark(
        [lat, lng],
        {
          balloonContent: `
            <div>
              <h3>${driver.full_name || driver.username}</h3>
              <p><strong>Скорость:</strong> ${spd.toFixed(1)} км/ч</p>
              <p><strong>Точность:</strong> ${acc.toFixed(1)} м</p>
              <p><strong>Время:</strong> ${new Date(driver.timestamp || Date.now()).toLocaleString('ru-RU')}</p>
            </div>
          `,
          iconCaption: driver.full_name || driver.username
        },
        {
          preset: 'islands#redCarIcon',
          iconColor: spd > 0 ? '#ff6b6b' : '#52d66b'
        }
      );
      
      mapInstanceRef.current.geoObjects.add(marker);
      markersRef.current.push(marker);
    });

    // Центрируем карту на водителях
    if (driversData.length > 0) {
      const points = driversData
        .map(d => [toNumber(d.latitude, null), toNumber(d.longitude, null)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

      const TARGET_ZOOM = 16; // ~100 м шкала в Яндекс.Картах

      if (points.length === 1) {
        // Для одной точки не используем setBounds (он уходит в максимальный зум)
        try {
          mapInstanceRef.current.setCenter(points[0], TARGET_ZOOM, { checkZoomRange: true });
        } catch (_) {}
      } else {
        const bounds = window.ymaps.util.bounds.fromPoints(points);
        mapInstanceRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 80 });
        // После установки границ принудительно выставляем целевой зум
        try { mapInstanceRef.current.setZoom(TARGET_ZOOM, { duration: 0 }); } catch (_) {}
      }
    }
  };

  const initMap = async () => {
    if (initializedRef.current) return;
    try {
      const { data } = await api.get('/api/utils/public-config');
      const apiKey = data?.yandexKey;
      if (!apiKey) {
        message.warning('Yandex Maps API ключ не настроен. Отображается заглушка карты.');
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div style="
              height: 320px; 
              width: 100%; 
              background: #f5f5f5; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              border: 2px dashed #d9d9d9;
              color: #666;
              font-size: 16px;
              text-align: center;
              overflow: hidden;
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
          zoom: 16
        });
        initializedRef.current = true;
        
        // Следим за изменением размеров контейнера (например, сворачивание левого сайдбара)
        try {
          if (window.ResizeObserver && mapRef.current) {
            resizeObserverRef.current = new ResizeObserver(() => {
              try { mapInstanceRef.current?.container.fitToViewport(); } catch (_) {}
            });
            resizeObserverRef.current.observe(mapRef.current);
          } else {
            // На всякий случай — слушатель окна
            window.addEventListener('resize', () => {
              try { mapInstanceRef.current?.container.fitToViewport(); } catch (_) {}
            });
          }
        } catch (_) {}
        
        // Загружаем данные водителей после инициализации карты
        loadDriversData();
      });
    } catch (error) {
      console.error('Ошибка инициализации карты:', error);
      message.error('Не удалось инициализировать карту');
    }
  };

  useEffect(() => { initMap(); }, []);

  // Очистка наблюдателей при размонтировании
  useEffect(() => {
    return () => {
      try { resizeObserverRef.current?.disconnect(); } catch (_) {}
    };
  }, []);

  // Автообновление каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      if (initializedRef.current) {
        loadDriversData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const columns = [
    {
      title: 'Водитель',
      dataIndex: 'full_name',
      key: 'name',
      render: (text, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>{text || record.username}</span>
      ),
    },
    {
      title: 'Координаты',
      key: 'coordinates',
      render: (_, record) => (
        <Space wrap={false}>
          <EnvironmentOutlined />
          <span style={{ whiteSpace: 'nowrap' }}>
            {toNumber(record.latitude, 0).toFixed(6)}, {toNumber(record.longitude, 0).toFixed(6)}
          </span>
        </Space>
      ),
    },
    {
      title: 'Скорость',
      dataIndex: 'speed',
      key: 'speed',
      render: (speed) => {
        const spd = toNumber(speed, 0);
        return (
        <Tag color={speed > 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
          {spd.toFixed(1)} км/ч
        </Tag>
        );
      },
    },
    {
      title: 'Точность',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy) => (
        <span style={{ whiteSpace: 'nowrap' }}>{toNumber(accuracy, 0).toFixed(1)} м</span>
      ),
    },
    {
      title: 'Последнее обновление',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => (
        <Space wrap={false}>
          <ClockCircleOutlined />
          <span style={{ whiteSpace: 'nowrap' }}>{new Date(timestamp || Date.now()).toLocaleString('ru-RU')}</span>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2}>GPS Мониторинг</Title>
        <Space>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={loadDriversData}
            loading={loading}
          >
            Обновить
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных водителей"
              value={drivers.length}
              prefix={<CarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="В движении"
              value={drivers.filter(d => d.speed > 0).length}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#ff6b6b' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="На месте"
              value={drivers.filter(d => d.speed === 0 || !d.speed).length}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#52d66b' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Последнее обновление"
              value={lastUpdate ? lastUpdate.toLocaleTimeString('ru-RU') : 'Нет данных'}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
      {/* Список водителей сверху, на всю ширину */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={24}>
          <Card title="Список водителей" style={{ overflow: 'hidden' }}>
            <Table
              dataSource={drivers}
              columns={columns}
              pagination={false}
              size="small"
              scroll={{ x: true }}
              loading={loading}
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>

      {/* Карта на всю ширину и выравнивание контейнера по карте */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="Карта местоположений" bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
            <div ref={mapRef} style={{ height: 520, width: '100%', overflow: 'hidden' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Tracking;
