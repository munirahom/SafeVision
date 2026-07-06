import { useState, useEffect } from 'react'
import { api, getOutputUrl } from '../api'
import { formatDateTime } from '../utils/datetime'

export default function Violations() {
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setViolations(await api.listViolations())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleReview(id, status) {
    try {
      await api.reviewViolation(id, { status })
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this violation record?')) return

    try {
      await api.deleteViolation(id)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const filtered = violations.filter(v => {
    const miss = JSON.parse(v.missing_ppe || '[]').join(' ')
    const match = [v.filename, miss].some(s => s.toLowerCase().includes(search.toLowerCase()))
    const sevOk = !filterSeverity || v.severity === filterSeverity
    const statOk = !filterStatus || v.status === filterStatus
    return match && sevOk && statOk
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Violations</h1>
        <p className="page-subtitle">All detected PPE compliance violations</p>
      </div>

      <div className="page-actions">
        <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <div className="search-box">
            <span className="search-icon">SR</span>
            <input placeholder="Search violations..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 140 }} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
            <option value="">All Severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="form-select" style={{ width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} violations</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>File</th><th>Type</th><th>Missing PPE</th><th>Severity</th>
                <th>Detected</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No violations found</td></tr>
              ) : filtered.map(v => {
                const missing = JSON.parse(v.missing_ppe || '[]')
                return (
                  <tr key={v.id}>
                    <td>#{v.id}</td>
                    <td className="td-primary" style={{ maxWidth: 160 }}>
                      <span title={v.filename} style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                        {v.filename}
                      </span>
                    </td>
                    <td><span className={`badge badge-${v.media_type}`}>{v.media_type}</span></td>
                    <td>
                      {missing.length === 0 ? (
                        <span style={{ color: 'var(--success)' }}>None</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {missing.map(m => <span key={m} className="badge badge-high" style={{ fontSize: 10 }}>{m}</span>)}
                        </div>
                      )}
                    </td>
                    <td><span className={`badge badge-${v.severity}`}>{v.severity}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(v.timestamp)}</td>
                    <td><span className={`badge badge-${v.status}`}>{v.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(v)}>View</button>
                        {v.status === 'pending' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleReview(v.id, 'reviewed')}>
                            Review
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>x</button>
            <h2 className="modal-title">Violation #{selected.id}</h2>
            <p className="modal-subtitle">{selected.filename}</p>

            {selected.output_path ? (
              selected.media_type === 'image' ? (
                <img
                  src={getOutputUrl(selected.output_path)}
                  alt="Annotated"
                  style={{ width: '100%', borderRadius: 8, marginBottom: 16 }}
                />
              ) : (
                <video
                  src={getOutputUrl(selected.output_path)}
                  controls
                  style={{ width: '100%', borderRadius: 8, marginBottom: 16 }}
                />
              )
            ) : (
              <div className="alert" style={{ marginBottom: 16 }}>
                No annotated preview is available for this violation record.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge badge-${selected.severity}`}>{selected.severity}</span>
                <span className={`badge badge-${selected.status}`}>{selected.status}</span>
                <span className={`badge badge-${selected.media_type}`}>{selected.media_type}</span>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>MISSING PPE</p>
                {JSON.parse(selected.missing_ppe || '[]').length === 0
                  ? <span style={{ color: 'var(--success)' }}>None</span>
                  : JSON.parse(selected.missing_ppe || '[]').map(m => (
                    <span key={m} className="badge badge-high" style={{ marginRight: 6 }}>Missing {m}</span>
                  ))}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Detected: {formatDateTime(selected.timestamp)}
              </p>
            </div>

            <div className="modal-actions">
              {selected.output_path && (
                <a href={getOutputUrl(selected.output_path)} download className="btn btn-secondary">
                  Download
                </a>
              )}
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
