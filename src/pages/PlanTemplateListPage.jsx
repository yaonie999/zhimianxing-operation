import React, { useState, useEffect } from 'react';

export default function PlanTemplateListPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetch('/api/plan-templates')
      .then(r => r.json())
      .then(p => { if (p.code === 200) setTemplates(p.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function viewDetail(tpl) {
    setSelected(tpl);
    fetch('/api/plan-templates/' + tpl.id)
      .then(r => r.json())
      .then(p => { if (p.code === 200) setDetail(p.data); })
      .catch(() => {});
  }

  const typeColors = { '7天': '#3b82f6', '14天': '#8b5cf6', '28天': '#f59e0b' };
  const typeIcons = { '7天': '⚡', '14天': '📅', '28天': '🗓️' };
const itemTypeMap = {
  music: '音乐放松',
  equipment: '经颅磁刺激',
  consult: '睡眠咨询',
  ctm: '中医调理',
  phase1: '强化期',
  phase2: '维持期',
  phase3: '巩固期'
};

  return (
    <div className="plan-template-page">
      <div className="page-header">
        <h2>方案模板库</h2>
        <p className="page-desc">选择适合患者的干预方案模板</p>
      </div>
      {loading ? <div className="page-loading">加载中...</div> : (
        <>
          <div className="template-list">
            {templates.map(t => (
              <div key={t.id} className="ptpl-card" onClick={() => viewDetail(t)}>
                <div className="ptpl-header">
                  <span className="ptpl-icon">{typeIcons[t.template_type] || '📋'}</span>
                  <span className="ptpl-type" style={{ background: typeColors[t.template_type] || '#666' }}>{t.template_type}</span>
                </div>
                <div className="ptpl-name">{t.template_name}</div>
                <div className="ptpl-desc">{t.description && t.description.slice(0, 80)}</div>
                <div className="ptpl-meta">
                  <span>⏱ {t.duration_days}天</span>
                  <span>📈 每周{t.frequency_per_week}次</span>
                  <span>⏰ {t.duration_per_session}分钟/次</span>
                </div>
                <div className="ptpl-price">¥{t.price}</div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="modal-overlay" onClick={() => { setSelected(null); setDetail(null); }}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>{selected.template_name}</h3>
                  <button className="modal-close" onClick={() => { setSelected(null); setDetail(null); }}>×</button>
                </div>
                <div className="modal-body">
                  <div className="detail-section">
                    <div className="detail-grid">
                      <div>类型：<strong>{detail && detail.template_type}</strong></div>
                      <div>时长：<strong>{detail && detail.duration_days}天</strong></div>
                      <div>频率：<strong>每周{detail && detail.frequency_per_week}次</strong></div>
                      <div>单次：<strong>{detail && detail.duration_per_session}分钟</strong></div>
                    </div>
                    <p><strong>目标：</strong>{detail && detail.target_goal}</p>
                    <p><strong>适用：</strong>{detail && detail.suitable_conditions}</p>
                  </div>
                  {detail && detail.items && detail.items.length > 0 && (
                    <div className="detail-section">
                      <h4>方案项目（前20项）</h4>
                      <table className="items-table">
                        <thead><tr><th>天</th><th>类型</th><th>项目</th><th>时长</th></tr></thead>
                        <tbody>
                          {detail.items.slice(0, 20).map(it => (
                            <tr key={it.id}>
                              <td>第{it.day_num}天</td>
                              <td>{itemTypeMap[it.item_type] || it.item_type}</td>
                              <td>{it.item_name}</td>
                              <td>{it.duration_minutes}分钟</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {detail.items.length > 20 && <p>还有{detail.items.length - 20}项...</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
