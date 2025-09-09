import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Card, Typography, DatePicker, message } from 'antd';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import axios from 'axios';
import { getApiUrl } from '../config/api';
// Отказываемся от @ant-design/plots: рисуем собственный SVG-график

const { Title } = Typography;

const Reports = () => {
  const [data, setData] = useState([]);
  const [range, setRange] = useState(null);

  const fetch = async (start, end) => {
    try {
      const params = start && end ? { startDate: start, endDate: end } : {};
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      // Получаем почасовой/дневной ряд
      const seriesRes = await axios.get(getApiUrl('/api/reports/orders-by-date', { params, headers });
      const rows = Array.isArray(seriesRes.data?.report) ? seriesRes.data.report : [];

      // Строим полный список дат от start до end (включительно)
      const startD = dayjs(start);
      const endD = dayjs(end);
      const days = [];
      for (let d = startD.clone(); d.isBefore(endD) || d.isSame(endD, 'day'); d = d.add(1, 'day')) {
        days.push(d.format('YYYY-MM-DD'));
      }

      // Индексируем приходящие строки по дате
      const byDate = new Map(rows.map(r => [dayjs(r.period).format('YYYY-MM-DD'), {
        revenue: Number(r.revenue || 0),
        expected: Number(r.expected_revenue || 0)
      }]));

      // Собираем сплошной ряд
      const mapped = days.map((iso) => {
        const v = byDate.get(iso) || { revenue: 0, expected: 0 };
        // Расходов пока нет в API — показываем 0, чтобы было 3 столбца
        const expense = 0;
        return {
          date: dayjs(iso).format('DD.MM.YYYY'),
          revenue: Number(v.revenue || 0),
          expected: Number(v.expected || 0),
          expense: Number(expense || 0),
        };
      });

      // Подтягиваем расходы из учёта и агрегируем по датам
      const accParams = start && end ? { startDate: start, endDate: end } : {};
      const accRes = await axios.get(getApiUrl('/api/accounting', { params: accParams, headers });
      const expenseByIso = (accRes.data?.records || [])
        .filter(r => Number(r.amount) < 0)
        .reduce((map, r) => {
          const iso = dayjs(r.date).format('YYYY-MM-DD');
          const add = Math.abs(Number(r.amount || 0));
          map[iso] = (map[iso] || 0) + add;
          return map;
        }, {});

      // Встраиваем расходы по датам
      const withExpense = mapped.map(r => ({
        ...r,
        expense: Number(expenseByIso[dayjs(r.date, 'DD.MM.YYYY').format('YYYY-MM-DD')] || 0),
      }));

      // Преобразуем в длинный формат для группированных столбцов
      const longData = withExpense.flatMap((r) => ([
        { date: r.date, metric: 'Доход', value: Number(r.revenue || 0) },
        { date: r.date, metric: 'Расход', value: Number(r.expense || 0) },
        { date: r.date, metric: 'Ожидаемая прибыль', value: Number(r.expected || 0) },
      ]));
      setData(longData);
    } catch (e) {
      const msg = e?.response?.status === 401 ? 'Требуется авторизация. Войдите заново.' : 'Не удалось получить данные отчёта';
      message.error(msg);
      setData([]);
    }
  };

  const onChange = (values) => {
    if (values && values.length === 2) {
      setRange(values);
      fetch(values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD'));
    }
  };

  useEffect(() => {
    const start = dayjs().startOf('month');
    const end = dayjs();
    setRange([start, end]);
    fetch(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  }, []);

  const totals = useMemo(() => {
    const sumBy = (metric) => data.filter(d => d.metric === metric).reduce((acc, x) => acc + (x.value || 0), 0);
    return {
      revenue: sumBy('Доход'),
      expense: sumBy('Расход'),
      expected: sumBy('Ожидаемая прибыль'),
    };
  }, [data]);

  const [isDark, setIsDark] = useState(typeof document !== 'undefined' && document.body?.getAttribute('data-theme') === 'dark');

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      const dark = document.body?.getAttribute('data-theme') === 'dark';
      setIsDark(dark);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // maxY больше не используется (отрисовка на SVG ниже имеет свой расчёт)

  // Подготовка данных к виду: [{date, metrics:{Доход:x, Расход:y, Ожидаемая прибыль:z}}]
  const byDate = useMemo(() => {
    const map = new Map();
    data.forEach(d => {
      const key = d.date;
      if (!map.has(key)) map.set(key, { date: key, metrics: { 'Доход': 0, 'Расход': 0, 'Ожидаемая прибыль': 0 } });
      map.get(key).metrics[d.metric] = Number(d.value || 0);
    });
    return Array.from(map.values());
  }, [data]);

  const BarChart = ({ width = 1000, height = 360, padding = { top: 20, right: 12, bottom: 40, left: 56 } }) => {
    const colors = { 'Доход': '#52c41a', 'Расход': '#ff4d4f', 'Ожидаемая прибыль': '#69c0ff' };
    const [tooltip, setTooltip] = useState(null); // {x,y,lines:["name: value"]}

    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    // Паддинг по Y: +10_000 до 1_000_000 и +100_000 свыше миллиона
    const rawMax = Math.max(0, ...byDate.flatMap(r => Object.values(r.metrics)));
    const pad = rawMax <= 1_000_000 ? 10_000 : 100_000;
    const maxVal = Math.max(1000, rawMax + pad);
    const yScale = (v) => innerH - (v / maxVal) * innerH;

    const groupCount = 3; // три метрики
    const bandW = byDate.length > 0 ? innerW / byDate.length : innerW;
    const colGap = 6;
    const colW = Math.max(4, (bandW - colGap * 2) / groupCount);
    // Шаг подписей по X, чтобы не накладывались: минимум ~66px на подпись
    const minPxPerLabel = 66;
    const labelStep = Math.max(1, Math.ceil(minPxPerLabel / bandW));

    return (
      <div style={{ position: 'relative' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect x={0} y={0} width={width} height={height} fill={isDark ? '#111' : '#fff'} />
          {/* grid */}
          {Array.from({ length: 6 }).map((_, i) => {
            const y = padding.top + (innerH / 5) * i;
            return (
              <line key={`g-${i}`} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} />
            );
          })}
          {/* y labels */}
          {Array.from({ length: 6 }).map((_, i) => {
            const val = Math.round((maxVal / 5) * (5 - i));
            const y = padding.top + (innerH / 5) * i + 12;
            return (
              <text key={`yl-${i}`} x={8} y={y} fill={isDark ? '#aaa' : '#666'} fontSize="10">{val.toLocaleString('ru-RU')}</text>
            );
          })}
          {/* bars */}
          {byDate.map((row, idx) => {
            const x0 = padding.left + bandW * idx;
            const metrics = ['Доход', 'Расход', 'Ожидаемая прибыль'];
            return (
              <g key={`grp-${row.date}`}>
                {/* x label */}
                {idx % labelStep === 0 && (
                  <text x={x0 + bandW / 2} y={height - 8} textAnchor="middle" fill={isDark ? '#ddd' : '#000'} fontSize="10">
                    {byDate.length > 15 ? row.date.slice(0, 5) : row.date}
                  </text>
                )}
                {metrics.map((m, mi) => {
                  const v = row.metrics[m] || 0;
                  const h = innerH - yScale(v);
                  const x = x0 + mi * colW + mi * 2;
                  const y = padding.top + yScale(v);
                  return (
                    <rect
                      key={`bar-${m}-${idx}`}
                      x={x}
                      y={y}
                      width={colW}
                      height={h}
                      fill={colors[m]}
                      rx={4}
                      onMouseEnter={(e) => {
                        const lines = [`${m}: ${v.toLocaleString('ru-RU')} руб.`];
                        setTooltip({ x: e.clientX, y: e.clientY, title: row.date, lines });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
        {tooltip && (
          <div style={{ position: 'fixed', top: tooltip.y + 8, left: tooltip.x + 8, background: isDark ? '#1f1f1f' : '#fff', color: isDark ? '#fff' : '#000', border: `1px solid ${isDark ? '#333' : '#ddd'}`, borderRadius: 8, padding: '8px 10px', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.title}</div>
            {tooltip.lines.map((l, i) => (<div key={i}>{l}</div>))}
          </div>
        )}
      </div>
    );
  };

  dayjs.locale('ru');

  return (
    <ConfigProvider locale={ruRU}>
    <div>
      <Title level={2}>Отчеты и аналитика</Title>
      <Card title="Доход, Расход и ожидаемая прибыль">
        <DatePicker.RangePicker onChange={onChange} value={range} placeholder={["Выберите дату", "Выберите дату"]} format="DD.MM.YYYY" />
        <div style={{ marginTop: 16 }}>
          <BarChart width={1100} height={380} />
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Card size="small" bodyStyle={{ padding: 12, background: isDark ? '#141414' : '#f5f5f5', color: isDark ? '#fff' : '#000' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Доход (Завершённые заявки)</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.revenue.toLocaleString('ru-RU')} руб.</div>
          </Card>
          <Card size="small" bodyStyle={{ padding: 12, background: isDark ? '#141414' : '#f5f5f5', color: isDark ? '#fff' : '#000' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Расход</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.expense.toLocaleString('ru-RU')} руб.</div>
          </Card>
          <Card size="small" bodyStyle={{ padding: 12, background: isDark ? '#141414' : '#f5f5f5', color: isDark ? '#fff' : '#000' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Ожидаемая прибыль (назначены / в пути)</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.expected.toLocaleString('ru-RU')} руб.</div>
          </Card>
        </div>
      </Card>
    </div>
    </ConfigProvider>
  );
};

export default Reports;
