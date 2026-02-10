import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';
import * as XLSX from 'xlsx';
import { SkeletonTable, SkeletonKanban, SkeletonLine } from '../components/Skeleton';
import Spinner from '../components/Spinner';
import NetworkError from '../components/NetworkError';
import { formatCLP, blockNonNumericKeys, handleAmountPaste } from '../lib/formatters';

const STATUS_LABELS = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de Aprobación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  ejecutado: 'Ejecutado',
};

const STATUS_LABELS_SHORT = {
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

const KANBAN_COLUMN_COLORS = {
  borrador: 'border-t-gray-400',
  pendiente: 'border-t-yellow-400',
  aprobado: 'border-t-green-400',
  rechazado: 'border-t-red-400',
  ejecutado: 'border-t-blue-400',
};

const KANBAN_COLUMN_BG = {
  borrador: 'bg-gray-50',
  pendiente: 'bg-yellow-50',
  aprobado: 'bg-green-50',
  rechazado: 'bg-red-50',
  ejecutado: 'bg-blue-50',
};

const KANBAN_COLUMNS = ['borrador', 'pendiente', 'aprobado', 'rechazado', 'ejecutado'];

const VIEW_KEY = 'solicitudes_view';

export default function Solicitudes() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectConfirm, setRejectConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionRef = useRef(false);
  const isMountedRef = useRef(true);
  const showFeedback = (type, message) => addToast({ type, message, duration: type === 'success' ? 4000 : 6000, testId: 'solicitudes-toast' });
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem(VIEW_KEY) || 'kanban';
  });

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
  const [createFormErrors, setCreateFormErrors] = useState({});
  const [createSubmitted, setCreateSubmitted] = useState(false);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const createSubmittingRef = useRef(false);
  const editSubmittingRef = useRef(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasAdvancedFilters = categoryFilter || creatorFilter || searchFilter || beneficiaryFilter;
  // Track recently transitioned card IDs for CSS animation
  const [recentlyTransitioned, setRecentlyTransitioned] = useState(new Set());

  function buildFilterQuery(overrides = {}) {
    const status = overrides.status !== undefined ? overrides.status : statusFilter;
    const cat = overrides.category !== undefined ? overrides.category : categoryFilter;
    const creator = overrides.creator !== undefined ? overrides.creator : creatorFilter;
    const search = overrides.search !== undefined ? overrides.search : searchFilter;
    const benef = overrides.beneficiary !== undefined ? overrides.beneficiary : beneficiaryFilter;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (cat) params.set('category_id', cat);
    if (creator) params.set('created_by', creator);
    if (search && search.trim()) params.set('search', search.trim());
    if (benef && benef.trim()) params.set('beneficiary', benef.trim());
    params.set('sort_by', 'created_at');
    params.set('sort_order', 'desc');
    return params.toString();
  }

  async function loadRequests(filterOverrides = {}, { silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      const qs = buildFilterQuery(filterOverrides);
      const data = await api.get(`/payment-requests?${qs}`);
      if (!isMountedRef.current) return;
      setRequests(data.payment_requests || []);
    } catch (err) {
      setError(err.message);
      setIsNetworkError(!!err.isNetworkError);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await api.get('/categories');
      const cats = (data.categories || data || []).filter(c => c.type === 'egreso');
      if (!isMountedRef.current) return;
      setCategories(cats);
    } catch (err) {
      // Categories are optional
    }
  }

  async function loadUsers() {
    try {
      const data = await api.get('/users');
      if (!isMountedRef.current) return;
      setUsers(data.users || data || []);
    } catch (err) {
      // Users are optional for filter
    }
  }

  function handleStatusFilter(s) {
    setStatusFilter(s);
    loadRequests({ status: s });
  }

  function applyFilters() {
    loadRequests();
  }

  function clearAdvancedFilters() {
    setCategoryFilter('');
    setCreatorFilter('');
    setSearchFilter('');
    setBeneficiaryFilter('');
    loadRequests({ category: '', creator: '', search: '', beneficiary: '' });
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    try {
      setExporting(true);
      // Fetch all records matching current filters
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (creatorFilter) params.set('created_by', creatorFilter);
      if (searchFilter && searchFilter.trim()) params.set('search', searchFilter.trim());
      if (beneficiaryFilter && beneficiaryFilter.trim()) params.set('beneficiary', beneficiaryFilter.trim());
      params.set('sort_by', 'created_at');
      params.set('sort_order', 'desc');
      params.set('limit', '10000');

      const data = await api.get(`/payment-requests?${params.toString()}`);
      const reqs = data.payment_requests || [];

      if (reqs.length === 0) {
        alert('No hay datos para exportar con los filtros actuales.');
        return;
      }

      const rows = reqs.map(req => ({
        'ID': req.id,
        'Descripcion': req.description || '',
        'Beneficiario': req.beneficiary || '',
        'Categoria': req.category_name || 'Sin categoria',
        'Monto (CLP)': req.amount,
        'Estado': STATUS_LABELS[req.status] || req.status,
        'Creado por': req.created_by_name || '',
        'Fecha creacion': req.created_at || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');

      let filename = 'solicitudes';
      if (statusFilter) filename += `_${statusFilter}`;
      filename += '.xlsx';

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Error al exportar: ' + (err.message || 'Error desconocido'));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    loadRequests();
    loadCategories();
    loadUsers();
    return function() { isMountedRef.current = false; };
  }, []);

  function handleViewChange(mode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
    // When switching to kanban, clear status filter to show all columns
    if (mode === 'kanban' && statusFilter) {
      setStatusFilter('');
      loadRequests({ status: '' });
    }
  }

  const DESCRIPTION_MAX_LENGTH = 500;
  const BENEFICIARY_MAX_LENGTH = 200;

  function validatePaymentForm(f) {
    const errors = {};
    const rawAmount = String(f.amount).trim();
    if (!rawAmount) {
      errors.amount = 'El monto es requerido';
    } else {
      const num = Number(rawAmount);
      if (isNaN(num) || !/^-?\d*\.?\d+$/.test(rawAmount)) {
        errors.amount = 'El monto debe ser un número válido';
      } else if (num <= 0) {
        errors.amount = 'El monto debe ser mayor a cero';
      } else if (!Number.isInteger(num)) {
        errors.amount = 'El monto debe ser un número entero (sin decimales)';
      }
    }
    if (!f.category_id) {
      errors.category_id = 'La categoría es requerida';
    }
    if (!f.description || !f.description.trim()) {
      errors.description = 'La descripción es requerida';
    } else if (f.description.length > DESCRIPTION_MAX_LENGTH) {
      errors.description = `La descripción no puede exceder ${DESCRIPTION_MAX_LENGTH} caracteres`;
    }
    if (!f.beneficiary || !f.beneficiary.trim()) {
      errors.beneficiary = 'El beneficiario es requerido';
    } else if (f.beneficiary.length > BENEFICIARY_MAX_LENGTH) {
      errors.beneficiary = `El beneficiario no puede exceder ${BENEFICIARY_MAX_LENGTH} caracteres`;
    }
    return errors;
  }

  async function handleCreate(e, asDraft = false) {
    if (e && e.preventDefault) e.preventDefault();
    // Validate required fields
    const errors = validatePaymentForm(newRequest);
    setCreateFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    // Prevent double-click and back-resubmit: ref guard + submitted flag
    if (createSubmittingRef.current || createSubmitted) return;
    createSubmittingRef.current = true;
    try {
      setActionLoading(true);
      await api.post('/payment-requests', {
        amount: parseInt(newRequest.amount),
        description: newRequest.description,
        beneficiary: newRequest.beneficiary,
        category_id: newRequest.category_id ? parseInt(newRequest.category_id) : undefined,
        status: asDraft ? 'borrador' : 'pendiente',
      });
      setCreateSubmitted(true);
      setShowCreateModal(false);
      setNewRequest({ amount: '', description: '', beneficiary: '', category_id: '' });
      showFeedback('success', asDraft ? 'Borrador guardado exitosamente' : 'Solicitud enviada exitosamente');
      loadRequests({}, { silent: true });
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      createSubmittingRef.current = false;
      setActionLoading(false);
    }
  }

  async function handleApprove(id) {
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/approve`, {});
      // Optimistic UI update - move card immediately without full reload
      setRequests(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'aprobado', approved_by_name: user?.name } : r
      ));
      // Trigger entry animation
      setRecentlyTransitioned(prev => new Set([...prev, id]));
      setTimeout(() => setRecentlyTransitioned(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }), 600);
      showFeedback('success', 'Solicitud aprobada exitosamente');
      setShowDetailModal(false);
      // Background sync to get any server-side changes
      loadRequests({}, { silent: true });
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  }

  function showRejectConfirmation(id) {
    if (!rejectComment.trim()) {
      showFeedback('error', 'El comentario es obligatorio al rechazar');
      return;
    }
    const req = requests.find(r => r.id === id);
    setRejectConfirm({ id, request: req });
  }

  async function handleReject(id) {
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/reject`, { comment: rejectComment });
      // Optimistic UI update - move card immediately without full reload
      setRequests(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'rechazado', rejection_comment: rejectComment, rejected_by_name: user?.name } : r
      ));
      // Trigger entry animation
      setRecentlyTransitioned(prev => new Set([...prev, id]));
      setTimeout(() => setRecentlyTransitioned(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }), 600);
      showFeedback('success', 'Solicitud rechazada');
      setRejectComment('');
      setRejectConfirm(null);
      setShowDetailModal(false);
      // Background sync
      loadRequests({}, { silent: true });
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  }

  async function handleExecute(id) {
    // Prevent double-click: ref guard blocks re-entry before React re-renders
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      setActionLoading(true);
      await api.post(`/payment-requests/${id}/execute`, {});
      // Optimistic UI update - move card immediately
      setRequests(prev => prev.map(r =>
        r.id === id ? { ...r, status: 'ejecutado', executed_by_name: user?.name } : r
      ));
      // Trigger entry animation
      setRecentlyTransitioned(prev => new Set([...prev, id]));
      setTimeout(() => setRecentlyTransitioned(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }), 600);
      showFeedback('success', 'Pago ejecutado exitosamente. Comprobante adjuntado correctamente.');
      setShowDetailModal(false);
      // Background sync
      loadRequests({}, { silent: true });
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!selectedRequest) return;
    // Prevent double-click and back-resubmit
    if (editSubmittingRef.current || editSubmitted) return;
    editSubmittingRef.current = true;
    try {
      setActionLoading(true);
      await api.put(`/payment-requests/${selectedRequest.id}`, {
        amount: parseInt(editRequest.amount),
        description: editRequest.description,
        beneficiary: editRequest.beneficiary,
        category_id: editRequest.category_id ? parseInt(editRequest.category_id) : undefined,
      });
      setEditSubmitted(true);
      setShowEditModal(false);
      showFeedback('success', 'Solicitud editada exitosamente');
      loadRequests({}, { silent: true });
    } catch (err) {
      showFeedback('error', err.message);
    } finally {
      editSubmittingRef.current = false;
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
    setEditSubmitted(false);
    setShowEditModal(true);
  }

  function openDetail(request) {
    navigate(`/solicitudes/${request.id}`);
  }

  // Check if current user can edit a specific request (only own drafts)
  function canEditRequest(req) {
    return req.status === 'borrador' && req.created_by === user?.id;
  }

  // Determine which action buttons to show based on role
  const canApproveReject = user?.role === 'presidente';
  const canExecute = user?.role === 'secretaria';
  const canCreate = user?.role === 'delegado' || user?.role === 'presidente';

  // Group requests by status for Kanban view
  const requestsByStatus = KANBAN_COLUMNS.reduce((acc, status) => {
    acc[status] = requests.filter(r => r.status === status);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitudes de Pago</h1>
          <p className="text-sm text-gray-500 mt-1">Pipeline completo de solicitudes de egreso</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5" data-testid="view-toggle">
            <button
              onClick={() => handleViewChange('kanban')}
              data-testid="view-kanban"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="6" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="11" y="1" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Kanban
              </span>
            </button>
            <button
              onClick={() => handleViewChange('table')}
              data-testid="view-table"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="14" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="1" y="6" width="14" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="1" y="11" width="14" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Tabla
              </span>
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            data-testid="export-solicitudes-btn"
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? 'Exportando...' : 'Excel'}
          </button>
          {canCreate && (
            <button
              onClick={() => { setShowCreateModal(true); setCreateFormErrors({}); setCreateSubmitted(false); setNewRequest({ amount: '', description: '', beneficiary: '', category_id: '' }); }}
              className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors text-center"
            >
              + Nueva Solicitud
            </button>
          )}
        </div>
      </div>

      {/* Status Filters - only show in Table view */}
      {viewMode === 'table' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['', 'pendiente', 'aprobado', 'rechazado', 'ejecutado', 'borrador'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                data-testid={`status-filter-${s || 'all'}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s ? STATUS_LABELS_SHORT[s] : 'Todas'}
              </button>
            ))}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              data-testid="toggle-advanced-filters"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto ${
                showAdvancedFilters || hasAdvancedFilters
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {hasAdvancedFilters ? '⚙ Filtros Activos' : '⚙ Filtros'}
            </button>
          </div>

          {/* Advanced Filter Bar */}
          {showAdvancedFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap items-end gap-3">
                {/* Search */}
                <div className="flex-1 min-w-0 sm:min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value.slice(0, 500))}
                    maxLength={500}
                    data-testid="pipeline-filter-search"
                    placeholder="Descripción o beneficiario..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none truncate"
                  />
                </div>
                {/* Beneficiary */}
                <div className="min-w-0 sm:min-w-[160px] w-full sm:w-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Beneficiario</label>
                  <input
                    type="text"
                    value={beneficiaryFilter}
                    onChange={(e) => setBeneficiaryFilter(e.target.value.slice(0, 500))}
                    maxLength={500}
                    data-testid="pipeline-filter-beneficiary"
                    placeholder="Nombre del beneficiario..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none truncate"
                  />
                </div>
                {/* Category */}
                <div className="min-w-0 sm:min-w-[160px] w-full sm:w-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    data-testid="pipeline-filter-category"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  >
                    <option value="">Todas</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {/* Creator */}
                <div className="min-w-0 sm:min-w-[160px] w-full sm:w-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Creador</label>
                  <select
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    data-testid="pipeline-filter-creator"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  >
                    <option value="">Todos</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={applyFilters}
                    data-testid="pipeline-filter-apply"
                    className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Buscar
                  </button>
                  {hasAdvancedFilters && (
                    <button
                      onClick={clearAdvancedFilters}
                      data-testid="pipeline-filter-clear"
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div data-testid="loading-skeleton">
          {viewMode === 'kanban' ? (
            <SkeletonKanban />
          ) : (
            <SkeletonTable rows={5} columns={7} />
          )}
        </div>
      )}

      {/* Error */}
      {error && isNetworkError && (
        <NetworkError
          message={error}
          onRetry={async () => { setError(null); setIsNetworkError(false); await loadRequests(); }}
        />
      )}
      {error && !isNetworkError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-1">Error al cargar datos</h3>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => { setError(null); loadRequests(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && requests.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-medium text-gray-900">No hay solicitudes</h3>
          <p className="text-gray-500 mt-1 text-sm">
            {statusFilter || hasAdvancedFilters
              ? 'No se encontraron solicitudes con los filtros aplicados. Intenta ajustar o limpiar los filtros.'
              : 'Crea tu primera solicitud de pago para comenzar'}
          </p>
          {(statusFilter || hasAdvancedFilters) && (
            <button
              onClick={() => { setStatusFilter(''); clearAdvancedFilters(); }}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
          {canCreate && !statusFilter && !hasAdvancedFilters && (
            <button
              onClick={() => { setShowCreateModal(true); setCreateFormErrors({}); setCreateSubmitted(false); setNewRequest({ amount: '', description: '', beneficiary: '', category_id: '' }); }}
              className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              + Nueva Solicitud
            </button>
          )}
        </div>
      )}

      {/* KANBAN VIEW */}
      {!loading && requests.length > 0 && viewMode === 'kanban' && (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 kanban-scroll" data-testid="kanban-view">
          {KANBAN_COLUMNS.map(status => (
            <div
              key={status}
              className={`flex-shrink-0 w-[75vw] sm:w-52 md:w-56 lg:w-64 rounded-xl border border-gray-200 border-t-4 ${KANBAN_COLUMN_COLORS[status]} bg-white flex flex-col max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-240px)] kanban-column`}
              data-testid={`kanban-column-${status}`}
            >
              {/* Column header */}
              <div className={`px-3 py-3 border-b border-gray-100 ${KANBAN_COLUMN_BG[status]} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 truncate" data-testid={`kanban-label-${status}`}>
                    {STATUS_LABELS[status]}
                  </h3>
                  <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                    {requestsByStatus[status].length}
                  </span>
                </div>
              </div>
              {/* Column body */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {requestsByStatus[status].length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400">
                    Sin solicitudes
                  </div>
                ) : (
                  requestsByStatus[status].map(req => (
                    <div
                      key={req.id}
                      onClick={() => openDetail(req)}
                      className={`bg-white border border-gray-100 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all duration-300 cursor-pointer min-h-[44px] ${
                        recentlyTransitioned.has(req.id) ? 'animate-card-enter' : ''
                      }`}
                      data-testid={`kanban-card-${req.id}`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-xs text-gray-400 font-mono">#{req.id}</span>
                        <span className="text-xs font-semibold text-gray-900">{formatCLP(req.amount)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                        {req.description}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{req.beneficiary}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-400 truncate mr-1">{req.created_by_name}</span>
                        {/* Quick actions */}
                        {canApproveReject && req.status === 'pendiente' && (
                          <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleApprove(req.id)}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors min-w-[32px] min-h-[28px]"
                              disabled={actionLoading}
                            >
                              ✓
                            </button>
                          </div>
                        )}
                        {canExecute && req.status === 'aprobado' && (
                          <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => navigate(`/solicitudes/${req.id}`)}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors min-h-[28px]"
                              title="Requiere adjuntar comprobante"
                            >
                              Ejecutar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE VIEW - Mobile card layout */}
      {!loading && requests.length > 0 && viewMode === 'table' && (
        <div className="md:hidden space-y-3" data-testid="mobile-table-cards">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => openDetail(req)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-gray-300 transition-colors"
              data-testid={`mobile-req-card-${req.id}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-mono">#{req.id}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {STATUS_LABELS_SHORT[req.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{req.description}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCLP(req.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[120px]">{req.beneficiary}</span>
                  <span>· {req.created_by_name}</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {canEditRequest(req) && (
                    <button
                      onClick={() => openEdit(req)}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                      disabled={actionLoading}
                    >
                      Editar
                    </button>
                  )}
                  {canApproveReject && req.status === 'pendiente' && (
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium"
                      disabled={actionLoading}
                    >
                      Aprobar
                    </button>
                  )}
                  {canExecute && req.status === 'aprobado' && (
                    <button
                      onClick={() => navigate(`/solicitudes/${req.id}`)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium"
                    >
                      Ejecutar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE VIEW - Desktop table layout */}
      {!loading && requests.length > 0 && viewMode === 'table' && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto" data-testid="table-view">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Beneficiario</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Creado por</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Acciones</th>
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
                      {STATUS_LABELS_SHORT[req.status]}
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
                    {/* Execute button - ONLY for secretaria, ONLY on approved - links to detail page for comprobante */}
                    {canExecute && req.status === 'aprobado' && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/solicitudes/${req.id}`)}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                          title="Requiere adjuntar comprobante"
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Nueva Solicitud de Pago</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
            <form onSubmit={(e) => handleCreate(e, false)} noValidate className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newRequest.amount}
                  onChange={(e) => { setNewRequest({ ...newRequest, amount: e.target.value }); if (createFormErrors.amount) setCreateFormErrors(prev => ({ ...prev, amount: '' })); }}
                  onKeyDown={blockNonNumericKeys}
                  onPaste={e => handleAmountPaste(e, v => { setNewRequest(r => ({ ...r, amount: v })); if (createFormErrors.amount) setCreateFormErrors(prev => ({ ...prev, amount: '' })); })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none ${createFormErrors.amount ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="50000"
                  data-testid="pr-amount"
                />
                {createFormErrors.amount && (
                  <p className="mt-1 text-sm text-red-600" data-testid="pr-amount-error">{createFormErrors.amount}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select
                  value={newRequest.category_id}
                  onChange={(e) => { setNewRequest({ ...newRequest, category_id: e.target.value }); if (createFormErrors.category_id) setCreateFormErrors(prev => ({ ...prev, category_id: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none ${createFormErrors.category_id ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid="pr-category"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {createFormErrors.category_id && (
                  <p className="mt-1 text-sm text-red-600" data-testid="pr-category-error">{createFormErrors.category_id}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <textarea
                  value={newRequest.description}
                  onChange={(e) => { setNewRequest({ ...newRequest, description: e.target.value.slice(0, DESCRIPTION_MAX_LENGTH) }); if (createFormErrors.description) setCreateFormErrors(prev => ({ ...prev, description: '' })); }}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none ${createFormErrors.description ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Compra de materiales..."
                  data-testid="pr-description"
                />
                <div className="flex justify-between items-center mt-1">
                  {createFormErrors.description ? (
                    <p className="text-sm text-red-600" data-testid="pr-description-error">{createFormErrors.description}</p>
                  ) : <span />}
                  <span className={`text-xs ${newRequest.description.length >= DESCRIPTION_MAX_LENGTH ? 'text-red-500 font-medium' : 'text-gray-400'}`} data-testid="pr-description-counter">
                    {newRequest.description.length}/{DESCRIPTION_MAX_LENGTH}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiario *</label>
                <input
                  type="text"
                  value={newRequest.beneficiary}
                  onChange={(e) => { setNewRequest({ ...newRequest, beneficiary: e.target.value.slice(0, BENEFICIARY_MAX_LENGTH) }); if (createFormErrors.beneficiary) setCreateFormErrors(prev => ({ ...prev, beneficiary: '' })); }}
                  maxLength={BENEFICIARY_MAX_LENGTH}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none ${createFormErrors.beneficiary ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Proveedor XYZ"
                  data-testid="pr-beneficiary"
                />
                {createFormErrors.beneficiary && (
                  <p className="mt-1 text-sm text-red-600" data-testid="pr-beneficiary-error">{createFormErrors.beneficiary}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={(e) => handleCreate(e, true)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <><Spinner size={14} className="inline mr-1" />Guardando...</> : 'Guardar Borrador'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <><Spinner size={14} className="inline mr-1" />Enviando...</> : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Solicitud #{selectedRequest.id}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Cerrar"
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
                <span className="text-sm text-gray-500">Descripción</span>
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
                  {actionLoading ? <><Spinner size={14} className="inline mr-1" />Procesando...</> : 'Aprobar Solicitud'}
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
                    onClick={() => showRejectConfirmation(selectedRequest.id)}
                    disabled={actionLoading}
                    className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <><Spinner size={14} className="inline mr-1" />Procesando...</> : 'Rechazar Solicitud'}
                  </button>
                </div>
              </div>
            )}

            {canExecute && selectedRequest.status === 'aprobado' && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500 mb-2 text-center">Se requiere adjuntar comprobante para ejecutar</p>
                <button
                  onClick={() => { setShowDetailModal(false); navigate(`/solicitudes/${selectedRequest.id}`); }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Ir a Ejecutar con Comprobante
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

      {/* Reject Confirmation Modal */}
      {rejectConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setRejectConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirmar rechazo</h2>
              <p className="text-gray-600 text-sm mb-1">
                ¿Estás seguro de rechazar esta solicitud?
              </p>
              {rejectConfirm.request && (
                <p className="text-gray-800 font-medium text-sm mb-2">
                  {rejectConfirm.request.description} — {formatCLP(rejectConfirm.request.amount)}
                </p>
              )}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                <p className="text-xs font-medium text-red-700 mb-1">Motivo de rechazo:</p>
                <p className="text-sm text-red-800">{rejectComment}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectConfirm(null)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleReject(rejectConfirm.id)}
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

      {/* Edit Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Editar Solicitud #{selectedRequest.id}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editRequest.amount}
                  onChange={(e) => setEditRequest({ ...editRequest, amount: e.target.value })}
                  onKeyDown={blockNonNumericKeys}
                  onPaste={e => handleAmountPaste(e, v => setEditRequest(r => ({ ...r, amount: v })))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  required
                  value={editRequest.description}
                  onChange={(e) => setEditRequest({ ...editRequest, description: e.target.value.slice(0, DESCRIPTION_MAX_LENGTH) })}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${editRequest.description.length >= DESCRIPTION_MAX_LENGTH ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {editRequest.description.length}/{DESCRIPTION_MAX_LENGTH}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiario</label>
                <input
                  type="text"
                  required
                  value={editRequest.beneficiary}
                  onChange={(e) => setEditRequest({ ...editRequest, beneficiary: e.target.value.slice(0, BENEFICIARY_MAX_LENGTH) })}
                  maxLength={BENEFICIARY_MAX_LENGTH}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={editRequest.category_id}
                  onChange={(e) => setEditRequest({ ...editRequest, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                  {actionLoading ? <><Spinner size={14} className="inline mr-1" />Guardando...</> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
