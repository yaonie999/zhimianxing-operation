import React, { useState, useEffect } from 'react'
import DeviceManagePage from './DeviceManagePage'

// 图标组件占位
const Icon = ({ name, size = 20 }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: size, height: size, fontSize: size * 0.7, opacity: 0.9
  }}>
    {name === 'bell' && '🔔'}
    {name === 'search' && '🔍'}
    {name === 'user' && '👤'}
    {name === 'minimize' && '─'}
    {name === 'maximize' && '□'}
    {name === 'close' && '×'}
    {name === 'left' && '‹'}
    {name === 'right' && '›'}
    {name === 'chart' && '📊'}
    {name === 'users' && '👥'}
    {name === 'device' && '🖥️'}
    {name === 'order' && '📦'}
    {name === 'check' && '✅'}
    {name === 'refund' && '💰'}
    {name === 'file' && '📋'}
    {name === 'settings' && '⚙️'}
    {name === 'sleep' && '🌙'}
    {name === 'clock' && '⏰'}
    {name === 'plan' && '📝'}
    {name === 'exit' && '🚪'}
    {name === 'arrow-right' && '→'}
    {name === 'unread' && '●'}
  </span>
)

// API数据（由 useEffect 从后端加载）
const defaultStats = {
  todayPush: 0,
  todayOrder: 0,
  todayAmount: 0,
  monthAmount: 0,
  yearAmount: 0,
  todayNew: 0,
  totalPatients: 0,
}

const defaultQuickActions = [
  { label: '新建档案', icon: '📋', path: '/members' },
  { label: '患者管理', icon: '👥', path: '/members' },
  { label: '设备配置', icon: '🖥️', path: '/devices' },
  { label: '订单管理', icon: '📦', path: '/orders' },
  { label: '核销记录', icon: '✅', path: '/verify' },
  { label: '退款审批', icon: '💰', path: '/refund' },
]

const defaultKeyPatients = []
const defaultNotices = []
const defaultTodayTasks = []
const defaultPatientMessages = []

function formatTime(timeStr) {
  if (!timeStr) return '-'
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return timeStr
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${min}`
}

export default function WorkbenchPage({ embedded = false }) {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [studio, setStudio] = useState(() => localStorage.getItem('operation_user') ? JSON.parse(localStorage.getItem('operation_user')).studio || '万象城XXX工作室' : '万象城XXX工作室')
  const [showStudioDropdown, setShowStudioDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [showNoticeDetail, setShowNoticeDetail] = useState(false)
  const [noticePage, setNoticePage] = useState(1)
  const [notices, setNotices] = useState(defaultNotices)
  const [keyPatients, setKeyPatients] = useState(defaultKeyPatients)
  const [todayTasks, setTodayTasks] = useState(defaultTodayTasks)
  const [patientMessages, setPatientMessages] = useState(defaultPatientMessages)
  
  const [showVerifyEndModal, setShowVerifyEndModal] = useState(false)
  const [showVerifyScanModal, setShowVerifyScanModal] = useState(false)
  const [verifyRunning, setVerifyRunning] = useState(false)
  const [verifyResultMsg, setVerifyResultMsg] = useState('')
  const [selectedNotice, setSelectedNotice] = useState(null)
  const [showDeviceModal, setShowDeviceModal] = useState(false)

  const [quickActions] = useState(defaultQuickActions)
  const [stats, setStats] = useState(defaultStats)

  const menuItems = [
    { key: 'workbench', label: '工作台', path: '/' },
    { key: 'members', label: '会员管理', path: '/members' },
    { key: 'orders', label: '订单管理', path: '/orders' },
    { key: 'verify', label: '核销记录', path: '/verify' },
    { key: 'refund', label: '退单审批', path: '/refund' },
  ]

  const studios = [
    '万象城XXX工作室',
    '望京工作室',
    '中关村工作室',
    '国贸工作室',
  ]

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

  function openNoticeDetail(notice) {
    setSelectedNotice(notice)
    setShowNoticeDetail(true)
    setNotices(prev => prev.map(item => item.id === notice.id ? { ...item, unread: false } : item))
  }

  function openNoticeCenter() {
    setShowNoticeModal(true)
    setNoticePage(1)
  }

  function markAllNoticeRead() {
    setNotices(prev => prev.map(item => ({ ...item, unread: false })))
  }

  function handleConfirmVerify() {
    setShowVerifyEndModal(false)
    setShowVerifyScanModal(true)
    setVerifyResultMsg('')
  }

  function handleStartRun() {
    setVerifyRunning(true)
    setVerifyResultMsg('')
    setTimeout(() => {
      setVerifyRunning(false)
      setVerifyResultMsg('已启动运行，系统正在记录设备运行数据和异常日志。')
    }, 800)
  }

  useEffect(() => {
    const key = 'workbench_verify_prompt_shown'
    if (!sessionStorage.getItem(key)) {
      const timer = setTimeout(() => {
        setShowVerifyEndModal(true)
        sessionStorage.setItem(key, '1')
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handleOpenNoticeCenter = () => {
      setShowNoticeModal(true)
      setNoticePage(1)
    }
    window.addEventListener('open-workbench-notice-center', handleOpenNoticeCenter)
    return () => window.removeEventListener('open-workbench-notice-center', handleOpenNoticeCenter)
  }, [])

  // 从后端加载工作台数据
  useEffect(() => {
    async function loadWorkbenchData() {
      try {
        // 并行请求：患者列表 + 全部订单（用于KPI计算）+ 通知消息 + 患者消息
        const [patientsRes, ordersRes, noticesRes, msgsRes] = await Promise.all([
          fetch('/api/patients'),
          fetch('/api/orders?page=1&pageSize=9999'),
          fetch('/api/notices'),
          fetch('/api/patient-messages'),
        ])

        const patientsRecords = ((patientsRes.ok ? await patientsRes.json() : {}).data || {}).records || []
        const ordersData = ordersRes.ok ? await ordersRes.json() : {}
        const allOrders = (ordersData.data || ordersData).records || (ordersData.data || ordersData).list || []
        const noticesData = noticesRes.ok ? await noticesRes.json() : {}
        const msgsData = msgsRes.ok ? await msgsRes.json() : {}

        // KPI: 从全部订单计算今日/本月/本年成交（统一用UTC时间比较）
        const now = new Date()
        const todayStartUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        const monthStartUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        const yearStartUTC = Date.UTC(now.getUTCFullYear(), 0, 1)
        const todayOrders = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= todayStartUTC)
        const monthOrders = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= monthStartUTC)
        const yearOrders = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= yearStartUTC)
        const todayOrderCount = todayOrders.length
        const monthOrderCount = monthOrders.length
        const yearOrderCount = yearOrders.length
        const todayOrderAmount = todayOrders.reduce((s, o) => s + (parseFloat(o.payAmount) || 0), 0)
        const monthOrderAmount = monthOrders.reduce((s, o) => s + (parseFloat(o.payAmount) || 0), 0)
        const yearOrderAmount = yearOrders.reduce((s, o) => s + (parseFloat(o.payAmount) || 0), 0)

        setStats({
          todayPush: todayOrderCount,
          todayOrder: todayOrderCount,
          todayAmount: todayOrderAmount,
          monthAmount: monthOrderAmount,
          yearAmount: yearOrderAmount,
          todayNew: patientsRecords.filter(p => p.createTime && new Date(p.createTime).getTime() >= todayStartUTC).length,
          totalPatients: patientsRecords.length || 0,
        })

        // 重点关注患者：取前8个患者
        const topPatients = patientsRecords.slice(0, 8).map((p) => ({
          name: p.name,
          id: p.id,
          studio: p.studio,
          therapist: p.therapist,
        }))
        setKeyPatients(topPatients)
        if (topPatients.length > 0) {
          setSelectedPatient(topPatients[0])
        }

        // 今日任务
        const tasks = [
          { name: '睡眠日记', patients: topPatients.slice(0, 3) },
          { name: '打卡', patients: topPatients.slice(0, 2) },
          { name: '制定方案', patients: topPatients.slice(0, 1) },
        ]
        setTodayTasks(tasks)

        // 患者消息
        setPatientMessages(msgsData.data || [])
        // 通知消息
        setNotices(noticesData.data || defaultNotices)
      } catch (err) {
        console.error('工作台数据加载失败', err)
      }
    }
    loadWorkbenchData()
  }, [])

  const noticePageSize = 5
  const noticeTotalPages = Math.max(1, Math.ceil(notices.length / noticePageSize))
  const pagedNotices = notices.slice((noticePage - 1) * noticePageSize, noticePage * noticePageSize)
  const unreadCount = notices.filter(n => n.unread).length
  const showWorkbenchShell = !embedded
  const rootClassName = embedded ? 'workbench-embedded-root' : 'workbench-root'
  const mainClassName = embedded ? 'workbench-embedded-main' : 'main-area'
  const contentClassName = embedded ? 'workbench-embedded-content' : 'content-area'

  // 弹窗 Overlay
  function ModalOverlay({ children, onClose }) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={rootClassName}>
      {/* ====== 左侧边栏 ====== */}
      {showWorkbenchShell && <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo区 */}
        <div className="sidebar-logo">
          {!collapsed && <span className="sidebar-title">智眠星运营端 V1.0.0</span>}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? '展开' : '折叠'}
          >
            {collapsed ? <Icon name="right" /> : <Icon name="left" />}
          </button>
        </div>

        {/* 菜单列表 */}
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <div
              key={item.key}
              className={`sidebar-menu-item ${item.key === 'workbench' ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={item.label}
            >
              <span className="sidebar-menu-icon">
                {item.key === 'workbench' && '🏠'}
                {item.key === 'members' && '👥'}
                {item.key === 'orders' && '📦'}
                {item.key === 'verify' && '✅'}
                {item.key === 'refund' && '💰'}
              </span>
              {!collapsed && <span className="sidebar-menu-label">{item.label}</span>}
            </div>
          ))}
        </nav>
      </aside>}

      {/* ====== 右侧主区域 ====== */}
      <div className={mainClassName}>
        {/* ---- 顶部导航栏 ---- */}
        {showWorkbenchShell && <header className="top-navbar">
          {/* 左侧：折叠按钮 + 当前位置 */}
          <div className="navbar-left">
            <button
              className="navbar-collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Icon name={collapsed ? 'right' : 'left'} />
            </button>
            <span className="navbar-breadcrumb">工作台</span>
          </div>

          {/* 右侧：工作室选择 + 消息 + 用户 */}
          <div className="navbar-right">
            {/* 工作室选择 */}
            <div className="navbar-studio-wrap">
              <button
                className="navbar-studio-btn"
                onClick={() => setShowStudioDropdown(!showStudioDropdown)}
              >
                <span>{studio}</span>
                <Icon name="arrow-right" />
              </button>
              {showStudioDropdown && (
                <div className="navbar-dropdown">
                  {studios.map(s => (
                    <div
                      key={s}
                      className={`navbar-dropdown-item ${s === studio ? 'active' : ''}`}
                      onClick={() => { setStudio(s); setShowStudioDropdown(false) }}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 消息铃铛 - 打开抽屉 */}
            <button className="navbar-icon-btn" title="消息" onClick={openNoticeCenter}>
              <Icon name="bell" />
              {unreadCount > 0 && <span className="navbar-badge">{unreadCount}</span>}
            </button>

            {/* 用户名 */}
            <div className="navbar-user-wrap">
              <button
                className="navbar-user-btn"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
              >
                <Icon name="user" />
                <span>momo.zyy</span>
                <Icon name="arrow-right" />
              </button>
              {showUserDropdown && (
                <div className="navbar-dropdown user-dropdown">
                  <div
                    className="navbar-dropdown-item"
                    onClick={() => {
                      setShowUserDropdown(false)
                      window.location.hash = '/profile'
                    }}
                  >
                    个人中心
                  </div>
                  <div className="navbar-dropdown-item" onClick={logout}>退出登录</div>
                </div>
              )}
            </div>

          </div>
        </header>}

        {/* ---- 主内容区 ---- */}
        <main className={contentClassName}>
          {/* 1. 数据统计看板 */}
          <section className="stats-section">

            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="chart" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.todayPush}</div>
                <div className="stats-unit">人</div>
              </div>
              <div className="stats-label">今日推送量表</div>
            </div>
            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="order" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.todayAmount.toFixed(2)}</div>
                <div className="stats-unit">元</div>
              </div>
              <div className="stats-label">今日成交金额</div>
            </div>
            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="order" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.monthAmount.toFixed(2)}</div>
                <div className="stats-unit">元</div>
              </div>
              <div className="stats-label">本月成交金额</div>
            </div>
            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="order" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.yearAmount.toFixed(2)}</div>
                <div className="stats-unit">元</div>
              </div>
              <div className="stats-label">本年成交金额</div>
            </div>
            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="order" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.todayOrder}</div>
                <div className="stats-unit">笔</div>
              </div>
              <div className="stats-label">今日成交订单</div>
            </div>
            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="users" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.todayNew}</div>
                <div className="stats-unit">人</div>
              </div>
              <div className="stats-label">今日新增患者</div>
            </div>
            <div className="stats-card">
              <div className="stats-icon-wrap"><Icon name="users" size={24} /></div>
              <div className="stats-data">
                <div className="stats-num">{stats.totalPatients}</div>
                <div className="stats-unit">人</div>
              </div>
              <div className="stats-label">患者总数</div>
            </div>
          </section>

          {/* 2. 快捷入口 */}
          <section className="quick-actions-section">
            <div className="section-title-bar">
              <span className="section-title">快捷入口</span>
            </div>
            <div className="quick-actions-grid">
              {quickActions.map(action => (
                <div
                  key={action.label}
                  className="quick-action-item"
                  onClick={() => {
                    if (action.path === '/devices') {
                      setShowDeviceModal(true)
                      return
                    }
                    navigate(action.path)
                  }}
                >
                  <div className="qa-icon">{action.icon}</div>
                  <div className="qa-label">{action.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. 重点关注患者 */}
          <section className="key-patients-section">
            <div className="section-title-bar">
              <span className="section-title">重点关注患者</span>
            </div>
            <div className="patient-tabs-scroll">
              <div className="patient-tabs">
                {keyPatients.map(p => (
                  <div
                    key={p.id}
                    className={`patient-tab ${selectedPatient.id === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedPatient(p)}
                  >
                    {p.name}（{p.id}）
                  </div>
                ))}
              </div>
            </div>
            <div className="patient-detail-area">
              <div className="patient-detail-empty">暂无数据</div>
            </div>
          </section>

          {/* 4. 通知消息 + 今日任务 + 患者消息 */}
          <section className="info-section">
            {/* 通知消息 */}
            <div className="info-card notice-card">
              <div className="info-card-header">
                <span className="info-card-title">通知消息</span>
                <span
                  className="info-card-link"
                  onClick={openNoticeCenter}
                >
                  历史通知 →
                </span>
              </div>
              <div className="info-card-body">
                {notices.map(n => (
                  <div
                    key={n.id}
                    className={`notice-item ${n.unread ? 'unread' : ''}`}
                    onClick={openNoticeCenter}
                  >
                    {n.unread && <span className="unread-dot">●</span>}
                    <span className="notice-title">{n.title}</span>
                    <span className="notice-time">{formatTime(n.time)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 今日任务 + 患者消息 */}
            <div className="info-right-col">
              {/* 今日任务 */}
              <div className="info-card task-card">
                <div className="info-card-header">
                  <span className="info-card-title">今日任务</span>
                </div>
                <div className="info-card-body">
                  <div className="task-grid">
                    {todayTasks.map((t, i) => (
                      <div key={i} className="task-block">
                        <div className="task-block-title">
                          {t.name === '睡眠日记' && '🌙'}
                          {t.name === '打卡' && '✓'}
                          {t.name === '制定方案' && '📝'}
                          {t.name === '方案' && '📋'}
                          <span>{t.name}</span>
                        </div>
                        <div className="task-block-patients">
                          {t.patients.length > 0
                            ? t.patients.map(p => (
                              <span key={p.id} className="task-patient-tag">
                                {p.name}（{p.id}）
                              </span>
                            ))
                            : <span className="task-empty">（空）</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 患者消息 */}
              <div className="info-card msg-card">
                <div className="info-card-header">
                  <span className="info-card-title">患者消息</span>
                </div>
                <div className="info-card-body">
                  {patientMessages.map(m => (
                    <div key={m.id} className={`patient-msg-item ${m.unread ? 'unread' : ''}`}>
                      {m.unread && <span className="unread-dot">●</span>}
                      <div className="patient-msg-content">
                        {m.memberName ? `患者 ${m.memberName} 说：${m.content}` : m.content}
                      </div>
                      <div className="patient-msg-time">{m.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <div className="workbench-device-help-v2">
        <div className="title">如何进入设备管理？</div>
        <div className="desc">进入运营终端后，右下角有齿应用图标，可弹窗打开设备管理</div>
      </div>
      <button className="workbench-device-fab-v2" onClick={() => setShowDeviceModal(true)} title="扩展应用 / 设备管理">
        <span className="icon">⚙</span>
        <span>设备管理</span>
      </button>

      {/* 通知列表弹窗 */}
      {showNoticeModal && (
        <ModalOverlay onClose={() => setShowNoticeModal(false)}>
          <div className="notification-modal">
            <div className="modal-header">
              <div className="modal-title">通知消息</div>
              <div className="modal-close" onClick={() => setShowNoticeModal(false)}>×</div>
            </div>
            <div className="modal-body">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th style={{ width: 100, textAlign: 'left' }}>类型</th>
                    <th style={{ textAlign: 'left' }}>标题</th>
                    <th style={{ width: 120, textAlign: 'left' }}>时间</th>
                    <th style={{ width: 80, textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedNotices.map(n => (
                    <tr key={n.id}>
                      <td>{n.type}</td>
                      <td>{n.unread ? <strong>{n.title}</strong> : n.title}</td>
                      <td>{formatTime(n.time)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="table-link-btn" onClick={() => openNoticeDetail(n)}>查看</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="table-link-btn" onClick={markAllNoticeRead}>全部已读</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn-gray" disabled={noticePage <= 1} onClick={() => setNoticePage(p => Math.max(1, p - 1))}>上一页</button>
                <span style={{ fontSize: 12, color: '#64748B' }}>{noticePage}/{noticeTotalPages}</span>
                <button className="btn-gray" disabled={noticePage >= noticeTotalPages} onClick={() => setNoticePage(p => Math.min(noticeTotalPages, p + 1))}>下一页</button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 通知详情弹窗 */}
      {showNoticeDetail && selectedNotice && (
        <ModalOverlay onClose={() => setShowNoticeDetail(false)}>
          <div className="modal-container" style={{ width: 600 }}>
            <div className="modal-header">
              <div className="modal-title">公告详情</div>
              <div className="modal-close" onClick={() => setShowNoticeDetail(false)}>×</div>
            </div>
            <div className="modal-body">
              <div className="notice-detail-info">
                <span className="notice-detail-label">发送时间：</span>
                <span>{formatTime(selectedNotice.sentAt) || formatTime(selectedNotice.time)}</span>
              </div>
              <div className="notice-detail-content">
                <div className="notice-detail-label">通知内容：</div>
                <div className="notice-detail-text">
                  {selectedNotice.title === '新版评估量表上线通知' && (
                    <>尊敬的用户：<br/>我们高兴地通知您，新版评估量表已完成开发并正式上线。新量表在原有基础上进行了优化，增加了更多的评估维度，能够更全面地反映受评者的状态。请您及时更新并使用新版量表进行测评。如在使用过程中有任何疑问，请联系我们的客服团队。<br/><br/>智眠星运营团队<br/>2025年12月25日</>
                  )}
                  {selectedNotice.title === '系统已升级V1.2.0版本' && (
                    <>系统更新说明：<br/>1. 优化了页面加载速度<br/>2. 修复了若干已知问题<br/>3. 增加了新的数据分析功能<br/>4. 改进了用户界面体验<br/><br/>请及时更新以获得最佳使用体验。</>
                  )}
                  {selectedNotice.title === '系统暂停使用通知' && (
                    <>因系统升级维护需要，系统将于以下时间段暂停服务：<br/><br/>维护时间：2025年12月31日 00:00 - 06:00<br/><br/>请提前做好相关安排，感谢您的理解与支持。</>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer single-btn">
              <button className="btn-gray" onClick={() => setShowNoticeDetail(false)}>关闭</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 治疗结束确认核销弹窗 */}
      {showVerifyEndModal && (
        <ModalOverlay onClose={() => setShowVerifyEndModal(false)}>
          <div className="modal-container" style={{ width: 420 }}>
            <div className="modal-header">
              <div className="modal-title">确认核销</div>
              <div className="modal-close" onClick={() => setShowVerifyEndModal(false)}>×</div>
            </div>
            <div className="modal-body center-text">
              <div className="verify-end-msg">张新成 治疗已结束，请确认是否核销？</div>
            </div>
            <div className="modal-footer two-btns">
              <button className="btn-gray" onClick={() => setShowVerifyEndModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleConfirmVerify}>确认核销</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 扫码核销方案弹窗 */}
      {showVerifyScanModal && (
        <ModalOverlay onClose={() => setShowVerifyScanModal(false)}>
          <div className="modal-container" style={{ width: 600 }}>
            <div className="modal-header">
              <div className="modal-title">方案信息</div>
              <div className="modal-close" onClick={() => setShowVerifyScanModal(false)}>×</div>
            </div>
            <div className="modal-body">
              <div className="verify-scan-section">
                <div className="verify-section-label">方案信息</div>
                <div className="verify-section-content">张新成（患者ID: 1009） / 方案：睡眠改善14天计划 / 阶段：第2阶段</div>
              </div>
              <div className="verify-scan-section">
                <div className="verify-section-label">设备参数信息</div>
                <div className="verify-section-content">神经调控设备A-03，频率 30Hz，时长 20分钟，强度 2档</div>
              </div>
              <div className="verify-tip-yellow">
                显示方案信息和设备参数信息，支持按患者当次方案微调设备参数后执行。
              </div>
              <div className="verify-tip-red">
                核销动作触发外部设备按照服务方案的预定参数运行，并记录运行过程的数据及异常日志
              </div>
              {verifyResultMsg && (
                <div style={{ marginTop: 12, color: '#00A870', fontSize: 13 }}>
                  {verifyResultMsg}
                </div>
              )}
            </div>
            <div className="modal-footer two-btns">
              <button className="btn-gray" onClick={() => setShowVerifyScanModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleStartRun} disabled={verifyRunning}>
                {verifyRunning ? '运行中...' : '开始运行'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showDeviceModal && (
        <ModalOverlay onClose={() => setShowDeviceModal(false)}>
          <div className="modal-container workbench-device-modal-v2">
            <div className="modal-header">
              <div className="modal-title">设备管理</div>
              <div className="modal-close" onClick={() => setShowDeviceModal(false)}>×</div>
            </div>
            <div className="modal-body workbench-device-modal-body-v2">
              <DeviceManagePage />
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
