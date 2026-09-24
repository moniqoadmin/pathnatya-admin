import { apiFetch, apiFetchBlob } from './client'

export const EXCEL_MERGE_MAX_FILES = 100
export const EXCEL_MERGE_MAX_BYTES = 20 * 1024 * 1024
export const EXCEL_MERGE_ACCEPT =
  '.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const EXCEL_DATA_TYPES = [
  'string',
  'number',
  'integer',
  'phone',
  'date',
  'boolean',
] as const

export type ExcelDataType = (typeof EXCEL_DATA_TYPES)[number]

export const EXCEL_FILE_STATUSES = [
  'uploaded',
  'analyzed',
  'mapping_confirmed',
  'processing',
  'processed',
  'failed',
] as const

export type ExcelFileStatus = (typeof EXCEL_FILE_STATUSES)[number]

export type ExcelCellValue = string | number | boolean | null

export interface ExcelMergeColumnInput {
  label: string
  dataType: ExcelDataType
  required: boolean
}

export interface ExcelMergeColumn {
  id: string
  key: string
  label: string
  dataType: ExcelDataType
  required: boolean
  sortOrder: number
}

export interface ExcelMergeTaskSummary {
  id: string
  name: string
  description: string | null
  createdBy: string
  frozenHeaders: string[]
  schemaFrozen: boolean
  columnCount: number
  fileCount: number
  validCount: number
  pendingErrorCount: number
  createdAt: string
  updatedAt: string
}

export interface ExcelMergeTask extends ExcelMergeTaskSummary {
  columns: ExcelMergeColumn[]
  columnMappings: Record<string, unknown>
}

export interface ExcelMergePage<T> {
  data: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ExcelAnalysisColumn {
  index: number
  header: string
  sampleValues: string[]
  inferredType: string
  emptyCount: number
  filledCount: number
}

export interface ExcelAnalysisSheet {
  name: string
  headerRow: number
  columnCount: number
  dataRowCount: number
  emptyRowCount: number
  isLikelyDataSheet: boolean
}

export interface ExcelSuggestedMapping {
  sourceHeader: string
  sourceIndex: number
  action: 'map' | 'ignore' | 'unmapped' | 'create'
  columnKey?: string | null
  columnLabel?: string | null
  reason?: 'saved' | 'name_match' | 'unmapped' | string
}

export interface ExcelMergeFileSummary {
  id: string
  taskId: string
  fileName: string
  fileSize: number
  status: ExcelFileStatus
  selectedSheet: string | null
  headerRow: number | null
  totalRows: number
  validCount: number
  errorCount: number
  failureMessage: string | null
  uploadedBy: string
  processedAt: string | null
  columnCount: number
  sheetNames: string[]
  createdAt: string
  updatedAt: string
}

export interface ExcelMergeFileDetail extends ExcelMergeFileSummary {
  analysis?: {
    sheets?: ExcelAnalysisSheet[]
    selectedSheet?: string
    headerRow?: number
    columns?: ExcelAnalysisColumn[]
  } | null
  suggestedMappings?: ExcelSuggestedMapping[]
  review?: unknown
}

export interface ExcelMergeDataColumn {
  key: string
  label: string
  dataType: ExcelDataType
}

export interface ExcelMergeDataRow {
  id: string
  fileId: string
  fileName: string
  sourceRowNumber: number
  values: Record<string, ExcelCellValue>
  originalValues: Record<string, ExcelCellValue>
  createdAt: string
}

export interface ExcelMergeDataPage {
  columns: ExcelMergeDataColumn[]
  data: ExcelMergeDataRow[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ExcelMergeErrorField {
  columnKey: string
  label: string
  dataType: ExcelDataType
  required: boolean
  currentValue: ExcelCellValue
  originalValue: ExcelCellValue
  valid: boolean
  message: string | null
}

export interface ExcelMergeErrorRow {
  id: string
  fileId: string
  fileName: string
  sourceRowNumber: number
  status: 'pending' | 'resolved' | string
  originalValues: Record<string, ExcelCellValue>
  fields: ExcelMergeErrorField[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export interface ExcelMergeErrorUpdate {
  approved: boolean
  remainingProblems: unknown[]
  row: ExcelMergeErrorRow
}

export interface ExcelMergeMappingEntry {
  sourceHeader: string
  action: 'map' | 'ignore' | 'create'
  columnKey?: string
}

export interface ConfirmExcelMergeMappingPayload {
  sheetName: string
  headerRow: number
  process: boolean
  mappings: ExcelMergeMappingEntry[]
}

export interface CreateExcelMergeTaskPayload {
  name: string
  description?: string
  columns?: ExcelMergeColumnInput[]
}

export interface PatchExcelMergeColumnPayload {
  label?: string
  dataType?: ExcelDataType
  required?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function asNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function asPage<T>(body: unknown, fallbackLimit: number): ExcelMergePage<T> {
  if (Array.isArray(body)) {
    return {
      data: body as T[],
      page: 1,
      limit: body.length || fallbackLimit,
      total: body.length,
      totalPages: 1,
    }
  }

  const record = asRecord(body)
  const data = Array.isArray(record?.data) ? (record.data as T[]) : []
  const limit = asNumber(record?.limit, fallbackLimit)
  const total = asNumber(record?.total, data.length)
  const totalPages = Math.max(1, asNumber(record?.totalPages, Math.ceil(total / Math.max(limit, 1)) || 1))

  return {
    data,
    page: asNumber(record?.page, 1),
    limit,
    total,
    totalPages,
  }
}

function asTask(body: unknown): ExcelMergeTask {
  const record = asRecord(body)
  const source = (asRecord(record?.task) ?? asRecord(record?.data) ?? record ?? {}) as unknown as ExcelMergeTask
  return {
    ...source,
    description: source.description ?? null,
    frozenHeaders: Array.isArray(source.frozenHeaders) ? source.frozenHeaders : [],
    columns: Array.isArray(source.columns) ? source.columns : [],
    columnMappings:
      source.columnMappings && typeof source.columnMappings === 'object' ? source.columnMappings : {},
    schemaFrozen: Boolean(source.schemaFrozen),
    columnCount: asNumber(source.columnCount, source.columns?.length ?? 0),
    fileCount: asNumber(source.fileCount, 0),
    validCount: asNumber(source.validCount, 0),
    pendingErrorCount: asNumber(source.pendingErrorCount, 0),
  }
}

function asFile(body: unknown): ExcelMergeFileDetail {
  const record = asRecord(body)
  const source = (asRecord(record?.file) ?? record ?? {}) as unknown as ExcelMergeFileDetail
  if (typeof source.fileName === 'string' || typeof source.status === 'string') {
    return {
      ...source,
      sheetNames: Array.isArray(source.sheetNames) ? source.sheetNames : [],
      failureMessage: source.failureMessage ?? null,
      suggestedMappings: source.suggestedMappings ?? [],
    }
  }

  const nested = asRecord(record?.data)
  if (nested && (typeof nested.fileName === 'string' || typeof nested.status === 'string')) {
    return asFile(nested)
  }

  return source
}

function asUpload(body: unknown): { files: ExcelMergeFileDetail[] } {
  if (Array.isArray(body)) {
    return { files: body.map((item) => asFile(item)) }
  }
  const record = asRecord(body)
  const files = Array.isArray(record?.files) ? record.files : []
  return { files: files.map((item) => asFile(item)) }
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue
    }
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function listExcelMergeTasks(
  page: number,
  limit: number,
  authToken: string,
): Promise<ExcelMergePage<ExcelMergeTaskSummary>> {
  return apiFetch<unknown>(`/excel-merge/tasks${query({ page, limit })}`, { authToken }).then((body) =>
    asPage<ExcelMergeTaskSummary>(body, limit),
  )
}

export function createExcelMergeTask(
  payload: CreateExcelMergeTaskPayload,
  authToken: string,
): Promise<ExcelMergeTask> {
  return apiFetch<unknown>('/excel-merge/tasks', {
    method: 'POST',
    authToken,
    json: payload,
  }).then(asTask)
}

export function getExcelMergeTask(taskId: string, authToken: string): Promise<ExcelMergeTask> {
  return apiFetch<unknown>(`/excel-merge/tasks/${encodeURIComponent(taskId)}`, { authToken }).then(asTask)
}

export function updateExcelMergeTask(
  taskId: string,
  payload: { name: string; description: string | null },
  authToken: string,
): Promise<ExcelMergeTask> {
  return apiFetch<unknown>(`/excel-merge/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    authToken,
    json: payload,
  }).then(asTask)
}

export function deleteExcelMergeTask(taskId: string, authToken: string): Promise<void> {
  return apiFetch(`/excel-merge/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    authToken,
  })
}

export function addExcelMergeColumns(
  taskId: string,
  columns: ExcelMergeColumnInput[],
  authToken: string,
): Promise<void> {
  return apiFetch(`/excel-merge/tasks/${encodeURIComponent(taskId)}/columns`, {
    method: 'POST',
    authToken,
    json: { columns },
  })
}

export function updateExcelMergeColumn(
  taskId: string,
  columnId: string,
  payload: PatchExcelMergeColumnPayload,
  authToken: string,
): Promise<void> {
  return apiFetch(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/columns/${encodeURIComponent(columnId)}`,
    {
      method: 'PATCH',
      authToken,
      json: payload,
    },
  )
}

export function deleteExcelMergeColumn(
  taskId: string,
  columnId: string,
  authToken: string,
): Promise<void> {
  return apiFetch(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/columns/${encodeURIComponent(columnId)}`,
    {
      method: 'DELETE',
      authToken,
    },
  )
}

export function uploadExcelMergeFiles(
  taskId: string,
  files: File[],
  authToken: string,
): Promise<{ files: ExcelMergeFileDetail[] }> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  return apiFetch<unknown>(`/excel-merge/tasks/${encodeURIComponent(taskId)}/files`, {
    method: 'POST',
    authToken,
    body: formData,
  }).then(asUpload)
}

export function listExcelMergeFiles(
  taskId: string,
  page: number,
  limit: number,
  authToken: string,
  status?: ExcelFileStatus | '',
): Promise<ExcelMergePage<ExcelMergeFileSummary>> {
  return apiFetch<unknown>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/files${query({
      page,
      limit,
      status: status || undefined,
    })}`,
    { authToken },
  ).then((body) => asPage<ExcelMergeFileSummary>(body, limit))
}

export function getExcelMergeFile(
  taskId: string,
  fileId: string,
  authToken: string,
): Promise<ExcelMergeFileDetail> {
  return apiFetch<unknown>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}`,
    { authToken },
  ).then(asFile)
}

export function confirmExcelMergeMapping(
  taskId: string,
  fileId: string,
  payload: ConfirmExcelMergeMappingPayload,
  authToken: string,
): Promise<ExcelMergeFileDetail> {
  return apiFetch<unknown>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}/mapping`,
    {
      method: 'PUT',
      authToken,
      json: payload,
    },
  ).then(asFile)
}

export function processExcelMergeFile(
  taskId: string,
  fileId: string,
  authToken: string,
): Promise<ExcelMergeFileDetail> {
  return apiFetch<unknown>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}/process`,
    {
      method: 'POST',
      authToken,
    },
  ).then(asFile)
}

export function listExcelMergeData(
  taskId: string,
  page: number,
  limit: number,
  authToken: string,
  fileId?: string,
): Promise<ExcelMergeDataPage> {
  return apiFetch<unknown>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/data${query({
      page,
      limit,
      fileId: fileId || undefined,
    })}`,
    { authToken },
  ).then((body) => {
    const record = asRecord(body)
    const pageBody = asPage<ExcelMergeDataRow>(body, limit)
    const columns = Array.isArray(record?.columns) ? (record.columns as ExcelMergeDataColumn[]) : []
    return { ...pageBody, columns }
  })
}

export function listExcelMergeErrors(
  taskId: string,
  page: number,
  limit: number,
  authToken: string,
  status: 'pending' | 'resolved',
  fileId?: string,
): Promise<ExcelMergePage<ExcelMergeErrorRow>> {
  return apiFetch<unknown>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/errors${query({
      page,
      limit,
      status,
      fileId: fileId || undefined,
    })}`,
    { authToken },
  ).then((body) => asPage<ExcelMergeErrorRow>(body, limit))
}

export function updateExcelMergeError(
  taskId: string,
  errorId: string,
  payload: { values: Record<string, ExcelCellValue>; approve: boolean },
  authToken: string,
): Promise<ExcelMergeErrorUpdate> {
  return apiFetch<ExcelMergeErrorUpdate>(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/errors/${encodeURIComponent(errorId)}`,
    {
      method: 'PATCH',
      authToken,
      json: payload,
    },
  )
}

export async function downloadExcelMergeExport(taskId: string, authToken: string): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/export`,
    { authToken },
    'club-data.xlsx',
  )
  saveBlob(blob, filename)
}

export async function downloadExcelMergeErrors(taskId: string, authToken: string): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/excel-merge/tasks/${encodeURIComponent(taskId)}/export/errors`,
    { authToken },
    'club-data-errors.xlsx',
  )
  saveBlob(blob, filename)
}
