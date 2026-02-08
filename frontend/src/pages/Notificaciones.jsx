import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function Notificaciones() {
  const { user } = useAuth();
  const [notifications] = useState([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-gray-500 mt-1">Actividad reciente y alertas del sistema</p>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No hay notificaciones</h3>
          <p className="text-gray-500">Las notificaciones de actividad aparecerán aquí</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {notifications.map(n => (
            <div key={n.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <p className="text-sm text-gray-900">{n.message}</p>
              <p className="text-xs text-gray-500 mt-1">{n.created_at}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
