import React, { useState, useEffect } from 'react';
import './AssessmentPage.css';

export default function AssessmentPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('select');

  useEffect(() => {
    fetch('/api/scale-items/templates')
      .then(r => r.json())
      .then(p => { if (p.code === 200) setTemplates(p.data || []); })
      .catch(() => setError('加载量表失败'))
      .finally(() => setLoading(false));
  }, []);

  function selectTemplate(tpl) {
    setSelectedTpl(tpl);
    setAnswers({});
    setResult(null);
    setError('');
    fetch('/api/scale-items/questions/' + tpl.id)
      .then(r => r.json())
      .then(p => {
        if (p.code === 200) { setQuestions(p.data || []); setTab('fill'); }
        else setError(p.message || '加载题目失败');
      })
      .catch(() => setError('加载题目失败'));
  }

  function handleAnswer(qid, value) {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  }

  function submitAssessment() {
    if (!memberId.trim()) { setError('请输入患者ID'); return; }
    setSubmitting(true);
    setError('');
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: parseInt(memberId),
        member_name: memberName || '患者' + memberId,
        template_id: selectedTpl.id,
        template_name: selectedTpl.name,
        answers_json: JSON.stringify(answers),
        assessment_date: new Date().toISOString().slice(0, 10),
      })
    })
      .then(r => r.json())
      .then(p => {
        if (p.code === 200) { setResult(p.data); setTab('result'); }
        else setError(p.message || '提交失败');
      })
      .catch(() => setError('提交失败'))
      .finally(() => setSubmitting(false));
  }

  function generatePlan() {
    if (!memberId.trim() || !selectedTpl) { alert('请先完成评估'); return; }
    fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: parseInt(memberId),
        template_id: selectedTpl.id,
        therapist: ''
      })
    }).then(r => r.json()).then(p => {
      if (p.code === 200) {
        alert('方案创建成功！方案ID: ' + p.data.id + '，请到方案执行页面查看');
        setTab('select');
        setSelectedTpl(null);
        setAnswers({});
        setResult(null);
      } else {
        alert('方案创建失败: ' + (p.message || '未知错误'));
      }
    }).catch(() => alert('网络错误'));
  }

  if (loading) return <div className="page-loading">加载中...</div>;

  if (tab === 'result' && result) {
    const riskColors = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
    const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' };
    return (
      <div className="assessment-page">
        <div className="page-header"><h2>量表评估 - 评估结果</h2></div>
        <div className="result-card">
          <div className="result-icon">📊</div>
          <h3>评估完成</h3>
          <div className="result-score">
            <div className="score-num">{result.total_score || 0}</div>
            <div className="score-label">总分</div>
          </div>
          <div className="result-risk" style={{ color: riskColors[result.risk_level] || '#666' }}>
            风险等级：{riskLabels[result.risk_level] || result.risk_level}
          </div>
          <div className="result-name">{selectedTpl && selectedTpl.name}</div>
          <button className="action-btn secondary" onClick={generatePlan}>
            📋 生成方案
          </button>
          <button className="action-btn" onClick={() => { setTab('select'); setSelectedTpl(null); setAnswers({}); setResult(null); }}>
            再做一次
          </button>
        </div>
      </div>
    );
  }

  if (tab === 'fill' && selectedTpl) {
    const answeredCount = Object.keys(answers).length;
    return (
      <div className="assessment-page">
        <div className="page-header">
          <button className="back-btn" onClick={() => setTab('select')}>← 返回</button>
          <h2>{selectedTpl.name}</h2>
        </div>
        <p className="fill-progress">已填 {answeredCount}/{questions.length} 题</p>
        <div className="patient-input-row">
          <input className="input-field" placeholder="患者ID（必填）" value={memberId} onChange={e => setMemberId(e.target.value)} type="number" />
          <input className="input-field" placeholder="患者姓名（选填）" value={memberName} onChange={e => setMemberName(e.target.value)} />
        </div>
        <div className="questions-list">
          {questions.map((q, qi) => (
            <div key={q.id} className="question-item">
              <div className="question-text">
                <span className="q-num">{qi + 1}.</span>
                {q.question_text}
                {q.required && <span className="required-star">*</span>}
              </div>
              {q.question_type === 'single' && q.options && (
                <div className="options-list">
                  {(() => { try { return JSON.parse(q.options).options || []; } catch { return []; } })().map((opt, oi) => (
                    <label key={oi} className="option-label">
                      <input type="radio" name={'q_' + q.id} value={opt.score}
                        onChange={() => handleAnswer(q.id, opt.score)}
                        checked={answers[q.id] === opt.score} />
                      {opt.text}
                    </label>
                  ))}
                </div>
              )}
              {q.question_type === 'scale' && (
                <div className="scale-input">
                  <input type="number" min="1" max="10" placeholder="1-10" value={answers[q.id] || ''}
                    onChange={e => handleAnswer(q.id, parseInt(e.target.value))} className="scale-num-input" />
                </div>
              )}
              {q.question_type === 'text' && (
                <textarea className="text-input" placeholder="请输入" value={answers[q.id] || ''}
                  onChange={e => handleAnswer(q.id, e.target.value)} rows={2} />
              )}
            </div>
          ))}
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="submit-btn" onClick={submitAssessment} disabled={submitting || !memberId.trim()}>
          {submitting ? '提交中...' : '提交评估'}
        </button>
      </div>
    );
  }

  return (
    <div className="assessment-page">
      <div className="page-header"><h2>量表评估</h2></div>
      <div className="template-grid">
        {templates.map(t => (
          <div key={t.id} className="template-card" onClick={() => selectTemplate(t)}>
            <div className="template-icon">📋</div>
            <div className="template-name">{t.name}</div>
            <div className="template-desc">{t.description && t.description.slice(0, 60)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
