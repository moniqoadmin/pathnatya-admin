export function openFinalData(taskId: string) {
  const href = `/club-data/${encodeURIComponent(taskId)}/final`
  const opened = window.open(href, '_blank')
  if (opened) {
    opened.opener = null
    return
  }
  window.location.assign(href)
}
