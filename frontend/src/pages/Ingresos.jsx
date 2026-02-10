import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';
import * as XLSX from 'xlsx';
import { SkeletonTable, SkeletonLine } from '../components/Skeleton';
import Spinner from '../components/Spinner';
import NetworkError from '../components/NetworkError';
import { formatCLP, formatDate, blockNonNumericKeys, handleAmountPaste } from '../lib/formatters';

export default function Ingresos() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Filter state - initialize from URL params
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || '');
  const [filterFrom, setFilterFrom] = useState(searchParams.get('from') || '');
  const [filterTo, setFilterTo] = useState(searchParams.get('to') || '');
  const [filterSearch, setFilterSearch] = useState(searchParams.get('search') || '');
  const [filterAmountMin, setFilterAmountMin] = useState(searchParams.get('amount_min') || '');
  const [filterAmountMax, setFilterAmountMax] = useState(searchParams.get('amount_max') || '');
  const [showFilters, setShowFilters] = useState(!!(searchParams.get('from') || searchParams.get('to') || searchParams.get('amount_min') || searchParams.get('amount_max')));
  // Sort state - initialize from URL params
  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'date');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sort_order') || 'desc');
  // Pagination state - initialize from URL params
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 15;

  // Update URL search params when filters change
  const updateUrlParams = useCallback((overrides = {}) => {
    const params = new URLSearchParams();
    const cat = overrides.category !== undefined ? overrides.category : filterCategory;
    const from = overrides.from !== undefined ? overrides.from : filterFrom;
    const to = overrides.to !== undefined ? overrides.to : filterTo;
    const search = overrides.search !== undefined ? overrides.search : filterSearch;
    const amtMin = overrides.amount_min !== undefined ? overrides.amount_min : filterAmountMin;
    const amtMax = overrides.amount_max !== undefined ? overrides.amount_max : filterAmountMax;
    const sb = overrides.sort_by !== undefined ? overrides.sort_by : sortBy;
    const so = overrides.sort_order !== undefined ? overrides.sort_order : sortOrder;
    const pg = overrides.page !== undefined ? overrides.page : currentPage;

    if (cat) params.set('category', cat);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search && search.trim()) params.set('search', search.trim());
    if (amtMin) params.set('amount_min', amtMin);
    if (amtMax) params.set('amount_max', amtMax);
    if (sb && sb !== 'date') params.set('sort_by', sb);
    if (so && so !== 'desc') params.set('sort_order', so);
    if (pg && pg > 1) params.set('page', pg.toString());

    setSearchParams(params, { replace: true });
  }, [filterCategory, filterFrom, filterTo, filterSearch, filterAmountMin, filterAmountMax, sortBy, sortOrder, currentPage, setSearchParams]);

  const [form, setForm] = useState({
    amount: '',
    category_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    payer_name: '',
    payer_rut: ''
  });
  const [editForm, setEditForm] = useState({
    amount: '',
    category_id: '',
    description: '',
    date: '',
    payer_name: '',
    payer_rut: ''
  });
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [editFormSubmitted, setEditFormSubmitted] = useState(false);
  // feedback state kept for backward compat but toasts now go through context
  const showFeedback = (type, message) => addToast({ type, message, testId: 'income-toast' });
  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);
  const editSubmittingRef = useRef(false);

  const hasActiveFilters = filterCategory || filterFrom || filterTo || filterSearch || filterAmountMin || filterAmountMax;
  const [dateRangeWarning, setDateRangeWarning] = useState('');

  // Check if date range is inverted (from > to)
  const isDateRangeInverted = filterFrom && filterTo && filterFrom > filterTo;

  // Build query string from filters
  function buildFilterQuery(overrides = {}) {
    const cat = overrides.category !== undefined ? overrides.category : filterCategory;
    const from = overrides.from !== undefined ? overrides.from : filterFrom;
    const to = overrides.to !== undefined ? overrides.to : filterTo;
    const search = overrides.search !== undefined ? overrides.search : filterSearch;
    const amtMin = overrides.amount_min !== undefined ? overrides.amount_min : filterAmountMin;
    const amtMax = overrides.amount_max !== undefined ? overrides.amount_max : filterAmountMax;
    const sb = overrides.sort_by !== undefined ? overrides.sort_by : sortBy;
    const so = overrides.sort_order !== undefined ? overrides.sort_order : sortOrder;
    const pg = overrides.page !== undefined ? overrides.page : currentPage;
    const params = new URLSearchParams();
    params.set('type', 'ingreso');
    params.set('sort_by', sb);
    params.set('sort_order', so);
    params.set('page', pg.toString());
    params.set('limit', pageSize.toString());
    if (cat) params.set('category_id', cat);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search && search.trim()) params.set('search', search.trim());
    if (amtMin) params.set('amount_min', amtMin);
    if (amtMax) params.set('amount_max', amtMax);
    return params.toString();
  }

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    return function() { isMountedRef.current = false; };
  }, []);

  async function loadData(filterOverrides = {}, { silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      const [txRes, catRes] = await Promise.all([
        api.get(`/transactions?${buildFilterQuery(filterOverrides)}`),
        api.get('/categories')
      ]);
      if (!isMountedRef.current) return;
      setTransactions(txRes.transactions || []);
      if (txRes.pagination) {
        setTotalPages(txRes.pagination.pages || 1);
        setTotalRecords(txRes.pagination.total || 0);
        if (filterOverrides.page !== undefined) {
          setCurrentPage(txRes.pagination.page || 1);
        }
      }
      setCategories((catRes.categories || catRes || []).filter(c => c.type === 'ingreso'));
    } catch (err) {
      console.error('Error loading data:', err);
      setPageError(err.message || 'Error al cargar datos');
      setIsNetworkError(!!err.isNetworkError);
    } finally {
      setLoading(false);
    }
  }

  // Apply filters (reload data with current filter state, reset to page 1)
  function applyFilters() {
    // Auto-correct inverted date range
    if (filterFrom && filterTo && filterFrom > filterTo) {
      const correctedFrom = filterTo;
      const correctedTo = filterFrom;
      setFilterFrom(correctedFrom);
      setFilterTo(correctedTo);
      setDateRangeWarning('Las fechas fueron invertidas automaticamente (Desde era posterior a Hasta).');
      setTimeout(() => setDateRangeWarning(''), 5000);
      setCurrentPage(1);
      loadData({ from: correctedFrom, to: correctedTo, page: 1 });
      updateUrlParams({ from: correctedFrom, to: correctedTo, page: 1 });
      return;
    }
    setDateRangeWarning('');
    setCurrentPage(1);
    loadData({ page: 1 });
    updateUrlParams({ page: 1 });
  }

  function clearFilters() {
    setFilterCategory('');
    setFilterFrom('');
    setFilterTo('');
    setFilterSearch('');
    setFilterAmountMin('');
    setFilterAmountMax('');
    setCurrentPage(1);
    loadData({ category: '', from: '', to: '', search: '', amount_min: '', amount_max: '', page: 1 });
    updateUrlParams({ category: '', from: '', to: '', search: '', amount_min: '', amount_max: '', page: 1 });
  }

  function handleSort(column) {
    let newOrder = 'asc';
    if (sortBy === column) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(column);
    setSortOrder(newOrder);
    setCurrentPage(1);
    loadData({ sort_by: column, sort_order: newOrder, page: 1 });
    updateUrlParams({ sort_by: column, sort_order: newOrder, page: 1 });
  }

  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    loadData({ page });
    updateUrlParams({ page });
  }

  function SortArrow({ column }) {
    if (sortBy !== column) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary-600 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    try {
      setExporting(true);
      // Fetch ALL records matching current filters (no pagination limit)
      const params = new URLSearchParams();
      params.set('type', 'ingreso');
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);
      params.set('limit', '10000'); // Get all records
      if (filterCategory) params.set('category_id', filterCategory);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (filterSearch && filterSearch.trim()) params.set('search', filterSearch.trim());
      if (filterAmountMin) params.set('amount_min', filterAmountMin);
      if (filterAmountMax) params.set('amount_max', filterAmountMax);

      const res = await api.get(`/transactions?${params.toString()}`);
      const data = res.transactions || [];

      if (data.length === 0) {
        alert('No hay datos para exportar con los filtros actuales.');
        return;
      }

      // Build Excel data
      const rows = data.map(tx => ({
        'Fecha': formatDate(tx.date),
        'Descripcion': tx.description || '',
        'Categoria': tx.category_name || 'Sin categoria',
        'Pagador': tx.payer_name || '',
        'RUT Pagador': tx.payer_rut || '',
        'Monto (CLP)': tx.amount,
        'Monto Formateado': formatCLP(tx.amount),
        'Registrado por': tx.created_by_name || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');

      // Generate filename with filter info
      let filename = 'ingresos';
      if (filterFrom || filterTo) {
        if (filterFrom) filename += `_desde_${filterFrom}`;
        if (filterTo) filename += `_hasta_${filterTo}`;
      }
      filename += '.xlsx';

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Error al exportar: ' + (err.message || 'Error desconocido'));
    } finally {
      setExporting(false);
    }
  }

  function validateRut(rut) {
    // Remove dots and hyphens, trim whitespace
    const cleaned = rut.replace(/\./g, '').replace(/-/g, '').trim();
    if (cleaned.length < 2) return false;

    // Body is all chars except last, verifier is last char
    const body = cleaned.slice(0, -1);
    const verifier = cleaned.slice(-1).toUpperCase();

    // Body must be all digits, between 1 and 8 digits
    if (!/^\d{1,8}$/.test(body)) return false;
    // Verifier must be digit or K
    if (!/^[\dK]$/.test(verifier)) return false;

    // Calculate check digit using modulo 11 algorithm
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const remainder = 11 - (sum % 11);
    let expected;
    if (remainder === 11) expected = '0';
    else if (remainder === 10) expected = 'K';
    else expected = String(remainder);

    return verifier === expected;
  }

  function validateIncomeForm(f) {
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
    if (!f.date) {
      errors.date = 'La fecha es requerida';
    } else {
      // Validate date format and real calendar date
      const dateStr = String(f.date).trim();
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        errors.date = 'La fecha debe tener formato válido (AAAA-MM-DD)';
      } else {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const day = parseInt(dateMatch[3]);
        if (month < 1 || month > 12) {
          errors.date = 'El mes debe estar entre 1 y 12';
        } else if (day < 1 || day > 31) {
          errors.date = 'El día debe estar entre 1 y 31';
        } else {
          // Check the date is actually valid (e.g., Feb 30 would fail)
          const dateObj = new Date(year, month - 1, day);
          if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
            errors.date = 'La fecha ingresada no es válida';
          }
        }
      }
    }
    // RUT validation - optional, but if entered must be valid Chilean format
    if (f.payer_rut && f.payer_rut.trim()) {
      if (!validateRut(f.payer_rut.trim())) {
        errors.payer_rut = 'El RUT ingresado no es válido. Formato: 12.345.678-9';
      }
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Prevent double-click and back-resubmit: ref guard + submitted flag
    if (submittingRef.current || formSubmitted) return;

    const errors = validateIncomeForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setSaving(true);

    try {
      const payload = {
        type: 'ingreso',
        amount: parseInt(form.amount),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        description: form.description,
        date: form.date,
        payer_name: form.payer_name || null,
        payer_rut: form.payer_rut || null
      };

      await api.post('/transactions', payload);
      setFormSubmitted(true);
      setShowModal(false);
      setForm({
        amount: '',
        category_id: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        payer_name: '',
        payer_rut: ''
      });
      showFeedback('success', 'Ingreso registrado exitosamente');
      loadData({}, { silent: true });
    } catch (err) {
      if (err.fields) setFormErrors(err.fields);
      setError(err.isNetworkError
        ? 'No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.'
        : (err.message || 'Error al registrar ingreso'));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete(tx) {
    setDeleting(true);
    try {
      await api.delete(`/transactions/${tx.id}`);
      setDeleteConfirm(null);
      loadData({}, { silent: true });
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  function openEditModal(tx) {
    setEditingTransaction(tx);
    setEditForm({
      amount: tx.amount.toString(),
      category_id: tx.category_id ? tx.category_id.toString() : '',
      description: tx.description || '',
      date: tx.date,
      payer_name: tx.payer_name || '',
      payer_rut: tx.payer_rut || ''
    });
    setEditError('');
    setEditFormSubmitted(false);
    setShowEditModal(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError('');

    // Prevent double-click and back-resubmit: ref guard + submitted flag
    if (editSubmittingRef.current || editFormSubmitted) return;

    // Validate amount
    const amt = parseFloat(editForm.amount);
    if (!editForm.amount || isNaN(amt) || amt <= 0) {
      setEditError('El monto debe ser un número positivo');
      return;
    }

    // Validate RUT if provided
    if (editForm.payer_rut && editForm.payer_rut.trim()) {
      if (!validateRut(editForm.payer_rut.trim())) {
        setEditError('El RUT ingresado no es válido. Formato: 12.345.678-9');
        return;
      }
    }

    editSubmittingRef.current = true;
    setEditSaving(true);

    try {
      const payload = {
        amount: parseInt(editForm.amount),
        category_id: editForm.category_id ? parseInt(editForm.category_id) : null,
        description: editForm.description || null,
        date: editForm.date,
        payer_name: editForm.payer_name || null,
        payer_rut: editForm.payer_rut || null
      };

      await api.put(`/transactions/${editingTransaction.id}`, payload);
      setEditFormSubmitted(true);
      setShowEditModal(false);
      setEditingTransaction(null);
      loadData({}, { silent: true });
    } catch (err) {
      setEditError(err.message || 'Error al actualizar ingreso');
    } finally {
      editSubmittingRef.current = false;
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingresos</h1>
          <p className="text-gray-500 mt-1">Registro de ingresos del CPP</p>
        </div>
        {!loading && !pageError && (
          <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={handleExport}
              disabled={exporting}
              data-testid="export-excel-btn"
              className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
            <button
              onClick={() => { setShowModal(true); setFormErrors({}); setFormSubmitted(false); setError(''); setForm({ amount: '', category_id: '', description: '', date: new Date().toISOString().split('T')[0], payer_name: '', payer_rut: '' }); }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm text-center"
            >
              + Registrar Ingreso
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6" data-testid="loading-skeleton">
          {/* Filter bar skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <SkeletonLine width="w-48" height="h-9" />
              <SkeletonLine width="w-36" height="h-9" />
              <SkeletonLine width="w-20" height="h-9" />
              <SkeletonLine width="w-20" height="h-9" />
            </div>
          </div>
          {/* Table skeleton */}
          <SkeletonTable rows={5} columns={6} />
        </div>
      )}

      {/* Page Error Display */}
      {pageError && isNetworkError && (
        <NetworkError
          message={pageError}
          onRetry={async () => { setPageError(null); setIsNetworkError(false); await loadData(); }}
        />
      )}
      {pageError && !isNetworkError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-1">Error al cargar datos</h3>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{pageError}</p>
          <button
            onClick={() => { setPageError(null); loadData(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Filter Bar */}
      {!loading && !pageError && <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="filter-bar">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar por descripción..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value.slice(0, 500))}
              onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
              maxLength={500}
              data-testid="filter-search"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent truncate"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); }}
            data-testid="filter-category"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Toggle advanced filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || filterFrom || filterTo
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
              )}
            </span>
          </button>

          {/* Apply */}
          <button
            onClick={applyFilters}
            data-testid="filter-apply"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Buscar
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              data-testid="filter-clear"
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Date range and amount range - shown when advanced filters toggled */}
        {showFilters && (
          <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Desde:</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={e => { setFilterFrom(e.target.value); setDateRangeWarning(''); }}
                  data-testid="filter-from"
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${isDateRangeInverted ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Hasta:</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => { setFilterTo(e.target.value); setDateRangeWarning(''); }}
                  data-testid="filter-to"
                  className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${isDateRangeInverted ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                />
              </div>
            </div>
            {isDateRangeInverted && (
              <p className="text-xs text-amber-600 font-medium" data-testid="date-range-warning">
                ⚠ La fecha "Desde" es posterior a "Hasta". Se corregira automaticamente al buscar.
              </p>
            )}
            {dateRangeWarning && (
              <p className="text-xs text-amber-600 font-medium" data-testid="date-range-corrected">
                ✓ {dateRangeWarning}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Monto mín:</label>
                <input
                  type="number"
                  min="0"
                  value={filterAmountMin}
                  onChange={e => setFilterAmountMin(e.target.value)}
                  onKeyDown={blockNonNumericKeys}
                  onPaste={e => handleAmountPaste(e, setFilterAmountMin)}
                  data-testid="filter-amount-min"
                  placeholder="0"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Monto máx:</label>
                <input
                  type="number"
                  min="0"
                  value={filterAmountMax}
                  onChange={e => setFilterAmountMax(e.target.value)}
                  onKeyDown={blockNonNumericKeys}
                  onPaste={e => handleAmountPaste(e, setFilterAmountMax)}
                  data-testid="filter-amount-max"
                  placeholder="Sin límite"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>}

      {!loading && !pageError && transactions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">{hasActiveFilters ? '🔍' : '💰'}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {hasActiveFilters ? 'Sin resultados' : 'No hay ingresos registrados'}
          </h3>
          <p className="text-gray-500 mb-4">
            {hasActiveFilters
              ? 'No se encontraron ingresos con los filtros aplicados. Intenta ajustar o limpiar los filtros.'
              : 'Comienza registrando el primer ingreso del CPP'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Limpiar filtros
            </button>
          ) : (
            <button
              onClick={() => { setShowModal(true); setFormErrors({}); setFormSubmitted(false); setError(''); setForm({ amount: '', category_id: '', description: '', date: new Date().toISOString().split('T')[0], payer_name: '', payer_rut: '' }); }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Registrar primer ingreso
            </button>
          )}
        </div>
      )}

      {/* Mobile card view - visible on small screens */}
      {!loading && transactions.length > 0 && (
        <div className="md:hidden space-y-3" data-testid="mobile-income-cards">
          {/* Mobile sort controls */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Ordenar:</span>
            <button onClick={() => handleSort('date')} className={`px-2 py-1 rounded ${sortBy === 'date' ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-gray-100 text-gray-600'}`} data-testid="sort-fecha">
              Fecha {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button onClick={() => handleSort('amount')} className={`px-2 py-1 rounded ${sortBy === 'amount' ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-gray-100 text-gray-600'}`} data-testid="mobile-sort-monto">
              Monto {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          {transactions.map(tx => (
            <div key={tx.id} className="bg-white rounded-xl border border-gray-200 p-4" data-testid={`mobile-card-${tx.id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{tx.description || 'Sin descripción'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tx.category_name || 'Sin categoría'}</p>
                </div>
                <span className="text-sm font-semibold text-green-600 whitespace-nowrap">{formatCLP(tx.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>{formatDate(tx.date)}</span>
                  {tx.payer_name && <span className="truncate max-w-[120px]">{tx.payer_name}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEditModal(tx)}
                    className="text-primary-600 hover:text-primary-800 font-medium"
                    title="Editar ingreso"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(tx)}
                    className="text-red-500 hover:text-red-700 font-medium"
                    title="Eliminar ingreso"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop table view - hidden on small screens */}
      {!loading && transactions.length > 0 && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap" onClick={() => handleSort('date')} data-testid="sort-fecha">
                  Fecha<SortArrow column="date" />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap" onClick={() => handleSort('description')} data-testid="sort-descripcion">
                  Descripción<SortArrow column="description" />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Categoría</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Pagador</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap" onClick={() => handleSort('amount')} data-testid="sort-monto">
                  Monto<SortArrow column="amount" />
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{tx.description || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{tx.category_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{tx.payer_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium text-right whitespace-nowrap">{formatCLP(tx.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => openEditModal(tx)}
                        className="text-primary-600 hover:text-primary-800 transition-colors text-sm font-medium"
                        title="Editar ingreso"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(tx)}
                        className="text-red-500 hover:text-red-700 transition-colors text-sm font-medium"
                        title="Eliminar ingreso"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !pageError && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2" data-testid="pagination">
          <p className="text-sm text-gray-500">
            Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalRecords)} de {totalRecords} registros
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              data-testid="pagination-prev"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                data-testid={`pagination-page-${page}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-primary-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              data-testid="pagination-next"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - always rendered regardless of loading */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirmar eliminación</h2>
              <p className="text-gray-600 text-sm mb-1">
                ¿Estás seguro de eliminar este ingreso?
              </p>
              <p className="text-gray-800 font-medium text-sm mb-4">
                {deleteConfirm.description || 'Sin descripción'} — {formatCLP(deleteConfirm.amount)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? <><Spinner size={16} className="inline mr-1.5" />Eliminando...</> : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Editar Ingreso</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Cerrar">✕</button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{editError}</div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editForm.amount}
                  onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  onKeyDown={blockNonNumericKeys}
                  onPaste={e => handleAmountPaste(e, v => setEditForm(f => ({ ...f, amount: v })))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="50000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={editForm.category_id}
                  onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Cuota mensual marzo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={editForm.date}
                  onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del pagador</label>
                <input
                  type="text"
                  value={editForm.payer_name}
                  onChange={e => setEditForm({ ...editForm, payer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RUT del pagador</label>
                <input
                  type="text"
                  value={editForm.payer_rut}
                  onChange={e => setEditForm({ ...editForm, payer_rut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="12.345.678-9"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {editSaving ? <><Spinner size={16} className="inline mr-1.5" />Guardando...</> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Registrar Ingreso</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Cerrar">✕</button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (CLP) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={e => { setForm({ ...form, amount: e.target.value }); if (formErrors.amount) setFormErrors(prev => ({ ...prev, amount: '' })); }}
                  onKeyDown={blockNonNumericKeys}
                  onPaste={e => handleAmountPaste(e, v => { setForm(f => ({ ...f, amount: v })); if (formErrors.amount) setFormErrors(prev => ({ ...prev, amount: '' })); })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${formErrors.amount ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="50000"
                  data-testid="income-amount"
                />
                {formErrors.amount && (
                  <p className="mt-1 text-sm text-red-600" data-testid="income-amount-error">{formErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select
                  value={form.category_id}
                  onChange={e => { setForm({ ...form, category_id: e.target.value }); if (formErrors.category_id) setFormErrors(prev => ({ ...prev, category_id: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${formErrors.category_id ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid="income-category"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {formErrors.category_id && (
                  <p className="mt-1 text-sm text-red-600" data-testid="income-category-error">{formErrors.category_id}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Cuota mensual marzo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => { setForm({ ...form, date: e.target.value }); if (formErrors.date) setFormErrors(prev => ({ ...prev, date: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${formErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid="income-date"
                />
                {formErrors.date && (
                  <p className="mt-1 text-sm text-red-600" data-testid="income-date-error">{formErrors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del pagador</label>
                <input
                  type="text"
                  value={form.payer_name}
                  onChange={e => setForm({ ...form, payer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RUT del pagador</label>
                <input
                  type="text"
                  value={form.payer_rut}
                  onChange={e => { setForm({ ...form, payer_rut: e.target.value }); if (formErrors.payer_rut) setFormErrors(prev => ({ ...prev, payer_rut: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${formErrors.payer_rut ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="12.345.678-9"
                  data-testid="income-rut"
                />
                {formErrors.payer_rut && (
                  <p className="mt-1 text-sm text-red-600" data-testid="income-rut-error">{formErrors.payer_rut}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <><Spinner size={16} className="inline mr-1.5" />Guardando...</> : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
