import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, message, Button, Space, Table, Tag, Spin, Row, Col, Statistic } from 'antd';
import { ReloadOutlined, EnvironmentOutlined, ClockCircleOutlined, CarOutlined } from '@ant-design/icons';
import api from '../config/http';

const { Title } = Typography;

const Tracking = () => {
  const mapRef = useRef(null);
  const initializedRef = useRef(false);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Загрузка данных водителей
  const loadDriversData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/tracking/all-drivers');
      setDrivers(data.drivers || []);
      setLastUpdate(new Date());
      
      // Обновляем карту
      if (mapInstanceRef.current) {
        updateMapMarkers(data.drivers || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных водителей:', error);
      message.error('Не удалось загрузить данные водителей');
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
      const marker = new window.ymaps.Placemark(
        [driver.latitude, driver.longitude],
        {
          balloonContent: `
            <div>
              <h3>${driver.full_name || driver.username}</h3>
              <p><strong>Скорость:</strong> ${driver.speed?.toFixed(1) || 0} км/ч</p>
              <p><strong>Точность:</strong> ${driver.accuracy?.toFixed(1) || 0} м</p>
              <p><strong>Время:</strong> ${new Date(driver.timestamp).toLocaleString('ru-RU')}</p>
            </div>
          `,
          iconCaption: driver.full_name || driver.username
        },
        {
          preset: 'islands#redCarIcon',
          iconColor: driver.speed > 0 ? '#ff6b6b' : '#52d66b'
        }
      );
      
      mapInstanceRef.current.geoObjects.add(marker);
      markersRef.current.push(marker);
    });

    // Центрируем карту на водителях
    if (driversData.length > 0) {
      const bounds = window.ymaps.util.bounds.fromPoints(
        driversData.map(driver => [driver.latitude, driver.longitude])
      );
      mapInstanceRef.current.setBounds(bounds, { checkZoomRange: true });
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
        initializedRef.current = true;
        
        // Загружаем данные водителей после инициализации карты
        loadDriversData();
      });
    } catch (error) {
      console.error('Ошибка инициализации карты:', error);
      message.error('Не удалось инициализировать карту');
    }
  };

  useEffect(() => { initMap(); }, []);

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
      render: (text, record) => text || record.username,
    },
    {
      title: 'Координаты',
      key: 'coordinates',
      render: (_, record) => (
        <Space>
          <EnvironmentOutlined />
          {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
        </Space>
      ),
    },
    {
      title: 'Скорость',
      dataIndex: 'speed',
      key: 'speed',
      render: (speed) => (
        <Tag color={speed > 0 ? 'red' : 'green'}>
          {speed?.toFixed(1) || 0} км/ч
        </Tag>
      ),
    },
    {
      title: 'Точность',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy) => `${accuracy?.toFixed(1) || 0} м`,
    },
    {
      title: 'Последнее обновление',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => (
        <Space>
          <ClockCircleOutlined />
          {new Date(timestamp).toLocaleString('ru-RU')}
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

      <Row gutter={16} style={{ marginBottom: 16 }}>
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

      <Row gutter={16}>
        <Col span={16}>
          <Card title="Карта местоположений" style={{ height: 500 }}>
            <div ref={mapRef} style={{ height: 400, width: '100%' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Список водителей" style={{ height: 500 }}>
            <Table
              dataSource={drivers}
              columns={columns}
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
              loading={loading}
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Tracking;
