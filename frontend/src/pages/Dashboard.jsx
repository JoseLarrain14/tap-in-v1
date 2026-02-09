import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../lib/ThemeContext';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton';
import NetworkError from '../components/NetworkError';

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
  const { isDark } = useTheme();
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);

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
      setLoadError(err.message || 'Error al cargar el dashboard');
      setIsNetworkError(!!err.isNetworkError);
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

  // Chart colors for dark mode
  const chartGridColor = isDark ? '#374151' : '#f0f0f0';
  const chartAxisColor = isDark ? '#4b5563' : '#e5e7eb';
  const chartTickColor = isDark ? '#9ca3af' : '#6b7280';
  const tooltipBg = isDark ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb';
  const tooltipLabelColor = isDark ? '#f9fafb' : '#111827';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Bienvenido, {user?.name}
        </p>
      </div>

      {/* Error Display */}
      {loadError && isNetworkError && (
        <NetworkError
          message={loadError}
          onRetry={async () => { setLoadError(null); setIsNetworkError(false); await loadDashboard(); await loadChartData(); }}
        />
      )}
      {loadError && !isNetworkError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-1">Error al cargar datos</h3>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{loadError}</p>
          <button
            onClick={() => { setLoadError(null); loadDashboard(); loadChartData(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Actual</p>
          {loading ? (
            <div className="mt-1">
              <SkeletonLine width="w-32" height="h-7" className="mb-2" />
              <SkeletonLine width="w-48" height="h-3" />
            </div>
          ) : (
            <>
              <p className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}`}>
                {formatCLP(balance)}
              </p>
              {summary && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Ingresos: {formatCLP(summary.income_total)} &minus; Egresos: {formatCLP(summary.expense_total)}
                </p>
              )}
            </>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Ingresos del Mes</p>
          {loading ? (
            <div className="mt-1">
              <SkeletonLine width="w-28" height="h-7" className="mb-2" />
              <SkeletonLine width="w-36" height="h-3" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCLP(monthIncome)}
              </p>
              <p className={`text-xs mt-1 ${incomeDelta.color}`}>{incomeDelta.text}</p>
            </>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Egresos del Mes</p>
          {loading ? (
            <div className="mt-1">
              <SkeletonLine width="w-28" height="h-7" className="mb-2" />
              <SkeletonLine width="w-36" height="h-3" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCLP(monthExpense)}
              </p>
              <p className={`text-xs mt-1 ${expenseDelta.color}`}>{expenseDelta.text}</p>
            </>
          )}
        </div>
      </div>

      {/* Pending Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6" data-testid="pending-approval-card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes de Aprobaci&oacute;n</p>
          {loading ? (
            <div className="mt-1">
              <SkeletonLine width="w-12" height="h-7" className="mb-2" />
              <SkeletonLine width="w-48" height="h-3" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1" data-testid="pending-approval-count">
                {pendingApproval}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Solicitudes esperando aprobaci&oacute;n</p>
            </>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6" data-testid="pending-execution-card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes de Ejecuci&oacute;n</p>
          {loading ? (
            <div className="mt-1">
              <SkeletonLine width="w-12" height="h-7" className="mb-2" />
              <SkeletonLine width="w-48" height="h-3" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1" data-testid="pending-execution-count">
                {pendingExecution}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Aprobadas, esperando ejecuci&oacute;n</p>
            </>
          )}
        </div>
      </div>

      {/* 6-Month Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6" data-testid="monthly-chart">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Flujo Mensual (6 meses)</h2>
        {chartLoading ? (
          <div className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg h-80" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: chartTickColor }}
                axisLine={{ stroke: chartAxisColor }}
              />
              <YAxis
                tickFormatter={formatChartCLP}
                tick={{ fontSize: 12, fill: chartTickColor }}
                axisLine={{ stroke: chartAxisColor }}
                width={70}
              />
              <Tooltip
                formatter={(value) => formatCLP(value)}
                labelStyle={{ fontWeight: 600, color: tooltipLabelColor }}
                contentStyle={{ borderRadius: '8px', border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, color: tooltipLabelColor }}
              />
              <Legend
                wrapperStyle={{ fontSize: '13px', color: chartTickColor }}
              />
              <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">No hay datos para mostrar</div>
        )}
      </div>

      {/* Getting Started - shown when no data exists */}
      {!loading && summary && balance === 0 && monthIncome === 0 && monthExpense === 0 && pendingApproval === 0 && pendingExecution === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">¡Bienvenido a Tap In!</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Tu CPP aún no tiene movimientos registrados. Comienza registrando ingresos o creando solicitudes de pago.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="/ingresos"
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Registrar primer ingreso
            </a>
            <a
              href="/solicitudes"
              className="px-4 py-2 bg-black dark:bg-white dark:text-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              Crear primera solicitud
            </a>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Informaci&oacute;n del Usuario</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p><span className="font-medium">Nombre:</span> {user?.name}</p>
          <p><span className="font-medium">Correo:</span> {user?.email}</p>
          <p><span className="font-medium">Rol:</span> {user?.role}</p>
          <p><span className="font-medium">Organizaci&oacute;n:</span> {user?.organization_name}</p>
        </div>
      </div>
    </div>
  );
}
