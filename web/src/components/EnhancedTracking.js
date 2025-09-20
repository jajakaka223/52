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
  const driverMapRefs = useRef({});
  const mapInstances = useRef({});
  const markersRef = useRef([]);
  const resizeObserverRef = useRef(null);
  
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [requestingCoords, setRequestingCoords] = useState(false);
  const [activeDriverId, setActiveDriverId] = useState('all');
  const [pointsLimit, setPointsLimit] = useState(10);

  // Получение ref для карты в зависимости от активной вкладки
  const getMapRef = (driverId) => {
    if (driverId === 'all') {
      return mapRef;
    }
    if (!driverMapRefs.current[driverId]) {
      driverMapRefs.current[driverId] = { current: null };
    }
    return driverMapRefs.current[driverId];
  };


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
      const selectedDriver = drivers.find(d => d.id.toString() === activeDriverId.toString());
      console.log('Selected driver:', selectedDriver, 'for ID:', activeDriverId);
      if (selectedDriver && selectedDriver.location_history) {
        const history = selectedDriver.location_history
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, pointsLimit)
          .map(loc => ({ 
            ...loc, 
            key: loc.timestamp, 
            driver_name: selectedDriver.name, 
            driver_id: activeDriverId 
          }));
        console.log('Driver history:', history);
        return history;
      }
      console.log('No driver or history found');
      return [];
    }
  };

  // Форматирование скорости
  const formatSpeed = (speed) => {
    const numSpeed = toNumber(speed, 0);
    if (numSpeed === 0) return '0 км/ч';
    const kmh = (numSpeed * 3.6).toFixed(1);
    return `${kmh} км/ч`;
  };

  // Форматирование точности
  const formatAccuracy = (accuracy) => {
    const numAccuracy = toNumber(accuracy, 0);
    if (numAccuracy === 0) return 'Неизвестно';
    return `${numAccuracy.toFixed(1)} м`;
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Неизвестно';
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
  };

  // Получение цвета статуса по точности
  const getAccuracyColor = (accuracy) => {
    const numAccuracy = toNumber(accuracy, 0);
    if (numAccuracy === 0) return 'default';
    if (numAccuracy <= 10) return 'green';
    if (numAccuracy <= 50) return 'orange';
    return 'red';
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Водитель',
      dataIndex: 'driver_name',
      key: 'driver_name',
      render: (driverName) => (
        <Space>
          <UserOutlined />
          <span>{driverName || 'Неизвестно'}</span>
        </Space>
      ),
    },
    {
      title: 'Координаты',
      key: 'coordinates',
      render: (record) => {
        const lat = toNumber(record.latitude, 0);
        const lng = toNumber(record.longitude, 0);
        return (
          <Space>
            <EnvironmentOutlined />
            <span>{lat.toFixed(6)}, {lng.toFixed(6)}</span>
          </Space>
        );
      },
    },
    {
      title: 'Скорость',
      dataIndex: 'speed',
      key: 'speed',
      render: (speed) => {
        const numSpeed = toNumber(speed, 0);
        return (
          <Tag color={numSpeed > 0 ? 'blue' : 'default'}>
            {formatSpeed(speed)}
          </Tag>
        );
      },
    },
    {
      title: 'Точность',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy) => {
        const numAccuracy = toNumber(accuracy, 0);
        return (
          <Tag color={getAccuracyColor(numAccuracy)}>
            {formatAccuracy(accuracy)}
          </Tag>
        );
      },
    },
    {
      title: 'Направление',
      dataIndex: 'heading',
      key: 'heading',
      render: (heading) => {
        const numHeading = toNumber(heading, 0);
        return (
          <span>{numHeading > 0 ? `${numHeading.toFixed(0)}°` : '—'}</span>
        );
      },
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
    const initMap = async () => {
      const currentMapRef = getMapRef(activeDriverId);
      const mapKey = activeDriverId;
      
      // Ждем, пока ref будет готов
      const waitForRef = () => {
        return new Promise((resolve) => {
          const checkRef = () => {
            if (currentMapRef.current) {
              resolve();
            } else {
              setTimeout(checkRef, 100);
            }
          };
          checkRef();
        });
      };

      if (!mapInstances.current[mapKey]) {
        try {
          await waitForRef();
          
          // Загружаем Yandex Maps API
          if (!window.ymaps) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }

          window.ymaps.ready(() => {
            if (!mapInstances.current[mapKey] && currentMapRef.current) {
              mapInstances.current[mapKey] = new window.ymaps.Map(currentMapRef.current, {
                center: [55.75, 37.57], // Москва
                zoom: 10,
                controls: ['zoomControl', 'fullscreenControl']
              });
              console.log(`Yandex Map initialized for ${mapKey}`);
              // Небольшая задержка перед обновлением маркеров
              setTimeout(() => {
                updateMapMarkers();
              }, 100);
            }
          });
        } catch (error) {
          console.error('Ошибка загрузки Yandex Maps:', error);
          // Показываем заглушку
          if (currentMapRef.current) {
            currentMapRef.current.innerHTML = `
              <div style="
                height: 500px; 
                width: 100%; 
                background: #1f1f1f; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                border: 2px dashed #303030;
                color: #fff;
                font-size: 16px;
                text-align: center;
              ">
                <div>
                  <div style="font-size: 24px; margin-bottom: 10px;">🗺️</div>
                  <div>Карта недоступна</div>
                  <div style="font-size: 12px; margin-top: 5px;">Ошибка загрузки Yandex Maps</div>
                </div>
              </div>
            `;
          }
        }
      } else {
        // Карта уже существует, обновляем маркеры
        setTimeout(() => {
          updateMapMarkers();
        }, 100);
      }
    };

    initMap();
  }, [drivers, activeDriverId, pointsLimit]);

  // Обновление меток на карте
  const updateMapMarkers = () => {
    const mapKey = activeDriverId;
    const mapInstance = mapInstances.current[mapKey];
    if (!mapInstance) return;

    // Удаляем старые метки
    markersRef.current.forEach(marker => mapInstance.geoObjects.remove(marker));
    markersRef.current = [];

    const displayData = getDisplayData();
    if (displayData.length === 0) {
      console.log('Нет данных для отображения на карте');
      return;
    }

    const points = [];

    displayData.forEach(loc => {
      const latitude = toNumber(loc.latitude);
      const longitude = toNumber(loc.longitude);
      const accuracy = toNumber(loc.accuracy);
      const speed = toNumber(loc.speed);
      const timestamp = new Date(loc.timestamp).toLocaleString();

      if (latitude === 0 || longitude === 0) return; // Пропускаем невалидные координаты

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
          <b>Направление:</b> ${loc.heading ? toNumber(loc.heading).toFixed(1) + '°' : 'N/A'}
        `
      }, {
        preset: preset,
        iconColor: iconColor
      });

      mapInstance.geoObjects.add(placemark);
      markersRef.current.push(placemark);
      points.push([latitude, longitude]);
    });

    // Убираем линии маршрута - показываем только метки

    // Центрируем карту на метках
    if (points.length > 0) {
      if (points.length === 1) {
        mapInstance.setCenter(points[0], 16);
      } else {
        mapInstance.setBounds(window.ymaps.util.bounds.fromPoints(points), {
          checkZoomRange: true,
          zoomMargin: 30
        });
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <style>
        {`
          .ant-tabs-tab {
            color: #fff !important;
          }
          .ant-tabs-tab:hover {
            color: #1890ff !important;
          }
          .ant-tabs-tab-active {
            color: #1890ff !important;
          }
          .ant-tabs-tab-active .ant-tabs-tab-btn {
            color: #1890ff !important;
          }
          .ant-tabs-ink-bar {
            background-color: #1890ff !important;
          }
        `}
      </style>
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
              valueStyle={{ color: '#1890ff' }}
              titleStyle={{ color: '#fff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Активных"
              value={stats.activeDrivers}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              titleStyle={{ color: '#fff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="В движении"
              value={stats.movingDrivers}
              prefix={<EnvironmentOutlined />}
              valueStyle={{ color: '#faad14' }}
              titleStyle={{ color: '#fff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Средняя точность"
              value={stats.avgAccuracy}
              suffix="м"
              prefix={<FilterOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              titleStyle={{ color: '#fff' }}
            />
          </Col>
        </Row>

        {/* Вкладки и фильтры */}
        <Tabs 
          activeKey={activeDriverId} 
          onChange={setActiveDriverId}
          tabBarStyle={{ color: '#fff' }}
          style={{ color: '#fff' }}
        >
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
                  <span style={{ color: '#fff' }}>Количество последних точек:</span>
                  <Select
                    value={pointsLimit}
                    onChange={setPointsLimit}
                    style={{ width: 100 }}
                    dropdownStyle={{ backgroundColor: '#1f1f1f' }}
                  >
                    <Option value={5} style={{ color: '#fff' }}>5</Option>
                    <Option value={10} style={{ color: '#fff' }}>10</Option>
                    <Option value={15} style={{ color: '#fff' }}>15</Option>
                    <Option value={20} style={{ color: '#fff' }}>20</Option>
                    <Option value={50} style={{ color: '#fff' }}>50</Option>
                    <Option value={100} style={{ color: '#fff' }}>100</Option>
                  </Select>
                </Space>
              </div>
              <div ref={getMapRef(driver.id)} style={{ width: '100%', height: '500px', marginBottom: 20 }} />
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
