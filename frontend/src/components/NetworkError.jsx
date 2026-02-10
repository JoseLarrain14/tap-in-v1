/**
 * NetworkError component - Shows a friendly, non-technical error message
 * when the API server is unreachable. Includes a retry button and
 * auto-retry countdown.
 */
import { useState, useEffect, useRef } from 'react';

export default function NetworkError({ message, onRetry, className = '' }) {
  const [countdown, setCountdown] = useState(10);
  const [retrying, setRetrying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Auto-retry countdown
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleRetry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await onRetry();
    } catch (e) {
      // If retry fails, restart countdown
      setRetrying(false);
      setCountdown(10);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleRetry();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  const displayMessage = message || 'No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.';

  return (
    <div className={`bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-8 text-center ${className}`} data-testid="network-error">
      <div className="text-5xl mb-4">🔌</div>
      <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-2">
        Sin conexión al servidor
      </h3>
      <p className="text-orange-600 dark:text-orange-400 text-sm mb-1" data-testid="network-error-message">
        {displayMessage}
      </p>
      <p className="text-orange-500 dark:text-orange-500 text-xs mb-4">
        Esto puede ocurrir si el servidor está temporalmente fuera de servicio o si hay problemas de red.
      </p>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleRetry}
          disabled={retrying}
          data-testid="network-error-retry"
          className="px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {retrying ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Reintentando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Reintentar ahora
            </>
          )}
        </button>
        {!retrying && countdown > 0 && (
          <p className="text-xs text-orange-400 dark:text-orange-500" data-testid="network-error-countdown">
            Reintentando automáticamente en {countdown}s...
          </p>
        )}
      </div>
    </div>
  );
}
