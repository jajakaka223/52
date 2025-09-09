import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Row, Col, Statistic, Typography, List, Tag } from 'antd';
import axios from 'axios';
import { getApiUrl } from '../config/api';
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

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVehicles: 0,
    totalOrders: 0,
    completedOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [usersRes, vehiclesRes, ordersRes] = await Promise.all([
          axios.get(getApiUrl('/api/users/stats/overview', { headers }),
          axios.get(getApiUrl('/api/vehicles/stats/overview', { headers }),
          axios.get(getApiUrl('/api/reports/overview', { headers }),
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
        const res = await axios.get(getApiUrl('/api/orders', { headers });
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
      } catch (_) {
        setRecentOrders([]);
      }
    };
    fetchRecent();
  }, []);

  return (
    <div>
      <Title level={2}>Добро пожаловать, {user?.fullName && user.fullName.trim() ? user.fullName.split(' ')[0] : user?.username}!</Title>
      
      <Row gutter={16} style={{ marginBottom: '24px' }}>
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
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Последние заявки">
            <div style={{ marginBottom: '12px', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontWeight: 'bold', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 160px 120px 110px', gap: 16, width: '100%', alignItems: 'center' }}>
                <div style={{ color: 'var(--header-text-color, #000)' }}>Номер</div>
                <div style={{ color: 'var(--header-text-color, #000)' }}>Направление</div>
                <div style={{ color: 'var(--header-text-color, #000)', textAlign: 'right' }}>Компания</div>
                <div style={{ color: 'var(--header-text-color, #000)', textAlign: 'right' }}>Сумма</div>
                <div style={{ color: 'var(--header-text-color, #000)', textAlign: 'right' }}>Статус</div>
              </div>
            </div>
            <List
              size="small"
              dataSource={recentOrders}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 160px 120px 110px', gap: 16, width: '100%', alignItems: 'center' }}>
                    <a
                      href={`#/orders/${item.id}`}
                      style={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1890ff' }}
                      onClick={(e) => {
                        if (window && window.location) {
                          // поддержка history API (если используется react-router с hash)
                          e.preventDefault();
                          window.location.hash = `#/orders/${item.id}`;
                        }
                      }}
                    >
                      №{item.id}
                    </a>
                    <span style={{ whiteSpace: 'nowrap', fontWeight: '500' }}>{item.direction}</span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{item.company}</span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500', color: '#52c41a' }}>{Number(item.amount || 0).toLocaleString('ru-RU')} руб.</span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const preset = statusToColor[item.status] || 'default';
                        const colorMap = {
                          default: '#000',
                          processing: '#69c0ff',
                          warning: '#ffd666',
                          success: '#b7eb8f',
                          error: '#ff7875'
                        };
                        const textColor = colorMap[preset] || undefined;
                        return <Tag color={preset} style={textColor ? { color: textColor } : undefined}>{statusToRu[item.status] || statusToRu['new']}</Tag>;
                      })()}
                    </span>
                  </div>
                </List.Item>
              )}
              locale={{ emptyText: 'Нет заявок' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Доходы" style={{ height: '300px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 8, background: 'var(--income-bg, #102a43)' }}>
                <Title level={4} style={{ margin: 0, color: 'var(--income-text, #fff)' }}>Доход</Title>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: 'var(--income-amount1, #b7eb8f)' }}>
                  {Number(recentOrders.filter(o => o.status === 'completed').reduce((s, x) => s + (Number(x.amount)||0), 0)).toLocaleString('ru-RU')} руб.
                </div>
                <div style={{ marginTop: 6, color: 'var(--income-caption, #ddd)' }}>Завершённые заявки</div>
              </div>
              <div style={{ padding: 16, borderRadius: 8, background: 'var(--income-bg, #102a43)' }}>
                <Title level={4} style={{ margin: 0, color: 'var(--income-text, #fff)' }}>Ожидаемый доход</Title>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 600, color: 'var(--income-amount2, #69c0ff)' }}>
                  {Number(recentOrders.filter(o => ['assigned','in_progress'].includes(o.status)).reduce((s, x) => s + (Number(x.amount)||0), 0)).toLocaleString('ru-RU')} руб.
                </div>
                <div style={{ marginTop: 6, color: 'var(--income-caption, #ddd)' }}>Назначены / В пути</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
