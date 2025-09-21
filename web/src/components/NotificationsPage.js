import React, { useState, useEffect } from 'react';
import { Button, Input, Card, message, List, Typography, Space, Divider } from 'antd';
import { SendOutlined, NotificationOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const NotificationsPage = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Загружаем список уведомлений при загрузке компонента
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoadingList(true);
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    } finally {
      setLoadingList(false);
    }
  };

  const sendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      message.error('Заполните заголовок и текст уведомления');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
        }),
      });

      if (response.ok) {
        message.success('Уведомление отправлено успешно!');
        setTitle('');
        setBody('');
        fetchNotifications(); // Обновляем список
      } else {
        const error = await response.json();
        message.error(error.message || 'Ошибка отправки уведомления');
      }
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
      message.error('Ошибка отправки уведомления');
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        message.success('Уведомление удалено');
        fetchNotifications();
      } else {
        message.error('Ошибка удаления уведомления');
      }
    } catch (error) {
      console.error('Ошибка удаления уведомления:', error);
      message.error('Ошибка удаления уведомления');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2} style={{ color: 'white', marginBottom: '24px' }}>
        <NotificationOutlined /> Push-уведомления
      </Title>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Форма отправки уведомления */}
        <Card 
          title="Отправить уведомление" 
          style={{ 
            backgroundColor: '#1f1f1f', 
            border: '1px solid #333',
            color: 'white'
          }}
          headStyle={{ color: 'white', borderBottom: '1px solid #333' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                Заголовок уведомления:
              </Text>
              <Input
                placeholder="Введите заголовок уведомления"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white' }}
                maxLength={100}
              />
            </div>

            <div>
              <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                Текст уведомления:
              </Text>
              <TextArea
                placeholder="Введите текст уведомления"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                style={{ backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white' }}
                maxLength={500}
              />
            </div>

            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={sendNotification}
              loading={loading}
              disabled={!title.trim() || !body.trim()}
              style={{ width: '100%' }}
            >
              Отправить всем устройствам
            </Button>
          </Space>
        </Card>

        {/* Список отправленных уведомлений */}
        <Card 
          title="История уведомлений" 
          style={{ 
            backgroundColor: '#1f1f1f', 
            border: '1px solid #333',
            color: 'white'
          }}
          headStyle={{ color: 'white', borderBottom: '1px solid #333' }}
          extra={
            <Button 
              size="small" 
              onClick={fetchNotifications}
              loading={loadingList}
            >
              Обновить
            </Button>
          }
        >
          <List
            loading={loadingList}
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteNotification(notification.id)}
                    size="small"
                  >
                    Удалить
                  </Button>
                ]}
                style={{ borderBottom: '1px solid #333' }}
              >
                <List.Item.Meta
                  title={
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                      {notification.title}
                    </Text>
                  }
                  description={
                    <div>
                      <Text style={{ color: '#ccc', display: 'block', marginBottom: '4px' }}>
                        {notification.body}
                      </Text>
                      <Text style={{ color: '#666', fontSize: '12px' }}>
                        {formatDate(notification.created_at)}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: 'Уведомления не найдены' }}
          />
        </Card>
      </div>
    </div>
  );
};

export default NotificationsPage;
