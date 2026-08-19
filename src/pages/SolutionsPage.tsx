import { useMemo, useState } from 'react'
import { SOLUTIONS } from '../data/solutions'

export default function SolutionsPage() {
  const [search, setSearch] = useState('')

  const solutions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return SOLUTIONS
    }

    return SOLUTIONS.filter((solution) => {
      const haystack = [solution.title, ...solution.steps].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [search])

  return (
    <div className="page-panel solutions-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Help</p>
          <h1>Solutions</h1>
          <p className="page-subtitle">Common fixes and steps for Pathnatya accounts and teams.</p>
        </div>
      </div>

      <div className="users-toolbar">
        <label className="users-search" htmlFor="solutions-search">
          <span className="users-search-label">Search</span>
          <input
            id="solutions-search"
            type="search"
            placeholder="Search solutions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {solutions.length === 0 ? (
        <p className="teams-empty">
          {SOLUTIONS.length === 0
            ? 'Common solutions will appear here.'
            : 'No solutions match that search.'}
        </p>
      ) : (
        <div className="solutions-list">
          {solutions.map((solution) => (
            <details key={solution.id} className="solution-card">
              <summary>{solution.title}</summary>
              <ol className="solution-steps">
                {solution.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
