import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=email, 2=code+new password
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRequestCode(e) {
    e.preventDefault()
    if (!email) { setError('Please enter your email'); return }
    setLoading(true); setError('')
    try {
      const res = await api.resetPasswordRequest({ email })
      setDemoCode(res.demo_code || '')
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!code || !newPassword || !confirmPassword) { setError('Please fill all fields'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      await api.resetPasswordConfirm({ email, code, new_password: newPassword })
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
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Password Reset!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13 }}>
            Your password has been successfully reset.
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
        <h2 style={styles.title}>Reset Password</h2>

        {step === 1 ? (
          <>
            <p style={styles.subtitle}>Enter your registered email address to receive a verification code.</p>
            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
            <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Registered Email</label>
                <input className="form-input" type="email" placeholder="your.email@company.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Send Verification Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            {demoCode && (
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                Demo code: <strong>{demoCode}</strong> (shown here since email is simulated)
              </div>
            )}
            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input className="form-input" placeholder="Enter 5-digit code"
                  value={code} onChange={e => setCode(e.target.value)} maxLength={5} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Reset Password'}
              </button>
            </form>
          </>
        )}
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
    maxWidth: 400,
    boxShadow: 'var(--shadow)',
  },
  backLink: { color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 },
}
