import React, { useEffect, useRef, useState } from 'react';
import { 
  Card, 
  Typography, 
  message, 
  Button, 
  Space, 
  Table, 
  Tag, 
  Spin, 
  Row, 
  Col, 
  Statistic,
  Tabs,
  Select,
  Input,
  Tooltip
} from 'antd';
import { 
  ReloadOutlined, 
  EnvironmentOutlined, 
  ClockCircleOutlined, 
  CarOutlined,
  UserOutlined,
  FilterOutlined
} from '@ant-design/icons';
import api from '../config/http';

const { Title } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const EnhancedTracking = ({ user, userPermissions }) => {
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
  const [requestingCoords, setRequestingCoords] = useState(false);
  const [activeDriverId, setActiveDriverId] = useState('all');
  const [pointsLimit, setPointsLimit] = useState(10);


  // Запрос обновления координат у Android устройств
  const requestCoordinatesUpdate = async () => {
    try {
      setRequestingCoords(true);
      console.log('Отправка запроса координат...');
      
      const { data } = await api.post('/api/tracking/request-coordinates');
      console.log('Ответ сервера:', data);
      message.success('Запрос на обновление координат отправлен');
      
      // Ждем немного и обновляем данные
      setTimeout(() => {
        loadDriversData();
      }, 2000);
    } catch (error) {
      console.error('Ошибка запроса координат:', error);
      message.error(`Не удалось отправить запрос на обновление координат: ${error.response?.status || 'Неизвестная ошибка'}`);
    } finally {
      setRequestingCoords(false);
    }
  };

  // Загрузка данных водителей
  const loadDriversData = async () => {
    try {
      setLoading(true);
      console.log('Загрузка данных водителей...');
      
      const { data } = await api.get('/api/tracking/all-drivers');
      console.log('Данные водителей получены:', data);
      
      if (data && Array.isArray(data)) {
        // Загружаем историю для каждого водителя
        const driversWithHistory = await Promise.all(
          data.map(async (driver) => {
            try {
              const historyResponse = await api.get(`/api/tracking/driver-history/${driver.id}?limit=100`);
              return {
                ...driver,
                location_history: historyResponse.data
              };
            } catch (error) {
              console.warn(`Не удалось загрузить историю для водителя ${driver.id}:`, error);
              return {
                ...driver,
                location_history: []
              };
            }
          })
        );
        
        setDrivers(driversWithHistory);
        setLastUpdate(new Date());
      } else {
        console.warn('Неожиданный формат данных:', data);
        setDrivers([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных водителей:', error);
      message.error('Не удалось загрузить данные водителей');
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  };

  // Получение данных для отображения
  const getDisplayData = () => {
    if (activeDriverId === 'all') {
      // Для вкладки "Все" показываем только последние точки всех водителей
      return drivers.map(driver => ({
        ...driver.last_location,
        key: driver.id,
        driver_name: driver.name,
        driver_id: driver.id,
      })).filter(loc => loc.latitude && loc.longitude);
    } else {
      // Для конкретного водителя показываем историю с лимитом
      const selectedDriver = drivers.find(d => d.id === activeDriverId);
      if (selectedDriver && selectedDriver.location_history) {
        return selectedDriver.location_history
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, pointsLimit)
          .map(loc => ({ 
            ...loc, 
            key: loc.timestamp, 
            driver_name: selectedDriver.name, 
            driver_id: activeDriverId 
          }));
      }
      return [];
    }
  };

  // Форматирование скорости
  const formatSpeed = (speed) => {
    if (!speed || speed === 0) return '0 км/ч';
    const kmh = (speed * 3.6).toFixed(1);
    return `${kmh} км/ч`;
  };

  // Форматирование точности
  const formatAccuracy = (accuracy) => {
    if (!accuracy) return 'Неизвестно';
    return `${accuracy.toFixed(1)} м`;
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Неизвестно';
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
  };

  // Получение цвета статуса по точности
  const getAccuracyColor = (accuracy) => {
    if (!accuracy) return 'default';
    if (accuracy <= 10) return 'green';
    if (accuracy <= 50) return 'orange';
    return 'red';
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Водитель',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (userId) => (
        <Space>
          <UserOutlined />
          <span>Водитель {userId}</span>
        </Space>
      ),
    },
    {
      title: 'Координаты',
      key: 'coordinates',
      render: (record) => (
        <Space>
          <EnvironmentOutlined />
          <span>{record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}</span>
        </Space>
      ),
    },
    {
      title: 'Скорость',
      dataIndex: 'speed',
      key: 'speed',
      render: (speed) => (
        <Tag color={speed > 0 ? 'blue' : 'default'}>
          {formatSpeed(speed)}
        </Tag>
      ),
    },
    {
      title: 'Точность',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy) => (
        <Tag color={getAccuracyColor(accuracy)}>
          {formatAccuracy(accuracy)}
        </Tag>
      ),
    },
    {
      title: 'Направление',
      dataIndex: 'heading',
      key: 'heading',
      render: (heading) => (
        <span>{heading ? `${heading.toFixed(0)}°` : '—'}</span>
      ),
    },
    {
      title: 'Время',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => (
        <Space>
          <ClockCircleOutlined />
          <span>{formatTime(timestamp)}</span>
        </Space>
      ),
    },
  ];

  // Статистика
  const getStats = () => {
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.last_location && (Date.now() - d.last_location.timestamp < 300000)).length; // Last 5 minutes
    const movingDrivers = drivers.filter(d => d.last_location && toNumber(d.last_location.speed) > 0.5).length; // Speed > 0.5 m/s
    const avgAccuracy = drivers.reduce((sum, d) => sum + (d.last_location ? toNumber(d.last_location.accuracy) : 0), 0) / totalDrivers || 0;

    return {
      totalDrivers,
      activeDrivers,
      avgAccuracy: avgAccuracy.toFixed(1),
      movingDrivers
    };
  };

  const stats = getStats();

  useEffect(() => {
    loadDriversData();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadDriversData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Инициализация карты
  useEffect(() => {
    if (mapRef.current && !initializedRef.current) {
      // Инициализация Yandex Maps
      if (window.ymaps) {
        window.ymaps.ready(() => {
          if (!mapInstanceRef.current) {
            mapInstanceRef.current = new window.ymaps.Map(mapRef.current, {
              center: [55.75, 37.57], // Москва
              zoom: 10,
              controls: ['zoomControl', 'fullscreenControl']
            });
            initializedRef.current = true;
            console.log('Yandex Map initialized');
          }
          updateMapMarkers();
        });
      }
    } else if (initializedRef.current) {
      updateMapMarkers();
    }
  }, [drivers, activeDriverId, pointsLimit]);

  // Обновление меток на карте
  const updateMapMarkers = () => {
    if (!mapInstanceRef.current) return;

    // Удаляем старые метки
    markersRef.current.forEach(marker => mapInstanceRef.current.geoObjects.remove(marker));
    markersRef.current = [];

    const displayData = getDisplayData();
    if (displayData.length === 0) {
      console.log('Нет данных для отображения на карте');
      return;
    }

    const bounds = new window.ymaps.GeoObjectCollection();

    displayData.forEach(loc => {
      const latitude = toNumber(loc.latitude);
      const longitude = toNumber(loc.longitude);
      const accuracy = toNumber(loc.accuracy);
      const speed = toNumber(loc.speed);
      const timestamp = new Date(loc.timestamp).toLocaleString();

      let preset = 'islands#blueDotIcon';
      let iconColor = '#0000FF'; // Default blue
      if (accuracy <= 10) {
        preset = 'islands#greenDotIcon';
        iconColor = '#008000'; // Green for high accuracy
      } else if (accuracy <= 50) {
        preset = 'islands#orangeDotIcon';
        iconColor = '#FFA500'; // Orange for medium accuracy
      } else {
        preset = 'islands#redDotIcon';
        iconColor = '#FF0000'; // Red for low accuracy
      }

      const placemark = new window.ymaps.Placemark([latitude, longitude], {
        hintContent: `Водитель: ${loc.driver_name}<br>Время: ${timestamp}<br>Точность: ${accuracy}м<br>Скорость: ${speed ? (speed * 3.6).toFixed(1) + ' км/ч' : 'N/A'}`,
        balloonContent: `
          <b>Водитель:</b> ${loc.driver_name}<br>
          <b>Время:</b> ${timestamp}<br>
          <b>Координаты:</b> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}<br>
          <b>Точность:</b> ${accuracy}м<br>
          <b>Скорость:</b> ${speed ? (speed * 3.6).toFixed(1) + ' км/ч' : 'N/A'}<br>
          <b>Направление:</b> ${loc.heading ? loc.heading.toFixed(1) + '°' : 'N/A'}
        `
      }, {
        preset: preset,
        iconColor: iconColor
      });

      mapInstanceRef.current.geoObjects.add(placemark);
      markersRef.current.push(placemark);
      bounds.add(placemark);
    });

    // Добавляем линию маршрута для конкретного водителя
    if (activeDriverId !== 'all' && displayData.length > 1) {
      const polyline = new window.ymaps.Polyline(
        displayData.map(loc => [toNumber(loc.latitude), toNumber(loc.longitude)]),
        {},
        {
          strokeColor: '#0000FF',
          strokeWidth: 4,
          strokeOpacity: 0.7
        }
      );
      mapInstanceRef.current.geoObjects.add(polyline);
      markersRef.current.push(polyline);
    }

    // Центрируем карту на метках
    if (bounds.getLength() > 0) {
      mapInstanceRef.current.setBounds(bounds.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              <CarOutlined /> Отслеживание водителей
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={requestingCoords}
                onClick={requestCoordinatesUpdate}
              >
                Обновить координаты
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={loadDriversData}
              >
                Обновить данные
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Статистика */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title="Всего водителей"
              value={stats.totalDrivers}
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Активных"
              value={stats.activeDrivers}
              prefix={<CarOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="В движении"
              value={stats.movingDrivers}
              prefix={<EnvironmentOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Средняя точность"
              value={stats.avgAccuracy}
              suffix="м"
              prefix={<FilterOutlined />}
            />
          </Col>
        </Row>

        {/* Вкладки и фильтры */}
        <Tabs activeKey={activeDriverId} onChange={setActiveDriverId}>
          <TabPane tab="Все водители" key="all">
            <div ref={mapRef} style={{ width: '100%', height: '500px', marginBottom: 20 }} />
            <Table
              columns={columns}
              dataSource={getDisplayData()}
              rowKey="driver_id"
              loading={loading}
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </TabPane>
          
          {drivers.map(driver => (
            <TabPane tab={driver.name} key={driver.id.toString()}>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <span>Количество последних точек:</span>
                  <Select
                    value={pointsLimit}
                    onChange={setPointsLimit}
                    style={{ width: 100 }}
                  >
                    <Option value={5}>5</Option>
                    <Option value={10}>10</Option>
                    <Option value={15}>15</Option>
                    <Option value={20}>20</Option>
                    <Option value={50}>50</Option>
                    <Option value={100}>100</Option>
                  </Select>
                </Space>
              </div>
              <div ref={mapRef} style={{ width: '100%', height: '500px', marginBottom: 20 }} />
              <Table
                columns={columns}
                dataSource={getDisplayData()}
                rowKey="timestamp"
                loading={loading}
                pagination={{ pageSize: 20 }}
                size="small"
              />
            </TabPane>
          ))}
        </Tabs>

        {lastUpdate && (
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            Последнее обновление: {lastUpdate.toLocaleString('ru-RU')}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnhancedTracking;
