import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true); setError('')
    try {
      const data = await api.login({ email, password })
      localStorage.setItem('sv_token', data.access_token)
      localStorage.setItem('sv_user', JSON.stringify(data.user))
      navigate('/dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.4C17.25 22.15 21 17.25 21 12V6L12 2z" fill="#f5c842"/>
              <path d="M9 12l2 2 4-4" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={styles.logoText}>SafeVision</h1>
          <p style={styles.logoSub}>PPE Compliance Monitoring System</p>
        </div>

        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Sign In</h2>

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="form-input-icon">
                <span className="icon">&#9679;</span>
                <input
                  className="form-input"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowPw(!showPw)}
                  style={styles.eyeBtn}
                  tabIndex={-1}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={styles.rememberRow}>
              <label style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Remember me
              </label>
              <Link to="/reset-password" style={styles.forgotLink}>Forgot Password?</Link>
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleLogin}
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>

            <p style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
              Your account role is applied automatically after login.
            </p>
          </div>

          <p style={styles.requestText}>
            Don't have access?{' '}
            <Link to="/request-access" style={styles.requestLink}>Request Access</Link>
          </p>
        </div>
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
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
  },
  logoWrap: { textAlign: 'center' },
  logoIcon: {
    width: 64, height: 64,
    background: 'rgba(245,200,66,0.12)',
    border: '1px solid rgba(245,200,66,0.3)',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  logoText: { fontSize: 26, fontWeight: 800, color: 'var(--accent)', letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 },
  formCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 32px',
    width: '100%',
    boxShadow: 'var(--shadow)',
  },
  formTitle: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  rememberRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  checkLabel: { display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' },
  forgotLink: { color: 'var(--accent)', fontSize: 13, fontWeight: 500 },
  eyeBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', fontSize: 16, color: 'var(--text-muted)',
  },
  requestText: { textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)', fontSize: 13 },
  requestLink: { color: 'var(--accent)', fontWeight: 600 },
}
