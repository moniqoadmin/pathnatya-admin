interface PagerProps {
  page: number
  totalPages: number
  total: number
  limit: number
  loading: boolean
  onPage: (page: number) => void
}

export default function Pager({ page, totalPages, total, limit, loading, onPage }: PagerProps) {
  const safeLimit = Math.max(limit, 1)
  const from = total === 0 ? 0 : (page - 1) * safeLimit + 1
  const to = Math.min(page * safeLimit, total)

  return (
    <div className="users-pagination">
      <p className="users-pagination-meta">
        {loading
          ? 'Loading...'
          : `Showing ${from.toLocaleString()}-${to.toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      <div className="users-pagination-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span className="users-page-indicator">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
