import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, message, Space, Tooltip } from 'antd';
import { UserOutlined, LogoutOutlined, DashboardOutlined, CarOutlined, FileTextOutlined, BarChartOutlined, SettingOutlined, BulbOutlined, DollarOutlined } from '@ant-design/icons';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Orders from './components/Orders';
import Vehicles from './components/Vehicles';
import Reports from './components/Reports';
import Tracking from './components/Tracking';
import Settings from './components/Settings';
import Expenses from './components/Expenses';

const { Header, Sider, Content } = Layout;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState(() => localStorage.getItem('ui_selected_menu') || 'dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('ui_theme') || 'light');

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    message.success('Вход выполнен успешно!');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setSelectedMenu('dashboard');
    message.info('Выход выполнен');
  };

  // авто-восстановление сессии по токену
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (!token) return;
    try {
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch (_) {}
    fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setIsLoggedIn(true))
      .catch(() => {
        // токен недействителен — очищаем
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      });
  }, []);

  // синхронизируем тему
  useEffect(() => {
    localStorage.setItem('ui_theme', theme);
    try { document.body.setAttribute('data-theme', theme); } catch (_) {}
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  // сохраняем выбранную вкладку, чтобы после F5 остаться на той же
  useEffect(() => {
    try { localStorage.setItem('ui_selected_menu', selectedMenu); } catch (_) {}
  }, [selectedMenu]);

  // Переключение раздела по хэшу: #/orders и #/orders/:id
  useEffect(() => {
    const syncFromHash = () => {
      if (typeof window === 'undefined') return;
      const h = String(window.location.hash || '');
      if (/^#\/orders(\/\d+)?$/.test(h)) {
        setSelectedMenu('orders');
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'orders':
        return <Orders user={user} />;
      case 'expenses':
        return <Expenses user={user} />;
      case 'vehicles':
        return <Vehicles user={user} />;
      case 'tracking':
        return <Tracking user={user} />;
      case 'reports':
        return <Reports user={user} />;
      case 'settings':
        return <Settings user={user} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: theme === 'dark' ? '#0f0f0f' : '#f5f5f5' }}>
      <Sider width={250} theme={theme === 'dark' ? 'dark' : 'light'}>
        <div style={{ padding: '16px', color: theme === 'dark' ? 'white' : '#111', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-52express.png" alt={'52 EXPRESS'} style={{ width: 40, height: 40, objectFit: 'contain', display: 'block', opacity: 0.95 }} />
          <div style={{ fontFamily: 'PFDinTextPro-Bold, system-ui, -apple-system, Segoe UI, Roboto, Arial', fontWeight: 700, letterSpacing: 1, fontSize: 20, color: theme === 'dark' ? '#fff' : '#000' }}>52 EXPRESS</div>
        </div>
        <Menu
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[selectedMenu]}
          onSelect={({ key }) => setSelectedMenu(key)}
        >
          <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
            Главная
          </Menu.Item>
          <Menu.Item key="orders" icon={<FileTextOutlined />}>
            Заявки
          </Menu.Item>
          <Menu.Item key="expenses" icon={<DollarOutlined />}>
            Расход
          </Menu.Item>
          <Menu.Item key="vehicles" icon={<CarOutlined />}>
            Транспорт
          </Menu.Item>
          <Menu.Item key="tracking" icon={<BarChartOutlined />}>
            GPS Мониторинг
          </Menu.Item>
          <Menu.Item key="reports" icon={<BarChartOutlined />}>
            Отчеты
          </Menu.Item>
          <Menu.Item key="settings" icon={<SettingOutlined />}>
            Настройки
          </Menu.Item>
        </Menu>
      </Sider>
      
      <Layout>
        <Header style={{ background: theme === 'dark' ? '#1c1c1c' : '#fff', color: theme === 'dark' ? '#ddd' : '#000', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ marginRight: '16px' }}>
              <UserOutlined /> {user?.fullName && user.fullName.trim() ? user.fullName.split(' ')[0] : user?.username}
            </span>
            <span style={{ color: '#666' }}>
              {user?.role === 'admin' ? 'Администратор' : 'Водитель'}
            </span>
          </div>
          <Space>
            <Tooltip title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              <Button type="text" icon={<BulbOutlined />} onClick={toggleTheme} />
            </Tooltip>
            <Button 
              type="text" 
              icon={<LogoutOutlined />} 
              onClick={handleLogout}
            >
              Выход
            </Button>
          </Space>
        </Header>
        
        <Content style={{ margin: '16px', padding: '16px', background: theme === 'dark' ? '#1f1f1f' : '#fff', borderRadius: '6px' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
