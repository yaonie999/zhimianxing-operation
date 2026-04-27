import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const AVATAR_MALE = 'https://api.dicebear.com/7.x/avataaars/svg?seed=male1&backgroundColor=b6e3f4'
const AVATAR_FEMALE = 'https://api.dicebear.com/7.x/avataaars/svg?seed=female1&backgroundColor=ffd5dc'

const LEFT_MENU_SECTIONS = [
  {
    title: '入组/问询/评估',
    items: [
      { key: 'consent', label: '入组同意书' },
      { key: 'interview', label: '睡眠访谈' },
      { key: 'diary', label: '睡眠日记' },
      { key: 'scale', label: '推送量表' },
      { key: 'assessment', label: '测评记录' },
    ]
  },
  {
    title: '方案和报告',
    items: [
      { key: 'plan', label: '睡眠方案' },
      { key: 'execution', label: '计划' },
      { key: 'report', label: '睡眠报告' },
      { key: 'checkin', label: '打卡记录' },
      { key: 'timeline', label: '用户旅程时间轴' },
      { key: 'behavior', label: '用户行为轨迹' },
    ]
  }
]

const ITEM_TYPE_MAP = {
  '音乐放松': '🎵 音乐放松',
  '经颅磁刺激': '🧲 经颅磁刺激',
  '睡眠咨询': '📋 睡眠咨询',
  '中医调理': '🌿 中医调理',
}

function fmtTime(s) {
  if (!s) return '-'
  return String(s).replace('T', ' ').substring(0, 19)
}
function formatMemberId(num) {
  if (!num) return '-'
  const n = Number(num)
  if (isNaN(n)) return '-'
  const letter = String.fromCharCode(65 + Math.floor(n / 100000))
  const numPart = String(n % 100000).padStart(5, '0')
  return `${letter}${numPart}`
}
function maskPhone(p) {
  if (!p) return '-'
  const s = String(p)
  if (s.length >= 11) return s.substring(0, 3) + '****' + s.substring(7)
  return s
}
function riskLabel(r) {
  const m = { low: '低风险', medium: '中风险', high: '高风险' }
  return m[r] || r || '-'
}
function riskColor(r) {
  return r === 'high' ? '#ef4444' : r === 'medium' ? '#f97316' : '#22c55e'
}

export default function MemberDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leftTab, setLeftTab] = useState('consent')
  const [rightActive, setRightActive] = useState('info')

  // Data per tab
  const [interview, setInterview] = useState(null)
  const [diary, setDiary] = useState(null)
  const [scales, setScales] = useState([])
  const [assessments, setAssessments] = useState([])
  const [plans, setPlans] = useState([])
  const [reports, setReports] = useState([])
  const [planTemplates, setPlanTemplates] = useState([])

  // Push scale panel
  const [scalePanelOpen, setScalePanelOpen] = useState(false)
  const [selectedScaleIds, setSelectedScaleIds] = useState([])
  const [leftSearch, setLeftSearch] = useState('')
  const [rightSearch, setRightSearch] = useState('')

  useEffect(function() {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/patients/' + id)
        const data = await res.json().catch(function() { return null })
        if (!res.ok || !data || !data.data) throw new Error(data?.message || '加载失败')
        if (mounted) setMember(data.data)
      } catch (e) {
        if (mounted) setError(e.message || '加载失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return function() { mounted = false }
  }, [id])

  // Load tab data when leftTab changes
  useEffect(function() {
    if (!leftTab) return
    loadTabData(leftTab)
  }, [leftTab, id])

  async function loadTabData(tab) {
    switch (tab) {
      case 'interview': {
        const res = await fetch('/api/sleep/interview/' + id + '/latest')
        const data = await res.json().catch(function() { return null })
        if (data && data.data) setInterview(data.data)
        break
      }
      case 'diary': {
        const res = await fetch('/api/sleep/diary/' + id)
        const data = await res.json().catch(function() { return null })
        if (data && data.data) setDiary(data.data)
        break
      }
      case 'scale': {
        const res = await fetch('/api/scale-items/templates')
        const data = await res.json().catch(function() { return null })
        if (data && data.data) setScales(data.data)
        break
      }
      case 'record': {
        const res = await fetch('/api/assessments/members/' + id)
        const data = await res.json().catch(function() { return null })
        if (data && Array.isArray(data.data)) setAssessments(data.data)
        break
      }
      case 'plan': {
        const res = await fetch('/api/plans/members/' + id)
        const data = await res.json().catch(function() { return null })
        if (data && Array.isArray(data.data)) setPlans(data.data)
        const tres = await fetch('/api/plan-templates')
        const tdata = await tres.json().catch(function() { return null })
        if (tdata && Array.isArray(tdata.data)) setPlanTemplates(tdata.data)
        break
      }
      case 'report': {
        const res = await fetch('/api/reports/members/' + id)
        const data = await res.json().catch(function() { return null })
        if (data && Array.isArray(data.data)) setReports(data.data)
        break
      }
    }
  }

  function toggleScaleItem(itemId, checked) {
    setSelectedScaleIds(function(prev) {
      return checked ? [...new Set([...prev, itemId])] : prev.filter(function(x) { return x !== itemId })
    })
  }

  function toggleScaleCat(catItems, checked) {
    const ids = catItems.map(function(i) { return i.id })
    setSelectedScaleIds(function(prev) {
      if (checked) return [...new Set([...prev, ...ids])]
      return prev.filter(function(x) { return ids.indexOf(x) < 0 })
    })
  }

  function handleRemoveScale(itemId) {
    setSelectedScaleIds(function(prev) { return prev.filter(function(x) { return x !== itemId }) })
  }

  function handleConfirmScales() {
    if (selectedScaleIds.length === 0) {
      window.alert('请选择至少一个量表')
      return
    }
    window.alert('已推送 ' + selectedScaleIds.length + ' 个量表')
    setScalePanelOpen(false)
  }

  function handleCancelScales() {
    setScalePanelOpen(false)
    setSelectedScaleIds([])
  }

  // Group scales by category
  var scaleCats = {}
  scales.forEach(function(s) {
    var cat = s.category || '其他'
    if (!scaleCats[cat]) scaleCats[cat] = []
    scaleCats[cat].push(s)
  })

  var filteredScales = {}
  if (leftSearch.trim() === '') {
    filteredScales = scaleCats
  } else {
    Object.keys(scaleCats).forEach(function(cat) {
      var matched = scaleCats[cat].filter(function(s) {
        return s.name.toLowerCase().indexOf(leftSearch.toLowerCase()) >= 0
      })
      if (matched.length > 0) filteredScales[cat] = matched
    })
  }

  var rightSelected = scales.filter(function(s) {
    return selectedScaleIds.indexOf(s.id) >= 0 &&
      (rightSearch.trim() === '' || s.name.toLowerCase().indexOf(rightSearch.toLowerCase()) >= 0)
  })

  var avatar = (member && member.gender === '男') ? AVATAR_MALE : AVATAR_FEMALE

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#64748b',fontSize:14}}>
        加载中...
      </div>
    )
  }
  if (error || !member) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#dc2626',fontSize:14}}>
        {error || '未找到该会员'}
      </div>
    )
  }

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden',background:'#f5f5f5'}}>
      {/* 左侧会员信息卡 */}
      <div style={{width:260,flexShrink:0,background:'#fff',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* 顶部页签 */}
        <div style={{display:'flex',borderBottom:'1px solid #e5e7eb'}}>
          <div style={{flex:1,padding:'10px 12px',textAlign:'center',fontSize:13,color:'#64748b',cursor:'pointer',borderRight:'1px solid #e5e7eb'}}>工作台</div>
          <div style={{flex:1,padding:'10px 12px',textAlign:'center',fontSize:13,color:'#3b82f6',fontWeight:600,cursor:'pointer',background:'#eff6ff'}}>患者姓名：{member.name}</div>
        </div>

        {/* 患者信息卡片 */}
        <div style={{padding:'16px',borderBottom:'1px solid #e5e7eb',background:'#fafafa'}}>
          <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
            <img src={avatar} alt="avatar" style={{width:48,height:48,borderRadius:'50%',background:'#e8f4fd',marginRight:12}} />
            <div>
              <div style={{fontSize:15,fontWeight:600,color:'#1e293b',marginBottom:2}}>{member.name}</div>
              <div style={{fontSize:12,color:'#64748b'}}>{member.gender || '男'}，{member.age || '-'}岁，{member.marriage || '未婚'}</div>
            </div>
          </div>
          <div style={{fontSize:12,color:'#3b82f6',marginBottom:8}}>小绵羊普通会员 · 28积分</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:600,color:'#1e293b'}}>基本资料</span>
            <button style={{fontSize:11,color:'#3b82f6',background:'none',border:'none',cursor:'pointer',padding:'2px 6px'}}>编辑</button>
          </div>
          <div style={{fontSize:11,color:'#64748b',lineHeight:'20px'}}>
            <div>卡号：{formatMemberId(member.id)}</div>
            <div>电话：{maskPhone(member.phone)}</div>
            <div>职业：{member.profession || '-'}</div>
            <div>分组：{member.group_name || member.group || '-'}</div>
            <div>建档：{fmtTime(member.create_time).substring(0,10)}</div>
            <div>睡眠师：{member.sleep_manager || member.sleepTherapist || '-'}</div>
          </div>
        </div>

        {/* 左侧导航菜单 */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {LEFT_MENU_SECTIONS.map(function(section, sIdx) {
            return (
              <div key={sIdx}>
                <div style={{padding:'8px 16px 4px',fontSize:12,color:'#64748b',fontWeight:700}}>{section.title}</div>
                {section.items.map(function(item) {
                  return (
                    <div key={item.key} onClick={function() { setLeftTab(leftTab === item.key ? '' : item.key) }}
                      style={{padding:'8px 16px',fontSize:13,cursor:'pointer',background: leftTab === item.key ? '#eff6ff' : 'transparent',color: leftTab === item.key ? '#3b82f6' : '#475569',fontWeight: leftTab === item.key ? 600 : 400}}>
                      {item.label}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* 内容区 */}
        <div style={{flex:1,overflowY:'auto',padding:'0 16px 16px'}}>
          {!leftTab ? (
            <div style={{background:'#fff',padding:24,borderRadius:8,border:'1px solid #e5e7eb',textAlign:'center',color:'#94a3b8',fontSize:14}}>
              请选择左侧菜单查看详情
            </div>
          ) : leftTab === 'consent' ? (
            <div style={{background:'#fff',margin:16,padding:24,borderRadius:8,border:'1px solid #e5e7eb'}}>
              {/* 操作按钮 */}
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                <button style={{padding:'6px 16px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:13}}>导出</button>
                <button style={{padding:'6px 16px',background:'#fff',color:'#475569',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:13}}>打印</button>
              </div>
              {/* 文档标题 */}
              <div style={{fontSize:18,fontWeight:600,color:'#1e293b',textAlign:'center',marginBottom:20}}>短程行为治疗入组知情同意书</div>
              {/* 患者基本信息 */}
              <div style={{display:'flex',gap:32,fontSize:13,marginBottom:24,color:'#475569'}}>
                <div><span style={{color:'#64748b'}}>姓名：</span><span style={{color:'#1e293b'}}>{member.name}</span></div>
                <div><span style={{color:'#64748b'}}>性别：</span><span style={{color:'#1e293b'}}>{member.gender || '男'}</span></div>
                <div><span style={{color:'#64748b'}}>年龄：</span><span style={{color:'#1e293b'}}>{member.age || '-'}</span></div>
                <div><span style={{color:'#64748b'}}>联系电话：</span><span style={{color:'#1e293b'}}>{member.phone || '-'}</span></div>
              </div>
              {/* 正文内容 */}
              <div style={{fontSize:13,color:'#475569',lineHeight:2}}>
                <p style={{marginBottom:12}}>尊敬的睡眠心理科患者及家属：您好！</p>

                <p style={{marginBottom:16}}><strong>一、治疗介绍</strong></p>
                <p style={{marginBottom:12}}>短程行为治疗是基于BBTi（失眠的短程行为治疗）理论的"生物-心理-医学"全新管理模式。旨在通过改变患者对睡眠的认知和行为，建立个性化的习惯，帮助患者自我调控睡眠，提高治愈率。主要针对睡眠障碍及伴随焦虑抑郁情绪的患者。</p>

                <p style={{marginBottom:16}}><strong>二、费用与周期</strong></p>
                <p style={{marginBottom:12}}>明确管理周期为14天。费用为一次性收费（___元/人）。要求参与者全程配合反馈与调整。若中途因个人原因退出，不予退费。</p>

                <p style={{marginBottom:16}}><strong>三、保密原则</strong></p>
                <p style={{marginBottom:12}}>承诺履行保密原则，机构有责任保护隐私。但在专业范围内进行案例讨论时，会隐藏身份信息。</p>

                <p style={{marginBottom:16}}><strong>四、保密例外</strong></p>
                <p style={{marginBottom:8}}>下列情况下可不遵循保密原则：</p>
                <ol style={{marginBottom:12,paddingLeft:20}}>
                  <li>发现患者有伤害自身、致伤他人的严重危险时；</li>
                  <li>患者患有致命传染病或其他可能危及自身及他人安全的疾病时；</li>
                  <li>未成年人在受到性侵犯或虐待时；</li>
                  <li>法律规定需要披露时。</li>
                </ol>

                <p style={{marginBottom:16}}><strong>五、权利说明</strong></p>
                <p style={{marginBottom:16}}>评估解释权归属于xx医院睡眠心理科。</p>

                <p style={{marginBottom:24}}><strong>六、确认声明</strong></p>
                <p style={{marginBottom:32}}>我是短程行为治疗的参与者，我对所提供的信息承担一切法律责任，已经阅读、理解并且同意上述条款。</p>

                {/* 落款 */}
                <div style={{display:'flex',justifyContent:'flex-end',gap:48,marginTop:24}}>
                  <div>
                    <div style={{marginBottom:16}}>参与者签字：<span style={{color:'#1e293b'}}>{member.name}</span></div>
                    <div>日  期：<span style={{color:'#1e293b'}}>{fmtTime(member.create_time).substring(0,10).replace(/-/g,'.')}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : leftTab === 'interview' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16,gap:8}}>
                <button style={{padding:'6px 16px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:13}}>导出</button>
                <button style={{padding:'6px 16px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:13}}>打印</button>
              </div>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',textAlign:'center',marginBottom:24}}>睡眠访谈</div>
              {/* 基本资料 */}
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>1. 基本资料</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,fontSize:13}}>
                  <div><span style={{color:'#64748b'}}>姓名：</span><span>{member.name}</span></div>
                  <div><span style={{color:'#64748b'}}>性别：</span><span>{member.gender || '男'}</span></div>
                  <div><span style={{color:'#64748b'}}>年龄：</span><span>{member.age || '-'}</span></div>
                  <div><span style={{color:'#64748b'}}>职业：</span><span>{member.profession || '-'}</span></div>
                  <div><span style={{color:'#64748b'}}>婚姻状况：</span><span>{member.marriage || '-'}</span></div>
                  <div><span style={{color:'#64748b'}}>联系电话：</span><span>{member.phone || '-'}</span></div>
                </div>
              </div>
              {/* 睡眠问题主诉 */}
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>2. 睡眠问题主诉</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:6}}>发生睡眠问题的具体时间/原因：</div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4,fontSize:13,color:'#475569',minHeight:60}}>{interview?.chiefComplaint || '暂无'}</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,fontSize:12,marginBottom:12}}>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.1 入睡困难</div>
                    <div>次数/周：<span style={{color:'#1e293b'}}>{interview?.difficultySleeping || 0}</span></div>
                    <div>入睡时长：<span style={{color:'#1e293b'}}>{interview?.sleepLatency || 0}</span>分钟</div>
                  </div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.2 多梦</div>
                    <div>次数/周：<span style={{color:'#1e293b'}}>{interview?.dreaming || 0}</span></div>
                  </div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.3 夜间觉醒</div>
                    <div>次数/周：<span style={{color:'#1e293b'}}>{interview?.nightAwakening || 0}</span></div>
                    <div>觉醒时长：<span style={{color:'#1e293b'}}>{interview?.awakeningDuration || 0}</span>分钟</div>
                  </div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.4 药物入睡</div>
                    <div>次数/周：<span style={{color:'#1e293b'}}>{interview?.medicationSleep || 0}</span></div>
                    <div>服药时长：<span style={{color:'#1e293b'}}>{interview?.medicationDuration || 0}</span>分钟</div>
                  </div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.5 不好/浅睡</div>
                    <div>次数/周：<span style={{color:'#1e293b'}}>{interview?.lightSleep || 0}</span></div>
                  </div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.6 总睡眠</div>
                    <div><span style={{color:'#1e293b'}}>{interview?.totalSleep || 0}</span>小时</div>
                  </div>
                  <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                    <div style={{color:'#64748b',marginBottom:4}}>2.7 早醒</div>
                    <div>次数/周：<span style={{color:'#1e293b'}}>{interview?.earlyAwakening || 0}</span></div>
                    <div>早于：<span style={{color:'#1e293b'}}>{interview?.earlyAwakeningTime || 0}</span>分钟</div>
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:8}}>2.8 白天精神状态：</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {['精神恍惚','特别困倦','没精打采','精力正常','充满活力'].map(function(s) {
                      return <span key={s} style={{padding:'4px 10px',background:'#f1f5f9',borderRadius:4,fontSize:12,color:'#475569'}}>{s}</span>
                    })}
                  </div>
                </div>
              </div>
              {/* 睡眠习惯 */}
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>3. 睡眠习惯</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:12}}>
                  <div>
                    <div style={{marginBottom:8}}>上床时间：<span style={{color:'#1e293b'}}>{interview?.bedTime || '--:--'}</span></div>
                    <div style={{marginBottom:8}}>关灯就寝时间：<span style={{color:'#1e293b'}}>{interview?.lightsOutTime || '--:--'}</span></div>
                    <div style={{marginBottom:8}}>入睡所需时间：<span style={{color:'#1e293b'}}>{interview?.sleepOnsetTime || 0}分钟</span></div>
                    <div style={{marginBottom:8}}>半夜醒来次数/时间：<span style={{color:'#1e293b'}}>{interview?.midNightWake || '--'}</span></div>
                    <div>起床时间：<span style={{color:'#1e293b'}}>{interview?.wakeTime || '--:--'}</span></div>
                  </div>
                  <div>
                    <div style={{marginBottom:8}}>多梦：<span style={{color:'#1e293b'}}>{interview?.dreaming || 0}次/周</span></div>
                    <div style={{marginBottom:8}}>药物入睡：<span style={{color:'#1e293b'}}>{interview?.medicationSleep || 0}次/周</span></div>
                    <div style={{marginBottom:8}}>总睡眠：<span style={{color:'#1e293b'}}>{interview?.totalSleep || 0}小时</span></div>
                    <div style={{marginBottom:8}}>白天精神：<span style={{color:'#1e293b'}}>精力正常</span></div>
                    <div>早上醒来时间：<span style={{color:'#1e293b'}}>{interview?.morningWakeTime || '--:--'}</span></div>
                  </div>
                </div>
              </div>
              {/* 与睡眠有关的行为 */}
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>4. 与睡眠有关的行为</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:12}}>
                  <div>
                    <div style={{marginBottom:8}}>咖啡/烟/茶/酒/其他：<span style={{color:'#1e293b'}}>无</span></div>
                    <div>在床上从事其他活动：<span style={{color:'#1e293b'}}>无</span></div>
                  </div>
                  <div>
                    <div style={{marginBottom:8}}>运动：<span style={{color:'#1e293b'}}>每周3次</span></div>
                    <div>睡眠环境：<span style={{color:'#1e293b'}}>安静、温度适宜</span></div>
                  </div>
                </div>
              </div>
              {/* 心理/情绪问题史 */}
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>5. 心理/情绪问题史</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:6}}>压力 (压力原因与因由)：</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                      <div style={{color:'#64748b',marginBottom:4}}>家庭方面</div>
                      <div style={{color:'#1e293b'}}>{interview?.familyStress || '无明显压力'}</div>
                    </div>
                    <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:4}}>
                      <div style={{color:'#64748b',marginBottom:4}}>工作方面</div>
                      <div style={{color:'#1e293b'}}>{interview?.workStress || '无明显压力'}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:8}}>人格特质：</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {['焦虑特质','神经质','悲观','虚荣倾向','情绪内化','完美主义','控制欲强'].map(function(s) {
                      return <span key={s} style={{padding:'4px 10px',background:'#f1f5f9',borderRadius:4,fontSize:12,color:'#475569'}}>{s}</span>
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : leftTab === 'diary' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontSize:13,color:'#64748b'}}>
                  <button style={{padding:'4px 12px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',marginRight:8,cursor:'pointer'}}>设置天数 (1)</button>
                  <button style={{padding:'4px 12px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',marginRight:8,cursor:'pointer'}}>提醒</button>
                  <button style={{padding:'4px 12px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',marginRight:8,cursor:'pointer'}}>已反馈</button>
                  <button style={{padding:'4px 12px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',marginRight:8,cursor:'pointer'}}>导出</button>
                  <button style={{padding:'4px 12px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer'}}>打印</button>
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <span style={{fontSize:16,fontWeight:600,color:'#1e293b'}}>{member.name}的睡眠日记</span>
                <span style={{marginLeft:12,fontSize:13,color:'#3b82f6',cursor:'pointer'}}>趋势</span>
              </div>
              {/* 时间轴图表 */}
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{fontSize:11,color:'#64748b'}}>时间范围：20:00 - 10:00</div>
                  <div style={{display:'flex',gap:16,fontSize:11,color:'#64748b'}}>
                    <span><span style={{display:'inline-block',width:12,height:12,background:'#bfdbfe',marginRight:4}}></span>卧床期</span>
                    <span><span style={{display:'inline-block',width:12,height:12,background:'#3b82f6',marginRight:4}}></span>睡眠期</span>
                    <span><span style={{display:'inline-block',width:12,height:12,background:'#f97316',marginRight:4}}></span>觉醒时刻</span>
                  </div>
                </div>
                {/* 模拟睡眠数据 */}
                {[
                  {date:'01.10',week:'周一',bed:'23:45',sleep:'00:35',wake:'06:50',total:'6.8h',awake:2,status:['精力正常']},
                  {date:'01.11',week:'周二',bed:'23:30',sleep:'00:10',wake:'07:00',total:'6.5h',awake:1,status:['没精打采']},
                  {date:'01.12',week:'周三',bed:'00:00',sleep:'00:45',wake:'07:30',total:'6.0h',awake:3,status:['特别困倦']},
                  {date:'01.13',week:'周四',bed:'23:15',sleep:'23:50',wake:'06:40',total:'7.2h',awake:0,status:['充满活力']},
                  {date:'01.14',week:'周五',bed:'23:00',sleep:'23:40',wake:'06:30',total:'7.0h',awake:1,status:['精力正常']},
                  {date:'01.15',week:'周六',bed:'00:30',sleep:'01:20',wake:'08:00',total:'6.5h',awake:2,status:['没精打采']},
                  {date:'01.16',week:'周日',bed:'23:00',sleep:'23:30',wake:'07:00',total:'7.5h',awake:0,status:['充满活力']},
                ].map(function(day, idx) {
                  return (
                    <div key={idx} style={{display:'flex',alignItems:'center',marginBottom:12,padding:'8px 12px',background:'#f9fafb',borderRadius:6}}>
                      <div style={{width:60,fontSize:12}}>
                        <div style={{fontWeight:600,color:'#1e293b'}}>{day.date}</div>
                        <div style={{color:'#94a3b8'}}>{day.week}</div>
                      </div>
                      <div style={{flex:1,marginLeft:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}>
                          {day.status.map(function(s) {
                            return <span key={s} style={{padding:'2px 6px',background:s === '充满活力'?'#dcfce7':s === '特别困倦'?'#ffedd5':'#fef9c3',color:s === '充满活力'?'#16a34a':s === '特别困倦'?'#ea580c':'#ca8a04',borderRadius:3,fontSize:10}}>{s}</span>
                          })}
                        </div>
                        <div style={{height:24,background:'#bfdbfe',borderRadius:3,position:'relative',minWidth:200}}>
                          <div style={{position:'absolute',left:'20%',top:0,bottom:0,width:'60%',background:'#3b82f6',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <span style={{fontSize:10,color:'#fff'}}>睡眠</span>
                          </div>
                        </div>
                      </div>
                      <div style={{width:50,fontSize:11,color:'#64748b',textAlign:'right'}}>
                        <div>上：{day.bed}</div>
                        <div>睡：{day.sleep}</div>
                        <div>起：{day.wake}</div>
                      </div>
                      <div style={{width:60,textAlign:'right'}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#3b82f6'}}>{day.total}</div>
                        <div style={{fontSize:11,color:'#f97316'}}>醒{day.awake}次</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : leftTab === 'scale' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontSize:16,fontWeight:600,color:'#1e293b'}}>推送量表</div>
                <button style={{padding:'6px 16px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:13}}>推送</button>
              </div>
              <div style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:40}}>
                {scales.length > 0 ? scales.length + ' 个量表模板' : '暂无量表模板'}
              </div>
            </div>
          ) : leftTab === 'assessment' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:16}}>测评记录</div>
              {assessments && assessments.length > 0 ? (
                <div>{JSON.stringify(assessments, null, 2)}</div>
              ) : (
                <div style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:40}}>暂无测评记录</div>
              )}
            </div>
          ) : leftTab === 'plan' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:16}}>睡眠方案</div>
              {plans && plans.length > 0 ? (
                <div>{JSON.stringify(plans, null, 2)}</div>
              ) : (
                <div style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:40}}>暂无方案记录</div>
              )}
            </div>
          ) : leftTab === 'report' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:16}}>睡眠报告</div>
              {reports && reports.length > 0 ? (
                <div>{JSON.stringify(reports, null, 2)}</div>
              ) : (
                <div style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:40}}>暂无报告记录</div>
              )}
            </div>
          ) : leftTab === 'checkin' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:16}}>打卡记录</div>
              <div style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:40}}>暂无打卡记录</div>
            </div>
          ) : leftTab === 'timeline' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:20}}>用户旅程时间轴</div>
              <div style={{position:'relative',paddingLeft:24}}>
                <div style={{position:'absolute',left:8,top:0,bottom:0,width:2,background:'#e5e7eb'}}></div>
                {[
                  {date:'2023-08-15',title:'用户注册',desc:'通过推荐链接注册成为会员'},
                  {date:'2023-08-20',title:'首次评估',desc:'完成健康评估问卷，系统生成初步用户画像'},
                  {date:'2023-08-25',title:'首次消费',desc:'购买智能手环，开始健康数据监测'},
                  {date:'2023-09-10',title:'方案执行',desc:'开始执行"7天睡眠改善方案"，设备每日自动运行'},
                  {date:'2023-09-20',title:'二次消费',desc:'购买健康咨询服务，升级为银牌会员'},
                  {date:'2023-10-15',title:'效果评估',desc:'完成方案效果评估，睡眠质量提升30%'},
                ].map(function(item, idx) {
                  return (
                    <div key={idx} style={{position:'relative',paddingBottom:24,display:'flex'}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:'#3b82f6',position:'absolute',left:-20,top:4,border:'2px solid #fff',boxShadow:'0 0 0 2px #3b82f6'}}></div>
                      <div style={{marginLeft:16}}>
                        <div style={{fontSize:12,color:'#94a3b8',marginBottom:2}}>{item.date}</div>
                        <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:4}}>{item.title}</div>
                        <div style={{fontSize:12,color:'#64748b'}}>{item.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : leftTab === 'behavior' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:20}}>用户行为轨迹</div>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>用户行为分析</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:8,height:120,marginBottom:8}}>
                  {[12,18,15,22,28,35,30].map(function(h, i) {
                    const days = ['周一','周二','周三','周四','周五','周六','周日']
                    return (
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                        <div style={{width:'100%',height:h*3,background:i>=5?'#3b82f6':'#93c5fd',borderRadius:4,marginBottom:4}}></div>
                        <div style={{fontSize:10,color:'#64748b'}}>{days[i]}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{fontSize:11,color:'#94a3b8',textAlign:'center'}}>最近7天行为频率变化</div>
              </div>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:12}}>近期行为记录</div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#f9fafb'}}>
                      <th style={{padding:'8px 12px',textAlign:'left',color:'#64748b',fontWeight:500}}>序号</th>
                      <th style={{padding:'8px 12px',textAlign:'left',color:'#64748b',fontWeight:500}}>行为</th>
                      <th style={{padding:'8px 12px',textAlign:'left',color:'#64748b',fontWeight:500}}>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {id:1,action:'记录睡眠日记',time:'2016-09-21 08:50:08'},
                      {id:2,action:'打卡',time:'2016-09-21 08:52:15'},
                      {id:3,action:'发表动态',time:'2016-09-21 09:15:33'},
                      {id:4,action:'查看报告',time:'2016-09-21 10:30:00'},
                      {id:5,action:'分享文章',time:'2016-09-21 14:20:45'},
                    ].map(function(row) {
                      return (
                        <tr key={row.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{padding:'8px 12px',color:'#64748b'}}>{row.id}</td>
                          <td style={{padding:'8px 12px',color:'#1e293b'}}>{row.action}</td>
                          <td style={{padding:'8px 12px',color:'#64748b'}}>{row.time}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#1e293b'}}>智能推送</div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={{padding:'4px 12px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:12}}>添加推送规则</button>
                    <button style={{padding:'4px 12px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:12}}>历史推送</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:12}}>
                  {[
                    {name:'睡眠质量提醒',status:'已启用',rule:'当用户连续3天睡眠时间少于6小时且晚上11点后未入睡时触发推送'},
                    {name:'设备使用提醒',status:'已启用',rule:'当用户超过7天未使用智能按摩仪时触发推送'},
                    {name:'健康数据记录提醒',status:'已启用',rule:'当用户连续2天未记录健康数据时触发推送'},
                  ].map(function(item, idx) {
                    return (
                      <div key={idx} style={{flex:1,border:'1px solid #e5e7eb',borderRadius:8,padding:12}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#1e293b'}}>{item.name}</div>
                          <span style={{padding:'2px 6px',background:'#dcfce7',color:'#16a34a',borderRadius:3,fontSize:10}}>{item.status}</span>
                        </div>
                        <div style={{fontSize:11,color:'#64748b',marginBottom:8,lineHeight:1.5}}>{item.rule}</div>
                        <div style={{display:'flex',gap:4}}>
                          <button style={{flex:1,padding:'4px 8px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:10}}>禁用</button>
                          <button style={{padding:'4px 8px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:10}}>删除</button>
                          <button style={{padding:'4px 8px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:10}}>编辑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : leftTab === 'execution' ? (
            <div style={{background:'#fff',margin:16,padding:20,borderRadius:8,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:16}}>睡眠计划</div>
              {/* 快捷计划组合 */}
              <div style={{marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#1e293b'}}>快捷计划组合</div>
                  <button style={{padding:'6px 12px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:12}}>自定义快捷计划</button>
                </div>
                <div style={{display:'flex',gap:12}}>
                  {[
                    {name:'晨间活动',tasks:['上午运动+光照喷射','冥想10分钟','拉伸训练']},
                    {name:'睡前放松',tasks:['冥想+禁食','热水泡脚','阅读30分钟']},
                    {name:'综合方案',tasks:['运动计划','饮食计划','放松训练']},
                  ].map(function(combo, idx) {
                    return (
                      <div key={idx} style={{flex:1,border:'1px solid #e5e7eb',borderRadius:8,padding:12}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:8}}>{combo.name}</div>
                        <div style={{marginBottom:8}}>
                          {combo.tasks.map(function(task, i) {
                            return <div key={i} style={{fontSize:11,color:'#64748b',marginBottom:2}}>· {task}</div>
                          })}
                        </div>
                        <div style={{fontSize:11,color:'#64748b'}}>共{combo.tasks.length}项任务</div>
                        <div style={{marginTop:8,display:'flex',gap:8}}>
                          <button style={{flex:1,padding:'4px 8px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:11}}>推送计划</button>
                          <button style={{padding:'4px 8px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:11}}>删除</button>
                          <button style={{padding:'4px 8px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,cursor:'pointer',fontSize:11}}>编辑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* 第2周计划 */}
              <div style={{marginBottom:16,border:'1px solid #e5e7eb',borderRadius:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#1e293b'}}>第2周计划</div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>修改计划</button>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>导出</button>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>打印</button>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>收起</button>
                  </div>
                </div>
                <div style={{display:'flex',padding:16,gap:16}}>
                  <div style={{flex:1,border:'1px solid #e5e7eb',borderRadius:6,padding:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#3b82f6',marginBottom:8}}>生理时钟</div>
                    <div style={{fontSize:11,color:'#64748b'}}>上床时间：<span style={{color:'#1e293b'}}>00:00</span></div>
                    <div style={{fontSize:11,color:'#64748b'}}>起床时间：<span style={{color:'#1e293b'}}>07:40</span></div>
                  </div>
                  <div style={{flex:2,border:'1px solid #e5e7eb',borderRadius:6,padding:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#3b82f6',marginBottom:8}}>行为打卡</div>
                    <div style={{fontSize:10,color:'#475569',lineHeight:1.6}}>
                      <div>1. 早晨运动30分钟（跑步/快走）</div>
                      <div>2. 睡前2小时禁食</div>
                      <div>3. 傍晚快走/骑车30分钟</div>
                      <div>4. 睡前1小时避免强光</div>
                      <div>5. 晚上11点后避光</div>
                      <div>6. 延迟1小时入睡（渐进式）</div>
                      <div>7. 经颅磁刺激 40Hz</div>
                      <div>8. 生物反馈训练</div>
                      <div>9. 音乐催眠</div>
                      <div>10. 光照治疗</div>
                    </div>
                  </div>
                  <div style={{flex:1,border:'1px solid #e5e7eb',borderRadius:6,padding:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#3b82f6',marginBottom:8}}>放松训练</div>
                    <div style={{fontSize:10,color:'#475569',lineHeight:1.6}}>
                      <div>1. 情绪或躁狂时做的呼吸训练.mp3</div>
                      <div>2. 白天疲惫时做的肌肉放松.mp4</div>
                      <div>3. 睡前1小时做的肌肉放松冥想.mp3</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* 第1周计划（折叠） */}
              <div style={{border:'1px solid #e5e7eb',borderRadius:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#94a3b8'}}>第1周计划</div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>导出</button>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>打印</button>
                    <button style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:4,background:'#fff',cursor:'pointer',fontSize:11}}>展开</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{background:'#fff',padding:24,borderRadius:8,border:'1px solid #e5e7eb',textAlign:'center',color:'#94a3b8',fontSize:14}}>
              暂无数据
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
