import type { BulkUploadError } from '../api/accounts'

const ERROR_CSV_HEADERS = [
  'row',
  'sn',
  'country',
  'sanghat',
  'jilha',
  'taluka',
  'group',
  'kendra',
  'sanchalakName',
  'phoneNumber',
  'error',
] as const

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function bulkErrorsToCsv(errors: BulkUploadError[]): string {
  const rows = errors.map((item) =>
    ERROR_CSV_HEADERS.map((header) => csvCell(item[header])).join(','),
  )
  return [ERROR_CSV_HEADERS.join(','), ...rows].join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadBulkErrorsCsv(errors: BulkUploadError[]): void {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(`bulk-upload-errors-${stamp}.csv`, bulkErrorsToCsv(errors))
}
