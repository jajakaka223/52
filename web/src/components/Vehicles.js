import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Typography, Form, Input, Select, Button, Table, Space, Modal, message, Popconfirm, DatePicker, InputNumber } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

function useAuthHeaders() {
  return useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
}

const Vehicles = () => {
  const headers = useAuthHeaders();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [assignModal, setAssignModal] = useState({ open: false, vehicleId: null });
  const [detailsModal, setDetailsModal] = useState({ open: false, vehicle: null, loading: false, history: [] });
  const [detailsForm] = Form.useForm();

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/vehicles', { headers });
      setVehicles(res.data?.vehicles || []);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось загрузить транспорт');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await axios.get('/api/users', { headers });
      const list = (res.data?.users || []).filter(u => u.role === 'driver' && u.is_active !== false);
      setDrivers(list);
    } catch (_) {}
  }, [headers]);

  useEffect(() => { fetchVehicles(); fetchDrivers(); }, [fetchVehicles, fetchDrivers]);

  const handleCreate = async (values) => {
    try {
      setLoading(true);
      const payload = {
        name: values?.name != null ? String(values.name).trim() : '',
        model: values?.model ? String(values.model).trim() : null,
        plateNumber: values?.plateNumber ? String(values.plateNumber).toUpperCase().replace(/\s+/g,'').trim() : null,
        driverId: values?.driverId || null
      };
      if (!payload.name) {
        message.error('Название машины обязательно');
        return;
      }
      await axios.post('/api/vehicles', payload, { headers });
      message.success('Машина создана');
      createForm.resetFields();
      fetchVehicles();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Не удалось создать машину';
      const map = {
        "Название машины обязательно": 'Название машины обязательно',
        "name is required": 'Название машины обязательно',
      };
      message.error(map[msg] || msg);
    }
    finally {
      setLoading(false);
    }
  };

  const handleAssign = async (driverId) => {
    try {
      await axios.post(`/api/vehicles/${assignModal.vehicleId}/assign-driver`, { driverId }, { headers });
      message.success('Водитель назначен машине');
      setAssignModal({ open: false, vehicleId: null });
      fetchVehicles();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось назначить водителя');
    }
  };

  const openDetails = async (vehicle) => {
    setDetailsModal({ open: true, vehicle, loading: true, history: [] });
    try {
      // загрузим актуальные данные по машине и историю
      const [vRes, hRes] = await Promise.all([
        axios.get(`/api/vehicles/${vehicle.id}`, { headers }),
        axios.get(`/api/vehicles/${vehicle.id}/maintenance`, { headers }).catch(() => ({ data: { history: [] } }))
      ]);
      const v = vRes.data?.vehicle || vehicle;
      setDetailsModal({ open: true, vehicle: v, loading: false, history: hRes.data?.history || [] });
      detailsForm.setFieldsValue({
        mileage: v.mileage || null,
        lastServiceDate: v.last_service_date ? dayjs(v.last_service_date) : null
      });
    } catch (_) {
      setDetailsModal(m => ({ ...m, loading: false }));
    }
  };

  const saveDetails = async () => {
    const values = await detailsForm.validateFields().catch(() => null);
    if (!values) return;
    try {
      const payload = {
        mileage: values.mileage != null ? Number(values.mileage) : null,
        last_service_date: values.lastServiceDate ? values.lastServiceDate.format('YYYY-MM-DD') : null
      };
      await axios.put(`/api/vehicles/${detailsModal.vehicle.id}`, payload, { headers });
      // пишем историю
      await axios.post(`/api/vehicles/${detailsModal.vehicle.id}/maintenance`, {
        mileage: payload.mileage,
        lastServiceDate: payload.last_service_date
      }, { headers }).catch(() => {});
      message.success('Данные обновлены');
      // обновим список + историю
      fetchVehicles();
      const h = await axios.get(`/api/vehicles/${detailsModal.vehicle.id}/maintenance`, { headers }).catch(() => ({ data: { history: [] } }));
      setDetailsModal(m => ({ ...m, history: h.data?.history || [] }));
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось сохранить');
    }
  };

  const deleteHistory = async (row) => {
    try {
      await axios.delete(`/api/vehicles/maintenance/${row.id}`, { headers });
      const h = await axios.get(`/api/vehicles/${detailsModal.vehicle.id}/maintenance`, { headers }).catch(() => ({ data: { history: [] } }));
      setDetailsModal(m => ({ ...m, history: h.data?.history || [] }));
    } catch (e) {
      message.error(e?.response?.data?.error || 'Не удалось удалить запись');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Марка', dataIndex: 'name' },
    { title: 'Модель', dataIndex: 'model' },
    { title: 'Гос. номер', dataIndex: 'plate_number' },
    { title: 'Водитель', dataIndex: 'driver_name', render: (v, r) => v || (r.driver_id ? `ID ${r.driver_id}` : '—') },
    { title: 'Действия', render: (_, r) => (
      <Space>
        <Button size="small" onClick={() => setAssignModal({ open: true, vehicleId: r.id })}>Назначить водителя</Button>
        <Button size="small" onClick={() => openDetails(r)}>Подробнее</Button>
        <Popconfirm title="Удалить машину?" okText="Удалить" cancelText="Отмена" onConfirm={async () => {
          try {
            await axios.delete(`/api/vehicles/${r.id}`, { headers });
            message.success('Машина удалена');
            fetchVehicles();
          } catch (e) {
            message.error(e?.response?.data?.error || 'Не удалось удалить машину');
          }
        }}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) }
  ];

  return (
    <div>
      <Title level={2}>Управление транспортом</Title>

      <Card style={{ marginBottom: 16 }} title="Добавить транспорт">
        <Form layout="vertical" form={createForm} onFinish={handleCreate}>
          <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Form.Item name="name" label="Марка" rules={[{ required: true, message: 'Название машины обязательно' }]}><Input style={{ width: 180 }} /></Form.Item>
            <Form.Item name="model" label="Модель" rules={[{ required: true, message: 'Укажите модель' }]} normalize={v => (v ? String(v).trim() : v)}><Input style={{ width: 180 }} /></Form.Item>
            <Form.Item name="plateNumber" label="Гос. номер" normalize={v => (v ? String(v).toUpperCase().replace(/\s+/g,'').trim() : v)} rules={[{ required: true, message: 'Укажите гос. номер' }, { validator: (_, v) => {
              const val = (v || '').trim();
              if (!val) return Promise.resolve();
              const exists = vehicles.some(x => (x.plate_number || '').trim().toLowerCase() === val.toLowerCase());
              return exists ? Promise.reject(new Error('Такой гос.номер уже существует')) : Promise.resolve();
            }}]}><Input style={{ width: 160 }} /></Form.Item>
            <Form.Item name="driverId" label="Закрепить за водителем"><Select allowClear style={{ width: 240 }}>{drivers.map(d => (<Option key={d.id} value={d.id}>{d.full_name || d.username}</Option>))}</Select></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading} disabled={loading}>Добавить</Button></Form.Item>
          </Space>
        </Form>
      </Card>

      <Card title="Транспорт">
        <Table rowKey="id" loading={loading} columns={columns} dataSource={vehicles} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="Назначить водителя" open={assignModal.open} onCancel={() => setAssignModal({ open: false, vehicleId: null })} footer={null}>
        <Select placeholder="Выберите водителя" style={{ width: '100%' }} onChange={handleAssign} showSearch optionFilterProp="children">
          {drivers.map(d => (<Option key={d.id} value={d.id}>{d.full_name || d.username}</Option>))}
        </Select>
      </Modal>

      <Modal title={detailsModal.vehicle ? `Машина ${detailsModal.vehicle.name || ''}${detailsModal.vehicle.plate_number ? ' / ' + detailsModal.vehicle.plate_number : ''}${detailsModal.vehicle.driver_name ? ' / ' + detailsModal.vehicle.driver_name : ''}` : 'Подробнее'} open={detailsModal.open} onCancel={() => setDetailsModal({ open: false, vehicle: null, loading: false, history: [] })} footer={null} width={720}>
        <Form layout="vertical" form={detailsForm}>
          <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Form.Item name="mileage" label="Пробег" rules={[{ type: 'number', transform: v => (v===''||v==null?undefined:Number(v)), message: 'Число' }]}>
              <InputNumber min={0} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="lastServiceDate" label="Последнее ТО">
              <DatePicker format="DD.MM.YYYY" placeholder="Выберите дату" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={saveDetails}>Изменить</Button>
            </Form.Item>
          </Space>
        </Form>

        <Card size="small" title="История изменений" style={{ marginTop: 16 }}>
          <Table
            size="small"
            rowKey="id"
            pagination={{ pageSize: 5 }}
            dataSource={detailsModal.history}
            columns={[
              { title: 'Дата', dataIndex: 'created_at', render: v => v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—' },
              { title: 'Пробег', dataIndex: 'mileage' },
              { title: 'Последнее ТО', dataIndex: 'last_service_date', render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—' },
              { title: 'Действия', render: (_, r) => (
                <Popconfirm title="Удалить запись?" okText="Удалить" cancelText="Отмена" onConfirm={() => deleteHistory(r)}>
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              ) }
            ]}
          />
        </Card>
      </Modal>
    </div>
  );
};

export default Vehicles;
