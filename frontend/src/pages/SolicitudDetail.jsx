import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';
import Spinner from '../components/Spinner';
import NetworkError from '../components/NetworkError';
import { formatCLP, formatDateTime, blockNonNumericKeys, handleAmountPaste } from '../lib/formatters';
import { useModalAccessibility } from '../lib/useModalAccessibility';

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

export default function SolicitudDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [request, setRequest] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const showFeedback = (type, message) => addToast({ type, message, duration: type === 'success' ? 4000 : 6000, testId: 'solicitud-detail-toast' });
  const [rejectComment, setRejectComment] = useState('');
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [executeFile, setExecuteFile] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [executeUploading, setExecuteUploading] = useState(false);
  const [executeUploadPercent, setExecuteUploadPercent] = useState(0);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editData, setEditData] = useState({ amount: '', description: '', beneficiary: '', category_id: '' });
  const [categories, setCategories] = useState([]);
  const actionRef = useRef(false);

  // Modal accessibility hook for reject confirmation
  const { modalRef: rejectModalRef, handleKeyDown: rejectKeyDown } = useModalAccessibility(rejectConfirm, () => setRejectConfirm(false));

  useEffect(() => {
    loadDetail();
    loadCategories();
  }, [id]);

  async function loadCategories() {
    try {
      const data = await api.get('/categories');
      const cats = (data.categories || data || []).filter(c => c.type === 'egreso');
      setCategories(cats);
    } catch (err) {
      // Categories are optional
    }
  }

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
      setIsNetworkError(!!err.isNetworkError);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/approve`, {});
      // Optimistic update - update local state immediately
      setRequest(prev => prev ? { ...prev, status: 'aprobado' } : prev);
      showFeedback('success', 'Solicitud aprobada exitosamente');
      // Background sync for complete data
      loadDetail();
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  }

  function showRejectConfirmation() {
    if (!rejectComment.trim()) {
      showFeedback('error', 'El comentario es obligatorio al rechazar');
      return;
    }
    setRejectConfirm(true);
  }

  async function handleReject() {
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/reject`, { comment: rejectComment });
      // Optimistic update
      setRequest(prev => prev ? { ...prev, status: 'rechazado', rejection_comment: rejectComment } : prev);
      showFeedback('success', 'Solicitud rechazada');
      setRejectComment('');
      setRejectConfirm(false);
      // Background sync
      loadDetail();
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  }

  async function handleExecute() {
    if (!executeFile) {
      showFeedback('error', 'Debe adjuntar un comprobante de pago para ejecutar la solicitud');
      return;
    }
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      setExecuteUploading(true);
      setExecuteUploadPercent(0);
      const formData = new FormData();
      formData.append('comprobante', executeFile);
      formData.append('comment', 'Pago ejecutado');
      await api.uploadWithProgress(`/payment-requests/${id}/execute`, formData, (progress) => {
        setExecuteUploadPercent(progress.percent);
      });
      // Optimistic update
      setRequest(prev => prev ? { ...prev, status: 'ejecutado' } : prev);
      showFeedback('success', 'Pago ejecutado exitosamente. Comprobante adjuntado correctamente.');
      setExecuteFile(null);
      // Background sync
      loadDetail();
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
      setExecuteUploading(false);
      setExecuteUploadPercent(0);
    }
  }

  async function handleSubmit() {
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/submit`, {});
      // Optimistic update
      setRequest(prev => prev ? { ...prev, status: 'pendiente' } : prev);
      showFeedback('success', 'Solicitud enviada para aprobación');
      // Background sync
      loadDetail();
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  }

  async function handleUploadAttachment() {
    if (!uploadFile) return;
    try {
      setUploading(true);
      setUploadPercent(0);
      setUploadProgress('Subiendo archivo...');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('attachment_type', 'respaldo');
      await api.uploadWithProgress(`/payment-requests/${id}/attachments`, formData, (progress) => {
        setUploadPercent(progress.percent);
        if (progress.percent < 100) {
          setUploadProgress(`Subiendo archivo... ${progress.percent}%`);
        } else {
          setUploadProgress('Procesando...');
        }
      });
      showFeedback('success', `Archivo "${uploadFile.name}" adjuntado exitosamente`);
      setUploadFile(null);
      setUploadProgress(null);
      setUploadPercent(0);
      // Reset file input
      const fileInput = document.getElementById('attachment-upload-input');
      if (fileInput) fileInput.value = '';
      loadDetail();
    } catch (err) {
      showFeedback('error', err.message || 'Error al subir archivo');
      setUploadProgress(null);
      setUploadPercent(0);
    } finally {
      setUploading(false);
    }
  }

  function openEditForm() {
    if (!request) return;
    setEditData({
      amount: request.amount.toString(),
      description: request.description || '',
      beneficiary: request.beneficiary || '',
      category_id: request.category_id ? request.category_id.toString() : '',
    });
    setShowEditForm(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editData.amount || !editData.description || !editData.beneficiary) {
      showFeedback('error', 'Monto, descripcion y beneficiario son requeridos');
      return;
    }
    try {
      setActionLoading(true);
      await api.put(`/payment-requests/${id}`, {
        amount: parseInt(editData.amount),
        description: editData.description,
        beneficiary: editData.beneficiary,
        category_id: editData.category_id ? parseInt(editData.category_id) : undefined,
      });
      setShowEditForm(false);
      showFeedback('success', 'Solicitud editada exitosamente');
      loadDetail();
    } catch (err) {
      showFeedback('error', err.message);
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
        <div className="animate-pulse text-gray-500">Cargando solicitud...</div>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Volver al Pipeline
        </button>
        {isNetworkError ? (
          <NetworkError
            message={error}
            onRetry={async () => { setError(null); setIsNetworkError(false); await loadDetail(); }}
          />
        ) : (
          <div role="alert" className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Error</h3>
            <p className="text-gray-500">{error}</p>
          </div>
        )}
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            Creada por {request.created_by_name} el {formatDateTime(request.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canEditDraft && !showEditForm && (
            <button
              onClick={openEditForm}
              data-testid="edit-draft-btn"
              className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Editar
            </button>
          )}
          <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[request.status]}`}>
            {STATUS_LABELS[request.status]}
          </span>
        </div>
      </div>

      {/* Edit Form (inline, replaces detail card when editing) */}
      {showEditForm && canEditDraft && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="edit-form">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Editar Solicitud</h2>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label htmlFor="detail-edit-amount" className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP)</label>
              <input
                id="detail-edit-amount"
                type="number"
                required
                min="1"
                data-testid="edit-amount"
                value={editData.amount}
                onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                onKeyDown={blockNonNumericKeys}
                onPaste={e => handleAmountPaste(e, v => setEditData(d => ({ ...d, amount: v })))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label htmlFor="detail-edit-description" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                id="detail-edit-description"
                required
                data-testid="edit-description"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value.slice(0, 500) })}
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${(editData.description?.length || 0) >= 500 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  {editData.description?.length || 0}/500
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="detail-edit-beneficiary" className="block text-sm font-medium text-gray-700 mb-1">Beneficiario</label>
              <input
                id="detail-edit-beneficiary"
                type="text"
                required
                data-testid="edit-beneficiary"
                value={editData.beneficiary}
                onChange={(e) => setEditData({ ...editData, beneficiary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label htmlFor="detail-edit-category" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                id="detail-edit-category"
                data-testid="edit-category"
                value={editData.category_id}
                onChange={(e) => setEditData({ ...editData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              >
                <option value="">Sin categoria</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                data-testid="save-edit-btn"
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <><Spinner size={14} className="inline mr-1" />Guardando...</> : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detail Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Detalles de la Solicitud</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5" data-testid="detail-amount">{formatCLP(request.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Descripcion</p>
              <p className="text-sm text-gray-900 mt-0.5" data-testid="detail-description">{request.description || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Beneficiario</p>
              <p className="text-sm text-gray-900 mt-0.5" data-testid="detail-beneficiary">{request.beneficiary || '-'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</p>
              <p className="text-sm text-gray-900 mt-0.5" data-testid="detail-category">{request.category_name || 'Sin categoria'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</p>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`} data-testid="detail-status">
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Creacion</p>
              <p className="text-sm text-gray-900 mt-0.5">{formatDateTime(request.created_at)}</p>
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
                        <span className="text-xs text-gray-500">
                          desde {STATUS_LABELS[event.previous_status] || event.previous_status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {event.user_name || 'Sistema'} — {formatDateTime(event.created_at)}
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
            {actionLoading ? <><Spinner size={14} className="inline mr-1" />Procesando...</> : 'Aprobar Solicitud'}
          </button>
          <div>
            <label htmlFor="detail-reject-comment" className="block text-sm font-medium text-gray-700 mb-1">
              Comentario de rechazo (obligatorio)
            </label>
            <textarea
              id="detail-reject-comment"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Ingrese el motivo del rechazo..."
              rows={2}
            />
            <button
              onClick={showRejectConfirmation}
              disabled={actionLoading}
              className="mt-2 w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? <><Spinner size={14} className="inline mr-1" />Procesando...</> : 'Rechazar Solicitud'}
            </button>
          </div>
        </div>
      )}

      {canExecute && request.status === 'aprobado' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Ejecutar Pago</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="execute-file-upload" className="block text-sm font-medium text-gray-700 mb-1">
                Comprobante de pago (imagen o PDF, máx. 10MB)
              </label>
              <input
                id="execute-file-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.webp"
                onChange={(e) => {
                  const file = e.target.files[0] || null;
                  if (file && file.size > 10 * 1024 * 1024) {
                    showFeedback('error', 'El archivo excede el tamaño máximo permitido (10MB)');
                    e.target.value = '';
                    setExecuteFile(null);
                    return;
                  }
                  setExecuteFile(file);
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
              />
              {executeFile && (
                <p className="mt-1 text-xs text-gray-500">
                  Archivo seleccionado: {executeFile.name} ({(executeFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              {!executeFile && (
                <p className="mt-1 text-xs text-red-500">
                  * El comprobante es obligatorio para ejecutar el pago
                </p>
              )}
            </div>
            {executeUploading && (
              <div className="space-y-2" data-testid="execute-upload-progress">
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Subiendo comprobante... {executeUploadPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${executeUploadPercent}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={handleExecute}
              disabled={actionLoading || !executeFile}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? <><Spinner size={14} className="inline mr-1" />Procesando...</> : 'Marcar como Ejecutado'}
            </button>
          </div>
        </div>
      )}

      {/* Upload Attachment Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Adjuntar Documento</h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="attachment-upload-input" className="block text-sm font-medium text-gray-700 mb-1">
              Documento de respaldo (imagen o PDF, máx. 10MB)
            </label>
            <input
              id="attachment-upload-input"
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.pdf,.webp"
              onChange={(e) => {
                  const file = e.target.files[0] || null;
                  if (file && file.size > 10 * 1024 * 1024) {
                    showFeedback('error', 'El archivo excede el tamaño máximo permitido (10MB)');
                    e.target.value = '';
                    setUploadFile(null);
                    return;
                  }
                  setUploadFile(file);
                }}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
            />
            {uploadFile && (
              <p className="mt-1 text-xs text-gray-500">
                Archivo seleccionado: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          {uploading && (
            <div className="space-y-2" data-testid="upload-progress">
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span data-testid="upload-progress-text">{uploadProgress || 'Subiendo archivo...'}</span>
                <span className="font-medium" data-testid="upload-percent">{uploadPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                  data-testid="upload-progress-bar"
                />
              </div>
            </div>
          )}
          <button
            onClick={handleUploadAttachment}
            disabled={!uploadFile || uploading}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Subiendo...' : 'Adjuntar Archivo'}
          </button>
        </div>
      </div>

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
            {actionLoading ? <><Spinner size={14} className="inline mr-1" />Enviando...</> : 'Enviar para Aprobación'}
          </button>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={rejectKeyDown} onClick={(e) => { if (e.target === e.currentTarget) setRejectConfirm(false); }}>
          <div ref={rejectModalRef} role="dialog" aria-modal="true" aria-labelledby="reject-confirm-detail-title" tabIndex={-1} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto outline-none">
            <div className="text-center">
              <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
              <h2 id="reject-confirm-detail-title" className="text-lg font-semibold text-gray-900 mb-2">Confirmar rechazo</h2>
              <p className="text-gray-600 text-sm mb-1">
                ¿Estás seguro de rechazar esta solicitud?
              </p>
              {request && (
                <p className="text-gray-800 font-medium text-sm mb-2">
                  {request.description} — {formatCLP(request.amount)}
                </p>
              )}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                <p className="text-xs font-medium text-red-700 mb-1">Motivo de rechazo:</p>
                <p className="text-sm text-red-800">{rejectComment}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectConfirm(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? <><Spinner size={16} className="inline mr-1.5" />Rechazando...</> : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
