import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';

const STATUS_LABELS = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  ejecutado: 'Ejecutado',
};

const STATUS_COLORS = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente: 'bg-yellow-100 text-yellow-800',
  aprobado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  ejecutado: 'bg-blue-100 text-blue-800',
};

const EVENT_ICONS = {
  borrador: '📝',
  pendiente: '📤',
  aprobado: '✅',
  rechazado: '❌',
  ejecutado: '💸',
};

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function SolicitudDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [executeFile, setExecuteFile] = useState(null);
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function loadDetail() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get(`/payment-requests/${id}`);
      setRequest(data.payment_request || data);
      setEvents(data.events || []);
      setAttachments(data.attachments || []);
    } catch (err) {
      setError(err.message || 'Error al cargar la solicitud');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/approve`, {});
      setFeedback({ type: 'success', message: 'Solicitud aprobada exitosamente' });
      loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      setFeedback({ type: 'error', message: 'El comentario es obligatorio al rechazar' });
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/reject`, { comment: rejectComment });
      setFeedback({ type: 'success', message: 'Solicitud rechazada' });
      setRejectComment('');
      loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExecute() {
    try {
      setActionLoading(true);
      const formData = new FormData();
      if (executeFile) {
        formData.append('comprobante', executeFile);
      }
      formData.append('comment', 'Pago ejecutado');
      await api.upload(`/payment-requests/${id}/execute`, formData);
      setFeedback({ type: 'success', message: 'Pago ejecutado exitosamente' });
      setExecuteFile(null);
      loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmit() {
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/submit`, {});
      setFeedback({ type: 'success', message: 'Solicitud enviada para aprobación' });
      loadDetail();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  const canApproveReject = user?.role === 'presidente';
  const canExecute = user?.role === 'secretaria';
  const canSubmitDraft = request?.status === 'borrador' && request?.created_by === user?.id;
  const canEditDraft = request?.status === 'borrador' && request?.created_by === user?.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Cargando solicitud...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/solicitudes')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Volver al Pipeline
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Error</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/solicitudes')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        data-testid="back-to-pipeline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Volver al Pipeline
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Solicitud #{request.id}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Creada por {request.created_by_name} el {formatDate(request.created_at)}
          </p>
        </div>
        <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[request.status]}`}>
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.message}
          <button
            onClick={() => setFeedback(null)}
            className="float-right text-lg leading-none opacity-50 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Detail Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Detalles de la Solicitud</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCLP(request.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</p>
              <p className="text-sm text-gray-900 mt-0.5">{request.description || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Beneficiario</p>
              <p className="text-sm text-gray-900 mt-0.5">{request.beneficiary || '-'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</p>
              <p className="text-sm text-gray-900 mt-0.5">{request.category_name || 'Sin categoría'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</p>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`}>
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Creación</p>
              <p className="text-sm text-gray-900 mt-0.5">{formatDate(request.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Rejection comment */}
        {request.rejection_comment && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-medium text-red-700 mb-1">Motivo de rechazo:</p>
            <p className="text-sm text-red-800">{request.rejection_comment}</p>
          </div>
        )}
      </div>

      {/* Timeline of Events */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Historial de Eventos</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No hay eventos registrados.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200"></div>

            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id || index} className="relative flex gap-4 pl-2">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-xs">
                    {EVENT_ICONS[event.new_status] || '•'}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[event.new_status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[event.new_status] || event.new_status}
                      </span>
                      {event.previous_status && (
                        <span className="text-xs text-gray-400">
                          desde {STATUS_LABELS[event.previous_status] || event.previous_status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {event.user_name || 'Sistema'} — {formatDate(event.created_at)}
                    </p>
                    {event.comment && (
                      <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        {event.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {canApproveReject && request.status === 'pendiente' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Acciones</h2>
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Procesando...' : 'Aprobar Solicitud'}
          </button>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comentario de rechazo (obligatorio)
            </label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Ingrese el motivo del rechazo..."
              rows={2}
            />
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="mt-2 w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Procesando...' : 'Rechazar Solicitud'}
            </button>
          </div>
        </div>
      )}

      {canExecute && request.status === 'aprobado' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Ejecutar Pago</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comprobante de pago (imagen o PDF)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.webp"
                onChange={(e) => setExecuteFile(e.target.files[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
              />
              {executeFile && (
                <p className="mt-1 text-xs text-gray-500">
                  Archivo seleccionado: {executeFile.name} ({(executeFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <button
              onClick={handleExecute}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Procesando...' : 'Marcar como Ejecutado'}
            </button>
          </div>
        </div>
      )}

      {/* Attachments section */}
      {attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Documentos Adjuntos</h2>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{att.file_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{att.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {att.attachment_type === 'comprobante' ? 'Comprobante de pago' : 'Documento de respaldo'}
                      {att.uploaded_by_name && ` — ${att.uploaded_by_name}`}
                      {att.file_size && ` — ${(att.file_size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                </div>
                <a
                  href={att.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Descargar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit draft for approval - only creator of borrador */}
      {canSubmitDraft && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Acciones</h2>
          <p className="text-sm text-gray-500 mb-4">
            Esta solicitud es un borrador. Puedes editarla o enviarla para aprobación.
          </p>
          <button
            onClick={handleSubmit}
            disabled={actionLoading}
            className="w-full px-4 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Enviando...' : 'Enviar para Aprobación'}
          </button>
        </div>
      )}
    </div>
  );
}
