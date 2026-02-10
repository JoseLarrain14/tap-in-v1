import { useToast } from '../lib/ToastContext';
import Toast from './Toast';

/**
 * ToastContainer renders all active toasts in a fixed position,
 * stacked vertically without overlapping.
 *
 * Place this once in your app layout (e.g., inside Layout or App).
 */
export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'hidden' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
            testId={toast.testId || `toast-${toast.id}`}
          />
        </div>
      ))}
    </div>
  );
}
