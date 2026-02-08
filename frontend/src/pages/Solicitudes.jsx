import { useState, useEffect } from 'react';
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

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Solicitudes() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Create form state
  const [newRequest, setNewRequest] = useState({
    amount: '',
    description: '',
    beneficiary: '',
    category_id: '',
  });

  // Edit form state
  const [editRequest, setEditRequest] = useState({
    amount: '',
    description: '',
    beneficiary: '',
    category_id: '',
  });
  const [categories, setCategories] = useState([]);

  async function loadRequests() {
    try {
      setLoading(true);
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await api.get(`/payment-requests${params}`);
      setRequests(data.payment_requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      // Load egreso categories for payment requests
      const data = await api.get('/transactions?type=egreso&limit=1');
      // We'll just skip category loading for now if the endpoint doesn't support it
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.post('/payment-requests', {
        amount: parseInt(newRequest.amount),
        description: newRequest.description,
        beneficiary: newRequest.beneficiary,
        category_id: newRequest.category_id ? parseInt(newRequest.category_id) : undefined,
        status: 'pendiente',
      });
      setShowCreateModal(false);
      setNewRequest({ amount: '', description: '', beneficiary: '', category_id: '' });
      setFeedback({ type: 'success', message: 'Solicitud creada exitosamente' });
      loadRequests();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove(id) {
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/approve`, {});
      setFeedback({ type: 'success', message: 'Solicitud aprobada exitosamente' });
      setShowDetailModal(false);
      loadRequests();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(id) {
    if (!rejectComment.trim()) {
      setFeedback({ type: 'error', message: 'El comentario es obligatorio al rechazar' });
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/reject`, { comment: rejectComment });
      setFeedback({ type: 'success', message: 'Solicitud rechazada' });
      setRejectComment('');
      setShowDetailModal(false);
      loadRequests();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExecute(id) {
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/execute`, {});
      setFeedback({ type: 'success', message: 'Pago ejecutado exitosamente' });
      setShowDetailModal(false);
      loadRequests();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      setActionLoading(true);
      await api.put(`/payment-requests/${selectedRequest.id}`, {
        amount: parseInt(editRequest.amount),
        description: editRequest.description,
        beneficiary: editRequest.beneficiary,
        category_id: editRequest.category_id ? parseInt(editRequest.category_id) : undefined,
      });
      setShowEditModal(false);
      setFeedback({ type: 'success', message: 'Solicitud editada exitosamente' });
      loadRequests();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  function openEdit(request) {
    setSelectedRequest(request);
    setEditRequest({
      amount: request.amount.toString(),
      description: request.description,
      beneficiary: request.beneficiary,
      category_id: request.category_id ? request.category_id.toString() : '',
    });
    setShowEditModal(true);
  }

  function openDetail(request) {
    setSelectedRequest(request);
    setShowDetailModal(true);
    setRejectComment('');
  }

  // Check if current user can edit a specific request (only own drafts)
  function canEditRequest(req) {
    return req.status === 'borrador' && req.created_by === user?.id;
  }

  // Determine which action buttons to show based on role
  const canApproveReject = user?.role === 'presidente';
  const canExecute = user?.role === 'secretaria';
  const canCreate = user?.role === 'delegado' || user?.role === 'presidente';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitudes de Pago</h1>
          <p className="text-sm text-gray-500 mt-1">Pipeline completo de solicitudes de egreso</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + Nueva Solicitud
          </button>
        )}
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

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pendiente', 'aprobado', 'rechazado', 'ejecutado', 'borrador'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Todas'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-400">Cargando solicitudes...</div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-12 text-red-500">{error}</div>
      )}

      {/* Empty State */}
      {!loading && !error && requests.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-medium text-gray-900">No hay solicitudes</h3>
          <p className="text-gray-500 mt-1 text-sm">
            {statusFilter
              ? `No hay solicitudes con estado "${STATUS_LABELS[statusFilter]}"`
              : 'Crea tu primera solicitud de pago para comenzar'}
          </p>
          {canCreate && !statusFilter && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              + Nueva Solicitud
            </button>
          )}
        </div>
      )}

      {/* Requests List */}
      {!loading && requests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Descripci&oacute;n</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Beneficiario</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Creado por</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openDetail(req)}
                >
                  <td className="px-4 py-3 text-sm text-gray-500">#{req.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{req.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{req.beneficiary}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {formatCLP(req.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{req.created_by_name}</td>
                  <td className="px-4 py-3 text-right">
                    {/* Edit button - ONLY for own drafts */}
                    {canEditRequest(req) && (
                      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(req)}
                          className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                          disabled={actionLoading}
                        >
                          Editar
                        </button>
                      </div>
                    )}
                    {/* Approve/Reject buttons - ONLY for presidente, ONLY on pending */}
                    {canApproveReject && req.status === 'pendiente' && (
                      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                          disabled={actionLoading}
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => { setSelectedRequest(req); setShowDetailModal(true); }}
                          className="px-2.5 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                          disabled={actionLoading}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                    {/* Execute button - ONLY for secretaria, ONLY on approved */}
                    {canExecute && req.status === 'aprobado' && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleExecute(req.id)}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                          disabled={actionLoading}
                        >
                          Ejecutar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nueva Solicitud de Pago</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newRequest.amount}
                  onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripci&oacute;n</label>
                <input
                  type="text"
                  required
                  value={newRequest.description}
                  onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="Compra de materiales..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiario</label>
                <input
                  type="text"
                  required
                  value={newRequest.beneficiary}
                  onChange={(e) => setNewRequest({ ...newRequest, beneficiary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="Proveedor XYZ"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Creando...' : 'Crear Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Solicitud #{selectedRequest.id}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Estado</span>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedRequest.status]}`}>
                  {STATUS_LABELS[selectedRequest.status]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Monto</span>
                <span className="text-sm font-medium">{formatCLP(selectedRequest.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Descripci&oacute;n</span>
                <span className="text-sm text-right max-w-[60%]">{selectedRequest.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Beneficiario</span>
                <span className="text-sm">{selectedRequest.beneficiary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Creado por</span>
                <span className="text-sm">{selectedRequest.created_by_name}</span>
              </div>
              {selectedRequest.rejection_comment && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 mb-1">Motivo de rechazo:</p>
                  <p className="text-sm text-red-800">{selectedRequest.rejection_comment}</p>
                </div>
              )}
            </div>

            {/* Action Buttons - Role based */}
            {canApproveReject && selectedRequest.status === 'pendiente' && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleApprove(selectedRequest.id)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
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
                    onClick={() => handleReject(selectedRequest.id)}
                    disabled={actionLoading}
                    className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Procesando...' : 'Rechazar Solicitud'}
                  </button>
                </div>
              </div>
            )}

            {canExecute && selectedRequest.status === 'aprobado' && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleExecute(selectedRequest.id)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Procesando...' : 'Marcar como Ejecutado'}
                </button>
              </div>
            )}

            {/* Show info text for non-presidente roles on pending requests */}
            {(user?.role === 'secretaria' || user?.role === 'delegado') && selectedRequest.status === 'pendiente' && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 text-center italic">
                  Solo el Presidente puede aprobar o rechazar solicitudes pendientes.
                </p>
              </div>
            )}

            {/* Show info text for non-secretaria roles on approved requests */}
            {(user?.role === 'presidente' || user?.role === 'delegado') && selectedRequest.status === 'aprobado' && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 text-center italic">
                  Solo la Secretaria puede ejecutar solicitudes aprobadas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Editar Solicitud #{selectedRequest.id}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editRequest.amount}
                  onChange={(e) => setEditRequest({ ...editRequest, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripci&oacute;n</label>
                <input
                  type="text"
                  required
                  value={editRequest.description}
                  onChange={(e) => setEditRequest({ ...editRequest, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiario</label>
                <input
                  type="text"
                  required
                  value={editRequest.beneficiary}
                  onChange={(e) => setEditRequest({ ...editRequest, beneficiary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
