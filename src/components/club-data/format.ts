import type { ExcelCellValue, ExcelDataType, ExcelFileStatus, ExcelMergeColumn } from '../../api/excel-merge'
import type { ApiError } from '../../api/client'

export const DATA_TYPE_LABELS: Record<ExcelDataType, string> = {
  string: 'Text',
  number: 'Number',
  integer: 'Whole number',
  phone: 'Phone',
  date: 'Date',
  boolean: 'Yes / no',
}

const FILE_STATUS_LABELS: Record<ExcelFileStatus, string> = {
  uploaded: 'Uploaded',
  analyzed: 'Ready to map',
  mapping_confirmed: 'Ready to process',
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError
  if (apiError?.status === 413) {
    return 'Each Excel file must be 20 MB or smaller.'
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  return fallback
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) {
    return '—'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCell(value: unknown): string {
  if (value == null || value === '') {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value)
}

export function valueToInput(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

export function coerceCellValue(dataType: ExcelDataType, raw: string): ExcelCellValue {
  const trimmed = raw.trim()
  if (dataType === 'boolean') {
    if (trimmed === 'true') {
      return true
    }
    if (trimmed === 'false') {
      return false
    }
    return null
  }
  if (!trimmed) {
    return null
  }
  if (dataType === 'integer') {
    return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed
  }
  if (dataType === 'number') {
    const number = Number(trimmed)
    return Number.isFinite(number) ? number : trimmed
  }
  return trimmed
}

export function sortedColumns(columns: ExcelMergeColumn[]): ExcelMergeColumn[] {
  return [...columns].sort((left, right) => {
    const order = (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
    return order || left.label.localeCompare(right.label)
  })
}

export function fileStatusLabel(status: string): string {
  if (status in FILE_STATUS_LABELS) {
    return FILE_STATUS_LABELS[status as ExcelFileStatus]
  }
  return status
}

export function statusPillClass(status: string): string {
  if (status === 'processed' || status === 'resolved') {
    return 'status-completed'
  }
  if (status === 'analyzed') {
    return 'status-active'
  }
  if (status === 'failed') {
    return 'status-failed'
  }
  if (status === 'processing' || status === 'uploaded' || status === 'pending') {
    return 'status-processing'
  }
  if (status === 'mapping_confirmed') {
    return 'status-queued'
  }
  return ''
}

export function problemTexts(problems: unknown[] | undefined): string[] {
  if (!problems || problems.length === 0) {
    return []
  }
  return problems
    .map((problem) => {
      if (typeof problem === 'string') {
        return problem.trim()
      }
      if (problem && typeof problem === 'object' && 'message' in problem) {
        const message = (problem as { message: unknown }).message
        return typeof message === 'string' ? message.trim() : ''
      }
      return ''
    })
    .filter(Boolean)
}

export function reviewLines(review: unknown): string[] {
  if (!review) {
    return []
  }
  if (typeof review === 'string') {
    return review.trim() ? [review.trim()] : []
  }
  if (!Array.isArray(review)) {
    return []
  }
  return review
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (!item || typeof item !== 'object') {
        return ''
      }
      const record = item as Record<string, unknown>
      if (typeof record.text === 'string' && record.text.trim()) {
        return record.text.trim()
      }
      const source = record.source ?? record.from ?? record.header
      const target = record.target ?? record.to ?? record.label
      if (typeof source === 'string' || typeof target === 'string') {
        return `${String(source ?? '')} → ${String(target ?? '')}`.trim()
      }
      return ''
    })
    .filter(Boolean)
}

export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}
