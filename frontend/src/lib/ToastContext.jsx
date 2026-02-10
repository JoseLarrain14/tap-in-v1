import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);

  // Keep ref in sync for use in callbacks
  toastsRef.current = toasts;

  const addToast = useCallback(({ message, type = 'success', duration = 4000, testId }) => {
    const id = ++toastIdCounter;
    const toast = { id, message, type, duration, testId };
    setToasts(prev => {
      // Limit max concurrent toasts to 5 to prevent overflow
      const next = [...prev, toast];
      if (next.length > 5) {
        return next.slice(next.length - 5);
      }
      return next;
    });
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Expose addToast for E2E testing
  useEffect(() => {
    window.__addToast = addToast;
    return () => { delete window.__addToast; };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
