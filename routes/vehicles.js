const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить все машины
router.get('/', async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin') {
      // Администратор видит все машины
      query = `
        SELECT v.*, u.full_name as driver_name, u.username as driver_username
        FROM vehicles v
        LEFT JOIN users u ON v.driver_id = u.id
        ORDER BY v.created_at DESC
      `;
    } else {
      // Водитель видит только свою машину
      query = `
        SELECT v.*, u.full_name as driver_name, u.username as driver_username
        FROM vehicles v
        LEFT JOIN users u ON v.driver_id = u.id
        WHERE v.driver_id = $1
        ORDER BY v.created_at DESC
      `;
      params = [req.user.userId];
    }

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      vehicles: result.rows
    });

  } catch (error) {
    logError(error, { route: '/vehicles', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении машин' });
  }
});

// Получить машину по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    let params = [id];

    if (req.user.role === 'admin') {
      query = `
        SELECT v.*, u.full_name as driver_name, u.username as driver_username
        FROM vehicles v
        LEFT JOIN users u ON v.driver_id = u.id
        WHERE v.id = $1
      `;
    } else {
      query = `
        SELECT v.*, u.full_name as driver_name, u.username as driver_username
        FROM vehicles v
        LEFT JOIN users u ON v.driver_id = u.id
        WHERE v.id = $1 AND v.driver_id = $2
      `;
      params = [id, req.user.userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Машина не найдена' });
    }

    res.json({
      success: true,
      vehicle: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/vehicles/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении машины' });
  }
});

// Создать новую машину (только для администраторов)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, model, plateNumber, driverId } = req.body;

    // Валидация обязательных полей
    if (!name) {
      return res.status(400).json({ error: 'Название машины обязательно' });
    }

    // Проверяем, что номер не дублируется
    if (plateNumber) {
      const plateExists = await pool.query(
        'SELECT id FROM vehicles WHERE plate_number = $1',
        [plateNumber]
      );

      if (plateExists.rows.length > 0) {
        return res.status(400).json({ error: 'Машина с таким номером уже существует' });
      }
    }

    // Создаем машину
    const result = await pool.query(
      `INSERT INTO vehicles (name, model, plate_number, driver_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, model, plateNumber, driverId]
    );

    // Логируем создание машины
    logUserAction(req.user.userId, 'vehicle_created', {
      vehicleId: result.rows[0].id,
      vehicleName: result.rows[0].name,
      plateNumber: result.rows[0].plate_number
    }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Машина успешно создана',
      vehicle: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/vehicles', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при создании машины' });
  }
});

// Обновить машину
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Проверяем права на редактирование
    if (req.user.role !== 'admin') {
      const vehicleCheck = await pool.query(
        'SELECT driver_id FROM vehicles WHERE id = $1',
        [id]
      );

      if (vehicleCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Машина не найдена' });
      }

      if (vehicleCheck.rows[0].driver_id !== req.user.userId) {
        return res.status(403).json({ error: 'Нет прав на редактирование этой машины' });
      }
    }

    // Формируем запрос на обновление
    const allowedFields = ['name', 'model', 'plate_number', 'driver_id', 'mileage', 'last_service_date'];
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

    // Добавляем ID машины
    values.push(id);

    const query = `
      UPDATE vehicles 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Машина не найдена' });
    }

    // Логируем обновление
    logUserAction(req.user.userId, 'vehicle_updated', {
      vehicleId: id,
      updatedFields: Object.keys(updateData)
    }, req.ip);

    res.json({
      success: true,
      message: 'Машина успешно обновлена',
      vehicle: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/vehicles/${req.params.id}`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при обновлении машины' });
  }
});

// Удалить машину (только для администраторов)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, есть ли активные заявки у этой машины
    const activeOrders = await pool.query(
      'SELECT COUNT(*) as count FROM orders o JOIN vehicles v ON o.driver_id = v.driver_id WHERE v.id = $1 AND o.status IN ($2, $3)',
      [id, 'assigned', 'in_progress']
    );

    if (parseInt(activeOrders.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить машину с активными заявками. Сначала завершите или переназначьте заявки.' 
      });
    }

    const result = await pool.query(
      'DELETE FROM vehicles WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Машина не найдена' });
    }

    // Логируем удаление
    logUserAction(req.user.userId, 'vehicle_deleted', {
      vehicleId: id,
      vehicleName: result.rows[0].name,
      plateNumber: result.rows[0].plate_number
    }, req.ip);

    res.json({
      success: true,
      message: 'Машина успешно удалена',
      deletedVehicle: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/vehicles/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении машины' });
  }
});

// Назначить водителя машине (только для администраторов)
router.post('/:id/assign-driver', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: 'ID водителя обязателен' });
    }

    // Проверяем существование водителя
    const driverCheck = await pool.query(
      'SELECT id, full_name, role FROM users WHERE id = $1 AND role = $2 AND is_active = $3',
      [driverId, 'driver', true]
    );

    if (driverCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Водитель не найден или неактивен' });
    }

    // Проверяем, не назначена ли машина другому водителю
    const vehicleCheck = await pool.query(
      'SELECT driver_id FROM vehicles WHERE id = $1',
      [id]
    );

    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Машина не найдена' });
    }

    // Обновляем машину
    const result = await pool.query(
      `UPDATE vehicles 
       SET driver_id = $1
       WHERE id = $2
       RETURNING *`,
      [driverId, id]
    );

    // Логируем назначение водителя
    logUserAction(req.user.userId, 'driver_assigned_to_vehicle', {
      vehicleId: id,
      driverId: driverId,
      driverName: driverCheck.rows[0].full_name
    }, req.ip);

    res.json({
      success: true,
      message: 'Водитель успешно назначен машине',
      vehicle: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/vehicles/${req.params.id}/assign-driver`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при назначении водителя' });
  }
});

// История обслуживания: получить список
router.get('/:id/maintenance', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM vehicle_maintenance_history WHERE vehicle_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json({ success: true, history: result.rows });
  } catch (error) {
    logError(error, { route: `/vehicles/${req.params.id}/maintenance`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении истории' });
  }
});

// История обслуживания: добавить запись (и при желании обновить текущие поля в ТС)
router.post('/:id/maintenance', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { mileage, lastServiceDate } = req.body;
    const ins = await pool.query(
      `INSERT INTO vehicle_maintenance_history (vehicle_id, mileage, last_service_date)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, mileage ?? null, lastServiceDate ?? null]
    );
    // также мягко обновим саму машину
    await pool.query(
      `UPDATE vehicles SET mileage = COALESCE($1, mileage), last_service_date = COALESCE($2, last_service_date)
       WHERE id = $3`,
      [mileage ?? null, lastServiceDate ?? null, id]
    );
    res.status(201).json({ success: true, record: ins.rows[0] });
  } catch (error) {
    logError(error, { route: `/vehicles/${req.params.id}/maintenance`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при добавлении записи' });
  }
});

// История обслуживания: удалить запись
router.delete('/maintenance/:recordId', requireAdmin, async (req, res) => {
  try {
    const { recordId } = req.params;
    const del = await pool.query('DELETE FROM vehicle_maintenance_history WHERE id = $1 RETURNING *', [recordId]);
    if (del.rows.length === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ success: true, deleted: del.rows[0] });
  } catch (error) {
    logError(error, { route: `/vehicles/maintenance/${req.params.recordId}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении записи' });
  }
});

// Получить статистику по машинам (только для администраторов)
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN driver_id IS NOT NULL THEN 1 END) as assigned_vehicles,
        COUNT(CASE WHEN driver_id IS NULL THEN 1 END) as unassigned_vehicles,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_vehicles
      FROM vehicles
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/vehicles/stats/overview', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении статистики' });
  }
});

module.exports = router;
