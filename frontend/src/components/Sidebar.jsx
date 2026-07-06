import { NavLink, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/dashboard', icon: 'DB', label: 'Dashboard' },
  { to: '/detect', icon: 'DT', label: 'Detection' },
  { to: '/violations', icon: 'VR', label: 'Violations' },
  { to: '/users', icon: 'US', label: 'Users', adminOnly: true },
  { to: '/audit-log', icon: 'AL', label: 'Audit Log', adminOnly: true },
  { to: '/reports', icon: 'RP', label: 'Reports' },
  { to: '/weather', icon: 'WT', label: 'Weather' },
  { to: '/system-health', icon: 'SH', label: 'System Health' },
]

const BOTTOM = [
  { to: '/settings', icon: 'ST', label: 'Settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('sv_user') || '{}')

  function logout() {
    localStorage.removeItem('sv_token')
    localStorage.removeItem('sv_user')
    navigate('/')
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.4C17.25 22.15 21 17.25 21 12V6L12 2z" fill="#f5c842" />
            <path d="M9 12l2 2 4-4" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={styles.logoText}>SafeVision</span>
      </div>

      <div style={styles.userBadge}>
        <div style={styles.avatar}>{(user.first_name?.[0] || 'U').toUpperCase()}</div>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{user.first_name} {user.last_name}</span>
          <span className={`badge badge-${user.role}`}>{user.role}</span>
        </div>
      </div>

      <div className="divider" style={{ margin: '8px 12px' }} />

      <nav style={styles.nav}>
        {NAV.filter(n => !n.adminOnly || user.role === 'admin').map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <span style={styles.navIcon}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div style={styles.bottom}>
        <div className="divider" style={{ margin: '8px 12px' }} />
        {BOTTOM.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <span style={styles.navIcon}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <button onClick={logout} style={styles.logoutBtn}>
          <span style={styles.navIcon}>LO</span>
          Logout
        </button>
      </div>
    </aside>
  )
}

const styles = {
  sidebar: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    background: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
    overflow: 'hidden',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '18px 16px 14px',
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: 'rgba(245,200,66,0.12)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontWeight: 800, fontSize: 16, color: 'var(--accent)', letterSpacing: -0.3 },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    margin: '0 8px',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  avatar: {
    width: 30,
    height: 30,
    background: 'var(--accent)',
    color: '#000',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  userInfo: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  userName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: { padding: '4px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
    textDecoration: 'none',
  },
  navItemActive: {
    background: 'var(--accent-light)',
    color: 'var(--accent)',
    borderLeft: '2px solid var(--accent)',
  },
  navIcon: { fontSize: 12, width: 18, textAlign: 'center', flexShrink: 0 },
  bottom: { padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
}
