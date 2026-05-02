import React, { useEffect, useState } from 'react'

function getToken() {
  return localStorage.getItem('operation_token') || ''
}

function formatDate(d) {
  if (!d) return '-'
  return String(d).slice(0, 10)
}

function formatDateTime(d) {
  if (!d) return '-'
  return String(d).slice(0, 19).replace('T', ' ')
}

export default function BehaviorAnalysisPage() {
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [points, setPoints] = useState([])
  const [assessments, setAssessments] = useState([])
  const [checkins, setCheckins] = useState([])
  const [plans, setPlans] = useState([])
  const [error, setError] = useState('')

  // 从URL获取会员ID: /members/behavior/:id
  const memberId = window.location.hash.match(/\/members\/behavior\/(\d+)/)?.[1]

  useEffect(() => {
    if (!memberId) {
      setError('缺少会员ID')
      setLoading(false)
      return
    }
    loadAll()
  }, [memberId])

  async function loadAll() {
    setLoading(true)
    setError('')
    const token = getToken()
    const headers = { 'Authorization': 'Bearer ' + token }

    try {
      // 1. 会员基本信息
      const patientRes = await fetch(`/api/patients/${memberId}`, { headers })
      const patientData = await patientRes.json()
      const currentMember = patientData.code === 200 ? patientData.data : null
      if (currentMember) {
        setMember(currentMember)
      }

      // 2. 积分记录（从GM后端，用phone查）
      try {
        const gmLogin = await fetch('/gm/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'admin123' })
        })
        const gmLoginData = await gmLogin.json()
        const gmToken = gmLoginData.data?.token
        const phone = currentMember?.phone
        if (gmToken && phone) {
          const pointsRes = await fetch(`/gm/consume/points/records?keyword=${encodeURIComponent(phone)}&pageNum=1&pageSize=50`, {
            headers: { 'Authorization': gmToken }
          })
          const pointsData = await pointsRes.json()
          if (pointsData.code === 200 && pointsData.data?.list) {
            // 转换GM后端字段到前端期望格式
            const converted = pointsData.data.list.map(p => ({
              ...p,
              points: p.changeNum ? parseInt(String(p.changeNum).replace(/\D/g, '')) * (String(p.changeNum).startsWith('+') ? 1 : -1) : 0,
              type: String(p.changeNum).startsWith('+') ? 'earn' : 'redeem',
              reason: p.changeName || '',
              createTime: p.changeTime || ''
            }))
            setPoints(converted)
          }
        }
      } catch (e) {
        console.warn('积分记录加载失败:', e)
      }

      // 3. 评估记录
      try {
        const assessRes = await fetch(`/api/assessments/members/${memberId}`, { headers })
        const assessData = await assessRes.json()
        if (assessData.code === 200 && assessData.data) {
          setAssessments(Array.isArray(assessData.data) ? assessData.data : [])
        }
      } catch (e) {
        console.warn('评估记录加载失败:', e)
      }

      // 4. 打卡记录
      try {
        const today = new Date()
        const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().slice(0, 10)
        const endDate = today.toISOString().slice(0, 10)
        const checkinRes = await fetch(`/api/checkin/${memberId}?startDate=${startDate}&endDate=${endDate}`, { headers })
        const checkinData = await checkinRes.json()
        if (checkinData.code === 200 && checkinData.data) {
          setCheckins(Array.isArray(checkinData.data) ? checkinData.data : [])
        }
      } catch (e) {
        console.warn('打卡记录加载失败:', e)
      }

      // 5. 方案执行记录
      try {
        const plansRes = await fetch(`/api/plans/members?keyword=${memberId}`, { headers })
        const plansData = await plansRes.json()
        if (plansData.code === 200 && plansData.data) {
          setPlans(Array.isArray(plansData.data) ? plansData.data : [])
        }
      } catch (e) {
        console.warn('方案执行记录加载失败:', e)
      }
    } catch (e) {
      setError('加载失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#86909c' }}>
        <span>加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#ff4d4f' }}>
        <div style={{ marginBottom: 16 }}>{error}</div>
        <button onClick={() => window.location.hash = '/member'}>返回会员列表</button>
      </div>
    )
  }

  const genderMap = { '男': '先生', '女': '女士' }
  const m = member || {}

  const tabs = [
    { key: 'overview', label: '总览' },
    { key: 'points', label: `积分明细${points.length ? ` (${points.length})` : ''}` },
    { key: 'assessments', label: `评估记录${assessments.length ? ` (${assessments.length})` : ''}` },
    { key: 'checkins', label: `打卡记录${checkins.length ? ` (${checkins.length})` : ''}` },
    { key: 'plans', label: `方案执行${plans.length ? ` (${plans.length})` : ''}` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f7', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
      {/* 顶部导航 */}
      <div style={{ background: '#fff', padding: '12px 24px', borderBottom: '1px solid #e5e6eb', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => window.location.hash = '/member'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1650ff', fontSize: 14, padding: '4px 8px' }}
        >
          ← 会员列表
        </button>
        <span style={{ color: '#c9cdd4' }}>|</span>
        <span style={{ color: '#4e5969', fontSize: 14 }}>用户行为分析</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        {/* 会员信息卡 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #1650ff, #4c7cff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 600, flexShrink: 0
            }}>
              {(m.name || '未知').slice(0, 1)}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1f2329', marginBottom: 4 }}>
                {m.name || '-'} <span style={{ fontSize: 13, color: '#86909c', fontWeight: 400 }}>
                  {genderMap[m.gender] || ''}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#86909c' }}>
                手机：{m.phone || '-'} &nbsp;|&nbsp; 工作室：{m.studio || '-'} &nbsp;|&nbsp; 睡眠师：{m.therapist || '-'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#86909c' }}>注册时间</div>
              <div style={{ fontSize: 14, color: '#1f2329', fontWeight: 500 }}>{formatDateTime(m.create_time)}</div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '可用积分', value: m.points ?? '-', color: '#1650ff', bg: '#e8effe' },
              { label: '累计消费(元)', value: m.totalConsume ?? m.total_consume ?? '-', color: '#ff7d00', bg: '#fff7e6' },
              { label: '评估记录', value: assessments.length || '-', color: '#00b42a', bg: '#f0fff0' },
              { label: '打卡记录', value: checkins.length || '-', color: '#f53f3f', bg: '#fff1f0' },
            ].map((item, i) => (
              <div key={i} style={{ background: item.bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: '#86909c' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 标签切换 */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e6eb', padding: '0 16px' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  color: activeTab === tab.key ? '#1650ff' : '#646a73',
                  borderBottom: activeTab === tab.key ? '2px solid #1650ff' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {/* 总览 */}
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2329', marginBottom: 12 }}>基本信息</div>
                    {[
                      ['姓名', m.name || '-'],
                      ['手机号', m.phone || '-'],
                      ['性别', m.gender || '-'],
                      ['年龄', m.age || '-'],
                      ['职业', m.occupation || '-'],
                      ['婚姻', m.marital || '-'],
                      ['工作室', m.studio || '-'],
                      ['睡眠师', m.therapist || '-'],
                      ['分组', m.group_name || '-'],
                      ['注册时间', formatDateTime(m.create_time)],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #f2f3f5', fontSize: 13 }}>
                        <span style={{ width: 80, color: '#86909c', flexShrink: 0 }}>{label}</span>
                        <span style={{ color: '#1f2329' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2329', marginBottom: 12 }}>行为统计</div>
                    {[
                      ['积分记录', `${points.length} 条`],
                      ['评估记录', `${assessments.length} 条`],
                      ['打卡记录', `${checkins.length} 条`],
                      ['方案执行', `${plans.length} 条`],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #f2f3f5', fontSize: 13 }}>
                        <span style={{ width: 80, color: '#86909c', flexShrink: 0 }}>{label}</span>
                        <span style={{ color: '#1650ff', fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                    {points.length === 0 && assessments.length === 0 && checkins.length === 0 && plans.length === 0 && (
                      <div style={{ color: '#86909c', fontSize: 13, padding: '16px 0' }}>
                        暂无行为数据，请确认该会员已在小程序端产生操作记录。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 积分明细 */}
            {activeTab === 'points' && (
              <div>
                {points.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <div>暂无积分变动记录</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>会员在小程序中的积分获取与兑换记录将显示在此</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f7f8fa', color: '#646a73' }}>
                        {['时间', '类型', '积分变化', '说明'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f2f3f5' }}>
                          <td style={{ padding: '10px 12px', color: '#646a73' }}>{formatDateTime(p.createTime)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 12,
                              background: p.type === 'earn' || p.points > 0 ? '#e8ffe8' : '#fff1f0',
                              color: p.type === 'earn' || p.points > 0 ? '#00b42a' : '#f53f3f'
                            }}>
                              {p.type === 'earn' ? '获取' : '兑换'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: p.points > 0 ? '#00b42a' : '#f53f3f', fontWeight: 600 }}>
                            {p.points > 0 ? '+' : ''}{p.points || 0}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#1f2329' }}>{p.description || p.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 评估记录 */}
            {activeTab === 'assessments' && (
              <div>
                {assessments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <div>暂无评估记录</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>在干预方案中进行评估后，记录将显示在此</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f7f8fa', color: '#646a73' }}>
                        {['评估日期', '评估模板', '总分', '风险等级', '评估师', '工作室'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.map((a, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f2f3f5' }}>
                          <td style={{ padding: '10px 12px', color: '#646a73' }}>{formatDate(a.assessment_date || a.assessmentDate)}</td>
                          <td style={{ padding: '10px 12px', color: '#1f2329' }}>{a.template_name || a.templateName || '-'}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1650ff' }}>{a.total_score ?? a.totalScore ?? '-'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {a.risk_level || a.riskLevel ? (
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 12,
                                background: a.risk_level >= 3 ? '#fff1f0' : '#e8ffe8',
                                color: a.risk_level >= 3 ? '#f53f3f' : '#00b42a'
                              }}>
                                {a.risk_level >= 3 ? '高风险' : '低风险'}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#1f2329' }}>{a.therapist || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#1f2329' }}>{a.workshop || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 打卡记录 */}
            {activeTab === 'checkins' && (
              <div>
                {checkins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏃</div>
                    <div>暂无打卡记录</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>会员在小程序端完成每日打卡后，记录将显示在此</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f7f8fa', color: '#646a73' }}>
                        {['打卡日期', '会员', '类型', '内容'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {checkins.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f2f3f5' }}>
                          <td style={{ padding: '10px 12px', color: '#646a73' }}>{formatDate(c.checkin_date || c.checkinDate || c.diary_date)}</td>
                          <td style={{ padding: '10px 12px', color: '#1f2329' }}>{c.memberName || c.member_name || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#1650ff', fontSize: 12 }}>{c.type || '打卡'}</td>
                          <td style={{ padding: '10px 12px', color: '#86909c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.content || c.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 方案执行 */}
            {activeTab === 'plans' && (
              <div>
                {plans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#86909c' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <div>暂无方案执行记录</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>在干预方案中创建并执行方案后，记录将显示在此</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f7f8fa', color: '#646a73' }}>
                        {['方案名称', '类型', '开始日期', '结束日期', '时长', '状态'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f2f3f5' }}>
                          <td style={{ padding: '10px 12px', color: '#1f2329', fontWeight: 500 }}>{p.plan_name || p.planName || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#86909c', fontSize: 12 }}>{p.plan_type || p.planType || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#646a73' }}>{formatDate(p.start_date || p.startDate)}</td>
                          <td style={{ padding: '10px 12px', color: '#646a73' }}>{formatDate(p.end_date || p.endDate)}</td>
                          <td style={{ padding: '10px 12px', color: '#646a73' }}>{p.duration_days || p.durationDays ? `${p.duration_days || p.durationDays}天` : '-'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {p.status !== undefined ? (
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 12,
                                background: p.status === 'active' || p.status === '执行中' ? '#e8ffe8' : '#f7f8fa',
                                color: p.status === 'active' || p.status === '执行中' ? '#00b42a' : '#86909c'
                              }}>
                                {p.status === 'active' ? '执行中' : p.status === 'completed' ? '已完成' : p.status === '已暂停' ? '已暂停' : String(p.status)}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
