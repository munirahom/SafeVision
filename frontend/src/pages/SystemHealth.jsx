import { useState, useEffect } from 'react'
import { api } from '../api'

function StatusRow({ label, value, ok, detail }) {
  return (
    <div style={styles.statusRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: ok ? 'var(--success)' : 'var(--danger)',
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: ok ? '0 0 8px var(--success)' : '0 0 8px var(--danger)',
        }} />
        <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ color: ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: 13 }}>{value}</span>
        {detail && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{detail}</p>}
      </div>
    </div>
  )
}

export default function SystemHealth() {
  const [stats, setStats] = useState(null)
  const [apiOk, setApiOk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState(null)

  async function check() {
    setLoading(true)
    try {
      const [s, h] = await Promise.all([api.dashboardStats(), api.health()])
      setStats(s)
      setApiOk(h.status === 'ok')
    } catch (e) {
      setApiOk(false)
    } finally {
      setLoading(false)
      setLastCheck(new Date().toLocaleTimeString())
    }
  }

  useEffect(() => { check() }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 className="page-title">System Health</h1>
          <p className="page-subtitle">Real-time status of all system components</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={check} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Refresh'}
          </button>
          {lastCheck && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last check: {lastCheck}</span>}
        </div>
      </div>

      <div className="card" style={{
        marginBottom: 20,
        borderTop: `3px solid ${apiOk !== false ? 'var(--success)' : 'var(--danger)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <span style={{ fontSize: 24 }}>{apiOk !== false ? 'OK' : 'ERR'}</span>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {apiOk !== false ? 'All Systems Operational' : 'System Issues Detected'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {apiOk !== false ? 'All components are running normally' : 'One or more components may have issues'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Core Services</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <StatusRow label="API Server" value="Online" ok={apiOk !== false} detail="FastAPI running on port 8000" />
            <StatusRow label="Detection Engine" value={stats?.system_status?.detection_engine || 'Checking...'} ok detail={`YOLOv8s - ${stats?.model_info?.name || 'best.pt'}`} />
            <StatusRow label="Database" value={stats?.system_status?.database || 'Checking...'} ok detail="SQLite - safevision.db" />
            <StatusRow label="WebSocket Server" value={stats?.system_status?.websocket || 'Checking...'} ok detail="Video stream processing" />
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Detection Model</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Model', `YOLOv8s (${stats?.model_info?.name || 'best.pt'})`],
              ['Classes', stats?.model_info?.class_count ? `${stats.model_info.class_count} classes` : '-'],
              ['Class Labels', stats?.model_info?.classes?.join(', ') || '-'],
              ['Input Size', '640 x 640'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, maxWidth: 320, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Usage Statistics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Active Users', stats?.active_users ?? '-', 'var(--accent)'],
              ['Active Violations', stats?.active_violations ?? '-', 'var(--warning)'],
              ['Pending Requests', stats?.pending_requests ?? '-', 'var(--info)'],
              ['Camera Uptime', stats?.camera_uptime != null ? `${stats.camera_uptime}%` : 'N/A', 'var(--success)'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{label}</span>
                <span style={{ color, fontWeight: 700, fontSize: 18 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Detection Confidence', '>= 0.25'],
              ['IoU Threshold', '0.45'],
              ['Max Upload Size', '500 MB'],
              ['Session Timeout', '8 hours'],
              ['Video Streaming', 'WebSocket (real-time)'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
  },
}
