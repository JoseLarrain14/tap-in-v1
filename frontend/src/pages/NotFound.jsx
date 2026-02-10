import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mb-6">
          <span className="text-8xl font-bold text-primary-600 dark:text-primary-400">404</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          P&aacute;gina no encontrada
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          La p&aacute;gina que buscas no existe o ha sido movida. Verifica la URL e intenta de nuevo.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
