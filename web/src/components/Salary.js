import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Typography, Tabs, Table, Space, Tag, Button, Modal, Form, DatePicker, InputNumber, Input, message, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../config/http';

const { Title } = Typography;

function useAuthHeaders() {
  return useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

const Salary = ({ userPermissions, user }) => {
  const headers = useAuthHeaders();
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeDriverId, setActiveDriverId] = useState(null);
  const [adjustments, setAdjustments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('salary_adjustments_v1') || '{}'); } catch (_) { return {}; }
  });
  const [adjModal, setAdjModal] = useState({ open: false, driverId: null });
  const [adjForm] = Form.useForm();
  const RangePicker = DatePicker.RangePicker;

  const computeDefaultRange = useCallback(() => {
    const now = dayjs();
    const d = now.date();
    if (d < 10) {
      const start = now.subtract(1, 'month').date(25);
      const end = now.date(10);
      return [start, end];
    }
    if (d >= 25) {
      const start = now.date(25);
      const end = now.add(1, 'month').date(10);
      return [start, end];
    }
    const start = now.date(10);
    const end = now.date(25);
    return [start, end];
  }, []);

  const [range, setRange] = useState(() => computeDefaultRange());

  const percent = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('budget_percents_v1') || 'null');
      return Number(p?.salary ?? 20);
    } catch (_) { return 20; }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, oRes, aRes] = await Promise.all([
        api.get('/api/users', { headers }),
        api.get('/api/orders', { headers }),
        api.get('/api/accounting', { headers }).catch(() => ({ data: { records: [] } }))
      ]);
      
      // Если пользователь - водитель, показываем только его данные
      let ds = (uRes.data?.users || []).filter(u => u.role === 'driver' && u.is_active !== false);
      if (user?.role === 'driver') {
        ds = ds.filter(d => d.id === user.id);
      }
      
      setDrivers(ds);
      setOrders(oRes.data?.orders || []);
      if (!activeDriverId && ds.length) setActiveDriverId(ds[0].id);
      
      // Синхронизируем вычеты с сервера (как в мобильном приложении)
      try {
        const accountingData = aRes.data;
        const salaryExpenses = (accountingData.records || []).filter(record => 
          record.category === 'Зарплата' && 
          record.description?.startsWith('Зарплатный вычет:') &&
          Number(record.amount) < 0
        );
        
        // Создаем вычеты из записей accounting
        const serverDeductions = salaryExpenses.map(expense => ({
          id: expense.id,
          date: expense.date,
          amount: Math.abs(Number(expense.amount)),
          comment: expense.description?.replace('Зарплатный вычет: ', '') || ''
        }));
        
        // Объединяем локальные и серверные вычеты, убираем дубликаты
        const currentAdjustments = JSON.parse(localStorage.getItem('salary_adjustments_v1') || '{}');
        const allDeductions = {};
        
        // Собираем все вычеты по водителям
        ds.forEach(driver => {
          const localDeductions = Array.isArray(currentAdjustments[driver.id]) ? currentAdjustments[driver.id] : [];
          const driverServerDeductions = serverDeductions.filter(deduction => 
            // Предполагаем, что вычет принадлежит водителю по дате или другим критериям
            // В реальном приложении нужно добавить поле driver_id в accounting
            true // Пока берем все вычеты для всех водителей
          );
          
          const uniqueDeductions = [...localDeductions, ...driverServerDeductions].filter((deduction, index, self) => 
            index === self.findIndex(d => d.id === deduction.id)
          );
          
          allDeductions[driver.id] = uniqueDeductions;
        });
        
        // Обновляем localStorage
        localStorage.setItem('salary_adjustments_v1', JSON.stringify(allDeductions));
        setAdjustments(allDeductions);
        
      } catch (e) {
        console.warn('Failed to sync deductions with server:', e);
      }
      
    } catch (_) {}
    finally { setLoading(false); }
  }, [headers, activeDriverId, user?.role, user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    if (!range?.[0] || !range?.[1]) return orders;
    const start = range[0].startOf('day');
    const end = range[1].endOf('day');
    return orders.filter(o => {
      const od = o.date ? dayjs(o.date) : null;
      return od && (od.isAfter(start) || od.isSame(start, 'day')) && (od.isBefore(end) || od.isSame(end, 'day'));
    });
  }, [orders, range]);

  const dataByDriver = useMemo(() => {
    const map = new Map();
    for (const o of filteredOrders) {
      // Убираем фильтр по статусу - показываем все заявки
      if (!o.driver_id) continue;
      const arr = map.get(o.driver_id) || [];
      arr.push(o);
      map.set(o.driver_id, arr);
    }
    return map;
  }, [filteredOrders]);

  // удалено: неиспользуемое вычисление сумм вычетов по водителю

  const addAdjustment = async () => {
    const vals = await adjForm.validateFields().catch(() => null);
    if (!vals) return;
    const driverId = adjModal.driverId;
    const entry = {
      id: Date.now(),
      date: vals.date ? vals.date.format('YYYY-MM-DD') : null,
      amount: Math.abs(Number(vals.amount || 0)),
      comment: vals.comment || ''
    };
    try {
      const next = { ...(adjustments || {}) };
      const list = Array.isArray(next[driverId]) ? next[driverId] : [];
      list.push(entry);
      next[driverId] = list;
      localStorage.setItem('salary_adjustments_v1', JSON.stringify(next));
      setAdjustments(next);
      
      // Добавляем вычет в расходы по категории "Зарплата"
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
        const payload = {
          type: 'expense',
          vehicleId: null,
          date: entry.date,
          amount: -entry.amount,
          description: `Зарплатный вычет: ${entry.comment}`,
          category: 'Зарплата',
          mileage: null,
        };
        await api.post('/api/accounting', payload, { headers });
        
        // Обновляем бюджет
        const balances = JSON.parse(localStorage.getItem('budget_balances_v1') || 'null') || { tax: 0, salary: 0, repair: 0, fuel: 0, safe: 0, profit: 0 };
        const round2 = n => Math.round(Number(n||0)*100)/100;
        balances.salary = round2(Number(balances.salary || 0) - entry.amount);
        localStorage.setItem('budget_balances_v1', JSON.stringify(balances));
        
        const hist = JSON.parse(localStorage.getItem('budget_history_v1') || '[]');
        hist.unshift({ ts: Date.now(), category: 'Зарплата', delta: -entry.amount, comment: `Зарплатный вычет: ${entry.comment}` });
        localStorage.setItem('budget_history_v1', JSON.stringify(hist.slice(0, 500)));
      } catch (e) {
        console.error('Ошибка добавления в расходы:', e);
      }
      
      setAdjModal({ open: false, driverId: null });
      adjForm.resetFields();
      message.success('Запись добавлена');
    } catch (_) {
      message.error('Не удалось сохранить запись');
    }
  };

  const deleteAdjustment = async (driverId, id) => {
    try {
      const next = { ...(adjustments || {}) };
      const list = Array.isArray(next[driverId]) ? next[driverId] : [];
      
      // Найти удаляемую запись для получения суммы
      const deletedRecord = list.find(x => x.id === id);
      if (deletedRecord && deletedRecord.amount) {
        // Удаляем соответствующую запись из расходов через API
        try {
          const token = localStorage.getItem('auth_token');
          const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
          
          // Ищем запись в расходах по описанию и сумме
          const response = await api.get('/api/accounting', { headers });
          if (response.data && response.data.success) {
            const expenses = response.data.accounting || [];
            const matchingExpense = expenses.find(expense => 
              expense.description === `Зарплатный вычет: ${deletedRecord.comment}` &&
              Math.abs(expense.amount) === deletedRecord.amount &&
              expense.category === 'Зарплата'
            );
            
            if (matchingExpense) {
              await api.delete(`/api/accounting/${matchingExpense.id}`, { headers });
            }
          }
        } catch (e) {
          console.error('Ошибка удаления из расходов:', e);
        }
        
        // Возвращаем сумму обратно в бюджет
        const currentBalances = JSON.parse(localStorage.getItem('budget_balances_v1') || '{}');
        const newBalances = {
          ...currentBalances,
          salary: (currentBalances.salary || 0) + deletedRecord.amount
        };
        localStorage.setItem('budget_balances_v1', JSON.stringify(newBalances));
        
        // Добавляем запись в историю бюджета
        const history = JSON.parse(localStorage.getItem('budget_history_v1') || '[]');
        history.unshift({
          ts: Date.now(),
          category: 'Зарплата',
          delta: deletedRecord.amount,
          comment: `Возврат зарплатного вычета: ${deletedRecord.comment || 'Без комментария'}`
        });
        localStorage.setItem('budget_history_v1', JSON.stringify(history.slice(0, 500)));
      }
      
      next[driverId] = list.filter(x => x.id !== id);
      localStorage.setItem('salary_adjustments_v1', JSON.stringify(next));
      setAdjustments(next);
      message.success('Запись удалена и сумма возвращена в бюджет');
    } catch (_) {
      message.error('Не удалось удалить запись');
    }
  };

  const statusToColor = {
    new: 'default',
    assigned: 'processing',
    in_progress: 'warning',
    unloaded: 'processing',
    completed: 'success',
    cancelled: 'error'
  };
  const statusToRu = {
    new: 'Новая',
    assigned: 'Назначена',
    in_progress: 'В пути',
    unloaded: 'Разгрузился',
    completed: 'Выполнена',
    cancelled: 'Отменена'
  };

  const columns = [
    { title: '№', dataIndex: 'id', width: 80 },
    { title: 'Дата', dataIndex: 'date', render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—', width: 120 },
    { title: 'Направление', dataIndex: 'direction', width: 240, render: (d) => (d ? String(d).split('\n')[0] : '—') },
    { title: 'Сумма заявки', dataIndex: 'amount', render: v => (v == null ? '—' : `${Number(v).toLocaleString('ru-RU')} руб.`), width: 160 },
    { title: `Зарплата (${percent}%)`, width: 180, render: (_, r) => {
      const val = Math.round(Number(r.amount || 0) * percent) / 100;
      return `${val.toLocaleString('ru-RU')} руб.`;
    }},
    { 
      title: 'Статус', dataIndex: 'status', width: 160,
      render: (s) => {
        const preset = statusToColor[s] || 'default';
        const colorMap = { 
          default: '#434343',
          processing: '#1890ff',
          warning: '#faad14',
          success: '#52c41a',
          error: '#ff4d4f'
        };
        const bg = colorMap[preset] || '#434343';
        return (
          <Tag style={{ background: bg, color: '#fff', border: `1px solid ${bg}`, fontWeight: 500 }}>
            {statusToRu[s] || statusToRu['new']}
          </Tag>
        );
      }
    },
  ];

  return (
    <div>
      <Title level={2}>Зарплата</Title>
      <style>{`
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
        [data-theme="dark"] .ant-input::placeholder {
          color: #ffffff !important;
        }
        [data-theme="dark"] .ant-input:focus::placeholder {
          color: #ffffff !important;
        }
        [data-theme="dark"] .ant-input-textarea::placeholder {
          color: #ffffff !important;
        }
        [data-theme="dark"] .ant-input-textarea:focus::placeholder {
          color: #ffffff !important;
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
      <Card bodyStyle={{ padding: 0 }} loading={loading}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 0 12px', gap: 12 }}>
          <RangePicker
            value={range}
            onChange={(vals) => { if (vals && vals.length === 2) setRange(vals); }}
            format="DD.MM.YYYY"
            allowClear={false}
            placeholder={["Выбрать дату","Выбрать дату"]}
          />
          {userPermissions?.can_edit_salary && (
            <Button type="primary" onClick={() => { if (activeDriverId) { setAdjModal({ open: true, driverId: activeDriverId }); adjForm.resetFields(); } }} disabled={!activeDriverId}>
              Редактировать
            </Button>
          )}
        </div>
        <Tabs
          activeKey={activeDriverId != null ? String(activeDriverId) : undefined}
          onChange={(k) => setActiveDriverId(Number(k))}
          tabBarStyle={{ paddingLeft: 16 }}
          items={drivers.map(d => {
            const list = dataByDriver.get(d.id) || [];
            // Для расчета зарплаты учитываем все заявки кроме отмененных
            const validOrders = list.filter(o => (o.status || '').toLowerCase() !== 'cancelled');
            const totalRaw = validOrders.reduce((s, o) => s + (Number(o.amount || 0) * percent / 100), 0);
            const adjList = Array.isArray((adjustments || {})[d.id]) ? (adjustments || {})[d.id] : [];
            const adjFiltered = adjList.filter(a => {
              if (!a.date || !range?.[0] || !range?.[1]) return true;
              const ad = dayjs(a.date);
              return (ad.isAfter(range[0], 'day') || ad.isSame(range[0], 'day')) && (ad.isBefore(range[1], 'day') || ad.isSame(range[1], 'day'));
            });
            const sub = adjFiltered.reduce((s, a) => s + Math.abs(Number(a.amount || 0)), 0);
            const total = Math.max(0, Math.round((totalRaw - sub) * 100) / 100);
            return {
              key: String(d.id),
              label: d.full_name || d.username || `ID ${d.id}`,
              children: (
                <div style={{ padding: 12 }}>
                  <Space direction="vertical" size={12} style={{ display: 'block' }}>
                    <Table
                      rowKey="id"
                      dataSource={activeDriverId === d.id ? list : []}
                      columns={columns}
                      pagination={{ pageSize: 10 }}
                      size="middle"
                      scroll={{ x: 700 }}
                    />
                    <Card size="small" title="Вычеты" bodyStyle={{ padding: 0 }}>
                      <Table
                        size="small"
                        rowKey="id"
                        dataSource={activeDriverId === d.id ? adjFiltered : []}
                        pagination={{ pageSize: 5 }}
                        columns={[
                          { title: 'Дата', dataIndex: 'date', width: 140, render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—' },
                          { title: 'Сумма', dataIndex: 'amount', width: 140, render: v => `- ${Number(v || 0).toLocaleString('ru-RU')} руб.` },
                          { title: 'Комментарий', dataIndex: 'comment', render: (v) => {
                            const isDark = typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark';
                            const isAdvanceOrPenalty = v && (v.toLowerCase().includes('аванс') || v.toLowerCase().includes('штраф'));
                            return (
                              <span style={{ 
                                color: isDark ? '#fff' : (isAdvanceOrPenalty ? '#fff' : undefined),
                                background: isAdvanceOrPenalty ? '#ff4d4f' : 'transparent',
                                padding: isAdvanceOrPenalty ? '2px 6px' : '0',
                                borderRadius: isAdvanceOrPenalty ? '4px' : '0'
                              }}>
                                {v}
                              </span>
                            );
                          } },
                          { title: 'Действия', width: 100, render: (_, r) => (
                            userPermissions?.can_edit_salary ? (
                              <Popconfirm title="Удалить запись?" okText="Удалить" cancelText="Отмена" onConfirm={() => deleteAdjustment(d.id, r.id)}>
                                <Button danger size="small" icon={<DeleteOutlined />} />
                              </Popconfirm>
                            ) : null
                          ) }
                        ]}
                      />
                    </Card>
                    <div style={{ textAlign: 'right', fontWeight: 600, marginTop: 12, color: (typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark') ? '#fff' : undefined }}>
                      Итого к выплате: {total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.
                    </div>
                  </Space>
                </div>
              )
            };
          })}
        />
      </Card>

      <Modal title="Добавить запись" open={adjModal.open} onCancel={() => setAdjModal({ open: false, driverId: null })} onOk={addAdjustment} okText="Сохранить" cancelText="Отмена" destroyOnClose>
        <Form layout="vertical" form={adjForm} initialValues={{ date: null, amount: null, comment: '' }}>
          <Form.Item name="date" label="Дата" rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder="Выбрать дату" />
          </Form.Item>
          <Form.Item name="amount" label="Сумма (будет вычтена)" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} step={100} style={{ width: '100%' }} formatter={(v)=>`${v}`.replace(/\B(?=(\d{3})+(?!\d))/g,' ')} parser={(v)=>String(v).replace(/\s/g,'')} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea 
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Salary;


