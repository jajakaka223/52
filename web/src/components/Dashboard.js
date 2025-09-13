import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Row, Col, Statistic, Typography, List, Tag } from 'antd';
import api from '../config/http';
import { UserOutlined, CarOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;
const statusToColor = {
  new: 'default',
  assigned: 'processing',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error'
};
const statusToRu = {
  new: 'Новая',
  assigned: 'Назначена',
  in_progress: 'В пути',
  completed: 'Выполнена',
  cancelled: 'Отменена'
};

const Dashboard = ({ user, theme, userPermissions }) => {
  const [isDark, setIsDark] = useState(() => theme === 'dark');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVehicles: 0,
    totalOrders: 0,
    completedOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [monthTotals, setMonthTotals] = useState({ revenue: 0, expected: 0, expense: 0 });

  // Синхронизируем с переданной темой
  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [usersRes, vehiclesRes, ordersRes] = await Promise.all([
          api.get('/api/users/stats/overview', { headers }),
          api.get('/api/vehicles/stats/overview', { headers }),
          api.get('/api/reports/overview', { headers }),
        ]);

        setStats({
          totalUsers: Number(usersRes?.data?.stats?.total_users || 0),
          totalVehicles: Number(vehiclesRes?.data?.stats?.total_vehicles || 0),
          totalOrders: Number(ordersRes?.data?.stats?.total_orders || 0),
          completedOrders: Number(ordersRes?.data?.stats?.completed_orders || 0),
        });
      } catch (error) {
        // тихо игнорируем, показывая нули при ошибке
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get('/api/orders', { headers });
        const orders = Array.isArray(res.data?.orders) ? res.data.orders : [];
        const short = orders
          .slice(0, 10)
          .map(o => ({
            id: o.id,
            date: o.date ? dayjs(o.date).format('DD.MM.YYYY') : '-',
            direction: (o.direction || '').split('\n')[0] || '-',
            company: o.company || '-',
            amount: o.amount || 0,
            status: o.status || 'new'
          }));
        setRecentOrders(short);

        // Агрегаты за текущий месяц
        const start = dayjs().startOf('month');
        const end = dayjs().endOf('month');
        const inMonth = orders.filter(o => {
          const d = o.date ? dayjs(o.date) : null;
          return d && (d.isAfter(start) || d.isSame(start, 'day')) && (d.isBefore(end) || d.isSame(end, 'day'));
        });
        const revenue = inMonth
          .filter(o => o.status === 'completed')
          .reduce((s, x) => s + (Number(x.amount) || 0), 0);
        const expected = inMonth
          .filter(o => ['assigned','in_progress'].includes(o.status))
          .reduce((s, x) => s + (Number(x.amount) || 0), 0);

        // Подтянем расходы из учёта
        let expense = 0;
        try {
          const accRes = await api.get('/api/accounting', {
            headers,
            params: { startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD') }
          });
          expense = (accRes.data?.records || [])
            .filter(r => Number(r.amount) < 0)
            .reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0);
        } catch (_) { /* игнорируем ошибку расходов */ }

        setMonthTotals({ revenue: Number(revenue || 0), expected: Number(expected || 0), expense: Number(expense || 0) });
      } catch (_) {
        setRecentOrders([]);
      }
    };
    fetchRecent();
  }, []);

  return (
    <div>
      <Title level={2}>Добро пожаловать, {user?.fullName && user.fullName.trim() ? user.fullName.split(' ')[0] : user?.username}!</Title>
      
      {userPermissions?.can_view_dashboard_stats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          {userPermissions?.can_view_dashboard_users_count && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="Пользователи"
                  value={stats.totalUsers}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
          )}
          {userPermissions?.can_view_dashboard_vehicles_count && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="Транспорт"
                  value={stats.totalVehicles}
                  prefix={<CarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          )}
          {userPermissions?.can_view_dashboard_orders_count && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="Заявки"
                  value={stats.totalOrders}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          )}
          {userPermissions?.can_view_dashboard_completed_count && (
            <Col span={6}>
              <Card>
                <Statistic
                  title="Выполнено"
                  value={stats.completedOrders}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          )}
        </Row>
      )}

      <Row gutter={16}>
        {userPermissions?.can_view_dashboard_recent_orders && (
          <Col span={12}>
            <Card 
              title="Последние заявки" 
              styles={{ 
                body: { background: isDark ? '#0f0f0f' : undefined, overflowX: 'auto' },
                header: { background: isDark ? '#141414' : undefined, color: isDark ? '#fff' : undefined }
              }}
            >
            {(() => {
              const gridTemplate = '70px minmax(200px,1fr) 200px 120px 110px';
              return (
                <>
                  <style>{`
                    .orders-list .ant-list-item{padding:6px 10px}
                    @media (max-width: 768px){
                      .orders-list .ant-list-item{padding:8px 10px}
                    }
                  `}</style>
                  <div style={{ marginBottom: '12px', padding: '8px 0', borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0', fontWeight: 'bold', fontSize: '12px', color: isDark ? '#fff' : undefined }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 16, width: '100%', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>Номер</div>
                      <div style={{ textAlign: 'center' }}>Направление</div>
                      <div style={{ textAlign: 'center' }}>Компания</div>
                      <div style={{ textAlign: 'center' }}>Сумма</div>
                      <div style={{ textAlign: 'center' }}>Статус</div>
                    </div>
                  </div>
                  <List
                    className="orders-list"
                    size="small"
                    dataSource={recentOrders}
                    renderItem={(item) => (
                      <List.Item style={{ background: isDark ? '#0f0f0f' : undefined }}>
                        <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 16, width: '100%', alignItems: 'center', color: isDark ? '#fff' : undefined }}>
                          <div style={{ textAlign: 'center' }}>
                            <a
                              href={`#/orders/${item.id}`}
                              style={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: isDark ? '#40a9ff' : '#1890ff' }}
                              onClick={(e) => {
                                if (window && window.location) {
                                  e.preventDefault();
                                  window.location.hash = `#/orders/${item.id}`;
                                }
                              }}
                            >
                              №{item.id}
                            </a>
                          </div>
                          <div style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{item.direction}</div>
                          <div style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{item.company}</div>
                          <div style={{ textAlign: 'center', whiteSpace: 'nowrap', fontWeight: '500', color: '#52c41a' }}>{Number(item.amount || 0).toLocaleString('ru-RU')} руб.</div>
                          <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {(() => {
                              const preset = statusToColor[item.status] || 'default';
                              const colorMap = { 
                                default: isDark ? '#434343' : '#d9d9d9', 
                                processing: isDark ? '#1890ff' : '#1890ff', 
                                warning: isDark ? '#faad14' : '#faad14', 
                                success: isDark ? '#52c41a' : '#52c41a', 
                                error: isDark ? '#ff4d4f' : '#ff4d4f' 
                              };
                              const textColor = item.status === 'new' ? '#434343' : (colorMap[preset] || undefined);
                              return <Tag color={preset} style={{ 
                                background: textColor, 
                                color: '#fff',
                                border: `1px solid ${textColor}`,
                                fontWeight: 500
                              }}>{statusToRu[item.status] || statusToRu['new']}</Tag>;
                            })()}
                          </div>
                        </div>
                      </List.Item>
                    )}
                    locale={{ emptyText: 'Нет заявок' }}
                  />
                </>
              );
            })()}
          </Card>
          </Col>
        )}
        {userPermissions?.can_view_dashboard_finances && (
          <Col span={12}>
            <Card 
              title="Доходы и расходы" 
              style={{ height: '300px' }} 
              styles={{ 
                body: { background: isDark ? '#0f0f0f' : undefined },
                header: { background: isDark ? '#141414' : undefined, color: isDark ? '#fff' : undefined }
              }}
            >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
              <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#102a43' : '#102a43', minHeight: 120 }}>
                <Title level={4} style={{ margin: 0, color: '#fff' }}>Доход</Title>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: '#b7eb8f' }}>
                  {Number(monthTotals.revenue || 0).toLocaleString('ru-RU')} руб.
                </div>
                <div style={{ marginTop: 6, color: '#ddd' }}>Завершённые заявки</div>
              </div>
              <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#102a43' : '#102a43', minHeight: 120 }}>
                <Title level={4} style={{ margin: 0, color: '#fff' }}>Расход</Title>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: theme === 'dark' ? '#ff7875' : '#ff4d4f' }}>
                  {Number(monthTotals.expense || 0).toLocaleString('ru-RU')} руб.
                </div>
                <div style={{ marginTop: 6, color: '#ddd' }}>Учёт расходов</div>
              </div>
              <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#102a43' : '#102a43', minHeight: 120 }}>
                <Title level={4} style={{ margin: 0, color: '#fff' }}>Ожидаемый доход</Title>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: '#69c0ff' }}>
                  {Number(monthTotals.expected || 0).toLocaleString('ru-RU')} руб.
                </div>
                <div style={{ marginTop: 6, color: '#ddd' }}>Назначены / В пути</div>
              </div>
            </div>
            <style>{`
              @media (max-width: 992px){
                .ant-row > .ant-col { width: 100% !important; }
              }
              @media (max-width: 768px){
                .ant-card-body > div[style*="grid"]{ grid-template-columns: 1fr !important; }
              }
            `}</style>
          </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default Dashboard;
