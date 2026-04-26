import React, { useEffect, useMemo, useState } from 'react'
import { buildQuery, requestJson } from '../utils/http'

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'refunded', label: '已退款' }
]

function toMoney(value = 0) {
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusText(status) {
  switch (status) {
    case 'pending': return '待审批'
    case 'approved': return '已通过'
    case 'rejected': return '已拒绝'
    case 'refunded': return '已退款'
    default: return '未知'
  }
}
function refundTypeText(type) {
  switch (type) {
    case 'full': return '全额退款'
    case 'partial': return '部分退款'
    default: return type || '-'
  }
}
function formatDateTime(str) {
  if (!str) return '-';
  return String(str).replace('T', ' ').substring(0, 19);
}

function statusClass(status) {
  switch (status) {
    case 'pending': return 'status-pending'
    case 'approved': return 'status-paid'
    case 'rejected': return 'status-refunded'
    case 'refunded': return 'status-cancelled'
    default: return ''
  }
}

function buildPager(totalPages, currentPage) {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (currentPage <= 5) return [1, 2, 3, 4, 5, 6, 7, '...', totalPages]
  if (currentPage >= totalPages - 4) return [1, '...', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

export default function RefundApprovalPage() {
  const [rows, setRows] = useState([])
  const [tab, setTab] = useState('all')
  const [orderNo, setOrderNo] = useState('')
  const [userText, setUserText] = useState('')
  const [status, setStatus] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0, refunded: 0 })
  const [appliedFilter, setAppliedFilter] = useState({
    orderNo: '',
    userText: '',
    status: '',
    dateRange: ''
  })

  const [approveTarget, setApproveTarget] = useState(null)
  const [approveRemark, setApproveRemark] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectType, setRejectType] = useState('')
  const [rejectDetail, setRejectDetail] = useState('')
  const [viewTarget, setViewTarget] = useState(null)

  const loadRows = async () => {
    try {
      setLoading(true)
      const query = buildQuery({
        tab,
        page: currentPage,
        pageSize,
        ...appliedFilter
      })
      const data = await requestJson(`/api/refunds${query ? `?${query}` : ''}`)
      const records = (data.data || data).records || data.list || [];
      const pending = records.filter(r => r.status === 'pending').length;
      const approved = records.filter(r => r.status === 'approved').length;
      const rejected = records.filter(r => r.status === 'rejected').length;
      const refunded = records.filter(r => r.status === 'refunded').length;
      const totalAll = pending + approved + rejected + refunded;
      setRows(records);
      setTotal(totalAll);
      setCounts({ all: totalAll, pending, approved, rejected, refunded })
    } catch {
      setRows([])
      setTotal(0)
      setCounts({ all: 0, pending: 0, approved: 0, rejected: 0, refunded: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentPage, pageSize, appliedFilter])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const pageNumbers = useMemo(() => buildPager(totalPages, currentPage), [totalPages, currentPage])

  const resetFilters = () => {
    setTab('all')
    setOrderNo('')
    setUserText('')
    setStatus('')
    setDateRange('')
    setCurrentPage(1)
    setAppliedFilter({ orderNo: '', userText: '', status: '', dateRange: '' })
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setAppliedFilter({ orderNo, userText, status, dateRange })
  }

  const changeTab = (nextTab) => {
    setTab(nextTab)
    setCurrentPage(1)
  }

  const confirmApprove = async () => {
    if (!approveTarget) return
    try {
      await requestJson(`/api/refunds/${approveTarget.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ remark: approveRemark })
      })
      setApproveTarget(null)
      setApproveRemark('')
      await loadRows()
    } catch (error) {
      window.alert(error.message || '审批通过失败')
    }
  }

  const confirmReject = async () => {
    if (!rejectTarget || !rejectType || !rejectDetail.trim()) return
    try {
      await requestJson(`/api/refunds/${rejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reasonType: rejectType, detail: rejectDetail.trim() })
      })
      setRejectTarget(null)
      setRejectType('')
      setRejectDetail('')
      await loadRows()
    } catch (error) {
      window.alert(error.message || '拒绝申请失败')
    }
  }

  const handleView = async (row) => {
    try {
      const data = await requestJson(`/api/refunds/${row.id}`)
      setViewTarget(data)
    } catch (error) {
      window.alert(error.message || '加载退款详情失败')
    }
  }

  return (
    <div className="refund-v2">
      <div className="order-panel">
        <div className="order-tabs-v2">
          {STATUS_TABS.map((item) => (
            <button
              key={item.key}
              className={`order-tab-v2 ${tab === item.key ? 'active' : ''}`}
              onClick={() => changeTab(item.key)}
            >
              {item.label}（{counts[item.key] || 0}）
            </button>
          ))}
        </div>

        <div className="order-filters-v2 refund-filters-v2">
          <div className="filter-group-v2">
            <label>订单号</label>
            <input value={orderNo} onChange={(event) => setOrderNo(event.target.value)} placeholder="请输入订单号" />
          </div>
          <div className="filter-group-v2">
            <label>用户信息</label>
            <input value={userText} onChange={(event) => setUserText(event.target.value)} placeholder="请输入姓名/手机号" />
          </div>
          <div className="filter-group-v2">
            <label>退款状态</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">请选择退款状态，可多选</option>
              {STATUS_TABS.filter((item) => item.key !== 'all').map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group-v2">
            <label>申请日期</label>
            <input value={dateRange} onChange={(event) => setDateRange(event.target.value)} placeholder="开始日期-结束日期" />
          </div>
          <div className="filter-actions-v2">
            <button className="btn-primary" onClick={handleSearch}>查询</button>
            <button className="btn-secondary" onClick={resetFilters}>重置</button>
          </div>
        </div>

        <div className="table-wrap-v2">
          <table className="order-table-v2">
            <thead>
              <tr>
                <th>序号</th>
                <th>退款单号</th>
                <th>订单号</th>
                <th>用户信息</th>
                <th>订单金额（元）</th>
                <th>退款金额（元）</th>
                <th>退款类型</th>
                <th>申请人</th>
                <th>申请时间</th>
                <th>退款状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty-v2">暂无退款记录</td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td>{row.refundNo}</td>
                  <td>{row.orderNo}</td>
                  <td>{row.user}</td>
                  <td>{toMoney(row.orderAmount)}</td>
                  <td>{toMoney(row.refundAmount)}</td>
                  <td>{refundTypeText(row.refundType)}</td>
                  <td>{row.applicant}</td>
                  <td>{formatDateTime(row.applyTime)}</td>
                  <td>
                    <span className={`status-pill-v2 ${statusClass(row.status)}`}>{statusText(row.status)}</span>
                    {row.status === 'rejected' && row.rejectReason && (
                      <span className="reject-tip-wrap-v2">
                        <span className="reject-tip-icon-v2">i</span>
                        <span className="reject-tip-pop-v2">拒绝原因：{row.rejectReason}</span>
                      </span>
                    )}
                  </td>
                  <td className="op-links-v2">
                    <button onClick={() => handleView(row)}>查看</button>
                    {row.status === 'pending' && (
                      <>
                        <button onClick={() => setApproveTarget(row)}>通过</button>
                        <button onClick={() => setRejectTarget(row)}>拒绝</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer-v2">
          <span>共 {total} 条记录 第 {currentPage} / {totalPages} 页</span>
          <div className="pager-v2">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>上一页</button>
            {pageNumbers.map((p, idx) => (
              typeof p === 'number'
                ? <button key={`${p}-${idx}`} className={p === currentPage ? 'active' : ''} onClick={() => setCurrentPage(p)}>{p}</button>
                : <span key={`ellipsis-${idx}`} className="ellipsis-v2">...</span>
            ))}
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}>
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
            <span>跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isFinite(v)) return
                setCurrentPage(Math.max(1, Math.min(totalPages, v)))
              }}
            />
            <span>页</span>
          </div>
        </div>
      </div>

      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal-content refund-dialog-v2" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>确认通过退款申请</h3>
              <button className="close-btn" onClick={() => setApproveTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="refund-dialog-symbol success">✓</div>
              <div className="refund-dialog-title">确认通过此退款申请？</div>
              <div className="refund-dialog-sub">退款单号：{approveTarget.refundNo}</div>
              <div className="refund-dialog-sub amount">退款金额：{toMoney(approveTarget.refundAmount)}</div>
              <div className="refund-dialog-sub">通过后系统将自动执行退款操作</div>
              <div className="refund-dialog-form">
                <label>审批备注（可选）</label>
                <textarea value={approveRemark} onChange={(event) => setApproveRemark(event.target.value)} placeholder="请输入审批备注" rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setApproveTarget(null)}>取消</button>
              <button className="btn-primary btn-success-v2" onClick={confirmApprove}>确认通过</button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal-content refund-dialog-v2" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>拒绝退款申请</h3>
              <button className="close-btn" onClick={() => setRejectTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="refund-dialog-symbol danger">×</div>
              <div className="refund-dialog-title">确认拒绝此退款申请？</div>
              <div className="refund-dialog-sub">退款单号：{rejectTarget.refundNo}</div>
              <div className="refund-dialog-sub amount">退款金额：{toMoney(rejectTarget.refundAmount)}</div>
              <div className="refund-dialog-sub">拒绝后申请人将收到系统通知</div>
              <div className="refund-dialog-form">
                <label>拒绝理由 *</label>
                <select value={rejectType} onChange={(event) => setRejectType(event.target.value)}>
                  <option value="">请选择拒绝理由，字典维护</option>
                  <option value="超期申请">超期申请</option>
                  <option value="服务已核销">服务已核销</option>
                  <option value="材料不完整">材料不完整</option>
                  <option value="订单信息异常">订单信息异常</option>
                </select>
              </div>
              <div className="refund-dialog-form">
                <label>详细说明 *</label>
                <textarea value={rejectDetail} onChange={(event) => setRejectDetail(event.target.value)} placeholder="请详细说明拒绝原因" rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setRejectTarget(null)}>取消</button>
              <button className="btn-primary btn-danger-v2" disabled={!rejectType || !rejectDetail.trim()} onClick={confirmReject}>确认拒绝</button>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="modal-overlay" onClick={() => setViewTarget(null)}>
          <div className="modal-content refund-view-dialog-v2" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>退款详情</h3>
              <button className="close-btn" onClick={() => setViewTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="refund-view-grid-v2">
                <div><label>退款单号</label><strong>{viewTarget.refundNo}</strong></div>
                <div><label>订单号</label><strong>{viewTarget.orderNo}</strong></div>
                <div><label>用户信息</label><strong>{viewTarget.user}</strong></div>
                <div><label>申请人</label><strong>{viewTarget.applicant}</strong></div>
                <div><label>订单金额</label><strong>{toMoney(viewTarget.orderAmount)}</strong></div>
                <div><label>退款金额</label><strong>{toMoney(viewTarget.refundAmount)}</strong></div>
                <div><label>退款类型</label><strong>{refundTypeText(viewTarget.refundType)}</strong></div>
                <div><label>申请时间</label><strong>{formatDateTime(viewTarget.applyTime)}</strong></div>
                <div><label>退款状态</label><strong>{statusText(viewTarget.status)}</strong></div>
              </div>
              {viewTarget.status === 'rejected' && viewTarget.rejectReason && (
                <div className="refund-view-reason-v2">
                  <label>拒绝原因</label>
                  <p>{viewTarget.rejectReason}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setViewTarget(null)}>知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

