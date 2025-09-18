const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить все записи учета
router.get('/', async (req, res) => {
  try {
    const { type, vehicleId, startDate, endDate } = req.query;
    
    let query = `
      SELECT a.*, v.name as vehicle_name, v.plate_number, u.full_name as driver_name
      FROM accounting a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      query += ` AND a.type = $${paramCount}`;
      params.push(type);
    }

    if (vehicleId) {
      paramCount++;
      query += ` AND a.vehicle_id = $${paramCount}`;
      params.push(vehicleId);
    }

    if (startDate && endDate) {
      paramCount++;
      const fromIdx = paramCount;
      params.push(startDate);
      paramCount++;
      const toIdx = paramCount;
      params.push(endDate);
      query += ` AND a.date BETWEEN $${fromIdx} AND $${toIdx}`;
    }

    // Проверяем права доступа
    if (req.user.role !== 'admin') {
      paramCount++;
      query += ` AND (v.driver_id = $${paramCount} OR (a.vehicle_id IS NULL AND a.description LIKE 'Зарплатный вычет:%' AND a.description LIKE '%водитель: ' || $${paramCount} || ')%'))`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY a.date DESC, a.created_at DESC`;

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      records: result.rows
    });

  } catch (error) {
    logError(error, { route: '/accounting', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении записей учета' });
  }
});

// Получить запись учета по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT a.*, v.name as vehicle_name, v.plate_number, u.full_name as driver_name
      FROM accounting a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись учета не найдена' });
    }

    // Проверяем права доступа
    if (req.user.role !== 'admin') {
      const record = result.rows[0];
      
      // Если это зарплатный вычет, проверяем по описанию
      if (record.vehicle_id === null && record.description && record.description.startsWith('Зарплатный вычет:')) {
        const driverIdMatch = record.description.match(/водитель: (\d+)\)/);
        const driverId = driverIdMatch ? parseInt(driverIdMatch[1]) : null;
        if (driverId !== req.user.userId) {
          return res.status(403).json({ error: 'Нет прав на просмотр этой записи' });
        }
      } else {
        // Для обычных записей проверяем через vehicle
        const vehicleCheck = await pool.query(
          'SELECT driver_id FROM vehicles WHERE id = $1',
          [record.vehicle_id]
        );

        if (vehicleCheck.rows.length === 0 || vehicleCheck.rows[0].driver_id !== req.user.userId) {
          return res.status(403).json({ error: 'Нет прав на просмотр этой записи' });
        }
      }
    }

    res.json({
      success: true,
      record: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/accounting/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении записи учета' });
  }
});

// Создать новую запись учета
router.post('/', async (req, res) => {
  try {
    const { type, vehicleId, date, amount, description, category, mileage } = req.body;

    // Валидация обязательных полей
    if (!type || !date || amount === undefined || amount === null || description === undefined) {
      return res.status(400).json({ 
        error: 'Обязательные поля: тип, дата, сумма, описание' 
      });
    }

    // Проверяем права доступа (если указана машина)
    if (vehicleId && req.user.role !== 'admin') {
      const vehicleCheck = await pool.query(
        'SELECT driver_id FROM vehicles WHERE id = $1',
        [vehicleId]
      );
      if (vehicleCheck.rows.length === 0 || vehicleCheck.rows[0].driver_id !== req.user.userId) {
        return res.status(403).json({ error: 'Нет прав на создание записи для этой машины' });
      }
    }

    // Создаем запись учета
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Сумма должна быть числом' });
    }

    const result = await pool.query(
      `INSERT INTO accounting (type, vehicle_id, date, amount, description, category, mileage, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [String(type), vehicleId || null, date, numericAmount, String(description || ''), category || null, mileage || null, req.user.userId]
    );

    // Логируем создание записи
    logUserAction(req.user.userId, 'accounting_record_created', {
      recordId: result.rows[0].id,
      type: result.rows[0].type,
      vehicleId: result.rows[0].vehicle_id,
      amount: result.rows[0].amount
    }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Запись учета успешно создана',
      record: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/accounting', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при создании записи учета', details: error.message });
  }
});

// Обновить запись учета
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Получаем текущую запись
    const currentRecord = await pool.query(
      'SELECT * FROM accounting WHERE id = $1',
      [id]
    );

    if (currentRecord.rows.length === 0) {
      return res.status(404).json({ error: 'Запись учета не найдена' });
    }

    // Проверяем права на редактирование
    if (req.user.role !== 'admin') {
      const record = currentRecord.rows[0];
      
      // Если это зарплатный вычет, проверяем по описанию
      if (record.vehicle_id === null && record.description && record.description.startsWith('Зарплатный вычет:')) {
        const driverIdMatch = record.description.match(/водитель: (\d+)\)/);
        const driverId = driverIdMatch ? parseInt(driverIdMatch[1]) : null;
        if (driverId !== req.user.userId) {
          return res.status(403).json({ error: 'Нет прав на редактирование этой записи' });
        }
      } else {
        // Для обычных записей проверяем через vehicle
        const vehicleCheck = await pool.query(
          'SELECT driver_id FROM vehicles WHERE id = $1',
          [record.vehicle_id]
        );

        if (vehicleCheck.rows.length === 0 || vehicleCheck.rows[0].driver_id !== req.user.userId) {
          return res.status(403).json({ error: 'Нет прав на редактирование этой записи' });
        }
      }
    }

    // Формируем запрос на обновление
    const allowedFields = ['type', 'date', 'amount', 'description', 'category', 'mileage'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Добавляем обновление времени и ID записи
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE accounting 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    // Логируем обновление
    logUserAction(req.user.userId, 'accounting_record_updated', {
      recordId: id,
      updatedFields: Object.keys(updateData)
    }, req.ip);

    res.json({
      success: true,
      message: 'Запись учета успешно обновлена',
      record: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/accounting/${req.params.id}`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при обновлении записи учета' });
  }
});

// Удалить запись учета
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем текущую запись
    const currentRecord = await pool.query(
      'SELECT * FROM accounting WHERE id = $1',
      [id]
    );

    if (currentRecord.rows.length === 0) {
      return res.status(404).json({ error: 'Запись учета не найдена' });
    }

    // Проверяем права на удаление
    if (req.user.role !== 'admin') {
      const record = currentRecord.rows[0];
      
      // Если это зарплатный вычет, проверяем по описанию
      if (record.vehicle_id === null && record.description && record.description.startsWith('Зарплатный вычет:')) {
        const driverIdMatch = record.description.match(/водитель: (\d+)\)/);
        const driverId = driverIdMatch ? parseInt(driverIdMatch[1]) : null;
        if (driverId !== req.user.userId) {
          return res.status(403).json({ error: 'Нет прав на удаление этой записи' });
        }
      } else {
        // Для обычных записей проверяем через vehicle
        const vehicleCheck = await pool.query(
          'SELECT driver_id FROM vehicles WHERE id = $1',
          [record.vehicle_id]
        );

        if (vehicleCheck.rows.length === 0 || vehicleCheck.rows[0].driver_id !== req.user.userId) {
          return res.status(403).json({ error: 'Нет прав на удаление этой записи' });
        }
      }
    }

    const result = await pool.query(
      'DELETE FROM accounting WHERE id = $1 RETURNING *',
      [id]
    );

    // Логируем удаление
    logUserAction(req.user.userId, 'accounting_record_deleted', {
      recordId: id,
      type: result.rows[0].type,
      amount: result.rows[0].amount
    }, req.ip);

    res.json({
      success: true,
      message: 'Запись учета успешно удалена',
      deletedRecord: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/accounting/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении записи учета' });
  }
});

// Получить статистику по расходам
router.get('/stats/expenses', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.query;
    
    let query = `
      SELECT 
        a.type,
        a.category,
        COUNT(*) as total_records,
        SUM(a.amount) as total_amount,
        AVG(a.amount) as avg_amount,
        MIN(a.amount) as min_amount,
        MAX(a.amount) as max_amount
      FROM accounting a
      WHERE a.amount < 0
    `;
    let params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      paramCount++;
      const fromIdx = paramCount;
      params.push(startDate);
      paramCount++;
      const toIdx = paramCount;
      params.push(endDate);
      query += ` AND a.date BETWEEN $${fromIdx} AND $${toIdx}`;
    }

    if (vehicleId) {
      paramCount++;
      query += ` AND a.vehicle_id = $${paramCount}`;
      params.push(vehicleId);
    }

    query += ` GROUP BY a.type, a.category ORDER BY total_amount ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      stats: result.rows
    });

  } catch (error) {
    logError(error, { route: '/accounting/stats/expenses', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении статистики расходов' });
  }
});

// Получить статистику по доходам
router.get('/stats/income', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.query;
    
    let query = `
      SELECT 
        v.name as vehicle_name,
        v.plate_number,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) as total_income,
        AVG(CASE WHEN o.status = 'completed' THEN o.amount ELSE NULL END) as avg_order_amount
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
      LEFT JOIN orders o ON u.id = o.driver_id
    `;
    let params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      paramCount++;
      const fromIdx = paramCount;
      params.push(startDate);
      paramCount++;
      const toIdx = paramCount;
      params.push(endDate);
      query += ` AND o.date BETWEEN $${fromIdx} AND $${toIdx}`;
    }

    if (vehicleId) {
      paramCount++;
      query += ` AND v.id = $${paramCount}`;
      params.push(vehicleId);
    }

    query += ` GROUP BY v.id, v.name, v.plate_number ORDER BY total_income DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      stats: result.rows
    });

  } catch (error) {
    logError(error, { route: '/accounting/stats/income', query: req.query, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении статистики доходов' });
  }
});

// Получить напоминания о ТО
router.get('/maintenance/reminders', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        v.name as vehicle_name,
        v.plate_number,
        u.full_name as driver_name,
        a.mileage - LAG(a.mileage) OVER (PARTITION BY a.vehicle_id ORDER BY a.date) as mileage_since_last
      FROM accounting a
      JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE a.type = 'maintenance'
      ORDER BY a.vehicle_id, a.date DESC
    `);

    // Группируем по машинам и находим последнее ТО
    const maintenanceByVehicle = {};
    result.rows.forEach(record => {
      if (!maintenanceByVehicle[record.vehicle_id]) {
        maintenanceByVehicle[record.vehicle_id] = record;
      }
    });

    // Проверяем, какие машины нуждаются в ТО
    const reminders = Object.values(maintenanceByVehicle).filter(record => {
      const mileageSinceLast = record.mileage_since_last || record.mileage;
      return mileageSinceLast > 10000; // ТО каждые 10,000 км
    });

    res.json({
      success: true,
      reminders: reminders
    });

  } catch (error) {
    logError(error, { route: '/accounting/maintenance/reminders', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении напоминаний о ТО' });
  }
});

module.exports = router;
