import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount || 0);
}

function getDeltaText(current, previous) {
  if (!previous || previous === 0) {
    if (current > 0) return { text: 'Nuevo este mes', color: 'text-gray-500' };
    return { text: 'Sin movimientos', color: 'text-gray-400' };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (diff > 0) return { text: `+${pct}% vs mes anterior`, color: 'text-green-600' };
  if (diff < 0) return { text: `${pct}% vs mes anterior`, color: 'text-red-600' };
  return { text: 'Sin cambio vs mes anterior', color: 'text-gray-500' };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await api.get('/dashboard/summary');
      setSummary(data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const balance = summary?.balance ?? 0;
  const monthIncome = summary?.month_income ?? 0;
  const monthExpense = summary?.month_expense ?? 0;
  const prevMonthIncome = summary?.prev_month_income ?? 0;
  const prevMonthExpense = summary?.prev_month_expense ?? 0;
  const pendingApproval = summary?.pending_approval ?? 0;
  const pendingExecution = summary?.pending_execution ?? 0;

  const incomeDelta = getDeltaText(monthIncome, prevMonthIncome);
  const expenseDelta = getDeltaText(monthExpense, prevMonthExpense);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Bienvenido, {user?.name}
        </p>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Saldo Actual</p>
          <p className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {loading ? '...' : formatCLP(balance)}
          </p>
          {!loading && summary && (
            <p className="text-xs text-gray-400 mt-1">
              Ingresos: {formatCLP(summary.income_total)} &minus; Egresos: {formatCLP(summary.expense_total)}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Ingresos del Mes</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {loading ? '...' : formatCLP(monthIncome)}
          </p>
          {!loading && (
            <p className={`text-xs mt-1 ${incomeDelta.color}`}>{incomeDelta.text}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Egresos del Mes</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {loading ? '...' : formatCLP(monthExpense)}
          </p>
          {!loading && (
            <p className={`text-xs mt-1 ${expenseDelta.color}`}>{expenseDelta.text}</p>
          )}
        </div>
      </div>

      {/* Pending Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="pending-approval-card">
          <p className="text-sm text-gray-500">Pendientes de Aprobaci&oacute;n</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1" data-testid="pending-approval-count">
            {loading ? '...' : pendingApproval}
          </p>
          {!loading && (
            <p className="text-xs text-gray-400 mt-1">Solicitudes esperando aprobaci&oacute;n</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="pending-execution-card">
          <p className="text-sm text-gray-500">Pendientes de Ejecuci&oacute;n</p>
          <p className="text-2xl font-bold text-blue-600 mt-1" data-testid="pending-execution-count">
            {loading ? '...' : pendingExecution}
          </p>
          {!loading && (
            <p className="text-xs text-gray-400 mt-1">Aprobadas, esperando ejecuci&oacute;n</p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Informaci&oacute;n del Usuario</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">Nombre:</span> {user?.name}</p>
          <p><span className="font-medium">Correo:</span> {user?.email}</p>
          <p><span className="font-medium">Rol:</span> {user?.role}</p>
          <p><span className="font-medium">Organizaci&oacute;n:</span> {user?.organization_name}</p>
        </div>
      </div>
    </div>
  );
}
