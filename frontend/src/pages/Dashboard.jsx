import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

function formatChartCLP(value) {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
  return '$' + value;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    loadChartData();
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

  async function loadChartData() {
    try {
      setChartLoading(true);
      const data = await api.get('/dashboard/chart');
      setChartData(data.months || []);
    } catch (err) {
      console.error('Error loading chart data:', err);
    } finally {
      setChartLoading(false);
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

      {/* 6-Month Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="monthly-chart">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Flujo Mensual (6 meses)</h2>
        {chartLoading ? (
          <div className="text-center py-12 text-gray-400">Cargando gr&aacute;fico...</div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={formatChartCLP}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                width={70}
              />
              <Tooltip
                formatter={(value) => formatCLP(value)}
                labelStyle={{ fontWeight: 600, color: '#111827' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '13px' }}
              />
              <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-400">No hay datos para mostrar</div>
        )}
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
