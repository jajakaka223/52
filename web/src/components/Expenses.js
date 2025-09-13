import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, DatePicker, Table, Typography, Input, Space, Button, message, Modal, Form, InputNumber, Popconfirm, Select } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import api from '../config/http';
import dayjs from 'dayjs';

const { Title } = Typography;

const Expenses = ({ theme }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [search, setSearch] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = {
        startDate: range?.[0]?.format('YYYY-MM-DD'),
        endDate: range?.[1]?.format('YYYY-MM-DD'),
      };
      const res = await api.get('/api/accounting', { params, headers });
      const rows = (res.data?.records || [])
        .filter(r => Number(r.amount) < 0)
        .map(r => ({
          key: r.id,
          date: r.date,
          category: r.category || r.type || '—',
          amount: Math.abs(Number(r.amount || 0)),
          comment: r.description || '—',
        }));
      setData(rows);
    } catch (e) {
      message.error('Не удалось загрузить расходы');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  const onRangeChange = (vals) => {
    if (vals && vals.length === 2) {
      setRange(vals);
    }
  };

  useEffect(() => { fetch(); }, [fetch, range]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(r => (
      (r.category || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q)
    ));
  }, [data, search]);

  const total = useMemo(() => (
    filtered.reduce((s, r) => s + (r.amount || 0), 0)
  ), [filtered]);

  const openEdit = (record) => {
    setIsModalOpen(true);
    form.setFieldsValue({
      id: record.key,
      date: dayjs(record.date),
      category: record.category,
      amount: record.amount,
      comment: record.comment,
    });
  };

  const handleDelete = async (record) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/api/accounting/${record.key}`, { headers });
      message.success('Удалено');
      // Вернуть сумму обратно в бюджет, если категория известна
      try {
        const map = {
          'Налог': 'tax',
          'Зарплата': 'salary',
          'Ремонт': 'repair',
          'Заправка': 'fuel',
          'Сейф': 'safe',
          'Чистая прибыль': 'profit',
          'Прочее': 'profit'
        };
        const key = map[record.category];
        if (key) {
          const balances = JSON.parse(localStorage.getItem('budget_balances_v1') || 'null') || { tax: 0, salary: 0, repair: 0, fuel: 0, safe: 0, profit: 0 };
          const round2 = n => Math.round(Number(n||0)*100)/100;
          balances[key] = round2(Number(balances[key] || 0) + Number(record.amount || 0));
          localStorage.setItem('budget_balances_v1', JSON.stringify(balances));
          const hist = JSON.parse(localStorage.getItem('budget_history_v1') || '[]');
          hist.unshift({ ts: Date.now(), category: record.category, delta: Number(record.amount || 0), comment: `Возврат: удалён расход` });
          localStorage.setItem('budget_history_v1', JSON.stringify(hist.slice(0, 500)));
        }
      } catch (_) {}
      fetch();
    } catch (e) {
      message.error('Не удалось удалить');
    }
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'date',
      key: 'date',
      align: 'left',
      width: '25%',
      render: (v) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      align: 'left',
      ellipsis: true,
      width: '25%',
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      align: 'left',
      width: '25%',
      render: (v) => `${Number(v).toLocaleString('ru-RU')} руб.`,
    },
    {
      title: 'Комментарий',
      dataIndex: 'comment',
      key: 'comment',
      align: 'left',
      ellipsis: true,
      width: '25%',
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>Редакт.</Button>
          <Popconfirm title="Удалить запись?" okText="Удалить" cancelText="Отмена" onConfirm={() => handleDelete(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }
  ];

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
      const payload = {
        type: 'expense',
        vehicleId: null,
        date: values.date.format('YYYY-MM-DD'),
        amount: -Math.abs(Number(values.amount)),
        description: values.comment || '',
        category: values.category || '',
        mileage: null,
      };
      const id = form.getFieldValue('id');
      if (id) {
        await api.put(`/api/accounting/${id}`, {
          date: payload.date,
          amount: payload.amount,
          description: payload.description,
          category: payload.category,
        }, { headers });
        message.success('Расход обновлён');
      } else {
        // убираем перевод строки из комментария
        payload.description = (payload.description || '').toString();
        await api.post('/api/accounting', payload, { headers });
        message.success('Расход добавлен');
        // Синхронизируем бюджет: вычитаем из соответствующего баланса
        try {
          const map = {
            'Налог': 'tax',
            'Зарплата': 'salary',
            'Ремонт': 'repair',
            'Заправка': 'fuel',
            'Сейф': 'safe',
            'Чистая прибыль': 'profit',
            'Прочее': 'profit'
          };
          const key = map[values.category];
          if (key) {
            const balances = JSON.parse(localStorage.getItem('budget_balances_v1') || 'null') || { tax: 0, salary: 0, repair: 0, fuel: 0, safe: 0, profit: 0 };
            const round2 = n => Math.round(Number(n||0)*100)/100;
            const amt = Math.abs(Number(values.amount || 0));
            balances[key] = round2(Number(balances[key] || 0) - amt);
            localStorage.setItem('budget_balances_v1', JSON.stringify(balances));
            const hist = JSON.parse(localStorage.getItem('budget_history_v1') || '[]');
            hist.unshift({ ts: Date.now(), category: values.category, delta: -amt, comment: `Расход добавлен` });
            localStorage.setItem('budget_history_v1', JSON.stringify(hist.slice(0, 500)));
          }
        } catch (_) {}
      }
      setIsModalOpen(false);
      form.resetFields();
      fetch();
    } catch (e) {
      if (e?.errorFields) return; // валидация формы
      const errMsg = e?.response?.data?.error || e?.message || 'Не удалось добавить расход';
      message.error(errMsg);
    }
  };

  return (
    <div>
      <style>
        {isDark && `
          .ant-input::placeholder {
            color: #8c8c8c !important;
          }
          .ant-input:focus::placeholder {
            color: #8c8c8c !important;
          }
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
      <Title level={2}>Расходы</Title>
      <Card title="Список расходов">
        <Space style={{ marginBottom: 12 }} wrap>
          <DatePicker.RangePicker
            value={range}
            onChange={onRangeChange}
            format="DD.MM.YYYY"
            placeholder={["Выбрать дату", "Выбрать дату"]}
          />
          <Input.Search placeholder="Поиск по категории/комментарию" allowClear onSearch={setSearch} onChange={(e) => setSearch(e.target.value)} style={{ width: 320 }} />
          <Button type="primary" onClick={() => setIsModalOpen(true)}>Добавить</Button>
        </Space>
        <Table
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5,10,15,20,50,100] }}
          tableLayout="fixed"
          scroll={{ x: 900 }}
        />
        <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, textAlign: 'right', color: isDark ? '#fff' : '#000' }}>
          Итого расходов: {total.toLocaleString('ru-RU')} руб.
        </div>
      </Card>

      <Modal
        title="Добавить расход"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleAdd}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form layout="vertical" form={form} initialValues={{ date: dayjs() }}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="Дата" name="date" rules={[{ required: true, message: 'Укажите дату' }]}> 
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder="Выбрать дату" />
          </Form.Item>
          <Form.Item label="Категория" name="category" rules={[{ required: true, message: 'Укажите категорию' }]}>
            <Select placeholder="Выберите категорию" allowClear>
              <Select.Option value="Налог">Налог</Select.Option>
              <Select.Option value="Зарплата">Зарплата</Select.Option>
              <Select.Option value="Ремонт">Ремонт</Select.Option>
              <Select.Option value="Заправка">Заправка</Select.Option>
              <Select.Option value="Сейф">Сейф</Select.Option>
              <Select.Option value="Прочее">Прочее</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} step={100} style={{ width: '100%' }} formatter={(v)=>`${v}`.replace(/\B(?=(\d{3})+(?!\d))/g,' ')} parser={(v)=>v.replace(/\s/g,'')} />
          </Form.Item>
          <Form.Item label="Комментарий" name="comment">
            <Input.TextArea 
              rows={3} 
              placeholder="Комментарий (необязательно)" 
              style={{ 
                color: isDark ? '#fff' : undefined, 
                background: isDark ? '#141414' : undefined 
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Expenses;

