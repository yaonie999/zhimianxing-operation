import React, { useState } from 'react';

export default function TreatmentReportPage() {
  const [memberId, setMemberId] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [error, setError] = useState('');

  function searchReports() {
    if (!memberId.trim()) { setError('请输入患者ID'); return; }
    setLoading(true);
    setError('');
    fetch('/api/reports/members?keyword=' + encodeURIComponent(memberId))
      .then(r => r.json())
      .then(p => { if (p.code === 200) setReports(p.data || []); else setError(p.message); })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false));
  }

  function viewDetail(report) {
    setSelectedReport(report);
    fetch('/api/reports/' + report.id)
      .then(r => r.json())
      .then(p => { if (p.code === 200) setReportDetail(p.data); })
      .catch(() => {});
  }

  function generateReport(period) {
    if (!memberId.trim()) { setError('请输入患者ID'); return; }
    if (!confirm('确定要生成' + (period === 'weekly' ? '周' : period === 'monthly' ? '月' : '') + '报告？')) return;
    setLoading(true);
    const endDate = new Date().toISOString().slice(0, 10);
    let startDate = endDate;
    if (period === 'weekly') startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    if (period === 'monthly') startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: parseInt(memberId),
        member_name: '患者' + memberId,
        report_type: period === 'weekly' ? '周报告' : period === 'monthly' ? '月报告' : '阶段报告',
        plan_id: null,
        report_period_start: startDate,
        report_period_end: endDate,
        therapist: ''
      })
    }).then(r => r.json()).then(p => {
      if (p.code === 200) { alert('报告生成成功！'); searchReports(); }
      else setError(p.message || '生成失败');
    }).catch(() => setError('生成失败')).finally(() => setLoading(false));
  }

  const typeLabels = { 'weekly': '周报告', 'monthly': '月报告', 'final': '阶段报告' };

  return (
    <div className="treatment-report-page">
      <div className="page-header">
        <h2>治疗报告</h2>
        <p className="page-desc">查看和生成患者的阶段性治疗报告</p>
      </div>

      <div className="search-bar">
        <input className="input-field" placeholder="输入患者ID 或姓名" value={memberId} onChange={e => setMemberId(e.target.value)} />
        <button className="search-btn" onClick={searchReports} disabled={loading}>{loading ? '查询中...' : '查询报告'}</button>
      </div>

      {memberId && (
        <div className="generate-btns">
          <button className="gen-btn" onClick={() => generateReport('weekly')} disabled={loading}>📄 生成周报告</button>
          <button className="gen-btn" onClick={() => generateReport('monthly')} disabled={loading}>📊 生成月报告</button>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {reports.length === 0 && !loading && memberId && (
        <div className="empty-tip">暂无报告，请先生成</div>
      )}

      {reports.length > 0 && (
        <div className="reports-list">
          {reports.map(r => (
            <div key={r.id} className="report-card" onClick={() => viewDetail(r)}>
              <div className="report-type">{typeLabels[r.report_type] || r.report_type}</div>
              <div className="report-date">📅 {r.report_date || r.create_time && r.create_time.slice(0, 10)}</div>
              <div className="report-score">改善评分: <strong>{r.improvement_score || '-'}</strong></div>
              <div className="report-compliance">依从率: <strong>{r.compliance_rate || 0}%</strong></div>
              <div className="report-therapist">👨‍⚕️ {r.therapist || '-'}</div>
            </div>
          ))}
        </div>
      )}

      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>治疗报告详情</h3>
              <button className="modal-close" onClick={() => setSelectedReport(null)}>×</button>
            </div>
            <div className="modal-body">
              {reportDetail ? (
                <>
                  <div className="report-summary">
                    <div className="summary-item">
                      <div className="summary-num" style={{ color: '#22c55e' }}>{reportDetail.improvement_score || 0}</div>
                      <div className="summary-label">改善评分</div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-num" style={{ color: '#3b82f6' }}>{reportDetail.compliance_rate || 0}%</div>
                      <div className="summary-label">依从率</div>
                    </div>
                  </div>
                  {reportDetail.assessment_summary_json && (
                    <div className="detail-section">
                      <h4>📊 评估变化</h4>
                      <div className="summary-text">
                        {Array.isArray(reportDetail.assessment_summary_json)
                          ? reportDetail.assessment_summary_json.map((a, i) => <div key={i}>- {a.template_name}: {a.total_score}分</div>)
                          : JSON.stringify(reportDetail.assessment_summary_json)}
                      </div>
                    </div>
                  )}
                  {reportDetail.suggestions && (
                    <div className="detail-section">
                      <h4>💡 建议</h4>
                      <div className="summary-text">{reportDetail.suggestions}</div>
                    </div>
                  )}
                </>
              ) : <div className="page-loading">加载中...</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
