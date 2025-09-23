import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Typography, Table, Button, Space, Tag, Form, Input, DatePicker, InputNumber, Select, message, Modal, Popconfirm, Checkbox, Divider } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import api from '../config/http';

const { Title } = Typography;
const { Option } = Select;

const statusToColor = {
  new: 'default',
  assigned: 'processing',
  in_progress: 'warning',
  unloaded: 'success',
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

const statusRank = {
  completed: 6,
  unloaded: 5,
  in_progress: 4,
  assigned: 3,
  new: 2,
  cancelled: 1
};

function useAuthHeaders() {
  return useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

const Orders = ({ theme, userPermissions, user }) => {
  const headers = useAuthHeaders();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [createForm] = Form.useForm();
  const [assignModal, setAssignModal] = useState({ open: false, orderId: null });
  const [statusModal, setStatusModal] = useState({ open: false, orderId: null });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/orders', { headers });
      setOrders(res.data?.orders || []);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const fetchDrivers = useCallback(async () => {
    // Для водителей не загружаем список водителей
    if (user?.role === 'driver') {
      setDrivers([]);
      return;
    }
    
    try {
      const res = await api.get('/api/users', { headers });
      const list = (res.data?.users || []).filter(u => u.role === 'driver' && u.is_active !== false);
      setDrivers(list);
    } catch (e) {
      // не критично для отображения списка заявок
    }
  }, [headers, user?.role]);

  useEffect(() => { fetchOrders(); fetchDrivers(); }, [fetchOrders, fetchDrivers]);

  // Открытие модала "Подробнее" по хэш-ссылке #/orders/:id (из дашборда)
  useEffect(() => {
    const handler = async () => {
      if (typeof window === 'undefined') return;
      const match = String(window.location.hash || '').match(/^#\/orders\/(\d+)/);
      if (!match) return;
      const id = Number(match[1]);
      if (!id) return;
      const found = orders.find(o => Number(o.id) === id);
      if (found) { setDetails(found); return; }
      try {
        const { data } = await api.get(`/api/orders/${id}`, { headers });
        if (data?.order) setDetails(data.order);
      } catch (_) {}
    };
    handler();
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [orders, headers]);

  const handleCreate = async (values) => {
    try {
      // Собираем человеко-читаемое направление с деталями
      const from = values.from || '';
      const to = values.to || '';
      const loads = Array.isArray(values.loads) && values.loads.length
        ? values.loads.map(l => ({ address: l?.address || '', company: l?.company || '', phone: l?.phone || 'нет' }))
        : [{ address: values.loadAddress || '', company: values.loadCompany || '', phone: values.loadPhone || 'нет' }];
      const unloads = Array.isArray(values.unloads) && values.unloads.length
        ? values.unloads.map(u => ({ address: u?.address || '', company: u?.company || '', phone: u?.phone || 'нет' }))
        : [{ address: values.unloadAddress || '', company: values.unloadCompany || '', phone: values.unloadPhone || 'нет' }];
      const comment = values.comment || '';

      // Явно прикрепим адреса к городам Откуда/Куда
      const withFrom = (addr) => `${from ? from + ', ' : ''}${addr}`.trim();
      const withTo = (addr) => `${to ? to + ', ' : ''}${addr}`.trim();
      const loadLines = loads.filter(Boolean).map((l, idx) => {
        const label = idx === 0 ? 'Погрузка' : `Погрузка ${idx + 1}`;
        return `${label}: ${withFrom(l.address)} (${l.company}, ${l.phone})`;
      }).join('\n');
      const unloadLines = unloads.filter(Boolean).map((u, idx) => {
        const label = idx === 0 ? 'Разгрузка' : `Разгрузка ${idx + 1}`;
        return `${label}: ${withTo(u.address)} (${u.company}, ${u.phone})`;
      }).join('\n');
      const directionDetails = `${from} → ${to}\n${loadLines}\n${unloadLines}${comment ? `\nКомментарий: ${comment}` : ''}`;

      const payload = {
        date: values.date?.format('YYYY-MM-DD'),
        direction: directionDetails,
        distance: values.distance || null,
        weight: values.weight || null,
        amount: values.amount || null,
        company: values.company || null,
        clientName: values.clientName,
        phone: values.phone || null,
        email: values.email || null,
        driverId: values.driverId || null
      };
      // Расстояние заполняется вручную пользователем

      await api.post('/api/orders', payload, { headers });
      message.success('Заявка создана');
      createForm.resetFields();
      fetchOrders();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось создать заявку');
    }
  };

  const openAssign = (orderId) => setAssignModal({ open: true, orderId });
  const openStatus = (orderId) => setStatusModal({ open: true, orderId });

  const handleAssign = async (driverId) => {
    try {
      await api.post(`/api/orders/${assignModal.orderId}/assign-driver`, { driverId }, { headers });
      message.success('Водитель назначен');
      setAssignModal({ open: false, orderId: null });
      fetchOrders();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось назначить водителя');
    }
  };

  // Функция для обновления бюджета при изменении статуса заявки
  const updateBudgetFromOrder = useCallback(async (orderId, newStatus) => {
    if (newStatus !== 'completed') return;
    
    try {
      // Получаем данные заявки
      const order = orders.find(o => o.id === orderId);
      if (!order || !order.amount) return;
      
      const amount = Number(order.amount);
      if (amount <= 0) return;
      
      // Читаем текущие настройки бюджета
      const DEFAULT_PERCENTS = { tax: 6, salary: 20, repair: 15, fuel: 14, safe: 5, profit: 40 };
      const currentBalances = JSON.parse(localStorage.getItem('budget_balances_v1') || 'null') || { tax: 0, salary: 0, repair: 0, fuel: 0, safe: 0, profit: 0 };
      const currentPercents = JSON.parse(localStorage.getItem('budget_percents_v1') || 'null') || DEFAULT_PERCENTS;
      
      // Распределяем сумму по категориям согласно процентам
      const newBalances = { ...currentBalances };
      Object.keys(currentPercents).forEach(key => {
        const percent = Number(currentPercents[key] || 0);
        const addAmount = Math.round((amount * percent / 100) * 100) / 100;
        newBalances[key] = Math.round((Number(newBalances[key] || 0) + addAmount) * 100) / 100;
      });
      
      // Сохраняем обновленные балансы
      localStorage.setItem('budget_balances_v1', JSON.stringify(newBalances));
      
      // Добавляем запись в историю
      const hist = JSON.parse(localStorage.getItem('budget_history_v1') || '[]');
      const route = order.direction ? String(order.direction).split('\n')[0] : `Заявка #${orderId}`;
      hist.unshift({
        ts: Date.now(),
        category: 'Выполненная заявка',
        delta: amount,
        comment: `Заявка #${orderId} "${route}" выполнена`
      });
      localStorage.setItem('budget_history_v1', JSON.stringify(hist.slice(0, 500)));
      
    } catch (e) {
      console.error('Ошибка обновления бюджета:', e);
    }
  }, [orders]);

  const handleChangeStatus = async (status) => {
    try {
      await api.patch(`/api/orders/${statusModal.orderId}/status`, { status }, { headers });
      message.success('Статус обновлён');
      
      // Обновляем бюджет если заявка выполнена
      if (status === 'completed') {
        await updateBudgetFromOrder(statusModal.orderId, status);
      }
      
      setStatusModal({ open: false, orderId: null });
      fetchOrders();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось изменить статус');
    }
  };

  const [details, setDetails] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [pageSize, setPageSize] = useState(10);
  const routeMapRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const routeMapInstanceRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [routeInfo, setRouteInfo] = useState(null);

  // eslint-disable-next-line no-unused-vars
  const ensureYmapsLoaded = useCallback(async () => {
    // Загружаем JS SDK Яндекс.Карт по ключу из публичной конфигурации
    try {
      const { data } = await api.get('/api/utils/public-config');
      const apiKey = data?.yandexKey;
      if (!apiKey) return false;
      await new Promise((resolve, reject) => {
        if (window.ymaps) return resolve();
        const existing = document.getElementById('ymaps-sdk');
        if (existing) return existing.addEventListener('load', resolve);
        const s = document.createElement('script');
        s.id = 'ymaps-sdk';
        s.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${apiKey}`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('YM load failed'));
        document.body.appendChild(s);
      });
      return true;
    } catch (_) { return false; }
  }, []);

  const renderRouteOnMap = useCallback(async (fromAddress, toAddress) => {
    if (!fromAddress || !toAddress) return;
    // Возвращаем стабильный режим: только iframe-виджет, без платных дорог
    try {
      if (routeMapRef.current) {
        const src = `https://yandex.ru/map-widget/v1/?rtext=${encodeURIComponent(fromAddress)}~${encodeURIComponent(toAddress)}&rtt=auto&routes%5Bavoid%5D=tolls&rtn=1&rtd=0`;
        routeMapRef.current.innerHTML = `<iframe title="route" style="width:100%;height:100%;border:0" src="${src}"></iframe>`;
      }
    } catch (_) {}
  }, []);

  // Отрисовывать маршрут каждый раз при открытии/смене details
  useEffect(() => {
    if (!details) return;
    const lines = String(details.direction || '').split('\n');
    const first = lines[0] || '';
    const [fromCity, toCity] = first.split(' → ');
    const loadLine = lines.find(l => l.startsWith('Погрузка:')) || '';
    const unloadLine = lines.find(l => l.startsWith('Разгрузка:')) || '';
    const extractAddress = (line) => {
      const idx = line.indexOf(':');
      const rest = idx >= 0 ? line.slice(idx + 1).trim() : line;
      const paren = rest.indexOf('(');
      return paren > 0 ? rest.slice(0, paren).trim() : rest;
    };
    const fromAddrRaw = extractAddress(loadLine);
    const toAddrRaw = extractAddress(unloadLine);
    const ensureCityPrefix = (city, addr) => {
      const a = String(addr || '').trim();
      if (!city) return a;
      const re = new RegExp(`^${city.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*,`, 'i');
      return re.test(a) ? a : `${city}, ${a}`;
    };
    const fromAddress = ensureCityPrefix(fromCity, fromAddrRaw);
    const toAddress = ensureCityPrefix(toCity, toAddrRaw);
    renderRouteOnMap(fromAddress, toAddress);
  }, [details, renderRouteOnMap]);
  
  const parseDetailsToFields = useCallback((order) => {
    if (!order) return {};
    const lines = String(order.direction || '').split('\n');
    const first = lines[0] || '';
    const [from, to] = first.split(' → ');
    const loadLines = lines.filter(l => l.startsWith('Погрузка'));
    const unloadLines = lines.filter(l => l.startsWith('Разгрузка'));
    const extractPart = (line) => {
      const idx = line.indexOf(':');
      return idx >= 0 ? line.slice(idx + 1).trim() : line;
    };
    const splitCompanyPhone = (rest) => {
      const addrEnd = rest.indexOf('(');
      const address = addrEnd > 0 ? rest.slice(0, addrEnd).trim() : rest;
      const inside = rest.match(/\((.*)\)/)?.[1] || '';
      const company = inside.split(',')[0]?.trim() || '';
      const phone = inside.split(',')[1]?.trim() || '';
      return { address, company, phone };
    };
    const commentLine = lines.find(l => l.startsWith('Комментарий:')) || '';
    const commentIdx = commentLine.indexOf(':');
    const comment = commentIdx >= 0 ? commentLine.slice(commentIdx + 1).trim() : '';
    const loadParsedArr = loadLines.map(l => splitCompanyPhone(extractPart(l)));
    const loadParsed = loadParsedArr[0] || { address: '', company: '', phone: '' };
    const unloadParsedArr = unloadLines.map(l => splitCompanyPhone(extractPart(l)));
    const unloadParsed = unloadParsedArr[0] || { address: '', company: '', phone: '' };
    const escapeReg = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stripCityPrefix = (addr, city) => {
      let result = String(addr || '').trim();
      if (!city) return result;
      const re = new RegExp(`^(?:${escapeReg(city)}\\s*,\\s*)+`, 'i');
      result = result.replace(re, '').trim();
      return result;
    };
    return {
      date: order.date ? dayjs(order.date) : null,
      from: from || '',
      to: to || '',
      loadAddress: stripCityPrefix(loadParsed.address, from),
      loadCompany: loadParsed.company || '',
      loadPhone: loadParsed.phone || '',
      loadAddress2: loadParsedArr[1] ? stripCityPrefix(loadParsedArr[1].address, from) : '',
      loadCompany2: loadParsedArr[1]?.company || '',
      loadPhone2: loadParsedArr[1]?.phone || '',
      loadAddress3: loadParsedArr[2] ? stripCityPrefix(loadParsedArr[2].address, from) : '',
      loadCompany3: loadParsedArr[2]?.company || '',
      loadPhone3: loadParsedArr[2]?.phone || '',
      unloadAddress: stripCityPrefix(unloadParsed.address, to),
      unloadCompany: unloadParsed.company || '',
      unloadPhone: unloadParsed.phone || '',
      unloadAddress2: unloadParsedArr[1] ? stripCityPrefix(unloadParsedArr[1].address, to) : '',
      unloadCompany2: unloadParsedArr[1]?.company || '',
      unloadPhone2: unloadParsedArr[1]?.phone || '',
      unloadAddress3: unloadParsedArr[2] ? stripCityPrefix(unloadParsedArr[2].address, to) : '',
      unloadCompany3: unloadParsedArr[2]?.company || '',
      unloadPhone3: unloadParsedArr[2]?.phone || '',
      comment,
      company: order.company || '',
      clientName: order.client_name || '',
      phone: order.phone || '',
      email: order.email || '',
      weight: order.weight ?? null,
      amount: order.amount ?? null,
      driverId: order.driver_id || null
    };
  }, []);

  const isDriver = (user?.role || '').toLowerCase() === 'driver';
  const columns = [
    { 
      title: 'Номер', dataIndex: 'id', width: 90,
      sorter: (a, b) => (Number(a.id||0) - Number(b.id||0)),
      defaultSortOrder: 'descend', sortDirections: ['descend','ascend']
    },
    { 
      title: 'Дата', dataIndex: 'date', 
      render: v => (v ? dayjs(v).format('DD.MM.YYYY') : '-'),
      sorter: (a, b) => dayjs(a.date||0).valueOf() - dayjs(b.date||0).valueOf(),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Направление', dataIndex: 'direction', 
      render: (d) => {
        if (!d) return '—';
        const first = String(d).split('\n')[0] || '';
        const [from = '', to = ''] = first.split(' → ');
        const totalLen = (from + to).length;
        let fontSize = 14;
        if (totalLen > 50) fontSize = 13;
        if (totalLen > 70) fontSize = 12;
        if (totalLen > 90) fontSize = 11;
        return (
          <div style={{ maxWidth: 360, lineHeight: 1.2 }}>
            <div style={{ fontSize, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{from}</div>
            <div style={{ fontSize, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{to ? `→ ${to}` : ''}</div>
          </div>
        );
      },
      sorter: (a, b) => String(a.direction||'').localeCompare(String(b.direction||''), 'ru'),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Компания по заявке', dataIndex: 'company',
      render: (v) => {
        if (isDriver) return '—';
        return <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: 220 }}>{v}</span>;
      },
      sorter: (a, b) => String(a.company||'').localeCompare(String(b.company||''), 'ru'),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Email', dataIndex: 'email', 
      render: (e) => {
        if (isDriver) return '—';
        return e ? <button onClick={() => { navigator.clipboard.writeText(String(e)); message.success('Email скопирован'); }} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{e}</button> : '—';
      },
      sorter: (a, b) => String(a.email||'').localeCompare(String(b.email||''), 'ru'),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Имя', dataIndex: 'client_name',
      render: (text) => {
        if (isDriver) return '—';
        return text ? text.split(' ')[0] : '-';
      },
      sorter: (a, b) => String(a.client_name||'').localeCompare(String(b.client_name||''), 'ru'),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Телефон', dataIndex: 'phone', 
      render: (p) => {
        if (isDriver) return '—';
        return p ? <button onClick={() => { navigator.clipboard.writeText(String(p)); message.success('Номер скопирован'); }} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{p}</button> : '—';
      },
      sorter: (a, b) => String(a.phone||'').localeCompare(String(b.phone||''), 'ru'),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Сумма', dataIndex: 'amount', 
      render: (v) => (v == null ? '—' : <span style={{ whiteSpace: 'nowrap' }}>{Number(v).toLocaleString('ru-RU')} руб.</span>),
      sorter: (a, b) => (Number(a.amount||0) - Number(b.amount||0)),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Водитель', dataIndex: 'driver_name', 
      render: (v, r) => v ? v.split(' ')[0] : (r.driver_id ? `ID ${r.driver_id}` : '—'),
      sorter: (a, b) => String(a.driver_name||'').localeCompare(String(b.driver_name||''), 'ru'),
      sortDirections: ['descend','ascend']
    },
    { 
      title: 'Статус', dataIndex: 'status', 
      render: s => {
        const preset = statusToColor[s] || 'default';
        const colorMap = { 
          default: theme === 'dark' ? '#434343' : '#d9d9d9', 
          processing: '#1890ff',
          warning: '#faad14',
          success: '#52c41a',
          error: '#ff4d4f'
        };
        const bg = s === 'new' ? '#434343' : (colorMap[preset] || (theme === 'dark' ? '#434343' : '#d9d9d9'));
        return (
          <Tag style={{ background: bg, color: '#fff', border: `1px solid ${bg}`, fontWeight: 500 }}>
            {statusToRu[s] || statusToRu['new']}
          </Tag>
        );
      },
      sorter: (a, b) => (statusRank[a.status]||0) - (statusRank[b.status]||0),
      sortDirections: ['descend','ascend']
    },
    {
      title: <div style={{ textAlign: 'center' }}>Действия</div>,
      render: (_, r) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 8 }}>
          {userPermissions?.can_assign_drivers && !isDriver && (
            <Button size="small" onClick={() => openAssign(r.id)}>Назначить</Button>
          )}
          <Button size="small" onClick={() => openStatus(r.id)}>Статус</Button>
          <Button size="small" onClick={() => setDetails(r)}>Подробнее</Button>
          {userPermissions?.can_delete_any && !isDriver && (
            <Popconfirm title="Удалить заявку?" okText="Удалить" cancelText="Отмена" onConfirm={async () => {
              try {
                await api.delete(`/api/orders/${r.id}`, { headers });
                message.success('Заявка удалена');
                fetchOrders();
              } catch (e) {
                message.error(e?.response?.data?.error || 'Не удалось удалить заявку');
              }
            }}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      )
    }
  ];

  // Фильтр по статусам
  const allStatuses = ['new','assigned','in_progress','unloaded','completed','cancelled'];
  const [visibleStatuses, setVisibleStatuses] = useState(allStatuses);
  const filteredOrders = useMemo(() => (
    Array.isArray(orders) ? orders.filter(o => visibleStatuses.includes(o.status || 'new')) : []
  ), [orders, visibleStatuses]);

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
      <Title level={2}>Управление заявками</Title>

      {userPermissions?.can_create_orders && !isDriver && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, color: theme === 'dark' ? '#fff' : undefined }}>
              Для создания заявки нажмите кнопку:
            </div>
            <Button type="primary" onClick={() => setCreateModalOpen(true)}>Создать</Button>
          </div>
        </Card>
      )}

      <Modal title="Создать заявку" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" form={createForm} onFinish={async (vals)=>{ await handleCreate(vals); setCreateModalOpen(false); }}>
            <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Form.Item name="date" label="Дата" rules={[{ required: true, message: 'Укажите дату' }]}> 
                <DatePicker format="DD.MM.YYYY" placeholder="Выбрать дату" />
              </Form.Item>
              <Form.Item name="from" label="Откуда" rules={[{ required: true, message: 'Укажите точку отправления' }]}>
                <Input style={{ width: 180 }} />
              </Form.Item>
              <Form.Item name="to" label="Куда" rules={[{ required: true, message: 'Укажите точку назначения' }]}>
                <Input style={{ width: 200 }} />
              </Form.Item>
            </Space>
            <Divider orientation="left" orientationMargin={0}><span style={{ color: theme === 'dark' ? '#fff' : undefined }}>Погрузка</span></Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.List name="loads" initialValue={[{}]}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, idx) => (
                      <Space key={field.key} size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Form.Item {...field} name={[field.name, 'address']} fieldKey={[field.fieldKey, 'address']} label={idx === 0 ? 'Адрес загрузки' : `Адрес загрузки ${idx+1}` } rules={[{ required: true, message: 'Укажите адрес загрузки' }]}>
                          <Input style={{ width: 240 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'company']} fieldKey={[field.fieldKey, 'company']} label={idx === 0 ? 'Компания на загрузке' : `Компания на загрузке ${idx+1}` } rules={[{ required: true, message: 'Укажите компанию на загрузке' }]}>
                          <Input style={{ width: 220 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'phone']} fieldKey={[field.fieldKey, 'phone']} label={idx === 0 ? 'Телефон загрузки' : `Телефон загрузки ${idx+1}` } normalize={v => (v ? String(v).replace(/\D/g,'') : v)}>
                          <Input style={{ width: 160 }} />
                        </Form.Item>
                        {fields.length > 1 && (
                          <Button danger onClick={() => remove(field.name)}>Удалить</Button>
                        )}
                      </Space>
                    ))}
                    <Button onClick={() => add({})}>Добавить ещё один адрес загрузки</Button>
                  </>
                )}
              </Form.List>
            </Space>
            <Divider orientation="left" orientationMargin={0}><span style={{ color: theme === 'dark' ? '#fff' : undefined }}>Разгрузка</span></Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.List name="unloads" initialValue={[{}]}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, idx) => (
                      <Space key={field.key} size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Form.Item {...field} name={[field.name, 'address']} fieldKey={[field.fieldKey, 'address']} label={idx === 0 ? 'Адрес разгрузки' : `Адрес разгрузки ${idx+1}` } rules={[{ required: true, message: 'Укажите адрес разгрузки' }]}>
                          <Input style={{ width: 240 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'company']} fieldKey={[field.fieldKey, 'company']} label={idx === 0 ? 'Компания на разгрузке' : `Компания на разгрузке ${idx+1}` } rules={[{ required: true, message: 'Укажите компанию на разгрузке' }]}>
                          <Input style={{ width: 220 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'phone']} fieldKey={[field.fieldKey, 'phone']} label={idx === 0 ? 'Телефон разгрузки' : `Телефон разгрузки ${idx+1}` } normalize={v => (v ? String(v).replace(/\D/g,'') : v)}>
                          <Input style={{ width: 160 }} />
                        </Form.Item>
                        {fields.length > 1 && (
                          <Button danger onClick={() => remove(field.name)}>Удалить</Button>
                        )}
                      </Space>
                    ))}
                    <Button onClick={() => add({})}>Добавить ещё один адрес разгрузки</Button>
                  </>
                )}
              </Form.List>
            </Space>
            <Divider orientation="left" orientationMargin={0}><span style={{ color: theme === 'dark' ? '#fff' : undefined }}>Данные по заявке</span></Divider>
            <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Form.Item name="company" label="Компания по заявке" rules={[{ required: true, message: 'Укажите компанию по заявке' }]}>
                <Input style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="clientName" label="Имя" rules={[{ required: true, message: 'Укажите имя' }]}> 
                <Input style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name="phone" label="Телефон" normalize={v => (v ? String(v).replace(/\D/g,'') : v)}>
                <Input style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input style={{ width: 220 }} />
              </Form.Item>
              <Form.Item name="comment" label="Комментарий">
                <Input.TextArea style={{ width: 320 }} rows={1} />
              </Form.Item>
              <Form.Item name="weight" label="Вес">
                <InputNumber min={0} step={0.1} style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="amount" label="Сумма">
                <InputNumber min={0} style={{ width: 140 }} />
              </Form.Item>
              <Form.Item name="driverId" label="Водитель">
                <Select allowClear placeholder="Не назначать" style={{ width: 220 }}>
                  {drivers.map(d => (
                    <Option key={d.id} value={d.id}>{d.full_name || d.username}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">Создать</Button>
              </Form.Item>
            </Space>
          </Form>
      </Modal>

      <Card title="Заявки" style={{ width: '100%' }}>
        <div style={{ marginBottom: 12 }}>
          <Space size={12} wrap>
            <span style={{ opacity: 0.9, color: (typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark') ? '#fff' : undefined }}>Показывать статусы:</span>
            {allStatuses.map((s) => (
              <Checkbox
                key={s}
                checked={visibleStatuses.includes(s)}
                onChange={(e) => {
                  setVisibleStatuses(prev => {
                    if (e.target.checked) {
                      return Array.from(new Set([...prev, s]));
                    }
                    return prev.filter(x => x !== s);
                  });
                }}
                style={{ color: (typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark') ? '#fff' : undefined }}
              >
                <span style={{ color: (typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark') ? '#fff' : undefined }}>{statusToRu[s]}</span>
              </Checkbox>
            ))}
          </Space>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredOrders}
          pagination={{ 
            pageSize, 
            showSizeChanger: true,
            pageSizeOptions: ['5','10','15','20','50','100'],
            onShowSizeChange: (_, size) => setPageSize(size)
          }}
          scroll={{ x: 'max-content' }}
          showSorterTooltip={{ title: 'Нажмите для сортировки' }}
        />
      </Card>

      <Modal
        title={`Заявка №${details?.id || ''}`}
        open={!!details}
        onCancel={() => { setDetails(null); if (typeof window !== 'undefined') { const m = String(window.location.hash||'').match(/^#\/orders\/(\d+)/); if (m) window.location.hash = '#'; } }}
        footer={null}
        width={800}
      >
        {details && (
          <div>
            {(() => {
              const lines = String(details.direction || '').split('\n');
              const first = lines[0] || '';
              const [from, to] = first.split(' → ');
              const loadLines = lines.filter(l => l.startsWith('Погрузка'));
              const unloadLines = lines.filter(l => l.startsWith('Разгрузка'));
              const extractPart = (line) => {
                const idx = line.indexOf(':');
                return idx >= 0 ? line.slice(idx + 1).trim() : line;
              };
              const splitCompanyPhone = (rest) => {
                const addrEnd = rest.indexOf('(');
                const address = addrEnd > 0 ? rest.slice(0, addrEnd).trim() : rest;
                const inside = rest.match(/\((.*)\)/)?.[1] || '';
                const company = inside.split(',')[0]?.trim() || '';
                const phone = inside.split(',')[1]?.trim() || '';
                return { address, company, phone };
              };
              const loadParsedArr = loadLines.map(l => splitCompanyPhone(extractPart(l)));
              const unloadParsedArr = unloadLines.map(l => splitCompanyPhone(extractPart(l)));
              const openMap = (addr) => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(addr)}`, '_blank');
              const copy = (text, msg) => { navigator.clipboard.writeText(String(text || '')); message.success(msg); };
              return (
                <>
                  <p><b>Дата:</b> {details.date ? dayjs(details.date).format('DD.MM.YYYY') : '—'}</p>
                  <p><b>Направление:</b> {(from || to) ? `${from || '—'} → ${to || '—'}` : '—'}</p>
                  {loadParsedArr.map((l, idx) => (
                    <div key={`load-${idx}`}>
                      <p><b>{idx === 0 ? 'Адрес загрузки' : `Адрес загрузки ${idx + 1}`}:</b> {l.address ? <button onClick={() => openMap(l.address)} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{l.address}</button> : '—'}</p>
                      <p><b>{idx === 0 ? 'Компания на загрузке' : `Компания на загрузке ${idx + 1}`}:</b> {l.company || '—'}</p>
                      <p><b>{idx === 0 ? 'Телефон на загрузке' : `Телефон на загрузке ${idx + 1}`}:</b> {l.phone ? <button onClick={() => copy(l.phone, 'Номер скопирован')} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{l.phone}</button> : 'нет'}</p>
                    </div>
                  ))}
                  {unloadParsedArr.map((u, idx) => (
                    <div key={idx}>
                      <p><b>{idx === 0 ? 'Адрес разгрузки' : `Адрес разгрузки ${idx + 1}`}:</b> {u.address ? <button onClick={() => openMap(u.address)} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{u.address}</button> : '—'}</p>
                      <p><b>{idx === 0 ? 'Компания на разгрузке' : `Компания на разгрузке ${idx + 1}`}:</b> {u.company || '—'}</p>
                      <p><b>{idx === 0 ? 'Телефон на разгрузке' : `Телефон на разгрузке ${idx + 1}`}:</b> {u.phone ? <button onClick={() => copy(u.phone, 'Номер скопирован')} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{u.phone}</button> : 'нет'}</p>
                    </div>
                  ))}
                  {!isDriver && (
                    <p><b>Email:</b> {details.email ? <button onClick={() => copy(details.email, 'Email скопирован')} style={{ padding: 0, border: 'none', background: 'none', color: '#1677ff', cursor: 'pointer' }}>{details.email}</button> : '—'}</p>
                  )}
                  {/* Компания по заявке / Имя / Телефон / Email скрыты по требованию */}
                  <p><b>Комментарий:</b> {(() => {
                    const commentLine = lines.find(l => l.startsWith('Комментарий:')) || '';
                    const idx = commentLine.indexOf(':');
                    return idx >= 0 ? commentLine.slice(idx + 1).trim() : '—';
                  })()}</p>
                  <p>
                    <b>Вес:</b> {details.weight == null ? '—' : Number(details.weight).toLocaleString('ru-RU')}
                    {' '}| <b>Сумма:</b> {details.amount == null ? '—' : `${Number(details.amount).toLocaleString('ru-RU')} руб.`}
                  </p>
                </>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 }}>
              <div style={{ flex: 1 }} />
              {!isDriver && (
                <div>
                  <Button onClick={() => { setEditVisible(true); editForm.setFieldsValue(parseDetailsToFields(details)); }}>Редактировать</Button>
                </div>
              )}
            </div>
            <div className="map-center-wrap" style={{ height: 260, borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
              <div ref={routeMapRef} style={{ width: '100%', height: '100%' }} />
            </div>
            {/* маршрут отрисовывается в useEffect ниже */}
            {routeInfo && (
              <p style={{ marginTop: 8 }}><b>Маршрут:</b> {routeInfo.distanceKm} км · ~ {routeInfo.etaMin} мин</p>
            )}
          </div>
        )}
      </Modal>

      <Modal title={`Редактировать заявку №${details?.id || ''}`} open={editVisible} onCancel={() => setEditVisible(false)} footer={null} destroyOnClose>
        <Form layout="vertical" form={editForm} onFinish={async (vals) => {
          try {
            const from = vals.from || '';
            const to = vals.to || '';
            const loadAddress = vals.loadAddress || '';
            const loadCompany = vals.loadCompany || '';
            const loadPhone = vals.loadPhone || 'нет';
            const unload1 = { address: vals.unloadAddress || '', company: vals.unloadCompany || '', phone: vals.unloadPhone || 'нет' };
            const unload2 = (vals.unloadAddress2 || vals.unloadCompany2 || vals.unloadPhone2)
              ? { address: vals.unloadAddress2 || '', company: vals.unloadCompany2 || '', phone: vals.unloadPhone2 || 'нет' }
              : null;
            const unload3 = (vals.unloadAddress3 || vals.unloadCompany3 || vals.unloadPhone3)
              ? { address: vals.unloadAddress3 || '', company: vals.unloadCompany3 || '', phone: vals.unloadPhone3 || 'нет' }
              : null;
            const comment = vals.comment || '';

            const startsWithCity = (city, addr) => city && new RegExp(`^${escape(city)}\\s*,`, 'i').test(String(addr));
            function escape(s){ return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
            const loadFull = startsWithCity(from, loadAddress) ? loadAddress : `${from ? from + ', ' : ''}${loadAddress}`.trim();
            const toPref = (addr) => (startsWithCity(to, addr) ? addr : `${to ? to + ', ' : ''}${addr}`).trim();
            const unloadLines = [unload1, unload2, unload3].filter(Boolean).map((u, idx) => {
              const label = idx === 0 ? 'Разгрузка' : `Разгрузка ${idx + 1}`;
              return `${label}: ${toPref(u.address)} (${u.company}, ${u.phone})`;
            }).join('\n');
            const directionDetails = `${from} → ${to}\nПогрузка: ${loadFull} (${loadCompany}, ${loadPhone})\n${unloadLines}${comment ? `\nКомментарий: ${comment}` : ''}`;

            const payload = {
              date: vals.date ? dayjs(vals.date).format('YYYY-MM-DD') : null,
              direction: directionDetails,
              company: vals.company,
              client_name: vals.clientName || vals.client_name,
              phone: vals.phone || null,
              email: vals.email || null,
              amount: vals.amount ?? null,
              weight: vals.weight ?? null,
              driver_id: vals.driverId || null
            };
            // Расстояние редактируется вручную пользователем
            await api.put(`/api/orders/${details.id}`, payload, { headers });
            message.success('Заявка обновлена');
            setEditVisible(false);
            fetchOrders();
            const r = await api.get(`/api/orders/${details.id}`, { headers });
            setDetails(r.data?.order || null);
          } catch (e) {
            message.error(e?.response?.data?.error || 'Не удалось обновить заявку');
          }
        }}>
          <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Form.Item name="date" label="Дата" rules={[{ required: true, message: 'Укажите дату' }]}> 
              <DatePicker format="DD.MM.YYYY" placeholder="Выбрать дату" />
            </Form.Item>
            <Form.Item name="from" label="Откуда" rules={[{ required: true, message: 'Укажите точку отправления' }]}>
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="to" label="Куда" rules={[{ required: true, message: 'Укажите точку назначения' }]}>
              <Input style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="loadAddress" label="Адрес загрузки" rules={[{ required: true, message: 'Укажите адрес загрузки' }]}>
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="loadCompany" label="Компания на загрузке" rules={[{ required: true, message: 'Укажите компанию на загрузке' }]}>
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="loadPhone" label="Телефон загрузки" normalize={v => (v ? String(v).replace(/\D/g,'') : v)}>
              <Input style={{ width: 160 }} />
            </Form.Item>
            {/* Доп. погрузки при редактировании */}
            <Form.Item name="loadAddress2" label="Адрес загрузки 2">
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="loadCompany2" label="Компания на загрузке 2">
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="loadPhone2" label="Телефон загрузки 2" normalize={v => (v ? String(v).replace(/\D/g,'') : v)}>
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="loadAddress3" label="Адрес загрузки 3">
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="loadCompany3" label="Компания на загрузке 3">
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="loadPhone3" label="Телефон загрузки 3" normalize={v => (v ? String(v).replace(/\D/g,'') : v)}>
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="unloadAddress" label="Адрес разгрузки" rules={[{ required: true, message: 'Укажите адрес разгрузки' }]}>
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="unloadCompany" label="Компания на разгрузке" rules={[{ required: true, message: 'Укажите компанию на разгрузке' }]}>
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="unloadPhone" label="Телефон разгрузки">
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="company" label="Компания по заявке" rules={[{ required: true, message: 'Укажите компанию по заявке' }]}>
              <Input style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="clientName" label="Имя" rules={[{ required: true, message: 'Укажите имя' }]}> 
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="phone" label="Телефон">
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="comment" label="Комментарий">
              <Input.TextArea style={{ width: 320 }} rows={1} />
            </Form.Item>
            <Form.Item name="weight" label="Вес">
              <InputNumber min={0} step={0.1} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="amount" label="Сумма">
              <InputNumber min={0} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="driverId" label="Водитель">
              <Select allowClear placeholder="Не назначать" style={{ width: 220 }}>
                {drivers.map(d => (
                  <Option key={d.id} value={d.id}>{d.full_name || d.username}</Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit">Сохранить</Button>
        </Form>
      </Modal>

      <Modal
        title="Назначить водителя"
        open={assignModal.open}
        onCancel={() => setAssignModal({ open: false, orderId: null })}
        footer={null}
        destroyOnClose
      >
        <Select
          placeholder="Выберите водителя"
          style={{ width: '100%' }}
          onChange={handleAssign}
          showSearch
          optionFilterProp="children"
          key={assignModal.orderId || 'assign'}
        >
          {drivers.map(d => (
            <Option key={d.id} value={d.id}>{d.full_name || d.username}</Option>
          ))}
        </Select>
      </Modal>

      <Modal
        title="Изменить статус"
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, orderId: null })}
        footer={null}
        destroyOnClose
      >
        <Select
          placeholder="Выберите статус"
          style={{ width: '100%' }}
          onChange={handleChangeStatus}
          key={statusModal.orderId || 'status'}
        >
          {isDriver ? (
            <>
              <Option value="in_progress">В пути</Option>
              <Option value="unloaded">Разгрузился</Option>
            </>
          ) : (
            <>
              <Option value="new">Новая</Option>
              <Option value="assigned">Назначена</Option>
              <Option value="in_progress">В пути</Option>
              <Option value="unloaded">Разгрузился</Option>
              <Option value="completed">Выполнена</Option>
              <Option value="cancelled">Отменена</Option>
            </>
          )}
        </Select>
      </Modal>
    </div>
  );
};

export default Orders;
