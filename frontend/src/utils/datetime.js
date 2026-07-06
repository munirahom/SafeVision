function hasExplicitTimezone(value) {
  return /[zZ]$|[+-]\d{2}:\d{2}$/.test(value)
}

function normalizeApiDateString(value) {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed || hasExplicitTimezone(trimmed)) return trimmed
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}Z`
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return `${trimmed}Z`
  }

  return trimmed
}

export function parseApiDate(value) {
  if (!value) return null

  const normalized = normalizeApiDateString(value)
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value, options = {}) {
  const date = parseApiDate(value)
  if (!date) return '-'

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  })
}

export function formatDate(value, options = {}) {
  const date = parseApiDate(value)
  if (!date) return '-'

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function timeAgo(value) {
  const date = parseApiDate(value)
  if (!date) return '-'

  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}
