import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Row, Col, Statistic, Space, Button, Form, InputNumber, message, Table, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

const DEFAULT_PERCENTS = {
  tax: 6,
  salary: 20,
  repair: 15,
  fuel: 14,
  safe: 5,
  profit: 40
};

const STORAGE_BALANCES = 'budget_balances_v1';
const STORAGE_PERCENTS = 'budget_percents_v1';

function readLs(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}
function writeLs(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function formatThousandsFixed2(v) {
  if (v === undefined || v === null || v === '') return '';
  const num = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, ''));
  const fixed = round2(num).toFixed(2);
  return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const Budget = () => {
  const [percents, setPercents] = useState(() => readLs(STORAGE_PERCENTS, DEFAULT_PERCENTS));
  const [balances, setBalances] = useState(() => readLs(STORAGE_BALANCES, { tax: 0, salary: 0, repair: 0, fuel: 0, safe: 0, profit: 0 }));
  const [formPerc] = Form.useForm();
  const [formBal] = Form.useForm();
  const [history, setHistory] = useState(() => readLs('budget_history_v1', []));

  useEffect(() => { formPerc.setFieldsValue(percents); }, [percents, formPerc]);
  useEffect(() => { formBal.setFieldsValue(balances); }, [balances, formBal]);
  useEffect(() => {
    const h = readLs('budget_history_v1', []);
    setHistory(h);
    const onStorage = () => setHistory(readLs('budget_history_v1', []));
    window.addEventListener('storage', onStorage);
    const t = setInterval(onStorage, 1500);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t); };
  }, []);

  const totalPercent = useMemo(() => Object.values(percents).reduce((s, n) => s + Number(n || 0), 0), [percents]);

  const savePercents = async () => {
    const vals = await formPerc.validateFields().catch(() => null);
    if (!vals) return;
    const total = Object.values(vals).reduce((s, n) => s + Number(n || 0), 0);
    if (total !== 100) {
      message.error('Сумма процентов должна быть равна 100');
      return;
    }
    setPercents(vals);
    writeLs(STORAGE_PERCENTS, vals);
    message.success('Проценты сохранены');
  };

  const saveBalances = async () => {
    const vals = await formBal.validateFields().catch(() => null);
    if (!vals) return;
    const normalized = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, round2(v)]));
    setBalances(normalized);
    writeLs(STORAGE_BALANCES, normalized);
    message.success('Балансы сохранены');
  };

  const deleteHistory = (id) => {
    try {
      const list = Array.isArray(history) ? history.filter((r) => r.id ? r.id !== id : r.ts !== id) : [];
      const normalized = list.map(r => ({ ...r, id: r.id || r.ts }));
      localStorage.setItem('budget_history_v1', JSON.stringify(normalized));
      setHistory(normalized);
      message.success('Запись удалена');
    } catch (_) {
      message.error('Не удалось удалить запись');
    }
  };

  const cards = [
    { key: 'tax', title: 'Налог' },
    { key: 'salary', title: 'Зарплата' },
    { key: 'repair', title: 'Ремонт' },
    { key: 'fuel', title: 'Заправка' },
    { key: 'safe', title: 'Сейф' },
    { key: 'profit', title: 'Чистая прибыль' }
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
      <Title level={2}>Бюджет</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {cards.map(c => (
          <Col key={c.key} xs={24} sm={12} md={8} lg={8} xl={8}>
            <Card>
              <Statistic
                title={`${c.title} (${percents[c.key] || 0}%)`}
                value={Number(balances[c.key] || 0)}
                precision={2}
                suffix="руб."
                valueStyle={{ color: '#40a9ff' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Изменить балансы">
            <Form layout="vertical" form={formBal}>
              <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {cards.map(c => (
                  <Form.Item key={c.key} name={c.key} label={c.title} rules={[{ type: 'number', transform: v => (v===''||v==null?undefined:Number(v)), message: 'Число' }]}> 
                    <InputNumber
                      min={-1000000000}
                      step={100}
                      precision={2}
                      style={{ width: 180 }}
                      formatter={formatThousandsFixed2}
                      parser={(v)=>String(v).replace(/\s/g,'')}
                    />
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button type="primary" onClick={saveBalances}>Сохранить</Button>
                </Form.Item>
              </Space>
            </Form>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={`Распределение процентов (сумма: ${totalPercent}%)`}>
            <Form layout="vertical" form={formPerc}>
              <Space size={16} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {cards.map(c => (
                  <Form.Item key={c.key} name={c.key} label={c.title} rules={[{ required: true, message: 'Укажите процент' }]}> 
                    <InputNumber min={0} max={100} style={{ width: 120 }} />
                  </Form.Item>
                ))}
                <Form.Item>
                  <Button type="primary" onClick={savePercents}>Сохранить</Button>
                </Form.Item>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card title="История изменений" style={{ marginTop: 16 }}>
        <Table
          size="small"
          rowKey={(r, i) => String(r.id || r.ts || i)}
          dataSource={history}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Когда', dataIndex: 'ts', render: (v) => v ? new Date(v).toLocaleString('ru-RU') : '—', width: 180 },
            { title: 'Категория', dataIndex: 'category', width: 180 },
            { title: 'Изменение', dataIndex: 'delta', render: (v) => `${v > 0 ? '+' : ''}${Number(v).toLocaleString('ru-RU')} руб.` },
            { title: 'Комментарий', dataIndex: 'comment' },
            { title: 'Действия', width: 100, render: (_, r) => (
              <Popconfirm title="Удалить запись?" okText="Удалить" cancelText="Отмена" onConfirm={() => deleteHistory(r.id || r.ts)}>
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          ]}
        />
      </Card>
    </div>
  );
};

export default Budget;


