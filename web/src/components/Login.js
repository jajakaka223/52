import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', values);
      const { token, user, message: serverMessage } = response.data || {};

      if (token && user) {
        try {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));
        } catch (_) {}
        onLogin(user);
      } else {
        message.error(serverMessage || 'Ошибка входа');
      }
    } catch (error) {
      const backendMsg = error?.response?.data?.error;
      const translated = {
        username: 'Логин обязателен',
        password: 'Пароль обязателен',
        fullName: 'ФИО обязательно'
      };
      const msg = translated[backendMsg] || backendMsg || error?.message || 'Ошибка подключения к серверу';
      message.error(msg);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        title={
          <div style={{ textAlign: 'center', fontSize: '24px' }}>
            52 EXPRESS
          </div>
        }
        style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
      >
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Введите имя пользователя!' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Имя пользователя" 
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Введите пароль!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Пароль"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              size="large"
              style={{ width: '100%' }}
            >
              Войти
            </Button>
          </Form.Item>
        </Form>
        
        
      </Card>
    </div>
  );
};

export default Login;
