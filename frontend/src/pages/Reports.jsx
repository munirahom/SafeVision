import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { api } from '../api'

export default function Reports() {
  const user = JSON.parse(localStorage.getItem('sv_user') || '{}')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.reportSummary().then(setSummary).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function exportFile(path, filename) {
    try {
      await api.downloadFile(path, filename)
    } catch (e) {
      alert(e.message)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  const maxPpe = Math.max(...(summary?.ppe_breakdown || []).map(d => d.count), 1)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Analytics and violation summaries</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderTop: '3px solid var(--danger)' }}>
          <div className="stat-card-label">Total Violations</div>
          <div className="stat-card-value">{summary?.total_violations ?? 0}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--warning)' }}>
          <div className="stat-card-label">Pending Review</div>
          <div className="stat-card-value">{summary?.pending ?? 0}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--success)' }}>
          <div className="stat-card-label">Reviewed</div>
          <div className="stat-card-value">{summary?.reviewed ?? 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Monthly Violation Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={summary?.monthly_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6 }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#f5c842' }}
              />
              <Line type="monotone" dataKey="count" stroke="#f5c842" strokeWidth={2} dot={{ fill: '#f5c842', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Missing PPE Breakdown</h3>
          {(summary?.ppe_breakdown || []).length === 0 ? (
            <div className="empty-state"><p>No violation data yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {summary.ppe_breakdown.map((d, i) => (
                <div key={d.item}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.item}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.count}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(d.count / maxPpe) * 100}%`,
                        background: i === 0 ? 'var(--danger)' : i === 1 ? 'var(--warning)' : i === 2 ? 'var(--accent)' : 'var(--info)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Export Reports</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => exportFile('/reports/export/violations', 'violations_report.csv')}>
            Download Violations CSV
          </button>
          {user.role === 'admin' && (
            <button className="btn btn-secondary" onClick={() => exportFile('/reports/export/audit', 'audit_log_report.csv')}>
              Download Audit Log CSV
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
