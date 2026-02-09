import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateFields = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'El correo electrónico es requerido';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errors.email = 'Ingrese un correo electrónico válido';
    }
    if (!password) {
      errors.password = 'La contraseña es requerida';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-700 dark:text-primary-400">Tap In</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Gesti&oacute;n financiera para tu CPP</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Correo electr&oacute;nico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' })); }}
                placeholder="tu@correo.cl"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 ${fieldErrors.email ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400" data-testid="email-error">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contrase&ntilde;a
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' })); }}
                placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 ${fieldErrors.password ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400" data-testid="password-error">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <><Spinner size={16} className="inline mr-1.5" />Ingresando...</> : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
