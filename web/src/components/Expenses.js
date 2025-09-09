import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, DatePicker, Table, Typography, Input, Space, Button, message, Modal, Form, InputNumber, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;

const Expenses = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [search, setSearch] = useState('');
  const [isDark, setIsDark] = useState(typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark');
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
      const res = await axios.get('/api/accounting', { params, headers });
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

  const onRangeChange = (vals) => {
    if (vals && vals.length === 2) {
      setRange(vals);
    }
  };

  useEffect(() => { fetch(); }, [fetch, range]);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      const dark = document.body?.getAttribute('data-theme') === 'dark';
      setIsDark(dark);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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
      await axios.delete(`/api/accounting/${record.key}`, { headers });
      message.success('Удалено');
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
        await axios.put(`/api/accounting/${id}`, {
          date: payload.date,
          amount: payload.amount,
          description: payload.description,
          category: payload.category,
        }, { headers });
        message.success('Расход обновлён');
      } else {
        // убираем перевод строки из комментария
        payload.description = (payload.description || '').toString();
        await axios.post('/api/accounting', payload, { headers });
        message.success('Расход добавлен');
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
      <Title level={2}>Расходы</Title>
      <Card title="Список расходов">
        <Space style={{ marginBottom: 12 }} wrap>
          <DatePicker.RangePicker
            value={range}
            onChange={onRangeChange}
            format="DD.MM.YYYY"
            placeholder={["Выберите дату", "Выберите дату"]}
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
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Категория" name="category" rules={[{ required: true, message: 'Укажите категорию' }]}>
            <Input placeholder="Например: Топливо, Ремонт, Стоянка" />
          </Form.Item>
          <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} step={100} style={{ width: '100%' }} formatter={(v)=>`${v}`.replace(/\B(?=(\d{3})+(?!\d))/g,' ')} parser={(v)=>v.replace(/\s/g,'')} />
          </Form.Item>
          <Form.Item label="Комментарий" name="comment">
            <Input.TextArea rows={3} placeholder="Комментарий (необязательно)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Expenses;

