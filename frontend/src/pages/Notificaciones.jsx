import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import NetworkError from '../components/NetworkError';

const TYPE_ICONS = {
  solicitud_creada: '📝',
  solicitud_aprobada: '✅',
  solicitud_rechazada: '❌',
  solicitud_ejecutada: '💸',
  recordatorio: '🔔',
};

export default function Notificaciones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    try {
      setLoading(true);
      const data = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      setError(err.message);
      setIsNetworkError(!!err.isNetworkError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      // Dispatch custom event so sidebar badge updates
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: 1 }))
      );
      setUnreadCount(0);
      // Dispatch custom event so sidebar badge updates
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs} h`;
    if (diffDays < 7) return `Hace ${diffDays} d`;
    return date.toLocaleDateString('es-CL');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 mt-1">Actividad reciente y alertas del sistema</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            data-testid="mark-all-read"
          >
            Marcar todo como leído
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Cargando notificaciones...</div>
      )}

      {error && isNetworkError && (
        <NetworkError
          message={error}
          onRetry={async () => { setError(null); setIsNetworkError(false); await loadNotifications(); }}
        />
      )}
      {error && !isNetworkError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-1">Error al cargar datos</h3>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => { setError(null); loadNotifications(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No hay notificaciones</h3>
          <p className="text-gray-500">Las notificaciones de actividad aparecerán aquí</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`px-6 py-4 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                !n.is_read ? 'bg-blue-50/50' : ''
              }`}
            >
              <span className="text-xl mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="flex-shrink-0 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                      data-testid={`mark-read-${n.id}`}
                    >
                      Marcar leído
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-400">{formatDate(n.created_at)}</p>
                  {n.reference_type === 'payment_request' && n.reference_id && (
                    <button
                      onClick={() => navigate(`/solicitudes/${n.reference_id}`)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors"
                      data-testid={`notification-link-${n.id}`}
                    >
                      Ver solicitud →
                    </button>
                  )}
                </div>
              </div>
              {!n.is_read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" data-testid={`unread-dot-${n.id}`}></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
