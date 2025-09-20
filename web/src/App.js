import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Menu, Button, message, Space, Tooltip, ConfigProvider } from 'antd';
import ruRU from 'antd/es/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import api from './config/http';
import { UserOutlined, LogoutOutlined, DashboardOutlined, CarOutlined, FileTextOutlined, BarChartOutlined, SettingOutlined, BulbOutlined, DollarOutlined, ToolOutlined, EnvironmentOutlined, CreditCardOutlined } from '@ant-design/icons';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Orders from './components/Orders';
import Vehicles from './components/Vehicles';
import Reports from './components/Reports';
import EnhancedTracking from './components/EnhancedTracking';
import Settings from './components/Settings';
import Expenses from './components/Expenses';
import Maintenance from './components/Maintenance';
import Budget from './components/Budget';
import Salary from './components/Salary';
import NotificationBell from './components/NotificationBell';
import Notifications from './components/Notifications';

const { Header, Sider, Content } = Layout;

function App() {
  dayjs.locale('ru');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState(() => localStorage.getItem('ui_selected_menu') || 'dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('ui_theme') || 'light');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    message.success('Вход выполнен успешно!');
    // Загружаем права сразу после входа
    if (userData?.role) {
      fetchUserPermissions(userData.role);
    }
  };

  // Функция для получения прав пользователя
  const fetchUserPermissions = useCallback(async (userRole) => {
    const role = userRole || user?.role;
    if (!role) return;
    try {
      const response = await api.get('/api/users/my-permissions');
      if (response.status === 200) {
        setUserPermissions(response.data.permissions);
      } else {
        // Если не удалось получить права, устанавливаем базовые права
        setUserPermissions({
          can_view_dashboard: true,
          can_view_orders: true,
          can_edit_orders: false,
          can_create_orders: false,
          can_view_reports: false,
          can_edit_reports: false,
          can_view_vehicles: false,
          can_edit_vehicles: false,
          can_view_tracking: false,
          can_edit_tracking: false,
          can_view_settings: false,
          can_edit_users: false,
          can_manage_roles: false,
          can_view_dashboard_stats: false,
          can_view_dashboard_users_count: false,
          can_view_dashboard_vehicles_count: false,
          can_view_dashboard_orders_count: false,
          can_view_dashboard_completed_count: false,
          can_view_dashboard_recent_orders: false,
          can_view_dashboard_finances: false,
          can_view_menu_budget: false,
          can_view_menu_expenses: false,
          can_view_menu_salary: false,
          can_edit_salary: false,
          can_view_menu_vehicles: false,
          can_view_menu_maintenance: false,
          can_view_menu_tracking: false,
          can_view_menu_reports: false,
          can_delete_any: false,
          can_assign_drivers: false,
          can_send_notifications: false,
          can_view_notifications: false
        });
      }
    } catch (error) {
      console.error('Ошибка получения прав пользователя:', error);
      // Устанавливаем базовые права в случае ошибки
      setUserPermissions({
        can_view_dashboard: true,
        can_view_orders: true,
        can_edit_orders: false,
        can_create_orders: false,
        can_view_reports: false,
        can_edit_reports: false,
        can_view_vehicles: false,
        can_edit_vehicles: false,
        can_view_tracking: false,
        can_edit_tracking: false,
        can_view_settings: false,
        can_edit_users: false,
        can_manage_roles: false,
        can_view_dashboard_stats: false,
        can_view_dashboard_users_count: false,
        can_view_dashboard_vehicles_count: false,
        can_view_dashboard_orders_count: false,
        can_view_dashboard_completed_count: false,
        can_view_dashboard_recent_orders: false,
        can_view_dashboard_finances: false,
        can_view_menu_budget: false,
        can_view_menu_expenses: false,
        can_view_menu_salary: false,
        can_edit_salary: false,
        can_view_menu_vehicles: false,
        can_view_menu_maintenance: false,
        can_view_menu_tracking: false,
        can_view_menu_reports: false,
        can_delete_any: false,
        can_assign_drivers: false,
        can_send_notifications: false,
        can_view_notifications: false
      });
    }
  }, [user?.role]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setUserPermissions(null);
    setSelectedMenu('dashboard');
    // Очищаем localStorage при выходе
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    message.info('Выход выполнен');
  };

  // авто-восстановление сессии по токену
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('auth_user');
      
      if (!token || !savedUser) {
        // Нет токена или пользователя - показываем логин
        setIsLoggedIn(false);
        setUser(null);
        return;
      }
      
      try {
        // Восстанавливаем пользователя
        const userData = JSON.parse(savedUser);
        setUser(userData);
        
        // Проверяем токен на сервере
        await api.get('/api/auth/verify');
        setIsLoggedIn(true);
        
        // Загружаем права пользователя
        if (userData?.role) {
          fetchUserPermissions(userData.role);
        }
      } catch (error) {
        console.warn('Token verification failed:', error);
        // Если токен недействителен, выходим
        setIsLoggedIn(false);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    };
    
    checkAuth();
  }, [fetchUserPermissions]);

  // Загружаем права пользователя при изменении пользователя
  useEffect(() => {
    if (user?.role) {
      fetchUserPermissions(user.role);
    }
  }, [user?.role, fetchUserPermissions]);

  // синхронизируем тему
  useEffect(() => {
    localStorage.setItem('ui_theme', theme);
    try { document.body.setAttribute('data-theme', theme); } catch (_) {}
  }, [theme]);

  // Принудительно обновляем компоненты при смене темы
  const [themeKey, setThemeKey] = useState(0);
  useEffect(() => {
    setThemeKey(prev => prev + 1);
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
        return <Dashboard user={user} theme={theme} userPermissions={userPermissions} />;
      case 'orders':
        return <Orders user={user} theme={theme} userPermissions={userPermissions} />;
      case 'budget':
        return <Budget userPermissions={userPermissions} />;
      case 'expenses':
        return <Expenses user={user} theme={theme} userPermissions={userPermissions} />;
      case 'salary':
        return <Salary userPermissions={userPermissions} user={user} />;
      case 'vehicles':
        return <Vehicles user={user} userPermissions={userPermissions} />;
      case 'maintenance':
        return <Maintenance userPermissions={userPermissions} />;
      case 'tracking':
        return <EnhancedTracking user={user} userPermissions={userPermissions} />;
      case 'reports':
        return <Reports user={user} theme={theme} userPermissions={userPermissions} />;
      case 'settings':
        return <Settings user={user} userPermissions={userPermissions} />;
      default:
        return <Dashboard user={user} theme={theme} userPermissions={userPermissions} />;
    }
  };


  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ConfigProvider locale={ruRU}>
    <Layout style={{ minHeight: '100vh', background: theme === 'dark' ? '#0f0f0f' : '#f5f5f5' }}>
      <Sider
        width={250}
        collapsible
        collapsed={isCollapsed}
        onCollapse={setIsCollapsed}
        breakpoint="lg"
        theme={theme === 'dark' ? 'dark' : 'light'}
        trigger={
          <div style={{ 
            height: 48, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderTop: theme === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0', 
            background: theme === 'dark' ? '#141414' : undefined 
          }}>
            <Button
              type="primary"
              size="small"
              style={{ background: '#1677ff', borderColor: '#1677ff', color: '#fff' }}
            >
              {isCollapsed ? '>' : '<'}
            </Button>
          </div>
        }
      >
        <div style={{ padding: '16px', color: theme === 'dark' ? 'white' : '#111', display: 'flex', alignItems: 'center', gap: 12, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <img src="/logo-52express.png" alt={'52 EXPRESS'} style={{ width: 40, height: 40, objectFit: 'contain', display: 'block', opacity: 0.95 }} />
          {!isCollapsed && (
            <div style={{ fontFamily: 'PFDinTextPro-Bold, system-ui, -apple-system, Segoe UI, Roboto, Arial', fontWeight: 700, letterSpacing: 1, fontSize: 20, color: theme === 'dark' ? '#fff' : '#000' }}>52 EXPRESS</div>
          )}
        </div>
        <Menu
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[selectedMenu]}
          onSelect={({ key }) => setSelectedMenu(key)}
        >
          {/* Показываем меню если права загружены или если это базовые права */}
          {(!userPermissions || userPermissions?.can_view_dashboard) && (
            <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
              Главная
            </Menu.Item>
          )}
          {(!userPermissions || userPermissions?.can_view_orders) && (
            <Menu.Item key="orders" icon={<FileTextOutlined />}>
              Заявки
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_budget && (
            <Menu.Item key="budget" icon={<BarChartOutlined />}>
              Бюджет
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_expenses && (
            <Menu.Item key="expenses" icon={<DollarOutlined />}>
              Расход
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_salary && (
            <Menu.Item key="salary" icon={<CreditCardOutlined />}>
              Зарплата
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_vehicles && (
            <Menu.Item key="vehicles" icon={<CarOutlined />}>
              Транспорт
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_maintenance && (
            <Menu.Item key="maintenance" icon={<ToolOutlined />}>
              ТО
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_tracking && (
            <Menu.Item key="tracking" icon={<EnvironmentOutlined />}>
              GPS Мониторинг
            </Menu.Item>
          )}
          {userPermissions?.can_view_menu_reports && (
            <Menu.Item key="reports" icon={<BarChartOutlined />}>
              Отчеты
            </Menu.Item>
          )}
          {userPermissions?.can_view_settings && (
            <Menu.Item key="settings" icon={<SettingOutlined />}>
              Настройки
            </Menu.Item>
          )}
        </Menu>
      </Sider>
      
      <Layout>
        <Header style={{ background: theme === 'dark' ? '#1c1c1c' : '#fff', color: theme === 'dark' ? '#ddd' : '#000', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ marginRight: '16px' }}>
              <UserOutlined /> {user?.fullName && user.fullName.trim() ? user.fullName.split(' ')[0] : user?.username}
            </span>
            <span style={{ color: '#666' }}>
              {user?.role_title || (user?.role === 'admin' ? 'Администратор' : 'Водитель')}
            </span>
          </div>
          <Space>
            {userPermissions?.can_send_notifications && (
              <NotificationBell 
                isDark={theme === 'dark'} 
                onClick={() => setNotificationsOpen(true)}
              />
            )}
            <Tooltip title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              <Button
                type="primary"
                style={theme === 'dark' ? { background: '#faad14', borderColor: '#faad14', color: '#000' } : { background: '#1890ff', borderColor: '#1890ff', color: '#fff' }}
                icon={<BulbOutlined />}
                onClick={toggleTheme}
              />
            </Tooltip>
            <Button 
              type="primary"
              style={theme === 'dark' ? { background: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' } : { background: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
              icon={<LogoutOutlined />} 
              onClick={handleLogout}
            >
              Выход
            </Button>
          </Space>
        </Header>
        
        <Content style={{ margin: '12px', padding: '12px', background: theme === 'dark' ? '#1f1f1f' : '#fff', borderRadius: '6px' }}>
          <div key={themeKey}>
            {renderContent()}
          </div>
        </Content>
      </Layout>
      
      {/* Drawer с уведомлениями */}
      <Notifications 
        isDark={theme === 'dark'} 
        open={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
      />
    </Layout>
    </ConfigProvider>
  );
}

export default App;
