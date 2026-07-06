import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import RequestAccess from './pages/RequestAccess'
import ResetPassword from './pages/ResetPassword'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Detection from './pages/Detection'
import Users from './pages/Users'
import Violations from './pages/Violations'
import AuditLog from './pages/AuditLog'
import Reports from './pages/Reports'
import SystemHealth from './pages/SystemHealth'
import Settings from './pages/Settings'
import Weather from './pages/Weather'

function PrivateRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem('sv_token')
  const user = JSON.parse(localStorage.getItem('sv_user') || 'null')
  if (!token || !user) return <Navigate to="/" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="detect" element={<Detection />} />
          <Route path="violations" element={<Violations />} />
          <Route path="audit-log" element={
            <PrivateRoute adminOnly>
              <AuditLog />
            </PrivateRoute>
          } />
          <Route path="reports" element={<Reports />} />
          <Route path="weather" element={<Weather />} />
          <Route path="system-health" element={<SystemHealth />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={
            <PrivateRoute adminOnly>
              <Users />
            </PrivateRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
