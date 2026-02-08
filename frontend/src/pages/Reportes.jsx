import { useAuth } from '../lib/AuthContext';

export default function Reportes() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 mt-1">Reportes financieros y exportación de datos</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Reportes financieros</h3>
        <p className="text-gray-500 mb-4">Genera y exporta reportes del CPP en formato Excel</p>
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Generar Reporte
        </button>
      </div>
    </div>
  );
}
