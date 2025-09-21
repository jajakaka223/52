import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Grid, 
  Box, 
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Send, History, Refresh } from '@mui/icons-material';
import { api } from '../config/api';

const NotificationsPage = ({ user, userPermissions }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'success' });
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      if (response.data.success) {
        setNotifications(response.data.notifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/notifications/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      setAlert({
        show: true,
        message: 'Заполните все поля',
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/notifications', {
        title: title.trim(),
        message: message.trim(),
        targetUsers: 'all'
      });

      if (response.data.success) {
        setAlert({
          show: true,
          message: 'Уведомление отправлено успешно',
          severity: 'success'
        });
        setTitle('');
        setMessage('');
        loadNotifications();
        loadStats();
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setAlert({
        show: true,
        message: 'Ошибка при отправке уведомления',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'success';
      case 'failed': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Управление уведомлениями
      </Typography>

      {alert.show && (
        <Alert 
          severity={alert.severity} 
          onClose={() => setAlert({ ...alert, show: false })}
          sx={{ mb: 3 }}
        >
          {alert.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Статистика */}
        {stats && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Статистика
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {stats.total}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Всего уведомлений
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        {stats.sent}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Отправлено
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="error.main">
                        {stats.failed}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Ошибки
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {stats.total_tokens}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Активных устройств
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Форма отправки */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Отправить уведомление
              </Typography>
              
              <TextField
                fullWidth
                label="Заголовок уведомления"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                margin="normal"
                inputProps={{ maxLength: 100 }}
                helperText={`${title.length}/100 символов`}
              />
              
              <TextField
                fullWidth
                label="Текст уведомления"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                margin="normal"
                multiline
                rows={4}
                inputProps={{ maxLength: 500 }}
                helperText={`${message.length}/500 символов`}
              />
              
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                  onClick={sendNotification}
                  disabled={loading || !title.trim() || !message.trim()}
                >
                  Отправить
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<History />}
                  onClick={() => setShowHistory(true)}
                >
                  История
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Информация */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Информация
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  • Уведомления отправляются на все зарегистрированные устройства
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  • Максимальная длина заголовка: 100 символов
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  • Максимальная длина сообщения: 500 символов
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  • Уведомления доставляются мгновенно
                </Typography>
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Убедитесь, что у пользователей включены push-уведомления в настройках приложения.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Диалог истории */}
      <Dialog 
        open={showHistory} 
        onClose={() => setShowHistory(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          История уведомлений
          <IconButton
            onClick={loadNotifications}
            sx={{ float: 'right' }}
          >
            <Refresh />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Заголовок</TableCell>
                  <TableCell>Сообщение</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Дата</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>{notification.title}</TableCell>
                    <TableCell>
                      {notification.message.length > 50 
                        ? `${notification.message.substring(0, 50)}...`
                        : notification.message
                      }
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={notification.status}
                        color={getStatusColor(notification.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(notification.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NotificationsPage;
