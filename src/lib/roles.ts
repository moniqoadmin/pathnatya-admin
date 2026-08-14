export type AppRole = 'user' | 'admin' | 'superadmin' | 'developer'

export type NavItemId =
  | 'dashboard'
  | 'creation'
  | 'list-users'
  | 'report-issue'
  | 'list-issues'

export interface NavItem {
  id: NavItemId
  label: string
  path: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'creation', label: 'Creation', path: '/creation' },
  { id: 'list-users', label: 'List Users', path: '/users' },
  { id: 'report-issue', label: 'Report Issue', path: '/report-issue' },
  { id: 'list-issues', label: 'List Issues', path: '/issues' },
]

const ROLE_NAV: Record<Exclude<AppRole, 'user'>, NavItemId[]> = {
  admin: ['dashboard', 'list-users', 'report-issue'],
  superadmin: ['dashboard', 'creation', 'list-users', 'report-issue', 'list-issues'],
  developer: ['dashboard', 'creation', 'list-users', 'report-issue', 'list-issues'],
}

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) {
    return null
  }

  const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, '')

  if (normalized === 'user') {
    return 'user'
  }
  if (normalized === 'admin') {
    return 'admin'
  }
  if (normalized === 'superadmin') {
    return 'superadmin'
  }
  if (normalized === 'developer') {
    return 'developer'
  }

  return null
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'admin' || normalized === 'superadmin' || normalized === 'developer'
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'superadmin'
}

export function canEditPrivilegedAccountFields(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'superadmin' || normalized === 'developer'
}

export function getNavItemsForRole(role: string | null | undefined): NavItem[] {
  const normalized = normalizeRole(role)
  if (!normalized || normalized === 'user') {
    return []
  }

  const allowed = new Set(ROLE_NAV[normalized])
  return NAV_ITEMS.filter((item) => allowed.has(item.id))
}

export function canAccessPath(role: string | null | undefined, path: string): boolean {
  return getNavItemsForRole(role).some(
    (item) => path === item.path || path.startsWith(`${item.path}/`),
  )
}
