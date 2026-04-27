import React, { useEffect, useState } from 'react'

export default function TherapistMgmtPage() {
  const [therapists, setTherapists] = useState([])
  const [studios, setStudios] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', employee_no: '', title: '', education: '', specialty: '', hire_date: '', phone: '', studio_id: '' })

  useEffect(() => { loadData() }, [])

  function loadData() {
    setLoading(true)
    Promise.all([
      fetch('/api/therapists').then(r => r.json()),
      fetch('/api/studios').then(r => r.json())
    ]).then(([tData, sData]) => {
      if (tData.code === 200) setTherapists(tData.data)
      if (sData.code === 200) setStudios(sData.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', employee_no: '', title: '', education: '', specialty: '', hire_date: '', phone: '', studio_id: '' })
    setShowModal(true)
  }

  function openEdit(s) {
    setEditItem(s)
    setForm({
      name: s.name, employee_no: s.employee_no || '', title: s.title || '',
      education: s.education || '', specialty: s.specialty || '',
      hire_date: s.hire_date ? s.hire_date.slice(0, 10) : '', phone: s.phone || '', studio_id: s.studio_id || ''
    })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.name.trim()) { alert('请输入姓名'); return }
    const method = editItem ? 'PUT' : 'POST'
    const url = editItem ? `/api/therapists/${editItem.id}` : '/api/therapists'
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, studio_id: form.studio_id || null })
    }).then(r => r.json()).then(data => {
      if (data.code === 200) {
        setShowModal(false)
        loadData()
      } else {
        alert(data.message || '保存失败')
      }
    })
  }

  function handleDelete(s) {
    if (!confirm(`确定删除"${s.name}"？`)) return
    fetch(`/api/therapists/${s.id}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => { if (data.code === 200) loadData() })
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>睡眠师管理</h2>
        <button onClick={openAdd} style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          + 新建睡眠师
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {therapists.map(t => (
          <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 600, marginRight: 12 }}>
                {t.name.slice(0, 1)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{t.title || '睡眠师'}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}>工号：{t.employee_no || '-'}</div>
              <div style={{ marginBottom: 4 }}>电话：{t.phone || '-'}</div>
              <div style={{ marginBottom: 4 }}>工作室：{t.studio_name || '-'}</div>
              <div style={{ marginBottom: 4 }}>学历/资质：{t.education || '-'}</div>
              <div style={{ marginBottom: 4 }}>入职时间：{t.hire_date ? t.hire_date.slice(0, 10) : '-'}</div>
              <div>专长：{t.specialty || '-'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ flex: 1, textAlign: 'center', background: '#f5f5f5', borderRadius: 6, padding: '8px 0' }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#1677ff' }}>{t.plan_count || 0}</div>
                <div style={{ fontSize: 11, color: '#666' }}>方案数</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: '#f5f5f5', borderRadius: 6, padding: '8px 0' }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#52c41a' }}>{t.execution_count || 0}</div>
                <div style={{ fontSize: 11, color: '#666' }}>执行次数</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => openEdit(t)} style={{ flex: 1, padding: '6px 0', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12 }}>编辑</button>
              <button onClick={() => handleDelete(t)} style={{ flex: 1, padding: '6px 0', border: '1px solid #ff4d4f', borderRadius: 4, background: '#fff', color: '#ff4d4f', cursor: 'pointer', fontSize: 12 }}>删除</button>
            </div>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>}
      {!loading && therapists.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无睡眠师</div>}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 560, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 600 }}>{editItem ? '编辑睡眠师' : '新建睡眠师'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>姓名 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>工号</label>
                <input value={form.employee_no} onChange={e => setForm({ ...form, employee_no: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>职称</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：睡眠治疗师" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>学历/资质</label>
                <input value={form.education} onChange={e => setForm({ ...form, education: e.target.value })} placeholder="如：本科、国家二级心理咨询师" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>入职时间</label>
                <input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>联系电话</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>专长</label>
                <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="如：失眠治疗、认知行为疗法" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>所属工作室</label>
                <select value={form.studio_id} onChange={e => setForm({ ...form, studio_id: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}>
                  <option value="">请选择工作室</option>
                  {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14 }}>取消</button>
              <button onClick={handleSave} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#1677ff', color: '#fff', cursor: 'pointer', fontSize: 14 }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
