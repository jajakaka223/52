import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Form, Input, Select, Button, Table, Space, Modal, message, Popconfirm, Checkbox, Divider, List } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import api, { invalidateGetCache } from '../config/http';

const { Title } = Typography;
const { Option } = Select;

function useAuthHeaders() {
  return useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

const Settings = ({ user, userPermissions }) => {
  const headers = useAuthHeaders();
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [editUser, setEditUser] = useState(null);
  const [pwdUser, setPwdUser] = useState(null);
  const canEditRole = (user?.role || '').toLowerCase() === 'admin';
  const [roles, setRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState(null);
  const [permModalOpen, setPermModalOpen] = useState(false);

  // Слушаем изменения темы
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark');
    };
    
    // Проверяем при монтировании
    checkTheme();
    
    // Слушаем изменения атрибута
    const observer = new MutationObserver(checkTheme);
    if (typeof document !== 'undefined') {
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    }
    
    return () => observer.disconnect();
  }, []);

  const requiredTrim = (message) => ({
    validator: (_, value) => {
      const str = value != null ? String(value).trim() : '';
      return str ? Promise.resolve() : Promise.reject(new Error(message));
    }
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/users', { headers });
      setUsers(res.data?.users || []);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/users/roles/list', { headers });
      setRoles(res.data?.roles || []);
    } catch (_) {}
  };

  useEffect(() => { fetchUsers(); fetchRoles(); }, [/* eslint-disable-line react-hooks/exhaustive-deps */]);

  const handleCreate = async (values) => {
    // Жёсткая нормализация и проверка на пустые строки
    const username = values?.username != null ? String(values.username).trim() : '';
    const fullName = values?.fullName != null ? String(values.fullName).trim() : '';
    const password = values?.password != null ? String(values.password) : '';
    const roleInput = values?.role;
    const role = Array.isArray(roleInput) ? roleInput[0] : roleInput;
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
      await api.post('/api/users', {
        username,
        password,
        fullName,
        role,
        email,
        phone
      }, { headers });
      message.success('Пользователь создан');
      createForm.resetFields();
      invalidateGetCache('/api/users');
      fetchUsers();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось создать пользователя');
    }
  };

  const openPerms = async (roleKey) => {
    try {
      const { data } = await api.get(`/api/users/roles/${encodeURIComponent(roleKey)}/permissions`, { headers });
      setRolePermissions({ role_key: roleKey, ...(data?.permissions || {}) });
      setPermModalOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось получить права роли');
    }
  };

  const savePerms = async () => {
    if (!rolePermissions?.role_key) return;
    const payload = { ...rolePermissions };
    delete payload.role_key;
    try {
      await api.put(`/api/users/roles/${encodeURIComponent(rolePermissions.role_key)}/permissions`, payload, { headers });
      message.success('Права роли сохранены');
      setPermModalOpen(false);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось сохранить права');
    }
  };


  const handleUpdate = async (values) => {
    try {
      const { data } = await api.put(`/api/users/${editUser.id}`, {
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
        role: values.role
      }, { headers });
      message.success('Пользователь обновлён');
      setEditUser(null);
      try {
        const updatedUser = data?.user;
        if (updatedUser) {
          setUsers(prev => prev.map(u => (u.id === updatedUser.id ? updatedUser : u)));
        }
      } catch (_) {}
      invalidateGetCache('/api/users');
      fetchUsers();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось обновить пользователя');
    }
  };

  const handleChangePassword = async (values) => {
    try {
      await api.patch(`/api/users/${pwdUser.id}/password`, {
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
    { title: 'Роль', dataIndex: 'role', render: (v) => (roles.find(r => r.key === v)?.title || (v === 'admin' ? 'Администратор' : (v === 'driver' ? 'Водитель' : v))) },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Телефон', dataIndex: 'phone' },
    {
      title: 'Действия',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => { setEditUser(r); editForm.setFieldsValue({ full_name: r.full_name, email: r.email, phone: r.phone, role: r.role }); }}>Редактировать</Button>
          <Button size="small" onClick={() => { setPwdUser(r); }}>Пароль</Button>
          <Popconfirm title="Удалить пользователя?" okText="Удалить" cancelText="Отмена" onConfirm={async () => {
            try {
              await api.delete(`/api/users/${r.id}`, { headers });
              message.success('Пользователь удалён');
              invalidateGetCache('/api/users');
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
      <style>{`
        [data-theme="dark"] .ant-table-tbody > tr:hover > td {
          background: #1f1f1f !important;
          border-color: #303030 !important;
        }
        [data-theme="dark"] .ant-table-tbody > tr.ant-table-row:hover > td {
          background: #1f1f1f !important;
          border-color: #303030 !important;
        }
        [data-theme="dark"] .ant-table-tbody > tr.ant-table-row-selected:hover > td {
          background: #1f1f1f !important;
          border-color: #303030 !important;
        }
        [data-theme="dark"] .ant-table-tbody > tr.ant-table-row-selected > td {
          background: #1f1f1f !important;
          border-color: #303030 !important;
        }
        [data-theme="dark"] .ant-table-tbody > tr > td {
          border-color: #303030 !important;
        }
        [data-theme="dark"] .ant-table-thead > tr > th {
          border-color: #303030 !important;
          background: #141414 !important;
        }
        [data-theme="dark"] .ant-table-tbody > tr > td.ant-table-cell-row-hover {
          background: #1f1f1f !important;
          border-color: #303030 !important;
        }
        .ant-input::placeholder {
          color: #8c8c8c !important;
        }
        .ant-input:focus::placeholder {
          color: #8c8c8c !important;
        }
        .ant-input-textarea::placeholder {
          color: #8c8c8c !important;
        }
        .ant-input-textarea:focus::placeholder {
          color: #8c8c8c !important;
        }
        .ant-select-selection-placeholder {
          color: #8c8c8c !important;
        }
      `}</style>
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
                  <Select allowClear placeholder="Выберите роль">
                    {roles.map(r => (
                      <Option key={r.key} value={r.key}>{r.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Form.Item name="email" label="Email" normalize={v => (v != null ? String(v).trim() : v)}> <Input /> </Form.Item>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Form.Item name="phone" label="Телефон" normalize={v => (v != null ? String(v).trim() : v)}>
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

      {userPermissions?.can_send_notifications && (
        <Card title="Отправка уведомлений" style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => setNotificationModalOpen(true)}>
            Отправить уведомление
          </Button>
        </Card>
      )}

      <Card title="Управление ролями" style={{ marginBottom: 16 }}>
        <Form layout="inline" onFinish={async (vals) => {
          try {
            const key = (vals.key || '').trim();
            const title = (vals.title || '').trim();
            if (!key || !title) { message.error('Укажите ключ и название роли'); return; }
            await api.post('/api/users/roles', { key, title }, { headers });
            message.success('Роль добавлена');
            fetchRoles();
          } catch (e) {
            message.error(e?.response?.data?.error || 'Не удалось добавить роль');
          }
        }}>
          <Form.Item name="key" label="Ключ">
            <Input placeholder="например: manager" />
          </Form.Item>
          <Form.Item name="title" label="Название">
            <Input placeholder="например: Менеджер" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Добавить роль</Button>
          </Form.Item>
        </Form>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ marginBottom: 8, fontWeight: 500, color: isDark ? '#fff' : undefined }}>Доступные роли:</div>
        <List
          size="small"
          dataSource={roles}
          locale={{ emptyText: 'Ролей нет' }}
          renderItem={(r) => (
            <List.Item style={{ padding: '6px 8px' }}>
              <Space>
                <span style={{ color: isDark ? '#fff' : '#000' }}>{r.title}</span>
                <Button type="primary" size="small" onClick={() => openPerms(r.key)}>Настроить права</Button>
                <Popconfirm title={`Удалить роль "${r.title}"?`} okText="Удалить" cancelText="Отмена" onConfirm={async () => {
                  try {
                    await api.delete(`/api/users/roles/${encodeURIComponent(r.key)}`, { headers });
                    message.success('Роль удалена');
                    invalidateGetCache('/api/users/roles/list');
                    fetchRoles();
                  } catch (e) {
                    message.error(e?.response?.data?.error || 'Не удалось удалить роль');
                  }
                }}>
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card title="Пользователи" bodyStyle={{ overflowX: 'auto' }}>
        <Table 
          rowKey="id" 
          loading={loading} 
          columns={columns} 
          dataSource={users} 
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal title="Редактировать пользователя" open={!!editUser} onCancel={() => setEditUser(null)} footer={null}>
        <Form layout="vertical" form={editForm} onFinish={handleUpdate}>
          <Form.Item name="full_name" label="ФИО"> <Input /> </Form.Item>
          <Form.Item name="email" label="Email"> <Input /> </Form.Item>
          <Form.Item name="phone" label="Телефон"> <Input /> </Form.Item>
          {canEditRole && (
            <Form.Item name="role" label="Роль" rules={[{ required: true, message: 'Выберите роль' }]}> 
              <Select allowClear placeholder="Выберите роль">
                {roles.map(r => (
                  <Option key={r.key} value={r.key}>{r.title}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit">Сохранить</Button>
        </Form>
      </Modal>

      <Modal title="Изменить пароль" open={!!pwdUser} onCancel={() => setPwdUser(null)} footer={null} afterOpenChange={(open) => { if (open) passwordForm.resetFields(); }}>
        <Form layout="vertical" form={passwordForm} onFinish={handleChangePassword}>
          <Form.Item name="newPassword" label="Новый пароль" rules={[{ required: true, min: 6 }]}> <Input.Password /> </Form.Item>
          <Button type="primary" htmlType="submit">Изменить</Button>
        </Form>
      </Modal>
      <Modal title={`Права роли: ${rolePermissions?.role_key || ''}`} open={permModalOpen} onCancel={() => setPermModalOpen(false)} onOk={savePerms} okText="Сохранить">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {(() => {
            const groupTitleStyle = {
              fontWeight: 600,
              fontSize: 13,
              margin: '0 0 8px 0',
              color: isDark ? '#fff' : '#111'
            };
            const boxStyle = {
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              background: isDark ? '#0f0f0f' : '#fafafa',
              color: isDark ? '#fff' : undefined
            };

            const groups = [
              {
                title: 'Разделы и действия',
                items: [
                  ['can_view_dashboard','Видеть раздел Дашборд'],
                  ['can_view_orders','Видеть раздел Заявки'],
                  ['can_edit_orders','Редактировать заявки'],
                  ['can_view_reports','Видеть раздел Отчёты'],
                  ['can_edit_reports','Редактировать отчёты'],
                  ['can_view_vehicles','Видеть раздел Транспорт'],
                  ['can_edit_vehicles','Редактировать транспорт'],
                  ['can_view_tracking','Видеть раздел Трекинг'],
                  ['can_edit_tracking','Редактировать трекинг'],
                  ['can_view_settings','Видеть раздел Настройки'],
                  ['can_edit_users','Управлять пользователями'],
                  ['can_manage_roles','Управлять ролями']
                ]
              },
              {
                title: 'Главная (Dashboard)',
                items: [
                  ['can_view_dashboard_stats','Видеть статистику на главной'],
                  ['can_view_dashboard_users_count','Видеть количество пользователей'],
                  ['can_view_dashboard_vehicles_count','Видеть количество машин'],
                  ['can_view_dashboard_orders_count','Видеть количество заявок'],
                  ['can_view_dashboard_completed_count','Видеть количество выполненных'],
                  ['can_view_dashboard_recent_orders','Видеть последние заявки'],
                  ['can_view_dashboard_finances','Видеть доходы и расходы']
                ]
              },
              {
                title: 'Меню',
                items: [
                  ['can_view_menu_budget','Видеть кнопку Бюджет в меню'],
                  ['can_view_menu_expenses','Видеть кнопку Расход в меню'],
                  ['can_view_menu_salary','Видеть кнопку Зарплата в меню'],
                  ['can_view_menu_vehicles','Видеть кнопку Транспорт в меню'],
                  ['can_view_menu_maintenance','Видеть кнопку ТО в меню'],
                  ['can_view_menu_tracking','Видеть кнопку GPS Мониторинг в меню'],
                  ['can_view_menu_reports','Видеть кнопку Отчёты в меню'],
                ]
              },
               {
                 title: 'Прочее',
                 items: [
                   ['can_create_orders','Создавать заявки'],
                   ['can_edit_salary','Редактировать на странице зарплата'],
                   ['can_delete_any','Возможность удалять (кнопки удаления)'],
                   ['can_assign_drivers','Возможность назначать водителей']
                 ]
               },
               {
                 title: 'Уведомления',
                 items: [
                   ['can_send_notifications','Отправлять уведомления'],
                   ['can_view_notifications','Видеть уведомления']
                 ]
               }
            ];

            return groups.map((g, idx) => (
              <div key={idx} style={boxStyle}>
                <p style={groupTitleStyle}>{g.title}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 8, color: isDark ? '#fff' : undefined }}>
                  {g.items.map(([k, label]) => (
                    <Checkbox
                      key={k}
                      checked={Boolean(rolePermissions?.[k])}
                      onChange={(e) => setRolePermissions(prev => ({ ...(prev || {}), [k]: e.target.checked }))}
                    >
                      <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, color: isDark ? '#fff' : undefined }}>{label}</span>
                    </Checkbox>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </Modal>

    </div>
  );
};

export default Settings;

