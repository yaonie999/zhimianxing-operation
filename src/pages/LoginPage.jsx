import React, { useEffect, useState } from 'react'

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [autoLogin, setAutoLogin] = useState(false)
  const [needImageVerify, setNeedImageVerify] = useState(false)
  const [loginVerifyCode, setLoginVerifyCode] = useState('')
  const [loginVerifyKey, setLoginVerifyKey] = useState('')
  const [loginVerifyDisplay, setLoginVerifyDisplay] = useState('----')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockInfo, setLockInfo] = useState(null)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [setupToken, setSetupToken] = useState('')

  function storeAndEnter(payload) {
    const token = payload?.token || payload?.data?.token
    if (token) {
      localStorage.setItem('operation_token', token)
    }
    localStorage.setItem('operation_user', JSON.stringify(payload?.user || {}))
    localStorage.setItem('operation_auto_login', autoLogin ? '1' : '0')
    window.location.replace(window.location.origin + window.location.pathname + '#/workbench')
  }

  function normalizeErrorMessage(data) {
    if (!data) return '网络异常，请稍后重试'
    if (data.code === 401) return '用户名或密码错误'
    if (data.code === 403) return '账户已被锁定'
    if (data.code === 400 && data.msg === '缺少参数') return '用户名和密码不能为空'
    return data.msg || '操作失败，请稍后重试'
  }

  async function handleLogin(e) {
    if (e) e.preventDefault()
    if (loading) return
    if (!phone.trim()) return setError('请输入手机号')
    if (!password) return setError('请输入密码')
    if (needImageVerify && !loginVerifyCode) return setError('请输入图形验证码')

    setLoading(true)
    setError('')
    setLockInfo(null)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: phone,
          password,
          verifyCode: needImageVerify ? loginVerifyCode : undefined,
          verifyKey: needImageVerify ? loginVerifyKey : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(normalizeErrorMessage(data))
        setFailedAttempts(data.failedAttempts || 0)
        const shouldNeedVerify =
          Boolean(data.needVerifyCode) ||
          Number(data.failedAttempts || 0) > 3
        setNeedImageVerify(shouldNeedVerify)
        if (data.locked) {
          setLockInfo({
            reason: data.reason || '账户已锁定',
            remainingMinutes: data.remainingMinutes || 0,
          })
        }
        return
      }

      if (data.data?.token) {
        storeAndEnter(data.data)
        return
      }

      if (data.status === 'success' && data.payload?.token) {
        storeAndEnter(data.payload)
        return
      }

      setError(data.msg || '登录失败')
    } catch (err) {
      setError('网络异常，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #5b73d6 0%, #7b68c7 50%, #946fb8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '36px 40px',
        width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛏️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', letterSpacing: 1 }}>智眠星运营终端</div>
          <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, marginTop: 4 }}>ZHI MIAN XING OPERATION TERMINAL</div>
        </div>

        {/* Tab */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', marginBottom: 24 }}>
          <button
            onClick={() => setLoginMode('password')}
            style={{
              background: 'none', border: 'none', padding: '8px 0', marginRight: 24,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: loginMode === 'password' ? '#3b82f6' : '#94a3b8',
              borderBottom: loginMode === 'password' ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >账号密码登录</button>
          <button
            onClick={() => setLoginMode('qrcode')}
            style={{
              background: 'none', border: 'none', padding: '8px 0',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: loginMode === 'qrcode' ? '#3b82f6' : '#94a3b8',
              borderBottom: loginMode === 'qrcode' ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >扫码登录</button>
        </div>

        {loginMode === 'password' ? (
          <form onSubmit={handleLogin}>
            {error && (
              <div style={{
                background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
                borderRadius: 8, marginBottom: 16, fontSize: 13,
                border: '1px solid #fecaca',
              }}>{error}</div>
            )}
            {lockInfo && (
              <div style={{
                background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
                borderRadius: 8, marginBottom: 16, fontSize: 13,
              }}>{lockInfo.reason}，请{lockInfo.remainingMinutes}分钟后再试</div>
            )}

            <div style={{ marginBottom: 16 }}>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="请输入手机号"
                maxLength={11}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', background: '#eff4fa',
                }}
              />
            </div>

            <div style={{ marginBottom: 16, position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入登录密码"
                style={{
                  width: '100%', padding: '12px 40px 12px 14px', borderRadius: 8,
                  border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', background: '#eff4fa',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                }}
              >{showPassword ? '👁️' : '👁️'}</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={e => setAutoLogin(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>自动登录</span>
              </label>
              <button type="button" style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, cursor: 'pointer' }}>忘记密码？</button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #5b73d6, #7b68c7)',
                color: '#fff', border: 'none', fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(91,115,214,0.3)',
              }}
            >{loading ? '登录中...' : '登 录'}</button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📱</div>
            <div style={{ fontSize: 14 }}>请使用手机APP扫码登录</div>
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 24, left: 24,
        background: '#3b82f6', color: '#fff',
        padding: '6px 12px', borderRadius: 20,
        fontSize: 12, cursor: 'pointer',
      }}>主题：医疗蓝</div>
    </div>
  )
}
