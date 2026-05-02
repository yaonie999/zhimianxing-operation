import React, { useMemo, useState } from 'react'

const USER_KEY = 'operation_user'
const TOKEN_KEY = 'operation_token'

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}')
  } catch {
    return {}
  }
}

function maskPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length !== 11) return phone || '-'
  return `${digits.slice(0, 3)}****${digits.slice(7)}`
}

function nowText() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

export default function ProfilePage() {
  const user = useMemo(() => readUser(), [])

  const [profile, setProfile] = useState({
    id: user.id || '',
    username: user.phone || '',
    nickname: user.name || '',
    gender: user.gender || '女',
    userType: user.userType || '睡眠师',
    userStatus: user.userStatus || '正常',
    workStatus: user.workStatus || '在职',
    phone: user.phone || '',
    email: user.email || '',
    employeeId: user.employeeId || '',
    department: user.department || '运营部',
    role: user.role || '运营端用户',
    studio: user.studio || '',
    createTime: user.createTime || nowText(),
    loginCount: Number(user.loginCount) || 1,
    lastLoginTime: user.lastLoginTime || nowText()
  })

  const [editVisible, setEditVisible] = useState(false)
  const [pwdVisible, setPwdVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    username: profile.username,
    nickname: profile.nickname,
    gender: profile.gender,
    phone: profile.phone,
    studio: profile.studio,
    employeeId: profile.employeeId,
    department: profile.department,
    email: profile.email
  })

  const [pwdForm, setPwdForm] = useState({
    oldPwd: '',
    newPwd: '',
    confirmPwd: ''
  })

  const avatarText = (profile.nickname || profile.username || '?').slice(0, 1).toUpperCase()

  function openEdit() {
    setEditForm({
      username: profile.username,
      nickname: profile.nickname,
      gender: profile.gender,
      phone: profile.phone,
      studio: profile.studio,
      employeeId: profile.employeeId,
      department: profile.department,
      email: profile.email
    })
    setEditVisible(true)
  }

  async function saveProfile() {
    if (!editForm.nickname.trim()) {
      window.alert('请输入用户昵称')
      return
    }

    setSaving(true)

    const nextUser = {
      ...readUser(),
      name: editForm.nickname,
      phone: editForm.phone,
      gender: editForm.gender,
      employeeId: editForm.employeeId,
      department: editForm.department,
      email: editForm.email
    }

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}`
        },
        body: JSON.stringify(editForm)
      })
      if (!res.ok) throw new Error('save-failed')
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    } catch {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    } finally {
      setSaving(false)
    }

    setProfile((prev) => ({
      ...prev,
      username: editForm.username,
      nickname: editForm.nickname,
      phone: editForm.phone,
      studio: editForm.studio,
      gender: editForm.gender,
      employeeId: editForm.employeeId,
      department: editForm.department,
      email: editForm.email
    }))
    setEditVisible(false)
  }

  function gotoChangePassword() {
    setPwdVisible(false)
    window.location.hash = '/change-password'
  }

  async function savePwd() {
    if (!pwdForm.oldPwd || !pwdForm.newPwd || !pwdForm.confirmPwd) {
      window.alert('请完整输入密码信息')
      return
    }
    if (pwdForm.newPwd !== pwdForm.confirmPwd) {
      window.alert('两次输入的新密码不一致')
      return
    }
    if (pwdForm.newPwd.length < 8 || pwdForm.newPwd.length > 16) {
      window.alert('密码长度需在 8-16 位之间')
      return
    }

    setPwdSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    setPwdSaving(false)
    window.alert('请在修改密码页面完成密码更新')
    gotoChangePassword()
  }

  return (
    <div className="op-pc-page">
      <div className="op-pc-layout">
        <aside className="op-pc-left">
          <div className="op-pc-card profile">
            <div className="op-pc-avatar">{avatarText}</div>
            <div className="op-pc-name">{profile.nickname || '-'}</div>
            <div className="op-pc-sub">{profile.role}</div>

            <div className="op-pc-list">
              <div className="op-pc-row"><span>登录名称</span><b>{profile.username || '-'}</b></div>
              <div className="op-pc-row"><span>姓名</span><b>{profile.nickname || '-'}</b></div>
              <div className="op-pc-row"><span>性别</span><b>{profile.gender || '-'}</b></div>
              <div className="op-pc-row"><span>用户类型</span><b>{profile.userType}</b></div>
              <div className="op-pc-row"><span>用户状态</span><b className={profile.userStatus === '正常' ? 'ok' : 'bad'}>{profile.userStatus}</b></div>
              <div className="op-pc-row"><span>在职状态</span><b>{profile.workStatus}</b></div>
              <div className="op-pc-row"><span>手机号</span><b>{maskPhone(profile.phone)}</b></div>
              <div className="op-pc-row"><span>邮箱</span><b>{profile.email || '-'}</b></div>
              <div className="op-pc-row"><span>工号</span><b>{profile.employeeId || '-'}</b></div>
              <div className="op-pc-row"><span>创建时间</span><b>{profile.createTime}</b></div>
            </div>

            <div className="op-pc-stats">
              <div>
                <strong>{profile.loginCount}</strong>
                <span>登录次数</span>
              </div>
              <div>
                <strong>{profile.lastLoginTime}</strong>
                <span>最后登录</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="op-pc-right">
          <div className="op-pc-card">
            <div className="op-pc-head">
              <h3>基本信息</h3>
              <button className="op-pc-btn primary" onClick={openEdit}>编辑资料</button>
            </div>

            <div className="op-pc-grid">
              <div><label>用户账号</label><span>{profile.username || '-'}</span></div>
              <div><label>用户昵称</label><span>{profile.nickname || '-'}</span></div>
              <div><label>性别</label><span>{profile.gender || '-'}</span></div>
              <div><label>手机号码</label><span>{maskPhone(profile.phone)}</span></div>
              <div><label>用户邮箱</label><span>{profile.email || '-'}</span></div>
              <div><label>用户类型</label><span>{profile.userType}</span></div>
              <div><label>所属部门</label><span>{profile.department || '-'}</span></div>
              <div><label>用户角色</label><span>{profile.role || '-'}</span></div>
              <div><label>工号</label><span>{profile.employeeId || '-'}</span></div>
              <div><label>在职状态</label><span>{profile.workStatus}</span></div>
              <div><label>账户状态</label><span>{profile.userStatus}</span></div>
              <div><label>所属工作室</label><span>{profile.studio || '-'}</span></div>
            </div>
          </div>

          <div className="op-pc-card">
            <div className="op-pc-head">
              <h3>账户安全</h3>
            </div>
            <div className="op-pc-security">
              <div>
                <strong>登录密码</strong>
                <p>定期更换密码可以提高账户安全</p>
              </div>
              <button className="op-pc-btn" onClick={() => setPwdVisible(true)}>修改</button>
            </div>
          </div>
        </section>
      </div>

      {editVisible && (
        <div className="op-pc-mask" onClick={() => setEditVisible(false)}>
          <div className="op-pc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="op-pc-modal-head">
              <b>编辑资料</b>
              <button onClick={() => setEditVisible(false)}>x</button>
            </div>
            <div className="op-pc-modal-body">
              <label>用户账号<input value={editForm.username} onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))} /></label>
              <label>用户昵称<input value={editForm.nickname} onChange={(e) => setEditForm((p) => ({ ...p, nickname: e.target.value }))} /></label>
              <label>性别
                <select value={editForm.gender} onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </label>
              <label>手机号码<input value={editForm.phone || ''} readOnly style={{background:'#f0f0f0'}} /></label>
              <label>所属工作室<input value={editForm.studio || ''} readOnly style={{background:'#f0f0f0'}} /></label>
              <label>工号<input value={editForm.employeeId} onChange={(e) => setEditForm((p) => ({ ...p, employeeId: e.target.value }))} /></label>
              <label>所属部门<input value={editForm.department} onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))} /></label>
              <label>邮箱<input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} /></label>
            </div>
            <div className="op-pc-modal-foot">
              <button className="op-pc-btn" onClick={() => setEditVisible(false)}>取消</button>
              <button className="op-pc-btn primary" onClick={saveProfile} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {pwdVisible && (
        <div className="op-pc-mask" onClick={() => setPwdVisible(false)}>
          <div className="op-pc-modal small" onClick={(e) => e.stopPropagation()}>
            <div className="op-pc-modal-head">
              <b>修改密码</b>
              <button onClick={() => setPwdVisible(false)}>x</button>
            </div>
            <div className="op-pc-modal-body">
              <label>原密码<input type="password" value={pwdForm.oldPwd} onChange={(e) => setPwdForm((p) => ({ ...p, oldPwd: e.target.value }))} /></label>
              <label>新密码<input type="password" value={pwdForm.newPwd} onChange={(e) => setPwdForm((p) => ({ ...p, newPwd: e.target.value }))} /></label>
              <label>确认新密码<input type="password" value={pwdForm.confirmPwd} onChange={(e) => setPwdForm((p) => ({ ...p, confirmPwd: e.target.value }))} /></label>
            </div>
            <div className="op-pc-modal-foot">
              <button className="op-pc-btn" onClick={() => setPwdVisible(false)}>取消</button>
              <button className="op-pc-btn primary" onClick={savePwd} disabled={pwdSaving}>{pwdSaving ? '提交中...' : '确认修改'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
