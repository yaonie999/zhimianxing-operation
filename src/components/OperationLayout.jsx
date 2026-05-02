import React, { useEffect, useMemo, useState } from 'react'

class ContentErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[OperationLayout] content render error:', error, info)
    console.error('Error stack:', error?.stack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: '#fff',
            border: '1px solid #f0d6d6',
            borderRadius: 10,
            padding: 16,
            color: '#9f1239'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>页面内容渲染失败</div>
          <div style={{ fontSize: 13, color: '#881337' }}>
            已拦截异常，避免空白页。请刷新页面，或把控制台错误发我继续修复。
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const MENU_ITEMS = [
  { label: '工作台', path: '/workbench', icon: '🏠' },
  { label: '会员管理', path: '/members', icon: '👥' },
  { label: '订单管理', path: '/orders', icon: '📋' },
  { label: '核销记录', path: '/verify', icon: '✅' },
  { label: '退款审批', path: '/refund', icon: '💳' },
  { label: '量表评估', path: '/assessment', icon: '📝' },
  { label: '方案模板', path: '/plan-templates', icon: '📋' },
  { label: '方案执行', path: '/plan-execution', icon: '▶️' },
  { label: '治疗报告', path: '/treatment-report', icon: '📊' },
  { label: '工作室', path: '/studios', icon: '🏢' },
  { label: '睡眠师', path: '/therapists', icon: '👨‍⚕️' }
]

const STUDIOS = ['万象城XXX工作室', '望京工作室', '中关村工作室', '国贸工作室']

const cardLike = {
  background: 'var(--op-card)',
  border: '1px solid var(--op-line)',
  borderRadius: 14,
  boxShadow: 'var(--op-shadow-soft)'
}

export default function OperationLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [studioList, setStudioList] = useState([])
  const [studio, setStudio] = useState('')
  const [showStudioDropdown, setShowStudioDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  useEffect(() => {
    fetch('/api/studios')
      .then(r => r.json())
      .then(data => {
        if (data.code === 200 && data.data.length > 0) {
          setStudioList(data.data)
          setStudio(data.data[0].name)
        } else {
          setStudioList(STUDIOS.map(name => ({ name })))
          setStudio(STUDIOS[0])
        }
      })
      .catch(() => {
        setStudioList(STUDIOS.map(name => ({ name })))
        setStudio(STUDIOS[0])
      })
  }, [])

  function navigate(path) {
    window.location.hash = path
  }

  function logout() {
    localStorage.removeItem('operation_token')
    localStorage.removeItem('operation_user')
    localStorage.removeItem('operation_auto_login')
    sessionStorage.removeItem('workbench_verify_prompt_shown')
    setShowUserDropdown(false)
    window.location.hash = '/'
    window.location.reload()
  }

  const currentPath = window.location.hash.replace('#', '') || '/workbench'
  const activeMenu = useMemo(() => MENU_ITEMS.find((m) => currentPath.startsWith(m.path)), [currentPath])
  function openNoticeCenter() {
    if (!currentPath.startsWith('/workbench')) {
      window.location.hash = '/workbench'
      return
    }
    window.dispatchEvent(new CustomEvent('open-workbench-notice-center'))
  }

  return (
    <div
      className="op-shell-layout"
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: 'radial-gradient(1100px 500px at 20% -10%, var(--op-bg-soft) 0%, var(--op-bg) 65%)',
        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        color: 'var(--op-text)'
      }}
    >
      <aside
        className="op-shell-sidebar"
        style={{
          width: collapsed ? 72 : 232,
          minWidth: collapsed ? 72 : 232,
          margin: 12,
          marginRight: 0,
          ...cardLike,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.22s ease, min-width 0.22s ease',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
            borderBottom: '1px solid var(--op-line)',
            background: 'linear-gradient(180deg,#FFFFFF,#F9FCFF)'
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--op-primary)',
                letterSpacing: '.2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              智眠星运营端 V1.0.0
            </span>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            style={{
              width: 28,
              height: 28,
              border: 'none',
              background: 'var(--op-primary-soft)',
              color: 'var(--op-primary)',
              cursor: 'pointer',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              flexShrink: 0
            }}
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? '☰' : '◧'}
          </button>
        </div>

        <nav style={{ flex: 1, padding: 10, overflowY: 'auto', overflowX: 'hidden' }}>
          {MENU_ITEMS.map((item) => {
            const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/')
            return (
              <div
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: collapsed ? '11px 0' : '11px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 12,
                  cursor: 'pointer',
                  marginBottom: 6,
                  color: isActive ? '#FFFFFF' : 'var(--op-text)',
                  background: isActive
                    ? 'linear-gradient(135deg, var(--op-primary) 0%, var(--op-primary-2) 100%)'
                    : 'transparent',
                  boxShadow: isActive ? '0 8px 16px rgba(22,119,255,0.28)' : 'none',
                  transition: 'all .18s ease',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--op-primary-soft)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    marginRight: collapsed ? 0 : 10,
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {item.icon}
                </span>
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
              </div>
            )
          })}
        </nav>
      </aside>

      <div
        className="op-shell-main-wrap"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          margin: 12,
          marginLeft: 12
        }}
      >
        <header
          className="op-shell-header"
          style={{
            height: 56,
            ...cardLike,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
            backdropFilter: 'blur(4px)',
            marginBottom: 12,
            position: 'relative',
            zIndex: 9998
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setCollapsed((v) => !v)}
              style={{
                width: 32,
                height: 32,
                border: 'none',
                background: '#F1F6FD',
                color: 'var(--op-sub)',
                cursor: 'pointer',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}
              title="折叠菜单"
            >
              ☰
            </button>
            <span style={{ fontSize: 14, color: 'var(--op-text)', fontWeight: 600 }}>{activeMenu?.label || '工作台'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowStudioDropdown((v) => !v)}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--op-line)',
                  background: '#FFFFFF',
                  color: 'var(--op-text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13
                }}
              >
                <span>{studio}</span>
                <span style={{ color: 'var(--op-sub)' }}>▾</span>
              </button>
              {showStudioDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 38,
                    left: 0,
                    minWidth: 188,
                    background: '#FFFFFF',
                    border: '1px solid var(--op-line)',
                    borderRadius: 10,
                    boxShadow: 'var(--op-shadow)',
                    zIndex: 20,
                    overflow: 'hidden'
                  }}
                >
                  {studioList.map((s) => (
                    <div
                      key={s.id || s.name}
                      onClick={() => {
                        setStudio(s.name)
                        setShowStudioDropdown(false)
                      }}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        color: s.name === studio ? 'var(--op-primary)' : 'var(--op-text)',
                        background: s.name === studio ? 'var(--op-primary-soft)' : '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              title="消息"
              onClick={openNoticeCenter}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid var(--op-line)',
                background: '#FFFFFF',
                cursor: 'pointer',
                position: 'relative',
                fontSize: 14
              }}
            >
              🔔
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#FF4D4F',
                  color: '#FFFFFF',
                  fontSize: 10,
                  lineHeight: '16px',
                  textAlign: 'center',
                  padding: '0 3px'
                }}
              >
                3
              </span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserDropdown((v) => !v)}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--op-line)',
                  background: '#FFFFFF',
                  color: 'var(--op-text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13
                }}
              >
                <span>👤</span>
                <span>{JSON.parse(localStorage.getItem('operation_user') || '{}').name || '运营用户'}</span>
                <span style={{ color: 'var(--op-sub)' }}>▾</span>
              </button>
              {showUserDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 38,
                    right: 0,
                    minWidth: 126,
                    background: '#FFFFFF',
                    border: '1px solid var(--op-line)',
                    borderRadius: 10,
                    boxShadow: 'var(--op-shadow)',
                    zIndex: 99999,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}
                    onClick={() => {
                      setShowUserDropdown(false)
                      navigate('/profile')
                    }}
                  >
                    个人中心
                  </div>
                  <div style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', color: '#E11D48' }} onClick={logout}>
                    退出登录
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          className="op-shell-main"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: 16,
            ...cardLike,
            borderRadius: 14
          }}
        >
          <ContentErrorBoundary>{children}</ContentErrorBoundary>
        </main>
      </div>
    </div>
  )
}
