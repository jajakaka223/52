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

const EnhancedTracking = () => {
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
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [pointsLimit, setPointsLimit] = useState(10);
  const [activeTab, setActiveTab] = useState('all');

  // Получение уникальных водителей
  const uniqueDrivers = [...new Set(drivers.map(driver => driver.user_id))];

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
        setDrivers(data);
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

  // Фильтрация данных по выбранному водителю и лимиту точек
  const getFilteredData = () => {
    let filtered = drivers;
    
    // Фильтр по водителю
    if (selectedDriver !== 'all') {
      filtered = filtered.filter(driver => driver.user_id === parseInt(selectedDriver));
    }
    
    // Сортировка по времени (новые сначала)
    filtered = filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Лимит точек (только для конкретного водителя)
    if (selectedDriver !== 'all') {
      filtered = filtered.slice(0, pointsLimit);
    } else {
      // Для "Все" показываем только последние точки каждого водителя
      const latestByDriver = {};
      filtered.forEach(driver => {
        if (!latestByDriver[driver.user_id] || 
            new Date(driver.timestamp) > new Date(latestByDriver[driver.user_id].timestamp)) {
          latestByDriver[driver.user_id] = driver;
        }
      });
      filtered = Object.values(latestByDriver);
    }
    
    return filtered;
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
    const filtered = getFilteredData();
    const totalDrivers = uniqueDrivers.length;
    const activeDrivers = filtered.length;
    const avgAccuracy = filtered.length > 0 
      ? filtered.reduce((sum, d) => sum + (d.accuracy || 0), 0) / filtered.length 
      : 0;
    const movingDrivers = filtered.filter(d => d.speed > 0).length;

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

  // Обработка смены вкладки
  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'all') {
      setSelectedDriver('all');
    } else {
      setSelectedDriver(key);
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
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="Все водители" key="all">
            <div style={{ marginBottom: 16 }}>
              <Space>
                <span>Показать последние точки всех водителей</span>
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={getFilteredData()}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </TabPane>
          
          {uniqueDrivers.map(driverId => (
            <TabPane tab={`Водитель ${driverId}`} key={driverId.toString()}>
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
              <Table
                columns={columns}
                dataSource={getFilteredData()}
                rowKey="id"
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
