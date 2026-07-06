const BASE = '/api'

function getToken() {
  return localStorage.getItem('sv_token')
}

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function request(method, path, body, isForm = false) {
  const headers = isForm
    ? { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }
    : authHeaders()

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('sv_token')
    localStorage.removeItem('sv_user')
    window.location.href = '/'
  }

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text()

  if (!res.ok) {
    throw new Error(data?.detail || data || 'Request failed')
  }
  return data
}

async function download(path, filename) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  })

  if (res.status === 401) {
    localStorage.removeItem('sv_token')
    localStorage.removeItem('sv_user')
    window.location.href = '/'
    return
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    const errorBody = contentType.includes('application/json')
      ? await res.json()
      : await res.text()
    throw new Error(errorBody?.detail || errorBody || 'Download failed')
  }

  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const api = {
  // Auth
  login: (payload) => request('POST', '/auth/login', payload),
  me: () => request('GET', '/auth/me'),
  updateMe: (payload) => request('PUT', '/auth/me', payload),
  changePassword: (payload) => request('PUT', '/auth/me/password', payload),
  updateNotifications: (payload) => request('PUT', '/auth/me/notifications', payload),
  requestAccess: (payload) => request('POST', '/auth/request-access', payload),
  resetPasswordRequest: (payload) => request('POST', '/auth/reset-password/request', payload),
  resetPasswordConfirm: (payload) => request('POST', '/auth/reset-password/confirm', payload),

  // Dashboard
  dashboardStats: () => request('GET', '/dashboard/stats'),
  weatherCurrent: (location) => request('GET', `/weather/current?location=${encodeURIComponent(location)}`),

  // Users
  listUsers: () => request('GET', '/users/'),
  createUser: (payload) => request('POST', '/users/', payload),
  updateUser: (id, payload) => request('PUT', `/users/${id}`, payload),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  listAccessRequests: () => request('GET', '/users/access-requests'),
  reviewAccessRequest: (id, payload) => request('PUT', `/users/access-requests/${id}`, payload),

  // Violations
  listViolations: () => request('GET', '/violations/'),
  reviewViolation: (id, payload) => request('PUT', `/violations/${id}/review`, payload),
  deleteViolation: (id) => request('DELETE', `/violations/${id}`),

  // Audit
  listAuditLogs: () => request('GET', '/audit/'),

  // Reports
  reportSummary: () => request('GET', '/reports/summary'),
  downloadFile: (path, filename) => download(path, filename),

  // Detection
  detectImage: (formData, conf=0.25, iou=0.45) => request('POST', `/detect/image?conf=${conf}&iou=${iou}`, formData, true),
  uploadVideo: (formData, conf=0.25, iou=0.45) => request('POST', `/detect/video/upload?conf=${conf}&iou=${iou}`, formData, true),

  // Health
  health: () => request('GET', '/health'),
}

export function getOutputUrl(filename) {
  return `/outputs/${filename}`
}

export function createVideoWebSocket(taskId) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${window.location.host}/api/detect/video/${taskId}`)
}

export function createCameraWebSocket(conf = 0.25, iou = 0.45) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${window.location.host}/api/detect/camera/live?conf=${conf}&iou=${iou}`)
}
