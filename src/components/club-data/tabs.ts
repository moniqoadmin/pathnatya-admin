export type ClubTab = 'files' | 'mapping' | 'data' | 'errors'

export function parseClubTab(value: string | null): ClubTab {
  if (value === 'mapping' || value === 'data' || value === 'errors' || value === 'files') {
    return value
  }
  return 'files'
}
