import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { SkeletonTable } from '../components/Skeleton';
import Spinner from '../components/Spinner';
import NetworkError from '../components/NetworkError';

const ROLE_LABELS = {
  delegado: 'Delegado',
  presidente: 'Presidente',
  secretaria: 'Secretaria',
};

const ROLE_COLORS = {
  delegado: 'bg-blue-100 text-blue-800',
  presidente: 'bg-purple-100 text-purple-800',
  secretaria: 'bg-teal-100 text-teal-800',
};

const TYPE_LABELS = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
};

const TYPE_COLORS = {
  ingreso: 'bg-green-100 text-green-800',
  egreso: 'bg-red-100 text-red-800',
};

export default function Configuracion() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('usuarios');

  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'ingreso' });
  const [categoryError, setCategoryError] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [categoryDeleteError, setCategoryDeleteError] = useState('');

  // Invite form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'delegado',
  });

  const isPresidente = user?.role === 'presidente';

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await api.get('/users');
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
      setIsNetworkError(!!err.isNetworkError);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      setCategoriesLoading(true);
      const data = await api.get('/categories');
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message);
      setIsNetworkError(!!err.isNetworkError);
    } finally {
      setCategoriesLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadCategories();
  }, []);

  async function handleInvite(e) {
    e.preventDefault();
    try {
      setActionLoading(true);
      const result = await api.post('/users/invite', inviteForm);
      setFeedback({ type: 'success', message: result.message || 'Usuario invitado exitosamente' });
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'delegado' });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeactivate(userId) {
    try {
      setActionLoading(true);
      const result = await api.put(`/users/${userId}/deactivate`);
      setFeedback({ type: 'success', message: result.message || 'Usuario desactivado' });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleActivate(userId) {
    try {
      setActionLoading(true);
      const result = await api.put(`/users/${userId}/activate`);
      setFeedback({ type: 'success', message: result.message || 'Usuario activado' });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      setActionLoading(true);
      const result = await api.put(`/users/${userId}/role`, { role: newRole });
      setFeedback({ type: 'success', message: `Rol actualizado a ${ROLE_LABELS[newRole]} exitosamente` });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryForm({ name: '', type: 'ingreso' });
    setCategoryError('');
    setShowCategoryModal(true);
  }

  function openEditCategory(cat) {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, type: cat.type });
    setCategoryError('');
    setShowCategoryModal(true);
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    setCategoryError('');
    setCategorySaving(true);
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, categoryForm);
        setFeedback({ type: 'success', message: 'Categor\u00eda actualizada exitosamente' });
      } else {
        await api.post('/categories', categoryForm);
        setFeedback({ type: 'success', message: 'Categor\u00eda creada exitosamente' });
      }
      setShowCategoryModal(false);
      loadCategories();
    } catch (err) {
      setCategoryError(err.message || 'Error al guardar categor\u00eda');
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleDeleteCategory(cat) {
    setCategoryDeleteError('');
    setDeletingCategory(cat.id);
    try {
      await api.delete(`/categories/${cat.id}`);
      setFeedback({ type: 'success', message: `Categor\u00eda "${cat.name}" eliminada exitosamente` });
      setDeletingCategory(null);
      loadCategories();
    } catch (err) {
      setCategoryDeleteError(err.message || 'Error al eliminar categor\u00eda');
      setDeletingCategory(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuraci&oacute;n</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona tu organizaci&oacute;n y usuarios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'usuarios'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab('categorias')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'categorias'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Categor&iacute;as
        </button>
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

      {/* Users Tab */}
      {activeTab === 'usuarios' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Usuarios del CPP</h2>
            {isPresidente && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                + Invitar Usuario
              </button>
            )}
          </div>

          {loading && (
            <SkeletonTable rows={4} columns={isPresidente ? 5 : 4} />
          )}

          {error && (
            <div className="text-center py-12 text-red-500">{error}</div>
          )}

          {!loading && users.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rol</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                    {isPresidente && (
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      {isPresidente && (
                        <td className="px-4 py-3 text-right">
                          {u.id !== user.id && (
                            <div className="flex items-center gap-2 justify-end">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={actionLoading}
                                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none disabled:opacity-50"
                              >
                                <option value="delegado">Delegado</option>
                                <option value="presidente">Presidente</option>
                                <option value="secretaria">Secretaria</option>
                              </select>
                              {u.is_active ? (
                                <button
                                  onClick={() => handleDeactivate(u.id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                                >
                                  Desactivar
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleActivate(u.id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                                >
                                  Activar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categorias' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Categor&iacute;as de Ingreso y Egreso</h2>
            {isPresidente && (
              <button
                onClick={openCreateCategory}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                + Nueva Categor&iacute;a
              </button>
            )}
          </div>

          {categoryDeleteError && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              {categoryDeleteError}
              <button
                onClick={() => setCategoryDeleteError('')}
                className="float-right text-lg leading-none opacity-50 hover:opacity-100"
              >
                &times;
              </button>
            </div>
          )}

          {categoriesLoading && (
            <SkeletonTable rows={4} columns={isPresidente ? 3 : 2} />
          )}

          {!categoriesLoading && categories.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">🏷️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No hay categor&iacute;as</h3>
              <p className="text-gray-500 mb-4">Crea la primera categor&iacute;a para organizar ingresos y egresos</p>
            </div>
          )}

          {!categoriesLoading && categories.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    {isPresidente && (
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[cat.type]}`}>
                          {TYPE_LABELS[cat.type]}
                        </span>
                      </td>
                      {isPresidente && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => openEditCategory(cat)}
                              className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              disabled={deletingCategory === cat.id}
                              className="px-2.5 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                            >
                              {deletingCategory === cat.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Category Create/Edit Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCategory ? 'Editar Categor\u00eda' : 'Nueva Categor\u00eda'}
            </h2>

            {categoryError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{categoryError}</div>
            )}

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="Nombre de la categor&iacute;a"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={categorySaving}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {categorySaving ? <><Spinner size={14} className="inline mr-1" />Guardando...</> : (editingCategory ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invitar Usuario</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="Juan P&#233;rez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="usuario@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                >
                  <option value="delegado">Delegado</option>
                  <option value="presidente">Presidente</option>
                  <option value="secretaria">Secretaria</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <><Spinner size={14} className="inline mr-1" />Invitando...</> : 'Invitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
