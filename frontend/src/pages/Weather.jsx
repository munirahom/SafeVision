import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatDateTime } from '../utils/datetime'

const STORAGE_KEY = 'sv_weather_location'
const FALLBACK_LOCATION = 'Riyadh'

function weatherAccent(code) {
  if (code == null) return 'var(--accent)'
  if ([0, 1].includes(code)) return 'var(--success)'
  if ([2, 3, 45, 48].includes(code)) return 'var(--info)'
  if ([95, 96, 99].includes(code)) return 'var(--danger)'
  return 'var(--warning)'
}

function weatherIcon(code, isDay) {
  if ([95, 96, 99].includes(code)) return 'TS'
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'RN'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'SN'
  if ([45, 48].includes(code)) return 'FG'
  if ([0, 1].includes(code)) return isDay ? 'SU' : 'MO'
  if ([2, 3].includes(code)) return 'CL'
  return 'WX'
}

function WeatherAlertList({ alerts }) {
  if (!alerts?.length) {
    return <div className="alert alert-success">No extreme weather forecast in the next 72 hours.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {alerts.map((alert, index) => (
        <div
          key={`${alert.title}-${alert.starts_at || index}`}
          className={`alert alert-${alert.severity === 'high' ? 'error' : 'warning'}`}
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
        >
          <span className={`badge badge-${alert.severity}`} style={{ flexShrink: 0 }}>{alert.severity}</span>
          <div>
            <p style={{ fontWeight: 700 }}>{alert.title}</p>
            <p style={{ marginTop: 3 }}>{alert.detail}</p>
            {alert.starts_at && (
              <p style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                Forecast: {formatDateTime(alert.starts_at)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Weather() {
  const [location, setLocation] = useState(() => localStorage.getItem(STORAGE_KEY) || FALLBACK_LOCATION)
  const [draftLocation, setDraftLocation] = useState(() => localStorage.getItem(STORAGE_KEY) || FALLBACK_LOCATION)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadWeather(nextLocation = location) {
    const requestedLocation = nextLocation.trim() || FALLBACK_LOCATION

    setLoading(true)
    setError('')
    try {
      const data = await api.weatherCurrent(requestedLocation)
      setWeather(data)
      setLocation(requestedLocation)
      setDraftLocation(requestedLocation)
      localStorage.setItem(STORAGE_KEY, requestedLocation)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWeather(location)
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Weather</h1>
        <p className="page-subtitle">Current site weather for the selected location</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            loadWeather(draftLocation)
          }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div className="form-group" style={{ flex: '1 1 260px', marginBottom: 0 }}>
            <label className="form-label">Location</label>
            <input
              className="form-input"
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              placeholder="Enter a city or site location"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Refresh Weather'}
          </button>
        </form>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && !weather ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '45vh' }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : weather ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 16 }}>
          <div className="card" style={{ borderTop: `3px solid ${weatherAccent(weather.weather_code)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Current Conditions
                </p>
                <h2 style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                  {weather.location}
                  {weather.region ? `, ${weather.region}` : ''}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                  {weather.country} · {weather.condition}
                </p>
              </div>
              <div style={{
                minWidth: 96,
                textAlign: 'center',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                background: 'var(--accent-light)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{weatherIcon(weather.weather_code, weather.is_day)}</div>
                <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{Math.round(weather.temperature_c)}C</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
              <MetricCard label="Humidity" value={`${weather.humidity}%`} />
              <MetricCard label="Wind Speed" value={`${Math.round(weather.wind_speed_kph)} km/h`} />
              <MetricCard label="Timezone" value={weather.timezone || '-'} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DetailRow label="Requested Location" value={location} />
              <DetailRow label="Observed At" value={formatDateTime(weather.observed_at)} />
              <DetailRow label="Coordinates" value={`${weather.latitude}, ${weather.longitude}`} />
              <DetailRow label="Weather Code" value={`${weather.weather_code}`} />
            </div>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Forecast Alerts</h3>
            <WeatherAlertList alerts={weather.alerts} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div style={{
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      paddingBottom: 10,
      borderBottom: '1px solid var(--border)',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
