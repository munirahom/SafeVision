import { useState, useEffect } from 'react'
import { api } from '../api'
import { formatDate } from '../utils/datetime'

const DEPARTMENTS = ['IT Security', 'Operations', 'Safety', 'Logistics', 'Production', 'HR', 'Management', 'Other']

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user?.id
  const [form, setForm] = useState(user || { username: '', email: '', first_name: '', last_name: '', password: '', role: 'supervisor', department: '', is_active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setLoading(true); setError('')
    try {
      if (isEdit) {
        const payload = { ...form }
        delete payload.password
        delete payload.id
        await api.updateUser(user.id, payload)
      } else {
        await api.createUser(form)
      }
      onSave()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 className="modal-title">{isEdit ? 'Edit User' : 'Create User'}</h2>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={form.username} onChange={e => set('username', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" value={form.department || ''} onChange={e => set('department', e.target.value)}>
                <option value="">None</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner" /> : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [tab, setTab] = useState('users')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'create' | user object
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([api.listUsers(), api.listAccessRequests()])
      setUsers(u); setRequests(r)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(u) {
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return
    try { await api.deleteUser(u.id); load() }
    catch (e) { setError(e.message) }
  }

  async function handleReviewRequest(id, status) {
    try {
      const res = await api.reviewAccessRequest(id, { status })
      if (res.temporary_password) {
        setNotice(`Request approved. Temporary password: ${res.temporary_password}`)
      } else if (res.sign_in_message) {
        setNotice(res.sign_in_message)
      } else {
        setNotice(res.message || 'Request updated')
      }
      load()
    }
    catch (e) { setError(e.message) }
  }

  const filtered = users.filter(u =>
    [u.first_name, u.last_name, u.email, u.role, u.department].some(
      v => v?.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">Manage system users and access requests</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="alert alert-success" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={tab === 'users' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('users')}>
          Users ({users.length})
        </button>
        <button className={tab === 'requests' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('requests')}>
          Access Requests ({requests.filter(r => r.status === 'pending').length})
        </button>
      </div>

      {tab === 'users' && (
        <>
          <div className="page-actions">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => setModal('create')}>+ Create User</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Joined</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users found</td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.id}>
                      <td className="td-primary">{u.first_name} {u.last_name}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                      <td>{u.department || '—'}</td>
                      <td>
                        <span style={{ color: u.is_active ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                          {u.is_active ? '● Active' : '● Inactive'}
                        </span>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'requests' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Reason</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No requests</td></tr>
                ) : requests.map(r => (
                  <tr key={r.id}>
                    <td className="td-primary">{r.first_name} {r.last_name}</td>
                    <td>{r.email}</td>
                    <td>{r.department}</td>
                    <td><span className={`badge badge-${r.role}`}>{r.role}</span></td>
                    <td style={{ maxWidth: 200 }}><span title={r.reason}>{r.reason.slice(0, 50)}{r.reason.length > 50 ? '…' : ''}</span></td>
                    <td>{formatDate(r.created_at)}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleReviewRequest(r.id, 'approved')}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleReviewRequest(r.id, 'rejected')}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
