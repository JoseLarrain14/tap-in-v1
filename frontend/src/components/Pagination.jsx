/**
 * Client-side pagination controls: "Mostrando X–Y de Z" + Anterior / Siguiente.
 * Optional: page size selector (e.g. 10, 25, 50).
 */
export default function Pagination({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  pageSizeOptions = [10, 25, 50],
  onPageSizeChange,
  labelItems = 'registros',
  'data-testid': dataTestId = 'pagination',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.max(1, Math.min(currentPage, totalPages));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  if (totalItems === 0) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3" data-testid={dataTestId}>
        <p className="text-sm text-gray-500">Mostrando 0 de 0 {labelItems}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3" data-testid={dataTestId}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-500">
          Mostrando {from}–{to} de {totalItems} {labelItems}
        </p>
        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span>Filas:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
              data-testid="pagination-page-size"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="pagination-prev"
          aria-label="Página anterior"
        >
          ← Anterior
        </button>
        <span className="text-sm text-gray-500 px-2">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="pagination-next"
          aria-label="Página siguiente"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
