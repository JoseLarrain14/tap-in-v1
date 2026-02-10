/**
 * Shared formatting utilities for Tap In V1
 * CLP currency and es-CL date formatting
 */

/**
 * Format amount as Chilean Peso (CLP) currency
 * Uses Intl.NumberFormat with es-CL locale
 * Output: $1.500.000 (no decimals, dots as thousands separator)
 */
export function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Format amount as abbreviated CLP for charts
 * Output: $1,5M / $150K / $500
 */
export function formatChartCLP(value) {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
  return '$' + value;
}

/**
 * Format a date string to Chilean locale (dd-mm-yyyy)
 * @param {string} dateStr - ISO date string or YYYY-MM-DD
 * @param {object} options - Override toLocaleDateString options
 * @returns {string} Formatted date
 */
export function formatDate(dateStr, options) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-CL', options || {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a datetime string with time component
 * Output: 09-02-2026 14:30
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Block non-numeric keys on amount inputs.
 * Allows: digits 0-9, Backspace, Delete, Tab, Enter, Arrow keys, Home, End, Ctrl/Cmd+A/C/V/X
 * Blocks: letters (e, E, etc.), special chars (+, -, .), and others
 * Use as onKeyDown handler on <input type="number">
 */
export function blockNonNumericKeys(e) {
  // Allow control keys
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End',
  ];
  if (allowed.includes(e.key)) return;
  // Allow Ctrl/Cmd + A/C/V/X
  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
  // Allow only digits
  if (/^\d$/.test(e.key)) return;
  // Block everything else (letters like e/E, +, -, ., etc.)
  e.preventDefault();
}

/**
 * onPaste handler for amount inputs - strips non-numeric characters.
 * Use together with blockNonNumericKeys for full protection.
 * @param {ClipboardEvent} e
 * @param {function} setter - State setter function that receives the cleaned numeric string
 */
export function handleAmountPaste(e, setter) {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  const cleaned = pasted.replace(/\D/g, '');
  if (cleaned && setter) {
    setter(cleaned);
  }
}

/**
 * Relative time formatting (Hace X min, Hace X h, etc.)
 * Falls back to locale date for older dates
 */
export function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs} h`;
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
