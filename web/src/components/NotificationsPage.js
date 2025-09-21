import React, { useState, useEffect } from 'react';
import { Button, Input, Card, message, List, Typography, Space, Divider, Select, Radio, Form } from 'antd';
import { SendOutlined, NotificationOutlined, DeleteOutlined, UserOutlined, GlobalOutlined, MobileOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const NotificationsPage = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [form] = Form.useForm();

  // Загружаем список уведомлений и пользователей при загрузке компонента
  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('https://web-production-7cfec.up.railway.app/api/notifications/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoadingList(true);
      const response = await fetch('https://web-production-7cfec.up.railway.app/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
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

    if ((selectedType === 'web_user' || selectedType === 'push_user') && !selectedUser) {
      message.error('Выберите получателя');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('https://web-production-7cfec.up.railway.app/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type: selectedType,
          recipientId: selectedUser
        }),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(result.message);
        setTitle('');
        setBody('');
        setSelectedUser(null);
        form.resetFields();
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
      const response = await fetch(`https://web-production-7cfec.up.railway.app/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
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
          <Form form={form} layout="vertical">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                  Тип уведомления:
                </Text>
                <Radio.Group 
                  value={selectedType} 
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="all" style={{ color: 'white' }}>
                      <GlobalOutlined /> Всем (web + push)
                    </Radio>
                    <Radio value="web" style={{ color: 'white' }}>
                      <UserOutlined /> Всем в web
                    </Radio>
                    <Radio value="push" style={{ color: 'white' }}>
                      <MobileOutlined /> Всем в push
                    </Radio>
                    <Radio value="web_user" style={{ color: 'white' }}>
                      <UserOutlined /> Конкретному пользователю (web)
                    </Radio>
                    <Radio value="push_user" style={{ color: 'white' }}>
                      <MobileOutlined /> Конкретному пользователю (push)
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              {(selectedType === 'web_user' || selectedType === 'push_user') && (
                <div>
                  <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                    Выберите получателя:
                  </Text>
                  <Select
                    placeholder="Выберите пользователя"
                    value={selectedUser}
                    onChange={setSelectedUser}
                    style={{ width: '100%' }}
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                  >
                    {users.map(user => (
                      <Option key={user.id} value={user.id}>
                        {user.full_name} ({user.username}) - {user.role}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}

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
                disabled={!title.trim() || !body.trim() || ((selectedType === 'web_user' || selectedType === 'push_user') && !selectedUser)}
                style={{ width: '100%' }}
              >
                {selectedType === 'all' && 'Отправить всем'}
                {selectedType === 'web' && 'Отправить всем в web'}
                {selectedType === 'push' && 'Отправить всем в push'}
                {selectedType === 'web_user' && 'Отправить пользователю (web)'}
                {selectedType === 'push_user' && 'Отправить пользователю (push)'}
              </Button>
            </Space>
          </Form>
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
