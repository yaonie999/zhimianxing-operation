import React, { useEffect, useMemo, useState } from 'react'

const STUDIO_OPTIONS = ['万象城XXX工作室', '望京工作室', '中关村工作室']
const THERAPIST_OPTIONS = ['李健康师', '王健康师', '张健康师', '赵健康师']
const ASSIGN_RELATIONS = [
  { value: 'onsite-random', label: '到诊随机分配' },
  { value: 'online-prebook', label: '线上预约预分配' },
  { value: 'hospital-link', label: '医院对接分配' }
]

const genderOptions = ['男', '女', '未知']
const maritalOptions = ['未婚', '已婚', '离异', '丧偶']

// 转换数字ID为A00000格式
function formatMemberId(num) {
  if (!num) return '-'
  const n = Number(num)
  if (isNaN(n)) return '-'
  const letter = String.fromCharCode(65 + Math.floor(n / 100000))
  const numPart = String(n % 100000).padStart(5, '0')
  return `${letter}${numPart}`
}

function randomPick(list, seed = 0) {
  if (!list.length) return ''
  return list[Math.abs(seed) % list.length]
}

function assignTherapistByRelation({ relation, studio, index, existingTherapist }) {
  if (existingTherapist) return existingTherapist
  if (relation === 'online-prebook') return randomPick(THERAPIST_OPTIONS, index + 11)
  if (relation === 'hospital-link') {
    const mapped = {
      万象城XXX工作室: '李健康师',
      望京工作室: '王健康师',
      中关村工作室: '张健康师'
    }
    return mapped[studio] || '赵健康师'
  }
  const byStudio = {
    万象城XXX工作室: ['李健康师', '赵健康师'],
    望京工作室: ['王健康师', '赵健康师'],
    中关村工作室: ['张健康师', '赵健康师']
  }
  return randomPick(byStudio[studio] || THERAPIST_OPTIONS, index + 3)
}

function maskPhone(phone = '') {
  const cleaned = String(phone).replace(/\D/g, '')
  if (cleaned.length !== 11) return phone || '-'
  return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`
}

function MultiSelectFilter({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.length === options.length && options.length > 0

  function toggleOption(option) {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option))
    } else {
      onChange([...selected, option])
    }
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...options])
  }

  return (
    <div className="member-v2-filter-item">
      <label>{label}</label>
      <div className="member-v2-multi-select">
        <button type="button" className="member-v2-select-trigger" onClick={() => setOpen((v) => !v)}>
          {selected.length ? selected.join('、') : placeholder}
          <span>▼</span>
        </button>
        {open && (
          <div className="member-v2-select-dropdown">
            <label className="member-v2-check-item">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              全选
            </label>
            {options.map((option) => (
              <label key={option} className="member-v2-check-item">
                <input checked={selected.includes(option)} onChange={() => toggleOption(option)} type="checkbox" />
                {option}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MemberListPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [therapistFilters, setTherapistFilters] = useState([])
  const [searchText, setSearchText] = useState('')

  const [selectedRows, setSelectedRows] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [jumpPageInput, setJumpPageInput] = useState('')

  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ show: false, type: 'single', name: '', id: null, count: 0 })
  const [newMemberDrawer, setNewMemberDrawer] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({
    name: '', phone: '', gender: '男', age: '', occupation: '', marital: '未婚', studio: STUDIO_OPTIONS[0], therapist: THERAPIST_OPTIONS[0], group: 'XXX'
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    async function loadMembersInner() {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch('/api/patients')
        const json = await res.json().catch(() => ({}))
        const list = json.data?.records || json.data || json
        if (!res.ok || !Array.isArray(list)) throw new Error('会员数据加载失败')

        const normalized = list.map((item, index) => {
          const studio = item.studio || randomPick(STUDIO_OPTIONS, index)
          const relation = ASSIGN_RELATIONS[index % ASSIGN_RELATIONS.length].value
          const therapist = assignTherapistByRelation({
            relation,
            studio,
            index,
            existingTherapist: item.therapist
          })
          return {
            id: String(item.id || index + 1),
            name: item.name || `患者${index + 1}`,
            phoneRaw: (item.phone || `13800138${String(index + 1).padStart(3, '0')}`).replace(/\D/g, '').slice(0, 11),
            phone: maskPhone(item.phone || ''),
            gender: item.gender || genderOptions[index % genderOptions.length],
            age: Number(item.age) || 20 + (index % 40),
            occupation: item.occupation || '信息',
            marital: item.marital || maritalOptions[index % maritalOptions.length],
            group: item.group || 'XXX',
            therapist,
            studio,
            relation,
            createTime: item.create_time || item.createTime || '2016-09-21 08:50:08'
          }
        })

        if (mounted) setMembers(normalized)
      } catch (e) {
        if (mounted) setLoadError(e?.message || '会员数据加载失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadMembersInner()
    return () => {
      mounted = false
    }
  }, [refreshKey])

  const therapistsFromData = useMemo(() => {
    const set = new Set([...THERAPIST_OPTIONS, ...members.map((m) => m.therapist).filter(Boolean)])
    return [...set]
  }, [members])

  const filtered = useMemo(() => {
    return members.filter((item) => {
      const therapistOk = !therapistFilters.length || therapistFilters.includes(item.therapist)
      const s = searchText.trim()
      const searchOk = !s || item.name.includes(s) || item.phone.includes(s) || item.phoneRaw.includes(s)
      return therapistOk && searchOk
    })
  }, [members, therapistFilters, searchText])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize)
  const allOnPageSelected = paginated.length > 0 && paginated.every((item) => selectedRows.includes(item.id))

  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  function handleQuery() {
    setCurrentPage(1)
  }

  function handleReset() {
    setTherapistFilters([])
    setSearchText('')
    setCurrentPage(1)
  }

  function togglePageSelect() {
    if (allOnPageSelected) {
      setSelectedRows((prev) => prev.filter((id) => !paginated.some((row) => row.id === id)))
    } else {
      setSelectedRows((prev) => [...new Set([...prev, ...paginated.map((item) => item.id)])])
    }
  }

  function toggleRow(id) {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleConfirmDelete() {
    const token = localStorage.getItem('operation_token')
    if (deleteModal.type === 'single') {
      const targetId = deleteModal.id
      setDeleteModal({ show: false, type: 'single', name: '', id: null, count: 0 })
      if (!targetId) return
      setLoading(true)
      fetch(`/api/patients/${targetId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => { if (res.ok) { setMembers(prev => prev.filter(m => String(m.id) !== String(targetId))); setSelectedRows(prev => prev.filter(id => String(id) !== String(targetId))) } else { window.alert('删除失败，请重试') } })
        .catch(() => { window.alert('删除失败，请检查网络') })
        .finally(() => { setLoading(false) })
    } else if (deleteModal.type === 'batch') {
      const ids = [...selectedRows]
      setDeleteModal({ show: false, type: 'batch', name: '', id: null, count: 0 })
      if (!ids.length) return
      setLoading(true)
      Promise.all(ids.map(id => fetch(`/api/patients/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })))
        .then(results => { const allOk = results.every(r => r.ok); if (allOk) { setMembers(prev => prev.filter(m => !ids.includes(m.id))); setSelectedRows([]); window.alert('成功删除 ' + ids.length + ' 名会员') } else { window.alert('部分会员删除失败，请重试') } })
        .catch(() => { window.alert('删除失败，请检查网络') })
        .finally(() => { setLoading(false) })
    }
  }

  function handleBatchDelete() {
    if (!selectedRows.length) return
    setMembers((prev) => prev.filter((item) => !selectedRows.includes(item.id)))
    setSelectedRows([])
  }

  function handleCreateProfile() {
    setNewMemberForm({
      name: '', phone: '', gender: '男', age: '', occupation: '', marital: '未婚', studio: STUDIO_OPTIONS[0], therapist: THERAPIST_OPTIONS[0], group: 'XXX'
    })
    setNewMemberDrawer(true)
  }

  function closeNewDrawer() {
    setNewMemberDrawer(false)
  }

  function handleNewChange(field, value) {
    setNewMemberForm(prev => ({ ...prev, [field]: value }))
  }

  function saveNewMember() {
    if (!newMemberForm.name.trim()) {
      window.alert('请输入患者姓名')
      return
    }
    if (!newMemberForm.phone.trim()) {
      window.alert('请输入手机号')
      return
    }
    fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMemberForm)
    })
      .then(res => res.json())
      .then(data => {
        if (data.code === 200) {
          setNewMemberDrawer(false)
          setRefreshKey(k => k + 1)
          window.alert('新建档案成功')
        } else {
          window.alert(data.msg || '新建失败')
        }
      })
      .catch(() => {
        window.alert('新建失败，请重试')
      })
  }

  async function handleAssignTherapist() {
    if (!selectedRows.length) {
      window.alert('请先勾选需要分配睡眠师的会员。')
      return
    }
    const therapist = THERAPIST_OPTIONS[0]
    try {
      const res = await fetch('/api/patients/batch-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRows, therapist }),
      })
      if (res.ok) {
        setMembers((prev) => prev.map((item) => (selectedRows.includes(item.id) ? { ...item, therapist } : item)))
        window.alert(`已为 ${selectedRows.length} 位会员分配睡眠师：${therapist}`)
      } else { window.alert('分配失败') }
    } catch { window.alert('分配失败，请重试') }
  }

  function handleImportMembers() {
    window.alert('导入入口已启用：当前为演示模式，导入模板即将接入。')
  }

  async function handleBatchGroup() {
    if (!selectedRows.length) {
      window.alert('请先勾选需要批量分组的会员。')
      return
    }
    const groupName = '批量分组A'
    try {
      const res = await fetch('/api/patients/batch-update-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRows, group: groupName }),
      })
      if (res.ok) {
        setMembers((prev) => prev.map((item) => (selectedRows.includes(item.id) ? { ...item, group: groupName } : item)))
        window.alert('已更新 ' + selectedRows.length + ' 位会员到分组：' + groupName)
      } else { window.alert('分组更新失败') }
    } catch { window.alert('分组更新失败，请重试') }
  }
  function openEditDrawer(member) {
    setEditingMember(member)
    setEditForm({
      ...member,
      relation: member.relation || 'onsite-random',
      phoneRaw: member.phoneRaw || ''
    })
  }

  function closeEditDrawer() {
    setEditingMember(null)
    setEditForm(null)
  }

  function handleEditChange(key, value) {
    if (!editForm) return
    const next = { ...editForm, [key]: value }
    if (key === 'relation' || key === 'studio') {
      next.therapist = assignTherapistByRelation({
        relation: key === 'relation' ? value : next.relation,
        studio: key === 'studio' ? value : next.studio,
        index: 0,
        existingTherapist: key === 'relation' || key === 'studio' ? '' : next.therapist
      })
    }
    if (key === 'phoneRaw') next.phone = maskPhone(value)
    setEditForm(next)
  }

  function validateEditForm() {
    if (!editForm) return '表单为空'
    const requiredFields = [
      ['name', '患者姓名'],
      ['phoneRaw', '手机号'],
      ['gender', '性别'],
      ['age', '年龄'],
      ['occupation', '职业'],
      ['marital', '婚姻状况'],
      ['studio', '所属工作室'],
      ['therapist', '所属睡眠师']
    ]
    const missed = requiredFields.find(([k]) => !editForm[k] && editForm[k] !== 0)
    if (missed) return `请填写${missed[1]}`
    if (!/^1\d{10}$/.test(String(editForm.phoneRaw))) return '手机号格式不正确'
    if (Number(editForm.age) <= 0 || Number(editForm.age) > 120) return '年龄请输入1-120之间数字'
    return ''
  }

  async function saveEdit() {
    const err = validateEditForm()
    if (err) { window.alert(err); return }
    const payload = { ...editForm, age: Number(editForm.age), phone: maskPhone(editForm.phoneRaw) }
    try {
      const res = await fetch(`/api/patients/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setMembers((prev) =>
          prev.map((item) => item.id === editForm.id ? { ...item, ...payload } : item)
        )
        closeEditDrawer()
      } else { window.alert('保存失败') }
    } catch { window.alert('保存失败，请重试') }
  }

  function goPage(page) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  function jumpPage() {
    const page = Number(jumpPageInput)
    if (Number.isFinite(page) && page >= 1 && page <= totalPages) goPage(page)
  }

  const pageNumbers = Array.from({ length: Math.min(totalPages, 9) }, (_, i) => {
    if (totalPages <= 9) return i + 1
    const start = Math.max(1, currentPageSafe - 4)
    const adjustedStart = Math.min(start, totalPages - 8)
    return adjustedStart + i
  })

  return (
    <div className="member-v2-page">
      <div className="member-v2-filter-card">
        <div className="member-v2-filter-item">
          <label>患者信息</label>
          <input
            className="member-v2-input"
            placeholder="请输入患者姓名/手机号"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <MultiSelectFilter
          label="所属健康师"
          options={therapistsFromData}
          selected={therapistFilters}
          onChange={setTherapistFilters}
          placeholder="请选择健康师，支持多选"
        />
        <div className="member-v2-filter-actions">
          <button className="member-v2-btn primary" onClick={handleQuery}>查询</button>
          <button className="member-v2-btn" onClick={handleReset}>重置</button>
        </div>
      </div>

      <div className="member-v2-table-card">
        <div className="member-v2-toolbar" data-role="toolbar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="member-v2-btn primary" onClick={handleCreateProfile}>新建档案</button>
            <button className="member-v2-btn" onClick={handleAssignTherapist}>分配睡眠师</button>
            <button className="member-v2-btn" onClick={handleImportMembers}>导入</button>
             <button className="member-v2-btn" onClick={() => { if (!selectedRows.length) return; setDeleteModal({ show: true, type: 'batch', name: '', id: null, count: selectedRows.length }) }} disabled={!selectedRows.length}>批量删除</button>
            <button className="member-v2-btn" onClick={handleBatchGroup}>批量分组</button>
          </div>
        </div>

        {loading && <div className="member-v2-msg">会员数据加载中...</div>}
        {loadError && <div className="member-v2-msg error">{loadError}</div>}

        <div className="member-v2-table-wrap">
          <table className="member-v2-table">
            <thead>
              <tr>
                <th width="44"><input type="checkbox" checked={allOnPageSelected} onChange={togglePageSelect} /></th>
                <th width="60">序号</th>
                <th width="100">患者姓名</th>
                <th width="80">会员ID</th>
                <th width="130">手机号</th>
                <th width="80">性别</th>
                <th width="80">年龄</th>
                <th width="120">职业</th>
                <th width="100">婚姻状况</th>
                <th width="100">分组</th>
                <th width="130">所属睡眠师</th>
                <th width="130">所属工作室</th>
                <th width="170">创建时间</th>
                <th width="240">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((item, idx) => (
                <tr key={item.id}>
                  <td><input type="checkbox" checked={selectedRows.includes(item.id)} onChange={() => toggleRow(item.id)} /></td>
                  <td>{(currentPageSafe - 1) * pageSize + idx + 1}</td>
                  <td>{item.name}</td>
                  <td>{formatMemberId(item.id)}</td>
                  <td>{item.phone}</td>
                  <td>{item.gender}</td>
                  <td>{item.age}</td>
                  <td>{item.occupation}</td>
                  <td>{item.marital}</td>
                  <td>{item.group}</td>
                  <td>{item.therapist}</td>
                  <td>{item.studio}</td>
                  <td>{item.createTime}</td>
                  <td className="member-v2-actions">
                    <button onClick={() => (window.location.hash = `/members/${item.id}`)}>详情</button>
                    <button onClick={() => openEditDrawer(item)}>编辑</button>
                    <button className="danger" onClick={(e) => { e.stopPropagation(); setDeleteModal({ show: true, type: 'single', name: item.name, id: item.id, count: 1 }) }}>删除</button>
                    <button onClick={() => window.alert(`查看 ${item.name} 的用户行为分析（待接入）`)}>用户行为分析</button>
                  </td>
                </tr>
              ))}
              {!paginated.length && !loading && (
                <tr><td colSpan={14} className="member-v2-empty">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="member-v2-pagination">
          <div className="member-v2-page-info">共 {filtered.length} 条记录 第 {currentPageSafe} / {totalPages} 页</div>
          <div className="member-v2-page-controls">
            <button onClick={() => goPage(currentPageSafe - 1)} disabled={currentPageSafe <= 1}>&lt;</button>
            {pageNumbers.map((p) => (
              <button key={p} className={p === currentPageSafe ? 'active' : ''} onClick={() => goPage(p)}>{p}</button>
            ))}
            <button onClick={() => goPage(currentPageSafe + 1)} disabled={currentPageSafe >= totalPages}>&gt;</button>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
            <span>跳至</span>
            <input
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && jumpPage()}
            />
            <span>页</span>
          </div>
        </div>
      </div>

      {editingMember && editForm && (
        <div className="member-v2-drawer-mask" onClick={closeEditDrawer}>
          <div className="member-v2-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="member-v2-drawer-header">
              <h3>编辑会员信息</h3>
              <button onClick={closeEditDrawer}>✕</button>
            </div>
            <div className="member-v2-drawer-body">
              <div className="member-v2-form-row">
                <label>* 患者姓名</label>
                <input value={editForm.name} placeholder="请输入患者姓名" onChange={(e) => handleEditChange('name', e.target.value)} />
              </div>
              <div className="member-v2-form-row">
                <label>* 手机号</label>
                <input
                  value={editForm.phoneRaw}
                  placeholder="请输入手机号"
                  onChange={(e) => handleEditChange('phoneRaw', e.target.value.replace(/\D/g, '').slice(0, 11))}
                />
              </div>
              <div className="member-v2-form-row">
                <label>* 性别</label>
                <select value={editForm.gender} onChange={(e) => handleEditChange('gender', e.target.value)}>
                  {genderOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>* 年龄</label>
                <input
                  value={editForm.age}
                  placeholder="请输入年龄，只能输入数字"
                  onChange={(e) => handleEditChange('age', e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              </div>
              <div className="member-v2-form-row">
                <label>* 职业</label>
                <input value={editForm.occupation} placeholder="请输入职业" onChange={(e) => handleEditChange('occupation', e.target.value)} />
              </div>
              <div className="member-v2-form-row">
                <label>* 婚姻状况</label>
                <select value={editForm.marital} onChange={(e) => handleEditChange('marital', e.target.value)}>
                  {maritalOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>* 所属工作室</label>
                <select value={editForm.studio} onChange={(e) => handleEditChange('studio', e.target.value)}>
                  {STUDIO_OPTIONS.map((studio) => (<option key={studio} value={studio}>{studio}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>绑定关系</label>
                <select value={editForm.relation} onChange={(e) => handleEditChange('relation', e.target.value)}>
                  {ASSIGN_RELATIONS.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>* 所属睡眠师</label>
                <select value={editForm.therapist} onChange={(e) => handleEditChange('therapist', e.target.value)}>
                  {therapistsFromData.map((therapist) => (<option key={therapist} value={therapist}>{therapist}</option>))}
                </select>
              </div>
            </div>
            <div className="member-v2-drawer-footer">
              <button className="member-v2-btn" onClick={closeEditDrawer}>取消</button>
              <button className="member-v2-btn primary" onClick={saveEdit}>确定</button>
            </div>
          </div>
        </div>
      )}
      {deleteModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', minWidth: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>确认删除</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
              {deleteModal.type === 'batch' ? `确定删除选中的 ${deleteModal.count} 名会员吗？删除后不可恢复。` : `确定删除会员「${deleteModal.name}」吗？删除后不可恢复。`}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteModal({ show: false, type: 'single', name: '', id: null, count: 0 })} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>取消</button>
              <button onClick={handleConfirmDelete} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 14 }}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {newMemberDrawer && (
        <div className="member-v2-drawer-mask" onClick={closeNewDrawer}>
          <div className="member-v2-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="member-v2-drawer-header">
              <h3>新建档案</h3>
              <button onClick={closeNewDrawer}>✕</button>
            </div>
            <div className="member-v2-drawer-body">
              <div className="member-v2-form-row">
                <label>* 患者姓名</label>
                <input value={newMemberForm.name} placeholder="请输入患者姓名" onChange={(e) => handleNewChange('name', e.target.value)} />
              </div>
              <div className="member-v2-form-row">
                <label>* 手机号</label>
                <input value={newMemberForm.phone} placeholder="请输入手机号" onChange={(e) => handleNewChange('phone', e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </div>
              <div className="member-v2-form-row">
                <label>* 性别</label>
                <select value={newMemberForm.gender} onChange={(e) => handleNewChange('gender', e.target.value)}>
                  {genderOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>* 年龄</label>
                <input value={newMemberForm.age} placeholder="请输入年龄" onChange={(e) => handleNewChange('age', e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </div>
              <div className="member-v2-form-row">
                <label>* 职业</label>
                <input value={newMemberForm.occupation} placeholder="请输入职业" onChange={(e) => handleNewChange('occupation', e.target.value)} />
              </div>
              <div className="member-v2-form-row">
                <label>* 婚姻状况</label>
                <select value={newMemberForm.marital} onChange={(e) => handleNewChange('marital', e.target.value)}>
                  {maritalOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>* 分组</label>
                <input value={newMemberForm.group} placeholder="请输入分组" onChange={(e) => handleNewChange('group', e.target.value)} />
              </div>
              <div className="member-v2-form-row">
                <label>* 所属睡眠师</label>
                <select value={newMemberForm.therapist} onChange={(e) => handleNewChange('therapist', e.target.value)}>
                  {THERAPIST_OPTIONS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div className="member-v2-form-row">
                <label>* 所属工作室</label>
                <select value={newMemberForm.studio} onChange={(e) => handleNewChange('studio', e.target.value)}>
                  {STUDIO_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>
            <div className="member-v2-drawer-footer">
              <button className="member-v2-btn" onClick={closeNewDrawer}>取消</button>
              <button className="member-v2-btn primary" onClick={saveNewMember}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
