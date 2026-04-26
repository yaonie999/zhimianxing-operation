import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!oldPassword) { errs.old = '请输入原密码'; return errs; }
    if (newPassword.length < 8 || newPassword.length > 16) {
      errs.new = '密码需 8–16 位';
      return errs;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errs.new = '密码需包含字母和数字';
      return errs;
    }
    if (newPassword === oldPassword) {
      errs.new = '新密码不能与原密码相同';
      return errs;
    }
    if (newPassword !== confirmPassword) {
      errs.confirm = '两次输入的新密码不一致';
      return errs;
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      setSubmitting(true);
      try {
        const token = localStorage.getItem('operation_token');
        const res = await fetch('/api/password/change', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        const data = await res.json();
        if (res.ok) {
          alert('密码修改成功！');
          navigate('/workbench');
        } else {
          setErrors({ submit: data.error || '修改失败' });
        }
      } catch (_) {
        setErrors({ submit: '网络错误，请重试' });
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="change-password-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h2>修改密码</h2>
      </div>

      <div className="cp-form-card">
        <div className="cp-field">
          <label>原密码 <span className="required">*</span></label>
          <div className="cp-input-wrap">
            <input
              type={showOld ? 'text' : 'password'}
              value={oldPassword}
              placeholder="请输入原密码"
              onChange={e => setOldPassword(e.target.value)}
            />
            <button className="eye-btn" onClick={() => setShowOld(v => !v)} tabIndex={-1}>
              {showOld ? '🙈' : '👁'}
            </button>
          </div>
          {errors.old && <span className="cp-error">{errors.old}</span>}
        </div>

        <div className="cp-field">
          <label>新密码 <span className="required">*</span></label>
          <div className="cp-input-wrap">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              placeholder="请输入新密码"
              onChange={e => setNewPassword(e.target.value)}
            />
            <button className="eye-btn" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
              {showNew ? '🙈' : '👁'}
            </button>
          </div>
          {errors.new && <span className="cp-error">{errors.new}</span>}
          <div className="cp-hint">
            8–16 位，必须包含字母和数字
          </div>
        </div>

        <div className="cp-field">
          <label>确认新密码 <span className="required">*</span></label>
          <div className="cp-input-wrap">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              placeholder="请再次输入新密码"
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <button className="eye-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
              {showConfirm ? '🙈' : '👁'}
            </button>
          </div>
          {errors.confirm && <span className="cp-error">{errors.confirm}</span>}
        </div>

        {errors.submit && <span className="cp-error" style={{ display: 'block', marginBottom: 8 }}>{errors.submit}</span>}
        <div className="cp-submit">
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '确认修改'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
