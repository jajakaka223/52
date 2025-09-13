import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, List, Button, Typography, Space, Tag, Popconfirm } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../config/http';

const { Title, Text } = Typography;

function useAuthHeaders() {
  return useMemo(() => ({
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  }), []);
}

const Notifications = ({ isDark, open, onClose }) => {
  const headers = useAuthHeaders();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notifications', { headers });
      const data = res.data?.notifications || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (e) {
      // Тихо игнорируем ошибки, чтобы не спамить сообщениями
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchNotifications();
    // Обновляем уведомления каждые 30 секунд
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      // Тихо игнорируем ошибки
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notifications/mark-all-read', {}, { headers });
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (e) {
      // Тихо игнорируем ошибки
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`, { headers });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => {
        const deleted = notifications.find(n => n.id === id);
        return deleted && !deleted.is_read ? Math.max(0, prev - 1) : prev;
      });
    } catch (e) {
      // Тихо игнорируем ошибки
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0, color: isDark ? '#fff' : '#000', whiteSpace: 'nowrap' }}>
              Уведомления
            </Title>
          </div>
        }
        placement="right"
        width={400}
        open={open}
        onClose={onClose}
        bodyStyle={{ 
          background: isDark ? '#1f1f1f' : '#fff',
          padding: 0
        }}
        headerStyle={{ 
          background: isDark ? '#141414' : '#fafafa',
          borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0'
        }}
      >
        <List
          loading={loading}
          dataSource={notifications}
          locale={{ emptyText: 'Нет уведомлений' }}
          footer={
            unreadCount > 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', borderTop: isDark ? '1px solid #303030' : '1px solid #f0f0f0' }}>
                <Button type="primary" onClick={markAllAsRead} style={{ width: '100%' }}>
                  Отметить все прочитанными
                </Button>
              </div>
            ) : null
          }
          renderItem={(item) => (
            <List.Item
              style={{
                background: item.is_read ? 'transparent' : (isDark ? '#0f0f0f' : '#f6f6f6'),
                borderLeft: item.is_read ? 'none' : `3px solid #1890ff`,
                padding: '12px 16px',
                borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0'
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: 8
                }}>
                  <Text strong style={{ color: isDark ? '#fff' : '#000' }}>
                    {item.title}
                  </Text>
                  <Space>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatDate(item.created_at)}
                    </Text>
                    {!item.is_read && (
                      <Tag style={{ background: '#434343', color: '#fff', border: '1px solid #434343', fontWeight: 500 }} size="small">Новое</Tag>
                    )}
                  </Space>
                </div>
                
                <Text style={{ 
                  color: isDark ? '#ccc' : '#666',
                  display: 'block',
                  marginBottom: 8,
                  whiteSpace: 'pre-wrap'
                }}>
                  {item.message}
                </Text>
                
                <Space>
                  {!item.is_read && (
                    <Button 
                      size="small" 
                      icon={<EyeOutlined />}
                      onClick={() => markAsRead(item.id)}
                    >
                      Прочитано
                    </Button>
                  )}
                  <Popconfirm
                    title="Удалить уведомление?"
                    onConfirm={() => deleteNotification(item.id)}
                    okText="Удалить"
                    cancelText="Отмена"
                  >
                    <Button 
                      size="small" 
                      danger 
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                </Space>
              </div>
            </List.Item>
          )}
        />
      </Drawer>
    </>
  );
};

export default Notifications;
