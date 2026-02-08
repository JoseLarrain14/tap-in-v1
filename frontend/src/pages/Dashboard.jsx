import { useAuth } from '../lib/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Bienvenido, {user?.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Saldo Actual</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">$0</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Ingresos del Mes</p>
          <p className="text-2xl font-bold text-green-600 mt-1">$0</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Egresos del Mes</p>
          <p className="text-2xl font-bold text-red-600 mt-1">$0</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Pendientes de Aprobación</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">0</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Información del Usuario</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">Nombre:</span> {user?.name}</p>
          <p><span className="font-medium">Correo:</span> {user?.email}</p>
          <p><span className="font-medium">Rol:</span> {user?.role}</p>
          <p><span className="font-medium">Organización:</span> {user?.organization_name}</p>
        </div>
      </div>
    </div>
  );
}
