const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logRequest, checkUserActive } = require('../middleware/auth');
const { logUserAction, logError } = require('../utils/logger');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Применяем middleware ко всем роутам
router.use(authenticateToken);
router.use(checkUserActive);
router.use(logRequest);

// Получить всех пользователей (только для администраторов)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, role, email, phone, is_active, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      users: result.rows
    });

  } catch (error) {
    logError(error, { route: '/users', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении пользователей' });
  }
});

// Получить список ролей
router.get('/roles/list', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT id, key, title FROM roles ORDER BY id ASC`);
    res.json({ success: true, roles: r.rows });
  } catch (error) {
    logError(error, { route: '/users/roles/list', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении ролей' });
  }
});

// Добавить роль
router.post('/roles', requireAdmin, async (req, res) => {
  try {
    const key = String(req.body?.key || '').trim();
    const title = String(req.body?.title || '').trim();
    if (!key || !title) return res.status(400).json({ error: 'Укажите ключ и название роли' });
    const r = await pool.query(`INSERT INTO roles(key, title) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING RETURNING id, key, title`, [key, title]);
    // Создаём запись прав по умолчанию при первой вставке роли
    if (r.rows[0]) {
      await pool.query(`
        INSERT INTO role_permissions (role_key)
        VALUES ($1)
        ON CONFLICT (role_key) DO NOTHING
      `, [key]);
    }
    const role = r.rows[0] || null;
    res.json({ success: true, role });
  } catch (error) {
    logError(error, { route: '/users/roles', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при добавлении роли' });
  }
});

// Удалить роль
router.delete('/roles/:key', requireAdmin, async (req, res) => {
  try {
    const roleKey = String(req.params.key || '').trim();
    if (!roleKey) return res.status(400).json({ error: 'Не указан ключ роли' });

    // Запрет на удаление системных ролей
    if (['admin','driver'].includes(roleKey)) {
      return res.status(400).json({ error: 'Эту роль нельзя удалить' });
    }

    // Проверим, не используется ли роль пользователями
    const cnt = await pool.query('SELECT COUNT(*) AS c FROM users WHERE role = $1', [roleKey]);
    if (parseInt(cnt.rows[0].c) > 0) {
      return res.status(400).json({ error: 'Нельзя удалить роль, которая назначена пользователям' });
    }

    // Удаляем роль (права удалятся каскадно, если настроено ON DELETE CASCADE)
    const del = await pool.query('DELETE FROM roles WHERE key = $1 RETURNING id, key, title', [roleKey]);
    if (!del.rows[0]) return res.status(404).json({ error: 'Роль не найдена' });
    return res.json({ success: true, deleted: del.rows[0] });
  } catch (error) {
    logError(error, { route: '/users/roles/:key', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении роли' });
  }
});

// Получить права текущего пользователя
router.get('/my-permissions', async (req, res) => {
  try {
    const userRole = req.user.role;
    const r = await pool.query(`
      SELECT role_key,
        can_view_dashboard, can_view_orders, can_edit_orders,
        can_view_reports, can_edit_reports, can_view_vehicles, can_edit_vehicles,
        can_view_tracking, can_edit_tracking, can_view_settings, can_edit_users, can_manage_roles,
        can_view_dashboard_stats, can_view_dashboard_users_count, can_view_dashboard_vehicles_count,
        can_view_dashboard_orders_count, can_view_dashboard_completed_count, can_view_dashboard_recent_orders,
        can_view_dashboard_finances, can_view_menu_budget, can_view_menu_expenses, can_view_menu_salary,
        can_edit_salary, can_view_menu_vehicles, can_view_menu_maintenance, can_view_menu_tracking,
        can_view_menu_reports, can_delete_any, can_assign_drivers, can_create_orders, can_send_notifications, can_view_notifications
      FROM role_permissions WHERE role_key = $1
    `, [userRole]);
    
    if (!r.rows[0]) {
      // Если права для роли не найдены, возвращаем базовые права
      return res.json({ 
        success: true, 
        permissions: {
          can_view_dashboard: true,
          can_view_orders: true,
          can_edit_orders: false,
          can_view_reports: false,
          can_edit_reports: false,
          can_view_vehicles: false,
          can_edit_vehicles: false,
          can_view_tracking: false,
          can_edit_tracking: false,
          can_view_settings: false,
          can_edit_users: false,
          can_manage_roles: false,
          can_view_dashboard_stats: false,
          can_view_dashboard_users_count: false,
          can_view_dashboard_vehicles_count: false,
          can_view_dashboard_orders_count: false,
          can_view_dashboard_completed_count: false,
          can_view_dashboard_recent_orders: false,
          can_view_dashboard_finances: false,
          can_view_menu_budget: false,
          can_view_menu_expenses: false,
          can_view_menu_salary: false,
          can_edit_salary: false,
          can_view_menu_vehicles: false,
          can_view_menu_maintenance: false,
          can_view_menu_tracking: false,
          can_view_menu_reports: false,
          can_delete_any: false,
          can_assign_drivers: false,
          can_create_orders: false,
          can_send_notifications: false,
          can_view_notifications: false
        }
      });
    }
    
    res.json({ success: true, permissions: r.rows[0] });
  } catch (error) {
    logError(error, { route: '/users/my-permissions', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении прав пользователя' });
  }
});

// Получить права конкретной роли (только для администраторов)
router.get('/roles/:key/permissions', requireAdmin, async (req, res) => {
  try {
    const roleKey = String(req.params.key || '').trim();
    const r = await pool.query(`
      SELECT role_key,
        can_view_dashboard, can_view_orders, can_edit_orders,
        can_view_reports, can_edit_reports, can_view_vehicles, can_edit_vehicles,
        can_view_tracking, can_edit_tracking, can_view_settings, can_edit_users, can_manage_roles,
        can_view_dashboard_stats, can_view_dashboard_users_count, can_view_dashboard_vehicles_count,
        can_view_dashboard_orders_count, can_view_dashboard_completed_count, can_view_dashboard_recent_orders,
        can_view_dashboard_finances, can_view_menu_budget, can_view_menu_expenses, can_view_menu_salary,
        can_edit_salary, can_view_menu_vehicles, can_view_menu_maintenance, can_view_menu_tracking,
        can_view_menu_reports, can_delete_any, can_assign_drivers, can_create_orders, can_send_notifications, can_view_notifications
      FROM role_permissions WHERE role_key = $1
    `, [roleKey]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Права для роли не найдены' });
    res.json({ success: true, permissions: r.rows[0] });
  } catch (error) {
    logError(error, { route: '/users/roles/:key/permissions', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении прав роли' });
  }
});

// Обновить права роли
router.put('/roles/:key/permissions', requireAdmin, async (req, res) => {
  try {
    const roleKey = String(req.params.key || '').trim();
    const flags = req.body || {};

    const allowed = [
      'can_view_dashboard','can_view_orders','can_edit_orders',
      'can_view_reports','can_edit_reports','can_view_vehicles','can_edit_vehicles',
      'can_view_tracking','can_edit_tracking','can_view_settings','can_edit_users','can_manage_roles',
      'can_view_dashboard_stats','can_view_dashboard_users_count','can_view_dashboard_vehicles_count',
      'can_view_dashboard_orders_count','can_view_dashboard_completed_count','can_view_dashboard_recent_orders',
      'can_view_dashboard_finances','can_view_menu_budget','can_view_menu_expenses','can_view_menu_salary',
      'can_edit_salary','can_view_menu_vehicles','can_view_menu_maintenance','can_view_menu_tracking',
      'can_view_menu_reports','can_delete_any','can_assign_drivers','can_create_orders','can_send_notifications','can_view_notifications'
    ];

    const setParts = [];
    const values = [];
    let i = 1;
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(flags, k)) {
        setParts.push(`${k} = $${i}`);
        values.push(Boolean(flags[k]));
        i += 1;
      }
    }

    if (setParts.length === 0) {
      return res.status(400).json({ error: 'Нет флагов для обновления' });
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(roleKey);

    const q = `UPDATE role_permissions SET ${setParts.join(', ')} WHERE role_key = $${i} RETURNING *`;
    const r = await pool.query(q, values);
    if (!r.rows[0]) return res.status(404).json({ error: 'Роль не найдена' });
    res.json({ success: true, permissions: r.rows[0] });
  } catch (error) {
    logError(error, { route: '/users/roles/:key/permissions', user: req.user, body: req.body });
    res.status(500).json({ error: 'Ошибка сервера при обновлении прав роли' });
  }
});

// Получить пользователя по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({ error: 'Нет прав на просмотр данных этого пользователя' });
    }

    const result = await pool.query(
      `SELECT id, username, full_name, role, email, phone, is_active, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/users/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении пользователя' });
  }
});

// Создать нового пользователя (только для администраторов)
router.post('/', requireAdmin, async (req, res) => {
  try {
    // Нормализуем входные данные и поддерживаем альтернативные имена полей
    const username = req.body?.username != null ? String(req.body.username).trim() : '';
    const password = req.body?.password != null ? String(req.body.password) : '';
    const fullName = req.body?.fullName != null ? String(req.body.fullName).trim() : '';
    let role = req.body?.role;
    if (Array.isArray(role)) role = role[0];
    const email = req.body?.email != null ? String(req.body.email).trim() : null;
    const phoneRaw = (req.body?.phone ?? req.body?.phoneNumber ?? req.body?.phone_number);
    const phone = phoneRaw != null ? String(phoneRaw).trim() : null;

    // Валидация обязательных полей
    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ 
        error: 'Обязательные поля: логин, пароль, ФИО, роль' 
      });
    }

    // Проверяем, что пользователь не существует
    const userExists = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }

    // Шифруем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const result = await pool.query(
      `INSERT INTO users (username, password, full_name, role, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, full_name, role, email, phone, is_active, created_at`,
      [username, hashedPassword, fullName, role, email, phone]
    );

    // Логируем создание пользователя
    logUserAction(req.user.userId, 'user_created', {
      newUserId: result.rows[0].id,
      username: result.rows[0].username,
      role: result.rows[0].role
    }, req.ip);

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно создан',
      user: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/users', body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при создании пользователя' });
  }
});

// Обновить пользователя
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateDataRaw = req.body;
    const updateData = Array.isArray(updateDataRaw?.role) ? { ...updateDataRaw, role: updateDataRaw.role[0] } : updateDataRaw;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({ error: 'Нет прав на редактирование этого пользователя' });
    }

    // Если пытаются сменить роль — только администратор имеет право
    if (Object.prototype.hasOwnProperty.call(updateData, 'role') && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может менять роль' });
    }

    // Формируем запрос на обновление
    const allowedFields = ['full_name', 'email', 'phone', 'role'];
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

    // Добавляем обновление времени и ID пользователя
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, full_name, role, email, phone, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Логируем обновление
    logUserAction(req.user.userId, 'user_updated', {
      updatedUserId: id,
      updatedFields: Object.keys(updateData)
    }, req.ip);

    res.json({
      success: true,
      message: 'Пользователь успешно обновлен',
      user: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/users/${req.params.id}`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при обновлении пользователя' });
  }
});

// Изменить пароль пользователя
router.patch('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({ error: 'Нет прав на изменение пароля этого пользователя' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен содержать минимум 6 символов' });
    }

    // Текущий пароль не требуется: админ и пользователь могут сменить, указав только новый

    // Шифруем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновляем пароль
    const result = await pool.query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, full_name, role, email, phone, is_active, created_at, updated_at`,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Логируем изменение пароля
    logUserAction(req.user.userId, 'password_changed', {
      targetUserId: id,
      changedBy: req.user.role === 'admin' ? 'admin' : 'self'
    }, req.ip);

    res.json({
      success: true,
      message: 'Пароль успешно изменен',
      user: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/users/${req.params.id}/password`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при изменении пароля' });
  }
});

// Активировать/деактивировать пользователя (только для администраторов)
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Поле isActive должно быть boolean' });
    }

    // Нельзя деактивировать самого себя
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Нельзя деактивировать свой собственный аккаунт' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, full_name, role, email, phone, is_active, created_at, updated_at`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Логируем изменение статуса
    logUserAction(req.user.userId, 'user_status_changed', {
      targetUserId: id,
      newStatus: isActive,
      username: result.rows[0].username
    }, req.ip);

    res.json({
      success: true,
      message: `Пользователь ${isActive ? 'активирован' : 'деактивирован'}`,
      user: result.rows[0]
    });

  } catch (error) {
    logError(error, { route: `/users/${req.params.id}/status`, body: req.body, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при изменении статуса пользователя' });
  }
});

// Удалить пользователя (только для администраторов)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Нельзя удалить свой собственный аккаунт' });
    }

    // Проверяем, есть ли у пользователя активные заявки
    const activeOrders = await pool.query(
      'SELECT COUNT(*) as count FROM orders WHERE driver_id = $1 AND status IN ($2, $3)',
      [id, 'assigned', 'in_progress']
    );

    if (parseInt(activeOrders.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить пользователя с активными заявками. Сначала завершите или переназначьте заявки.' 
      });
    }

    // Старт транзакции: аккуратно разморозим внешние связи и удалим
    await pool.query('BEGIN');
    try {
      // Сначала проверим активные заявки — запрещаем удаление
      const activeOrders = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE driver_id = $1 AND status IN ($2, $3)',
        [id, 'assigned', 'in_progress']
      );
      if (parseInt(activeOrders.rows[0].count) > 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Нельзя удалить пользователя с активными заявками. Сначала завершите или переназначьте заявки.' 
        });
      }

      // Обнулим ссылку на водителя у всех заявок пользователя, чтобы не нарушать FK
      await pool.query('UPDATE orders SET driver_id = NULL WHERE driver_id = $1', [id]);
      // Обнулим ссылку на водителя у всех транспортных средств пользователя
      await pool.query('UPDATE vehicles SET driver_id = NULL WHERE driver_id = $1', [id]);

      const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      await pool.query('COMMIT');

      // Логируем удаление
      logUserAction(req.user.userId, 'user_deleted', {
        deletedUserId: id,
        deletedUsername: result.rows[0].username,
        deletedRole: result.rows[0].role
      }, req.ip);

      return res.json({
        success: true,
        message: 'Пользователь успешно удален',
        deletedUser: result.rows[0]
      });
    } catch (innerError) {
      await pool.query('ROLLBACK');
      throw innerError;
    }

  } catch (error) {
    logError(error, { route: `/users/${req.params.id}`, user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при удалении пользователя' });
  }
});

// Получить статистику по пользователям (только для администраторов)
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'driver' THEN 1 END) as driver_count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_month
      FROM users
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });

  } catch (error) {
    logError(error, { route: '/users/stats/overview', user: req.user });
    res.status(500).json({ error: 'Ошибка сервера при получении статистики' });
  }
});

module.exports = router;
