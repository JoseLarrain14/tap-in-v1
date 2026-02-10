import { useState, useEffect, useCallback } from 'react';

/**
 * Toast notification component with auto-dismiss.
 *
 * Props:
 * - message: string - The message to display
 * - type: 'success' | 'error' | 'warning' | 'info' - Style variant
 * - duration: number - Auto-dismiss after ms (default 4000). Set to 0 to disable.
 * - onClose: () => void - Called when toast is dismissed
 * - testId: string - Optional data-testid attribute
 */
export default function Toast({ message, type = 'success', duration = 4000, onClose, testId }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 300); // match CSS transition duration
  }, [onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(dismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, dismiss]);

  if (!visible) return null;

  const styles = {
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: (
        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: (
        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      icon: (
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: (
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const style = styles[type] || styles.success;

  return (
    <div
      data-testid={testId || 'toast-notification'}
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-sm transition-all duration-300 ${style.bg} ${style.text} ${
        exiting ? 'opacity-0 translate-y-[-8px]' : 'opacity-100 translate-y-0'
      }`}
    >
      {style.icon}
      <span className="flex-1">{message}</span>
      <button
        onClick={dismiss}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity text-lg leading-none ml-2"
        aria-label="Cerrar"
      >
        &times;
      </button>
    </div>
  );
}
