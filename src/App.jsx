import React, { useEffect, useMemo, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import OperationLayout from './components/OperationLayout'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DeviceManagePage from './pages/DeviceManagePage'
import LoginPage from './pages/LoginPage'
import MemberDetailPage from './pages/MemberDetailPage' // TEMPORARILY DISABLED
import MemberListPage from './pages/MemberListPage'
import OrderDetailPage from './pages/OrderDetailPage'
import OrderListPage from './pages/OrderListPage'
import ProfilePage from './pages/ProfilePage'
import RefundApprovalPage from './pages/RefundApprovalPage'
import VerifyRecordPage from './pages/VerifyRecordPage'
import WorkbenchPage from './pages/WorkbenchPage'

import AssessmentPage from './pages/AssessmentPage'
import PlanTemplateListPage from './pages/PlanTemplateListPage'
import PlanExecutionPage from './pages/PlanExecutionPage'
import TreatmentReportPage from './pages/TreatmentReportPage'

function ProtectedRoute({ children }) {
  const [token, setToken] = useState(localStorage.getItem('operation_token'))

  useEffect(() => {
    const handler = () => setToken(localStorage.getItem('operation_token'))
    window.addEventListener('storage', handler)
    setToken(localStorage.getItem('operation_token'))
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!token) return <Navigate to="/" replace />
  return children
}

function ThemeDock({ theme, onChange }) {
  const [open, setOpen] = useState(false)
  const label = useMemo(() => (theme === 'teal' ? '专业青绿' : '医疗蓝'), [theme])

  return (
    <div className="theme-dock-wrap">
      {open && (
        <div className="theme-dock-panel">
          <button
            className={`theme-option ${theme === 'medical' ? 'active' : ''}`}
            onClick={() => {
              onChange('medical')
              setOpen(false)
            }}
          >
            医疗蓝</button>
          <button
            className={`theme-option ${theme === 'teal' ? 'active' : ''}`}
            onClick={() => {
              onChange('teal')
              setOpen(false)
            }}
          >
            专业青绿
          </button>
        </div>
      )}
      <button className="theme-dock-trigger" onClick={() => setOpen((v) => !v)}>
        主题：{label}
      </button>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('op_ui_theme') || 'medical')

  useEffect(() => {
    document.documentElement.setAttribute('data-op-theme', theme)
    localStorage.setItem('op_ui_theme', theme)
  }, [theme])

  return (
    <HashRouter>
      <ThemeDock theme={theme} onChange={setTheme} />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/workbench"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <WorkbenchPage embedded />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/members"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <MemberListPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/members/:id"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <MemberDetailPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/orders"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <OrderListPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/orders/:id"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <OrderDetailPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/refund"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <RefundApprovalPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/verify"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <VerifyRecordPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/devices"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <DeviceManagePage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <ProfilePage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/change-password"
          element={(
            <ProtectedRoute>
              <OperationLayout>
                <ChangePasswordPage />
              </OperationLayout>
            </ProtectedRoute>
          )}
        />
        <Route path="/assessment" element={<ProtectedRoute><OperationLayout><AssessmentPage /></OperationLayout></ProtectedRoute>} />
<Route path="/plan-templates" element={<ProtectedRoute><OperationLayout><PlanTemplateListPage /></OperationLayout></ProtectedRoute>} />
<Route path="/plan-execution" element={<ProtectedRoute><OperationLayout><PlanExecutionPage /></OperationLayout></ProtectedRoute>} />
<Route path="/treatment-report" element={<ProtectedRoute><OperationLayout><TreatmentReportPage /></OperationLayout></ProtectedRoute>} />

<Route path="*" element={<Navigate to="/workbench" replace />} />
      </Routes>
    </HashRouter>
  )
}
