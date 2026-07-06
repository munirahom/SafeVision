import { useState, useEffect } from 'react'
import { api } from '../api'
import { formatDateTime } from '../utils/datetime'

const ACTION_COLORS = {
  Login: 'badge-supervisor',
  'User Created': 'badge-admin',
  'Violation Detected': 'badge-high',
  'Violation Updated': 'badge-pending',
  'Settings Changed': 'badge-reviewed',
  'Health Check': 'badge-approved',
  'User Updated': 'badge-supervisor',
  'User Deleted': 'badge-high',
  'Access Request Reviewed': 'badge-pending',
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterAction, setFilterAction] = useState('')

  useEffect(() => {
    api.listAuditLogs()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function exportCSV() {
    try {
      await api.downloadFile('/reports/export/audit', 'audit_log_report.csv')
    } catch (e) {
      alert(e.message)
    }
  }

  const filtered = logs.filter(l => {
    const match = [l.user_email, l.action_type, l.description].some(
      s => s?.toLowerCase().includes(search.toLowerCase())
    )
    const roleOk = !filterRole || l.role === filterRole
    const actOk = !filterAction || l.action_type === filterAction
    return match && roleOk && actOk
  })

  const actionTypes = [...new Set(logs.map(l => l.action_type))]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-subtitle">System activity and user actions</p>
      </div>

      <div className="page-actions">
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 140 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="system">System</option>
          </select>
          <select className="form-select" style={{ width: 200 }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">All Actions</option>
            {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Log ID</th><th>User</th><th>Role</th><th>Action Type</th><th>Description</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No logs found</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id}>
                  <td>#{l.id}</td>
                  <td className="td-primary">{l.user_email}</td>
                  <td><span className={`badge badge-${l.role}`}>{l.role}</span></td>
                  <td>
                    <span className={`badge ${ACTION_COLORS[l.action_type] || 'badge-supervisor'}`}>
                      {l.action_type}
                    </span>
                  </td>
                  <td style={{ maxWidth: 320, color: 'var(--text-secondary)' }}>
                    {l.description.length > 80 ? l.description.slice(0, 80) + '…' : l.description}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                    {formatDateTime(l.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
