import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { formatDateTime, timeAgo } from '../utils/datetime'

const ACTION_COLOR = {
  Login: 'var(--info)',
  'User Created': 'var(--accent)',
  'Violation Detected': 'var(--danger)',
  'Violation Updated': 'var(--warning)',
  'Settings Changed': 'var(--text-secondary)',
  'Health Check': 'var(--success)',
  'User Updated': 'var(--info)',
  'User Deleted': 'var(--danger)',
}

const WEATHER_LOCATION_STORAGE_KEY = 'sv_weather_location'

function StatCard({ label, value, sub, icon, accentColor }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${accentColor || 'var(--accent)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-card-label">{label}</div>
          <div className="stat-card-value">{value}</div>
          {sub && <div className="stat-card-sub">{sub}</div>}
        </div>
        <span style={{ fontSize: 28, opacity: 0.6 }}>{icon}</span>
      </div>
    </div>
  )
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: ok ? 'var(--success)' : 'var(--danger)',
      marginRight: 8,
    }} />
  )
}

function WeatherAlerts({ weather, error }) {
  const alerts = weather?.alerts || []

  if (error) {
    return (
      <div className="card" style={{ borderTop: '3px solid var(--warning)' }}>
        <h3 style={styles.sectionTitle}>Weather Alerts</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ borderTop: `3px solid ${alerts.length ? 'var(--danger)' : 'var(--success)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h3 style={styles.sectionTitle}>Weather Alerts</h3>
          {weather ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
              {weather.location}{weather.region ? `, ${weather.region}` : ''} - {weather.condition}
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Weather unavailable</p>
          )}
        </div>
        {weather && (
          <span className={`badge badge-${weather.highest_alert_severity || 'low'}`}>
            {alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : 'clear'}
          </span>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        {alerts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No extreme weather forecast in the next 72 hours.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.slice(0, 4).map((alert, index) => (
              <div key={`${alert.title}-${alert.starts_at || index}`} style={styles.weatherAlertRow}>
                <span className={`badge badge-${alert.severity}`} style={{ alignSelf: 'flex-start' }}>{alert.severity}</span>
                <div>
                  <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{alert.title}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{alert.detail}</p>
                  {alert.starts_at && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                      Forecast: {formatDateTime(alert.starts_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('sv_user') || '{}')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const nextStats = await api.dashboardStats()
        const selectedWeatherLocation = localStorage.getItem(WEATHER_LOCATION_STORAGE_KEY)

        if (selectedWeatherLocation && selectedWeatherLocation !== nextStats.weather?.query) {
          try {
            nextStats.weather = await api.weatherCurrent(selectedWeatherLocation)
            nextStats.weather_error = null
          } catch (e) {
            nextStats.weather_error = e.message
          }
        }

        setStats(nextStats)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  const barData = stats?.top_violations || []
  const maxBar = Math.max(...barData.map(d => d.count), 1)
  const hasCameraFeeds = (stats?.camera_feeds_total || 0) > 0

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">Welcome back, {user.first_name} {user.last_name}</p>
      </div>

      <div style={styles.statGrid}>
        <StatCard
          label="Camera Uptime"
          value={stats?.camera_uptime != null ? `${stats.camera_uptime}%` : 'N/A'}
          sub={hasCameraFeeds ? `${stats.camera_feeds_online}/${stats.camera_feeds_total} feeds online` : 'No live feeds configured'}
          icon="CAM"
          accentColor="var(--success)"
        />
        <StatCard
          label="Active Users"
          value={stats?.active_users ?? 0}
          sub="Registered accounts"
          icon="USR"
          accentColor="var(--accent)"
        />
        <StatCard
          label="Active Violations"
          value={stats?.active_violations ?? 0}
          sub="Pending review"
          icon="ALR"
          accentColor="var(--warning)"
        />
        <StatCard
          label="Pending Requests"
          value={stats?.pending_requests ?? 0}
          sub="Access requests"
          icon="REQ"
          accentColor="var(--info)"
        />
      </div>

      <div style={styles.midGrid}>
        <WeatherAlerts weather={stats?.weather} error={stats?.weather_error} />

        <div className="card">
          <h3 style={styles.sectionTitle}>System Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div style={styles.statusRow}>
              <span><StatusDot ok /> Camera Feed Status</span>
              <span style={styles.statusVal}>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                  {hasCameraFeeds ? `${stats.camera_feeds_online}/${stats.camera_feeds_total} Online` : 'No feeds configured'}
                </span>
              </span>
            </div>
            <div style={styles.statusRow}>
              <span><StatusDot ok /> Detection Engine</span>
              <span style={{ ...styles.statusVal, color: 'var(--success)' }}>
                {stats?.system_status?.detection_engine}
              </span>
            </div>
            <div style={styles.statusRow}>
              <span><StatusDot ok /> API</span>
              <span style={{ ...styles.statusVal, color: 'var(--success)' }}>
                {stats?.system_status?.api}
              </span>
            </div>
            <div style={styles.statusRow}>
              <span><StatusDot ok /> Database</span>
              <span style={{ ...styles.statusVal, color: 'var(--success)' }}>
                {stats?.system_status?.database}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={styles.sectionTitle}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <button className="btn btn-primary btn-full" onClick={() => navigate('/detect')}>
              Run Detection
            </button>
            {user.role === 'admin' && (
              <button className="btn btn-secondary btn-full" onClick={() => navigate('/users')}>
                Manage Users
              </button>
            )}
            {user.role === 'admin' && (
              <button className="btn btn-secondary btn-full" onClick={() => navigate('/audit-log')}>
                View Audit Log
              </button>
            )}
            <button className="btn btn-secondary btn-full" onClick={() => navigate('/reports')}>
              Open Reports
            </button>
          </div>
        </div>
      </div>

      <div style={styles.bottomGrid}>
        {user.role === 'admin' && (
          <div className="card">
            <h3 style={styles.sectionTitle}>Recent Audit Log</h3>
            <div style={{ marginTop: 12 }}>
              {(stats?.recent_audit_logs || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No audit logs yet</p>
              ) : (stats?.recent_audit_logs || []).map(log => (
                <div key={log.id} style={styles.logRow}>
                  <div>
                    <span style={{ color: ACTION_COLOR[log.action_type] || 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                      {log.action_type}
                    </span>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                      {log.description.length > 60 ? `${log.description.slice(0, 60)}...` : log.description}
                    </p>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    <span title={formatDateTime(log.timestamp)}>{timeAgo(log.timestamp)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={styles.sectionTitle}>Top Weekly Violations</h3>
          {barData.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <p>No violations this week</p>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {barData.map((d, i) => (
                <div key={d.item} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Missing {d.item}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {d.count}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(d.count / maxBar) * 100}%`,
                        background: i === 0 ? 'var(--danger)' : i === 1 ? 'var(--warning)' : 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  midGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 },
  bottomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    color: 'var(--text-secondary)',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  statusVal: { fontWeight: 600, fontSize: 12 },
  logRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  weatherAlertRow: {
    display: 'flex',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
}
