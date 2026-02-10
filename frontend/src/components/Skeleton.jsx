/**
 * Skeleton loading components for displaying placeholder UI while data loads.
 * Provides smooth pulse animations without layout shift.
 */

export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${width} ${height} ${className}`} />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <SkeletonLine width="w-24" height="h-3" className="mb-3" />
      <SkeletonLine width="w-32" height="h-7" className="mb-2" />
      <SkeletonLine width="w-40" height="h-3" />
    </div>
  );
}

export function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <SkeletonLine width={i === 0 ? 'w-20' : i === columns - 1 ? 'w-16' : 'w-24'} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, columns = 5, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex px-6 py-3 gap-6">
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonLine key={i} width="w-16" height="h-3" />
          ))}
        </div>
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div>
        <SkeletonLine width="w-32" height="h-7" className="mb-2" />
        <SkeletonLine width="w-48" height="h-4" />
      </div>

      {/* Financial cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Pending counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Chart area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <SkeletonLine width="w-48" height="h-5" className="mb-4" />
        <div className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg h-80" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <SkeletonLine width="w-32" height="h-7" className="mb-2" />
          <SkeletonLine width="w-48" height="h-4" />
        </div>
        <div className="flex gap-3">
          <SkeletonLine width="w-28" height="h-10" />
          <SkeletonLine width="w-36" height="h-10" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <SkeletonLine width="w-48" height="h-9" />
          <SkeletonLine width="w-36" height="h-9" />
          <SkeletonLine width="w-20" height="h-9" />
          <SkeletonLine width="w-20" height="h-9" />
        </div>
      </div>

      {/* Table skeleton */}
      <SkeletonTable rows={rows} columns={6} />
    </div>
  );
}

export function SkeletonKanban() {
  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 kanban-scroll">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="flex-shrink-0 w-[75vw] sm:w-48 md:w-52 lg:w-64 rounded-xl border border-gray-200 dark:border-gray-700 border-t-4 border-t-gray-300 bg-white dark:bg-gray-800 kanban-column">
          <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
            <div className="flex items-center justify-between">
              <SkeletonLine width="w-24" height="h-4" />
              <SkeletonLine width="w-6" height="h-5" className="rounded-full" />
            </div>
          </div>
          <div className="p-2 space-y-2">
            {Array.from({ length: colIdx === 0 ? 2 : colIdx === 1 ? 3 : 1 }).map((_, cardIdx) => (
              <div key={cardIdx} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between mb-1.5">
                  <SkeletonLine width="w-8" height="h-3" />
                  <SkeletonLine width="w-16" height="h-3" />
                </div>
                <SkeletonLine width="w-full" height="h-4" className="mb-1" />
                <SkeletonLine width="w-20" height="h-3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
