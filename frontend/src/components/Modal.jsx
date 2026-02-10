import { useEffect, useRef, useCallback } from 'react';

/**
 * Accessible modal wrapper component.
 *
 * Features:
 * - Focus traps inside the modal (Tab/Shift+Tab cycle through focusable elements)
 * - Escape key closes the modal
 * - Focus moves into the modal on open
 * - Focus returns to the trigger element on close
 * - role="dialog" and aria-modal="true" for screen readers
 * - Click outside (backdrop) closes the modal
 *
 * Props:
 * - isOpen: boolean - Whether the modal is visible
 * - onClose: () => void - Called when modal should close
 * - title: string - Modal title (used for aria-labelledby)
 * - children: ReactNode - Modal content
 * - className: string - Additional class for the inner modal panel
 * - backdropClassName: string - Additional class for the backdrop
 * - zIndex: string - Custom z-index class (default: 'z-50')
 * - testId: string - Optional data-testid
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  backdropClassName = '',
  zIndex = 'z-50',
  testId,
}) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = `modal-title-${title ? title.replace(/\s+/g, '-').toLowerCase() : 'dialog'}`;

  // Save focus on open, restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;

      // Delay focus to ensure modal is rendered
      requestAnimationFrame(() => {
        if (modalRef.current) {
          // Try to focus the first focusable element inside the modal
          const focusable = getFocusableElements(modalRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      });
    } else {
      // Restore focus when modal closes
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          if (previousFocusRef.current) {
            previousFocusRef.current.focus();
          }
        });
      }
    }
  }, [isOpen]);

  // Handle Escape key and Tab trapping
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'Tab' && modalRef.current) {
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center ${zIndex} p-4 ${backdropClassName}`}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      data-testid={testId}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

// Expose the title ID generation for consumers who want to use aria-labelledby
Modal.getTitleId = (title) => `modal-title-${title ? title.replace(/\s+/g, '-').toLowerCase() : 'dialog'}`;

function getFocusableElements(container) {
  const elements = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]'
  );
  return Array.from(elements).filter(el => {
    // Filter out hidden elements
    return el.offsetParent !== null && !el.hasAttribute('aria-hidden');
  });
}
