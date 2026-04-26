import React, { useState } from 'react';

export default function PlanExecutionPage() {
  const [memberId, setMemberId] = useState('');
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function searchPlans() {
    if (!memberId.trim()) { setError('请输入患者ID'); return; }
    setLoading(true);
    setError('');
    fetch('/api/plans/members/' + memberId)
      .then(r => r.json())
      .then(p => { if (p.code === 200) setPlans(p.data || []); else setError(p.message); })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false));
  }

  function loadPlanDetail(plan) {
    setSelectedPlan(plan);
    fetch('/api/plans/' + plan.id)
      .then(r => r.json())
      .then(p => { if (p.code === 200) setPlanDetail(p.data); })
      .catch(() => {});
    fetch('/api/executions/plan/' + plan.id)
      .then(r => r.json())
      .then(p => { if (p.code === 200) setExecutions(p.data || []); })
      .catch(() => {});
  }

  function completeItem(item) {
    fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: selectedPlan.id,
        plan_item_id: item.id,
        member_id: selectedPlan.member_id,
        execution_date: new Date().toISOString().slice(0, 10),
        execution_type: item.item_type,
        status: 'completed',
        operator: 'momo.zyy'
      })
    }).then(r => r.json()).then(d => {
      if (d.code === 200) {
        fetch('/api/plans/' + selectedPlan.id).then(r => r.json()).then(p => {
          if (p.code === 200) setPlanDetail(p.data);
        });
        fetch('/api/executions/plan/' + selectedPlan.id).then(r => r.json()).then(p => {
          if (p.code === 200) setExecutions(p.data || []);
        });
      } else {
        alert('操作失败: ' + (d.message || '未知错误'));
      }
    }).catch(() => { alert('网络错误，请重试'); });
  }

  const statusMap = { 0: '待开始', 1: '进行中', 2: '已完成' };
  const itemTypeMap = {
  music: '音乐放松',
  equipment: '经颅磁刺激',
  consult: '睡眠咨询',
  ctm: '中医调理',
  phase1: '强化期',
  phase2: '维持期',
  phase3: '巩固期'
};
const statusCls = { 0: 'status-pending', 1: 'status-active', 2: 'status-done' };

  return (
    <div className="plan-execution-page">
      <div className="page-header">
        <h2>方案执行管理</h2>
        <p className="page-desc">查询患者的治疗方案执行进度</p>
      </div>

      <div className="search-bar">
        <input className="input-field" placeholder="输入患者ID" value={memberId} onChange={e => setMemberId(e.target.value)} type="number" />
        <button className="search-btn" onClick={searchPlans} disabled={loading}>{loading ? '查询中...' : '查询方案'}</button>
      </div>
      {error && <div className="error-msg">{error}</div>}

      {plans.length > 0 && (
        <div className="plans-list">
          {plans.map(pl => (
            <div key={pl.id} className="plan-row" onClick={() => loadPlanDetail(pl)}>
              <div className="plan-row-info">
                <span className="plan-row-name">{pl.plan_name}</span>
                <span className={"status-badge " + (statusCls[pl.status] || '')}>{statusMap[pl.status] || '未知'}</span>
              </div>
              <div className="plan-row-meta">
                <span>ID: {pl.id}</span>
                <span>创建: {pl.create_time ? pl.create_time.slice(0, 10) : '-'}</span>
                <span>治疗师: {pl.therapist || '-'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPlan && planDetail && (
        <div className="plan-detail-section">
          <h3>方案详情：{selectedPlan.plan_name}</h3>
          <div className="plan-progress-summary">
            已完成 {planDetail.items && planDetail.items.filter(i => i.completed).length} / {planDetail.items && planDetail.items.length} 项
          </div>
          {planDetail.items && (
            <table className="items-table">
              <thead><tr><th>天</th><th>项目</th><th>类型</th><th>时长</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {planDetail.items.map(it => (
                  <tr key={it.id} className={it.completed ? 'row-done' : ''}>
                    <td>第{it.day_num}天</td>
                    <td>{it.item_name}</td>
                    <td><span className="type-badge">{itemTypeMap[it.item_type] || it.item_type}</span></td>
                    <td>{it.duration_minutes}分钟</td>
                    <td>{it.target_time || '-'}</td>
                    <td>{it.completed ? <span className="status-done">已完成</span> : <span className="status-pending">待执行</span>}</td>
                    <td>
                      {!it.completed && <button className="table-action-btn" onClick={() => completeItem(it)}>标记完成</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
