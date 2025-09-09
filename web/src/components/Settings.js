import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Form, Input, Select, Button, Table, Space, Modal, message, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { getApiUrl } from '../config/api';

const { Title } = Typography;
const { Option } = Select;

function useAuthHeaders() {
  return useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

const Settings = () => {
  const headers = useAuthHeaders();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [editUser, setEditUser] = useState(null);
  const [pwdUser, setPwdUser] = useState(null);

  const requiredTrim = (message) => ({
    validator: (_, value) => {
      const str = value != null ? String(value).trim() : '';
      return str ? Promise.resolve() : Promise.reject(new Error(message));
    }
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(getApiUrl('/api/users', { headers });
      setUsers(res.data?.users || []);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [/* eslint-disable-line react-hooks/exhaustive-deps */]);

  const handleCreate = async (values) => {
    // Жёсткая нормализация и проверка на пустые строки
    const username = values?.username != null ? String(values.username).trim() : '';
    const fullName = values?.fullName != null ? String(values.fullName).trim() : '';
    const password = values?.password != null ? String(values.password) : '';
    const role = values?.role;
    const email = values?.email != null ? String(values.email).trim() : null;
    const phone = values?.phone != null ? String(values.phone).trim() : null;

    if (!username || !fullName) {
      createForm.setFields([
        { name: 'username', errors: username ? [] : ['Укажите логин'] },
        { name: 'fullName', errors: fullName ? [] : ['Укажите ФИО'] },
      ]);
      return;
    }

    try {
      await axios.post(getApiUrl('/api/users', {
        username,
        password,
        fullName,
        role,
        email,
        phone
      }, { headers });
      message.success('Пользователь создан');
      createForm.resetFields();
      fetchUsers();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось создать пользователя');
    }
  };

  const handleUpdate = async (values) => {
    try {
      await axios.put(getApiUrl('/api/users/${editUser.id}`, {
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null
      }, { headers });
      message.success('Пользователь обновлён');
      setEditUser(null);
      fetchUsers();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось обновить пользователя');
    }
  };

  const handleChangePassword = async (values) => {
    try {
      await axios.patch(`/api/users/${pwdUser.id}/password`, {
        newPassword: values.newPassword
      }, { headers });
      message.success('Пароль изменён');
      setPwdUser(null);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось изменить пароль');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Логин', dataIndex: 'username' },
    { title: 'ФИО', dataIndex: 'full_name' },
    { title: 'Роль', dataIndex: 'role' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Телефон', dataIndex: 'phone' },
    {
      title: 'Действия',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => { setEditUser(r); editForm.setFieldsValue({ full_name: r.full_name, email: r.email, phone: r.phone }); }}>Редактировать</Button>
          <Button size="small" onClick={() => { setPwdUser(r); }}>Пароль</Button>
          <Popconfirm title="Удалить пользователя?" okText="Удалить" cancelText="Отмена" onConfirm={async () => {
            try {
              await axios.delete(getApiUrl('/api/users/${r.id}`, { headers });
              message.success('Пользователь удалён');
              fetchUsers();
            } catch (e) {
              message.error(e?.response?.data?.error || 'Не удалось удалить пользователя');
            }
          }}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={2}>Настройки</Title>

      <Card title="Создать аккаунт" style={{ marginBottom: 16 }}>
        <Form layout="vertical" form={createForm} onFinish={handleCreate} initialValues={{ role: 'driver' }} validateTrigger={["onBlur","onSubmit"]}>
          <div style={{ width: '100%' }}>
            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 16 }}>
              <div style={{ gridColumn: 'span 1' }}>
                <Form.Item name="username" label="Логин" rules={[requiredTrim('Укажите логин')]} normalize={v => (v != null ? String(v).trim() : v)}>
                  <Input onChange={(e) => { const v = (e.target.value || '').trim(); if (v) createForm.setFields([{ name: 'username', errors: [] }]); }} />
                </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <Form.Item name="password" label="Пароль" rules={[requiredTrim('Укажите пароль'), { min: 6, message: 'Минимум 6 символов' }]}>
                  <Input.Password />
                </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Form.Item name="fullName" label="ФИО" rules={[requiredTrim('Укажите ФИО')]} normalize={v => (v != null ? String(v).trim() : v)}>
                  <Input onChange={(e) => { const v = (e.target.value || '').trim(); if (v) createForm.setFields([{ name: 'fullName', errors: [] }]); }} />
                </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <Form.Item name="role" label="Роль" rules={[{ required: true, message: 'Выберите роль' }]}> 
                  <Select allowClear>
                    <Option value="admin">Администратор</Option>
                    <Option value="driver">Водитель</Option>
                  </Select>
                </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Form.Item name="email" label="Email" normalize={v => (v != null ? String(v).trim() : v)}> <Input /> </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Form.Item name="phone" label="Телефон" rules={[{ required: true, message: 'Укажите телефон' }]} normalize={v => (v != null ? String(v).trim() : v)}>
                  <Input />
                </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 1', alignSelf: 'end' }}>
                <Form.Item>
                  <Button type="primary" htmlType="submit" style={{ width: '100%' }}>Создать</Button>
                </Form.Item>
              </div>
            </div>
          </div>
        </Form>
      </Card>

      <Card title="Пользователи">
        <Table rowKey="id" loading={loading} columns={columns} dataSource={users} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="Редактировать пользователя" open={!!editUser} onCancel={() => setEditUser(null)} footer={null}>
        <Form layout="vertical" form={editForm} onFinish={handleUpdate} validateTrigger={["onChange","onBlur","onSubmit"]}>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}> <Input /> </Form.Item>
          <Form.Item name="email" label="Email"> <Input /> </Form.Item>
          <Form.Item name="phone" label="Телефон"> <Input /> </Form.Item>
          <Button type="primary" htmlType="submit">Сохранить</Button>
        </Form>
      </Modal>

      <Modal title="Изменить пароль" open={!!pwdUser} onCancel={() => setPwdUser(null)} footer={null} afterOpenChange={(open) => { if (open) passwordForm.resetFields(); }}>
        <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword}>
          <Form.Item name="newPassword" label="Новый пароль" rules={[{ required: true, min: 6 }]}> <Input.Password /> </Form.Item>
          <Button type="primary" htmlType="submit">Изменить</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;

