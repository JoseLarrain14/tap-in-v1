import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import * as XLSX from 'xlsx';
import { formatCLP, formatDate, formatDateTime } from '../lib/formatters';

export default function Reportes() {
  const { user } = useAuth();
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [exportingIngresos, setExportingIngresos] = useState(false);
  const [exportingSolicitudes, setExportingSolicitudes] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const data = await api.get('/categories');
      setCategories(data.categories || data || []);
    } catch (err) {
      // Optional
    }
  }

  async function exportIngresos() {
    try {
      setExportingIngresos(true);
      const { from: validFrom, to: validTo } = getValidDates();
      const params = new URLSearchParams();
      params.set('type', 'ingreso');
      params.set('sort_by', 'date');
      params.set('sort_order', 'desc');
      params.set('limit', '10000');
      if (validFrom) params.set('from', validFrom);
      if (validTo) params.set('to', validTo);
      if (filterCategory) params.set('category_id', filterCategory);

      const res = await api.get(`/transactions?${params.toString()}`);
      const data = res.transactions || [];

      if (data.length === 0) {
        alert('No hay ingresos para exportar con los filtros seleccionados.');
        return;
      }

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

      let filename = 'reporte_ingresos';
      if (filterFrom) filename += `_desde_${filterFrom}`;
      if (filterTo) filename += `_hasta_${filterTo}`;
      filename += '.xlsx';

      XLSX.writeFile(wb, filename);
    } catch (err) {
      alert('Error al exportar: ' + (err.message || 'Error'));
    } finally {
      setExportingIngresos(false);
    }
  }

  async function exportSolicitudes() {
    try {
      setExportingSolicitudes(true);
      const { from: validFrom, to: validTo } = getValidDates();
      const params = new URLSearchParams();
      params.set('sort_by', 'created_at');
      params.set('sort_order', 'desc');
      params.set('limit', '10000');
      if (validFrom) params.set('from', validFrom);
      if (validTo) params.set('to', validTo);
      if (filterCategory) params.set('category_id', filterCategory);

      const data = await api.get(`/payment-requests?${params.toString()}`);
      const reqs = data.payment_requests || [];

      if (reqs.length === 0) {
        alert('No hay solicitudes para exportar con los filtros seleccionados.');
        return;
      }

      const STATUS_LABELS = {
        borrador: 'Borrador',
        pendiente: 'Pendiente',
        aprobado: 'Aprobado',
        rechazado: 'Rechazado',
        ejecutado: 'Ejecutado',
      };

      const rows = reqs.map(req => ({
        'ID': req.id,
        'Descripcion': req.description || '',
        'Beneficiario': req.beneficiary || '',
        'Categoria': req.category_name || 'Sin categoria',
        'Monto (CLP)': req.amount,
        'Monto Formateado': formatCLP(req.amount),
        'Estado': STATUS_LABELS[req.status] || req.status,
        'Creado por': req.created_by_name || '',
        'Fecha creacion': formatDateTime(req.created_at),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');

      let filename = 'reporte_solicitudes';
      if (filterFrom) filename += `_desde_${filterFrom}`;
      if (filterTo) filename += `_hasta_${filterTo}`;
      filename += '.xlsx';

      XLSX.writeFile(wb, filename);
    } catch (err) {
      alert('Error al exportar: ' + (err.message || 'Error'));
    } finally {
      setExportingSolicitudes(false);
    }
  }

  async function exportAll() {
    try {
      setExportingAll(true);
      const { from: validFrom, to: validTo } = getValidDates();
      // Fetch both ingresos and solicitudes
      const ingresoParams = new URLSearchParams();
      ingresoParams.set('type', 'ingreso');
      ingresoParams.set('sort_by', 'date');
      ingresoParams.set('sort_order', 'desc');
      ingresoParams.set('limit', '10000');
      if (validFrom) ingresoParams.set('from', validFrom);
      if (validTo) ingresoParams.set('to', validTo);
      if (filterCategory) ingresoParams.set('category_id', filterCategory);

      const solParams = new URLSearchParams();
      solParams.set('sort_by', 'created_at');
      solParams.set('sort_order', 'desc');
      solParams.set('limit', '10000');
      if (validFrom) solParams.set('from', validFrom);
      if (validTo) solParams.set('to', validTo);
      if (filterCategory) solParams.set('category_id', filterCategory);

      const [ingresoRes, solRes] = await Promise.all([
        api.get(`/transactions?${ingresoParams.toString()}`),
        api.get(`/payment-requests?${solParams.toString()}`),
      ]);

      const ingresos = ingresoRes.transactions || [];
      const solicitudes = solRes.payment_requests || [];

      if (ingresos.length === 0 && solicitudes.length === 0) {
        alert('No hay datos para exportar con los filtros seleccionados.');
        return;
      }

      const STATUS_LABELS = {
        borrador: 'Borrador',
        pendiente: 'Pendiente',
        aprobado: 'Aprobado',
        rechazado: 'Rechazado',
        ejecutado: 'Ejecutado',
      };

      const wb = XLSX.utils.book_new();

      if (ingresos.length > 0) {
        const ingRows = ingresos.map(tx => ({
          'Fecha': formatDate(tx.date),
          'Descripcion': tx.description || '',
          'Categoria': tx.category_name || 'Sin categoria',
          'Pagador': tx.payer_name || '',
          'RUT Pagador': tx.payer_rut || '',
          'Monto (CLP)': tx.amount,
          'Monto Formateado': formatCLP(tx.amount),
          'Registrado por': tx.created_by_name || '',
        }));
        const ws = XLSX.utils.json_to_sheet(ingRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');
      }

      if (solicitudes.length > 0) {
        const solRows = solicitudes.map(req => ({
          'ID': req.id,
          'Descripcion': req.description || '',
          'Beneficiario': req.beneficiary || '',
          'Categoria': req.category_name || 'Sin categoria',
          'Monto (CLP)': req.amount,
          'Monto Formateado': formatCLP(req.amount),
          'Estado': STATUS_LABELS[req.status] || req.status,
          'Creado por': req.created_by_name || '',
          'Fecha creacion': formatDateTime(req.created_at),
        }));
        const ws = XLSX.utils.json_to_sheet(solRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes');
      }

      let filename = 'reporte_completo';
      if (filterFrom) filename += `_desde_${filterFrom}`;
      if (filterTo) filename += `_hasta_${filterTo}`;
      filename += '.xlsx';

      XLSX.writeFile(wb, filename);
    } catch (err) {
      alert('Error al exportar: ' + (err.message || 'Error'));
    } finally {
      setExportingAll(false);
    }
  }

  const hasFilters = filterFrom || filterTo || filterCategory;
  const isDateRangeInverted = filterFrom && filterTo && filterFrom > filterTo;
  const [dateRangeWarning, setDateRangeWarning] = useState('');
  const ingresoCategories = categories.filter(c => c.type === 'ingreso');
  const egresoCategories = categories.filter(c => c.type === 'egreso');

  // Auto-correct inverted dates before any export
  function getValidDates() {
    if (filterFrom && filterTo && filterFrom > filterTo) {
      const correctedFrom = filterTo;
      const correctedTo = filterFrom;
      setFilterFrom(correctedFrom);
      setFilterTo(correctedTo);
      setDateRangeWarning('Las fechas fueron invertidas automaticamente (Desde era posterior a Hasta).');
      setTimeout(() => setDateRangeWarning(''), 5000);
      return { from: correctedFrom, to: correctedTo };
    }
    setDateRangeWarning('');
    return { from: filterFrom, to: filterTo };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 mt-1">Reportes financieros y exportacion de datos</p>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="report-filters">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Filtros de exportacion</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={filterFrom}
              onChange={e => { setFilterFrom(e.target.value); setDateRangeWarning(''); }}
              data-testid="report-filter-from"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${isDateRangeInverted ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={filterTo}
              onChange={e => { setFilterTo(e.target.value); setDateRangeWarning(''); }}
              data-testid="report-filter-to"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${isDateRangeInverted ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              data-testid="report-filter-category"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Todas las categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type === 'ingreso' ? 'Ingreso' : 'Egreso'})</option>
              ))}
            </select>
          </div>
        </div>
        {isDateRangeInverted && (
          <p className="mt-3 text-xs text-amber-600 font-medium" data-testid="date-range-warning">
            ⚠ La fecha "Desde" es posterior a "Hasta". Se corregira automaticamente al exportar.
          </p>
        )}
        {dateRangeWarning && (
          <p className="mt-2 text-xs text-amber-600 font-medium" data-testid="date-range-corrected">
            ✓ {dateRangeWarning}
          </p>
        )}
        {hasFilters && (
          <button
            onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterCategory(''); setDateRangeWarning(''); }}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium min-h-[44px] inline-flex items-center"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Export Ingresos */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-3xl mb-3">💰</div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Ingresos</h3>
          <p className="text-sm text-gray-500 mb-4">Exportar registro de ingresos a Excel</p>
          <button
            onClick={exportIngresos}
            disabled={exportingIngresos}
            data-testid="export-ingresos-report"
            className="px-4 py-2.5 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exportingIngresos ? 'Exportando...' : 'Exportar Ingresos'}
          </button>
        </div>

        {/* Export Solicitudes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-3xl mb-3">📋</div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Solicitudes</h3>
          <p className="text-sm text-gray-500 mb-4">Exportar solicitudes de pago a Excel</p>
          <button
            onClick={exportSolicitudes}
            disabled={exportingSolicitudes}
            data-testid="export-solicitudes-report"
            className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exportingSolicitudes ? 'Exportando...' : 'Exportar Solicitudes'}
          </button>
        </div>

        {/* Export All */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Reporte Completo</h3>
          <p className="text-sm text-gray-500 mb-4">Exportar ingresos y solicitudes en un archivo</p>
          <button
            onClick={exportAll}
            disabled={exportingAll}
            data-testid="export-all-report"
            className="px-4 py-2.5 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exportingAll ? 'Exportando...' : 'Exportar Todo'}
          </button>
        </div>
      </div>
    </div>
  );
}
