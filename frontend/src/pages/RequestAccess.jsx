import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

const DEPARTMENTS = ['IT Security', 'Operations', 'Safety', 'Logistics', 'Production', 'HR', 'Management', 'Other']
const ROLES = ['supervisor', 'admin']

export default function RequestAccess() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', department: '', role: '', reason: '', password: '', confirm_password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.email || !form.department || !form.role || !form.reason || !form.password || !form.confirm_password) {
      setError('Please fill in all fields'); return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long'); return
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match'); return
    }
    setLoading(true); setError('')
    try {
      const { confirm_password, ...payload } = form
      await api.requestAccess(payload)
      setSuccess(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Request Submitted</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Your access request has been submitted. Once approved, sign in with the password you just set.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Login</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Link to="/" style={styles.backLink}>← Back</Link>
        <h2 style={styles.title}>Request System Access</h2>
        <p style={styles.subtitle}>
          Fill out the form below to request access to the SafeVision system. An administrator will review your request.
        </p>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" placeholder="John" value={form.first_name}
                onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" placeholder="Doe" value={form.last_name}
                onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input className="form-input" type="email" placeholder="john.doe@company.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select className="form-select" value={form.department}
                onChange={e => set('department', e.target.value)}>
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Requested Role *</label>
              <select className="form-select" value={form.role}
                onChange={e => set('role', e.target.value)}>
                <option value="">Select Role</option>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Access Reason *</label>
            <textarea className="form-textarea" placeholder="Explain why you need access to the system..."
              value={form.reason} onChange={e => set('reason', e.target.value)} rows={3} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="At least 8 characters"
                value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input className="form-input" type="password" placeholder="Re-enter your password"
                value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Submit Access Request'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 32px',
    width: '100%',
    maxWidth: 500,
    boxShadow: 'var(--shadow)',
  },
  backLink: { color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 },
}
