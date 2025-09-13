import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Badge } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import api from '../config/http';

function useAuthHeaders() {
  return useMemo(() => ({
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  }), []);
}

const NotificationBell = ({ isDark, onClick }) => {
  const headers = useAuthHeaders();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications/unread-count', { headers });
      setUnreadCount(res.data?.count || 0);
    } catch (e) {
      // Тихо игнорируем ошибки
    }
  }, [headers]);

  useEffect(() => {
    fetchUnreadCount();
    // Обновляем счетчик каждые 30 секунд
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return (
    <Button
      type="text"
      icon={
        <Badge count={unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : 0} size="small">
          <BellOutlined style={{ fontSize: '18px', color: isDark ? '#fff' : '#000' }} />
        </Badge>
      }
      onClick={onClick}
      style={{ 
        color: isDark ? '#fff' : '#000',
        border: 'none',
        background: 'transparent'
      }}
    />
  );
};

export default NotificationBell;
