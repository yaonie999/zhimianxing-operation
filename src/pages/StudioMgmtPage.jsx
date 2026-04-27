import React, { useEffect, useState } from 'react'

export default function StudioMgmtPage() {
  const [studios, setStudios] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', contact: '', phone: '', hours: '', remark: '' })

  useEffect(() => { loadStudios() }, [])

  function loadStudios() {
    setLoading(true)
    fetch('/api/studios')
      .then(r => r.json())
      .then(data => { if (data.code === 200) setStudios(data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', address: '', contact: '', phone: '', hours: '', remark: '' })
    setShowModal(true)
  }

  function openEdit(s) {
    setEditItem(s)
    setForm({ name: s.name, address: s.address || '', contact: s.contact || '', phone: s.phone || '', hours: s.hours || '', remark: s.remark || '' })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.name.trim()) { alert('请输入工作室名称'); return }
    const method = editItem ? 'PUT' : 'POST'
    const url = editItem ? `/api/studios/${editItem.id}` : '/api/studios'
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    }).then(r => r.json()).then(data => {
      if (data.code === 200) {
        setShowModal(false)
        loadStudios()
      } else {
        alert(data.message || '保存失败')
      }
    })
  }

  function handleDelete(s) {
    if (!confirm(`确定删除工作室"${s.name}"？`)) return
    fetch(`/api/studios/${s.id}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => { if (data.code === 200) loadStudios() })
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>工作室管理</h2>
        <button onClick={openAdd} style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          + 新建工作室
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>名称</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>地址</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>联系人</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>联系电话</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>营业时间</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>备注</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#999' }}>加载中...</td></tr>}
          {!loading && studios.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#999' }}>暂无工作室</td></tr>}
          {studios.map(s => (
            <tr key={s.id} style={{ borderTop: '1px solid #f0f0f0' }}>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.name}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.address || '-'}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.contact || '-'}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.phone || '-'}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.hours || '-'}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{s.remark || '-'}</td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <button onClick={() => openEdit(s)} style={{ marginRight: 8, padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12 }}>编辑</button>
                <button onClick={() => handleDelete(s)} style={{ padding: '4px 12px', border: '1px solid #ff4d4f', borderRadius: 4, background: '#fff', color: '#ff4d4f', cursor: 'pointer', fontSize: 12 }}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 500, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 600 }}>{editItem ? '编辑工作室' : '新建工作室'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>联系人</label>
                <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>联系电话</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>营业时间</label>
                <input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="如：9:00-18:00" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>地址</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 4 }}>备注</label>
                <input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
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
