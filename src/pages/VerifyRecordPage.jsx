import React, { useEffect, useMemo, useState } from 'react'
import { buildQuery, requestJson } from '../utils/http'

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待核销' },
  { key: 'verified', label: '已核销' }
]

function statusMeta(status) {
  if (status === 'verified') return { text: '已核销', color: '#00b42a' }
  return { text: '待核销', color: '#165dff' }
}

function formatMoney(value = 0) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function maskPhone(phone = '') {
  return String(phone || '')
}
function formatDateTime(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

function buildPager(totalPages, currentPage) {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (currentPage <= 5) return [1, 2, 3, 4, 5, 6, 7, '...', totalPages]
  if (currentPage >= totalPages - 4) return [1, '...', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

function calcStats(allRows = []) {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const toTs = (v) => new Date(String(v).replace(' ', 'T')).getTime()
  const verifiedRows = allRows.filter((item) => item.verify_status === 'verified')
  const todayRows = verifiedRows.filter((item) => toTs(item.verify_time) >= startToday)
  const monthRows = verifiedRows.filter((item) => toTs(item.verify_time) >= startMonth)

  return [
    { label: '今日核销', amount: todayRows.length, count: todayRows.length },
    { label: '本月核销', amount: monthRows.length, count: monthRows.length },
    { label: '待核销', amount: allRows.filter((item) => item.verify_status === 'pending').length, count: 0 },
    { label: '本月核销金额', amount: monthRows.length * 199, count: 0 }
  ]
}

export default function VerifyRecordPage() {
  const [tab, setTab] = useState('all')
  const [orderNo, setOrderNo] = useState('')
  const [keyword, setKeyword] = useState('')
  const [verifyStatus, setVerifyStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedFilter, setAppliedFilter] = useState({ orderNo: '', keyword: '', verifyStatus: '', startDate: '', endDate: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({ all: 0, pending: 0, verified: 0 })
  const [stats, setStats] = useState([
    { label: '今日核销', amount: 0, count: 0 },
    { label: '本月核销', amount: 0, count: 0 },
    { label: '待核销', amount: 0, count: 0 },
    { label: '本月核销金额', amount: 0, count: 0 }
  ])
  const [loading, setLoading] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [verifyTarget, setVerifyTarget] = useState(null)

  const loadStats = async () => {
    try {
      const query = buildQuery({ tab: 'all', page: 1, pageSize: 200 })
      const data = await requestJson(`/api/verify-records?${query}`)
      setStats(calcStats((data.data || data).records || data.list || []))
    } catch {
      setStats([
        { label: '今日核销', amount: 0, count: 0 },
        { label: '本月核销', amount: 0, count: 0 },
        { label: '待核销', amount: 0, count: 0 },
        { label: '本月核销金额', amount: 0, count: 0 }
      ])
    }
  }

  const loadRows = async () => {
    try {
      setLoading(true)
      const query = buildQuery({
        tab,
        keyword: appliedFilter.keyword,
        startDate: appliedFilter.startDate,
        endDate: appliedFilter.endDate,
        page: currentPage,
        pageSize
      })
      const data = await requestJson(`/api/verify-records${query ? `?${query}` : ''}`)
      const records = (data.data || data).records || data.list || [];
      const pending = records.filter(r => r.verify_status === 'pending' || r.verify_status === 'PENDING').length;
      const verified = records.filter(r => r.verify_status === 'verified' || r.verify_status === 'VERIFIED').length;
      const totalAll = pending + verified;
      setRows(records);
      setTotal(totalAll);
      setCounts({
        all: totalAll,
        pending,
        verified,
      })
    } catch {
      setRows([])
      setTotal(0)
      setCounts({ all: 0, pending: 0, verified: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentPage, pageSize, appliedFilter])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const pageNumbers = useMemo(() => buildPager(totalPages, currentPage), [totalPages, currentPage])

  const handleSearch = () => {
    setCurrentPage(1)
    setAppliedFilter({ orderNo, keyword, verifyStatus, startDate, endDate })
  }

  const handleReset = () => {
    setOrderNo('')
    setKeyword('')
    setVerifyStatus('')
    setStartDate('')
    setEndDate('')
    setTab('all')
    setCurrentPage(1)
    setAppliedFilter({ orderNo: '', keyword: '', verifyStatus: '', startDate: '', endDate: '' })
  }

  const handleVerify = async (id) => {
    const row = rows.find(r => r.id === id)
    if (row) setVerifyTarget(row)
  }

  const confirmVerify = async () => {
    if (!verifyTarget) return
    try {
      await requestJson(`/api/verify-records/${verifyTarget.id}/verify`, { method: 'POST' })
      setVerifyTarget(null)
      await loadRows()
      await loadStats()
    } catch (error) {
      window.alert(error.message || '核销失败')
    }
  }

  const handleView = async (id) => {
    try {
      const data = await requestJson(`/api/verify-records/${id}`)
      setViewTarget(data.data)
    } catch (error) {
      window.alert(error.message || '加载详情失败')
    }
  }

  return (
    <div className="refund-v2">
      <div className="order-kpi-grid">
        {stats.map((item) => (
          <div className="order-kpi-card" key={item.label}>
            <div className="kpi-title">
              <span className="kpi-dot dot-blue" />
              <span>{item.label}</span>
            </div>
            <div className="kpi-body">
              <div>
                <div className="kpi-label">数量</div>
                <div className="kpi-number">{item.count || 0}</div>
              </div>
              {item.amount !== undefined && (
                <div>
                  <div className="kpi-label">金额</div>
                  <div className="kpi-amount">{formatMoney(item.amount)}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="order-tabs-v2">
        {STATUS_TABS.map((item) => (
          <button
            key={item.key}
            className={`order-tab-v2 ${tab === item.key ? 'active' : ''}`}
            onClick={() => {
              setTab(item.key)
              setCurrentPage(1)
            }}
          >
            {item.label}（{counts[item.key] || 0}）
          </button>
        ))}
      </div>

      <div className="order-filters-v2 refund-filters-v2">
        <div className="filter-group-v2">
          <label>订单号</label>
          <input
            type="text"
            value={orderNo}
            onChange={(event) => setOrderNo(event.target.value)}
            placeholder="请输入订单号"
          />
        </div>
        <div className="filter-group-v2">
          <label>用户信息</label>
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="请输入姓名/手机号"
          />
        </div>
        <div className="filter-group-v2">
          <label>核销状态</label>
          <select value={verifyStatus} onChange={(event) => setVerifyStatus(event.target.value)}>
            <option value="">请选择订单状态，可多选</option>
            <option value="pending">待核销</option>
            <option value="verified">已核销</option>
          </select>
        </div>
        <div className="filter-group-v2 date-range-group">
          <label>申请核销日期</label>
          <div className="date-range-inputs">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <span>-</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>
        <div className="filter-actions-v2">
          <button className="btn-primary" onClick={handleSearch}>查询</button>
          <button className="btn-secondary" onClick={handleReset}>重置</button>
        </div>
      </div>

      <div className="table-wrap-v2">
        <table className="order-table-v2">
          <thead>
            <tr>
              <th>序号</th>
              <th>核销ID</th>
              <th>订单号</th>
              <th>用户信息</th>
              <th>服务内容</th>
              <th>申请核销时间</th>
              <th>操作人</th>
              <th>确认核销时间</th>
              <th>核销状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="table-empty-v2">暂无核销记录</td>
              </tr>
            )}
            {rows.map((row, index) => {
              const meta = statusMeta(row.verify_status)
              return (
                <tr key={row.id}>
                  <td>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td>{row.id}</td>
                  <td>{row.order_no}</td>
                  <td>
                    <div className="user-cell">
                      <span className="user-name">{row.user_name}</span>
                      <span className="user-phone">{maskPhone(row.phone)}</span>
                    </div>
                  </td>
                  <td>{row.product}</td>
                  <td>{formatDate(row.create_time)}</td>
                  <td>{row.verifier || '-'}</td>
                  <td>{formatDate(row.verify_time)}</td>
                  <td>
                    <span className={`status-pill-v2 ${meta.text === '已核销' ? 'status-paid' : 'status-pending'}`}>
                      {meta.text}
                    </span>
                  </td>
                  <td className="op-links-v2">
                    {row.verify_status === 'pending' ? (
                      <button className="table-action-btn success" onClick={() => handleVerify(row.id)}>核销</button>
                    ) : null}
                    <button className="table-action-btn detail" onClick={() => handleView(row.id)}>查看</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">共 {total} 条记录</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>{'<'}</button>
            {pageNumbers.map((item, idx) => (
              typeof item === 'number'
                ? <button key={`${item}-${idx}`} className={`page-btn ${item === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(item)}>{item}</button>
                : <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>
            ))}
            <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>{'>'}</button>
            <select
              className="page-size-select"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
            <span className="jump-to">跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              className="jump-input"
              value={currentPage}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                setCurrentPage(Math.max(1, Math.min(totalPages, value)))
              }}
            />
            <span className="jump-unit">页</span>
          </div>
        </div>
      </div>

      {viewTarget && (
        <div className="modal-overlay" onClick={() => setViewTarget(null)}>
          <div className="modal-content refund-view-dialog-v2" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>核销详情</h3>
              <button className="close-btn" onClick={() => setViewTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="refund-view-grid-v2">
                <div><label>订单号</label><strong>{viewTarget.orderNo}</strong></div>
                <div><label>商品</label><strong>{viewTarget.product}</strong></div>
                <div><label>用户</label><strong>{viewTarget.user}</strong></div>
                <div><label>手机号</label><strong>{maskPhone(viewTarget.phone)}</strong></div>
                <div><label>核销状态</label><strong>{statusMeta(viewTarget.verifyStatus).text}</strong></div>
                <div><label>核销人</label><strong>{viewTarget.verifier || '-'}</strong></div>
                <div><label>核销时间</label><strong>{formatDateTime(viewTarget.verifyTime)}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setViewTarget(null)}>知道了</button>
            </div>
          </div>
        </div>
      )}

      {verifyTarget && (
        <div className="modal-overlay" onClick={() => setVerifyTarget(null)}>
          <div className="modal-content refund-dialog-v2" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>确认核销</h3>
              <button className="close-btn" onClick={() => setVerifyTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="refund-dialog-symbol success">✓</div>
              <div className="refund-dialog-title">确认核销此记录？</div>
              <div className="refund-dialog-sub">订单号：{verifyTarget.order_no}</div>
              <div className="refund-dialog-sub">用户：{verifyTarget.user_name}</div>
              <div className="refund-dialog-sub">服务：{verifyTarget.product}</div>
              <div className="refund-dialog-sub">核销后状态将变更为"已核销"</div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setVerifyTarget(null)}>取消</button>
              <button className="btn-primary btn-success-v2" onClick={confirmVerify}>确认核销</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
