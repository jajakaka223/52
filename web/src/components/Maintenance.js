import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Typography, Tabs, Table, Button, Space, InputNumber, message, Popconfirm, Form } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import api from '../config/http';

const { Title } = Typography;

function useAuthHeaders() {
  return useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

const COLUMNS = [
  { key: 'oil_engine', title: 'Масло Двигатель' },
  { key: 'oil_gearbox', title: 'Масло коробка' },
  { key: 'oil_differential', title: 'Масло редуктор' },
  { key: 'clutch', title: 'Сцепление' },
  { key: 'gearbox', title: 'Коробка' },
  { key: 'cardan', title: 'Кардан' },
  { key: 'differential', title: 'Редуктор' },
  { key: 'axles', title: 'Полуоси' },
  { key: 'wheels', title: 'Колёса' }
];

const STORAGE_KEY = 'maintenance_per_vehicle_v1';

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function writeStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

const Maintenance = () => {
  const headers = useAuthHeaders();
  const [vehicles, setVehicles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataByVehicle, setDataByVehicle] = useState(() => readStorage());
  const [createForm] = Form.useForm();

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/vehicles', { headers });
      const list = res.data?.vehicles || [];
      setVehicles(list);
      if (list.length && !activeId) setActiveId(list[0].id);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось загрузить транспорт');
    } finally {
      setLoading(false);
    }
  }, [headers, activeId]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const currentRows = useMemo(() => {
    if (!activeId) return [];
    const rows = dataByVehicle[activeId] || [];
    // Сортируем от новых записей к старым (по дате создания)
    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [activeId, dataByVehicle]);

  const persist = (updater) => {
    setDataByVehicle(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeStorage(next);
      return next;
    });
  };

  const addRow = async () => {
    if (!activeId) return;
    const values = await createForm.validateFields().catch(() => null);
    const newRow = { 
      id: Date.now(),
      created_at: new Date().toISOString()
    };
    COLUMNS.forEach(c => { newRow[c.key] = values ? (values[c.key] != null ? Number(values[c.key]) : null) : null; });
    persist(prev => ({
      ...prev,
      [activeId]: [ ...(prev[activeId] || []), newRow ]
    }));
    if (values) createForm.resetFields();
  };

  // удалено: inline-редактирование, оставили только вывод значений

  const deleteRow = (rowId) => {
    persist(prev => ({
      ...prev,
      [activeId]: (prev[activeId] || []).filter(r => r.id !== rowId)
    }));
  };

  const columns = [
    { 
      title: 'Дата и время', 
      dataIndex: 'created_at', 
      width: 160,
      render: (v) => v ? new Date(v).toLocaleString('ru-RU') : '—'
    },
    ...COLUMNS.map(col => ({
      title: col.title,
      dataIndex: col.key,
      width: 140,
      render: (v) => (v != null && v !== '' ? `${Number(v).toLocaleString('ru-RU')} км` : '—')
    })),
    { title: 'Действия', width: 90, render: (_, r) => (
      <Space>
        <Popconfirm title="Удалить запись?" okText="Удалить" cancelText="Отмена" onConfirm={() => deleteRow(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )}
  ];

  return (
    <div>
      <style>
        {`
          [data-theme="dark"] .ant-form-item-label > label { color: #ffffff !important; }
          [data-theme="dark"] .ant-tabs .ant-tabs-tab .ant-tabs-tab-btn { color: #ffffff !important; }
          [data-theme="dark"] .ant-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #1890ff !important; }
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
        `}
      </style>
      <Title level={2}>Техническое обслуживание</Title>

      <Card style={{ marginBottom: 12 }}>
        <Form layout="vertical" form={createForm}>
          <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', paddingLeft: 8 }}>
            {COLUMNS.map(col => (
              <Form.Item key={col.key} name={col.key} label={col.title} rules={[{ type: 'number', transform: v => (v===''||v==null?undefined:Number(v)), message: 'Число' }]}>
                <InputNumber min={0} style={{ width: 160 }} />
              </Form.Item>
            ))}
            <Form.Item>
              <Button type="primary" onClick={addRow} disabled={!activeId}>Добавить</Button>
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card bodyStyle={{ padding: 0, overflowX: 'auto' }} loading={loading}>
        <Tabs
          activeKey={activeId != null ? String(activeId) : undefined}
          onChange={(k) => setActiveId(Number(k))}
          tabBarStyle={{ paddingLeft: 16 }}
          items={vehicles.map(v => ({
            key: String(v.id),
            label: `${v.name || ''}${v.plate_number ? ' / ' + v.plate_number : ''}`.trim() || `ID ${v.id}`,
            children: (
              <div style={{ padding: 12 }}>
                <Table
                  rowKey="id"
                  dataSource={activeId === v.id ? currentRows : []}
                  columns={columns}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                  bordered={false}
                  scroll={{ x: 900 }}
                />
              </div>
            )
          }))}
        />
      </Card>
    </div>
  );
};

export default Maintenance;


