import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to add keyboard accessibility to modals.
 * Returns a ref to attach to the modal content panel, and an onKeyDown handler for the backdrop.
 *
 * Features:
 * - Escape key closes the modal
 * - Focus is trapped within the modal (Tab/Shift+Tab cycle)
 * - Focus moves into the modal on open
 * - Focus returns to the trigger element when closed
 *
 * Usage:
 *   const { modalRef, handleKeyDown } = useModalAccessibility(isOpen, onClose);
 *   <div onKeyDown={handleKeyDown}>
 *     <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1}>
 *       ...modal content...
 *     </div>
 *   </div>
 */
export function useModalAccessibility(isOpen, onClose) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Save focus on open, restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;

      // Delay focus to allow modal to render
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusable = getFocusableElements(modalRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // Restore focus when modal closes
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        const el = previousFocusRef.current;
        requestAnimationFrame(() => {
          if (el && typeof el.focus === 'function') {
            el.focus();
          }
        });
      }
    }
  }, [isOpen]);

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
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  return { modalRef, handleKeyDown };
}

function getFocusableElements(container) {
  const elements = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]'
  );
  return Array.from(elements).filter(el => {
    return el.offsetParent !== null && !el.hasAttribute('aria-hidden');
  });
}
