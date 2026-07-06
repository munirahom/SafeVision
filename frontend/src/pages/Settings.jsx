import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Settings() {
  const localUser = JSON.parse(localStorage.getItem('sv_user') || '{}')
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '', username: '', department: '' })
  const [notif, setNotif] = useState({ notif_email: true, notif_violations: true, notif_system_updates: true, notif_weekly_reports: true })
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [pwMsg, setPwMsg] = useState('')
  const [pwMsgType, setPwMsgType] = useState('success')

  useEffect(() => {
    api.me().then(user => {
      setProfile({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        username: user.username || '',
        department: user.department || '',
      })
      setNotif({
        notif_email: user.notif_email ?? true,
        notif_violations: user.notif_violations ?? true,
        notif_system_updates: user.notif_system_updates ?? true,
        notif_weekly_reports: user.notif_weekly_reports ?? true,
      })
    }).catch(console.error)
  }, [])

  function setP(k, v) { setProfile(p => ({ ...p, [k]: v })) }
  function setN(k, v) { setNotif(n => ({ ...n, [k]: v })) }
  function setPwField(k, v) { setPw(p => ({ ...p, [k]: v })) }

  async function saveProfile(e) {
    e.preventDefault()
    setLoading(true); setMsg('')
    try {
      await api.updateMe(profile)
      await api.updateNotifications(notif)
      // Update local storage
      const updated = { ...localUser, ...profile }
      localStorage.setItem('sv_user', JSON.stringify(updated))
      setMsg('Profile updated successfully'); setMsgType('success')
    } catch (e) {
      setMsg(e.message); setMsgType('error')
    } finally { setLoading(false) }
  }

  async function savePassword(e) {
    e.preventDefault()
    if (!pw.current_password || !pw.new_password || !pw.confirm_password) {
      setPwMsg('Please fill all fields'); setPwMsgType('error'); return
    }
    setPwLoading(true); setPwMsg('')
    try {
      await api.changePassword(pw)
      setPwMsg('Password changed successfully'); setPwMsgType('success')
      setPw({ current_password: '', new_password: '', confirm_password: '' })
    } catch (e) {
      setPwMsg(e.message); setPwMsgType('error')
    } finally { setPwLoading(false) }
  }

  function NotifRow({ label, field }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
        <label className="toggle">
          <input type="checkbox" checked={notif[field]} onChange={e => setN(field, e.target.checked)} />
          <span className="toggle-slider" />
        </label>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Account Settings</h1>
        <p className="page-subtitle">{localUser.email} — {localUser.role}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Profile Information</h3>
            {msg && <div className={`alert alert-${msgType}`} style={{ marginBottom: 14 }}>{msg}</div>}
            <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-input" value={profile.first_name} onChange={e => setP('first_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" value={profile.last_name} onChange={e => setP('last_name', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={profile.email} onChange={e => setP('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={profile.username} onChange={e => setP('username', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" value={profile.department} onChange={e => setP('department', e.target.value)} />
              </div>

              <div className="divider" />

              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notification Preferences</h4>
              <NotifRow label="Email Notifications" field="notif_email" />
              <NotifRow label="Violation Alerts" field="notif_violations" />
              <NotifRow label="System Updates" field="notif_system_updates" />
              <NotifRow label="Weekly Reports" field="notif_weekly_reports" />

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                {loading ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Change Password</h3>
            {pwMsg && <div className={`alert alert-${pwMsgType}`} style={{ marginBottom: 14 }}>{pwMsg}</div>}
            <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={pw.current_password}
                  onChange={e => setPwField('current_password', e.target.value)} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={pw.new_password}
                  onChange={e => setPwField('new_password', e.target.value)} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" value={pw.confirm_password}
                  onChange={e => setPwField('confirm_password', e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pwLoading} style={{ alignSelf: 'flex-start' }}>
                {pwLoading ? <span className="spinner" /> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
