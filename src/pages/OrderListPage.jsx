import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildQuery, requestJson } from '../utils/http'

const ORDER_STATUS_OPTIONS = [
  { key: 'all', label: '全部', badgeClass: '' },
  { key: 'pending', label: '待支付', badgeClass: 'status-pending' },
  { key: 'paid', label: '已支付', badgeClass: 'status-paid' },
  { key: 'completed', label: '已完成', badgeClass: 'status-completed' },
  { key: 'cancelled', label: '已取消', badgeClass: 'status-cancelled' },
  { key: 'refunded', label: '已退款', badgeClass: 'status-refunded' }
]

const DEFAULT_KPIS = [
  { title: '今日成交', count: 0, amount: 0, dotClass: 'dot-blue' },
  { title: '昨日成交', count: 0, amount: 0, dotClass: 'dot-orange' },
  { title: '本周成交', count: 0, amount: 0, dotClass: 'dot-orange' },
  { title: '本月成交', count: 0, amount: 0, dotClass: 'dot-orange' }
]

function getStatusText(status) {
  return ORDER_STATUS_OPTIONS.find((item) => item.key === status)?.label || '未知'
}

function getStatusClass(status) {
  return ORDER_STATUS_OPTIONS.find((item) => item.key === status)?.badgeClass || ''
}

function maskPhone(phone = '') {
  return String(phone || '')
}
function formatDateTime(str) {
  if (!str) return '-'
  return String(str).replace('T', ' ').substring(0, 19)
}

function formatCurrency(amount = 0) {
  const value = Number(amount) || 0
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function buildPager(totalPages, currentPage) {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (currentPage <= 5) return [1, 2, 3, 4, 5, 6, 7, '...', totalPages]
  if (currentPage >= totalPages - 4) return [1, '...', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

export default function OrderListPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [kpis, setKpis] = useState(DEFAULT_KPIS)
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ all: 0, pending: 0, paid: 0, completed: 0, cancelled: 0, refunded: 0 })
  const [total, setTotal] = useState(0)

  const [activeTab, setActiveTab] = useState('all')
  const [orderNo, setOrderNo] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const [appliedFilter, setAppliedFilter] = useState({
    orderNo: '',
    keyword: '',
    status: '',
    dateRange: ''
  })

  // KPI: fetch ALL orders (pageSize=9999) to compute accurate time-based counts (UTC)
  useEffect(() => {
    let cancelled = false
    setKpis(DEFAULT_KPIS.map(k => ({ ...k }))) // reset while loading
    requestJson('/api/orders?page=1&pageSize=9999')
      .then((data) => {
        if (cancelled) return
        const allOrders = (data.data || data).records || data.list || []
        const now = new Date()
        const todayStartUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        const monthStartUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        const todayCount = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= todayStartUTC).length
        const monthCount = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= monthStartUTC).length
        const todayAmount = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= todayStartUTC).reduce((s, o) => s + (parseFloat(o.payAmount) || 0), 0)
        const monthAmount = allOrders.filter(o => o.createTime && new Date(o.createTime).getTime() >= monthStartUTC).reduce((s, o) => s + (parseFloat(o.payAmount) || 0), 0)
        const yearAmount = allOrders.reduce((s, o) => s + (parseFloat(o.payAmount) || 0), 0)
        setKpis([
          { title: '今日成交', count: todayCount, amount: todayAmount, dotClass: 'dot-blue' },
          { title: '本月成交', count: monthCount, amount: monthAmount, dotClass: 'dot-orange' },
          { title: '本年成交', count: allOrders.length, amount: yearAmount, dotClass: 'dot-green' },
        ])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    // 并行请求：全部订单（用于统计）+ 分页订单（用于显示）
    // 统计用始终请求不带status的全量数据，列表显示用带status的过滤数据
    Promise.all([
      requestJson('/api/orders?page=1&pageSize=9999'),
      requestJson(`/api/orders?page=${currentPage}&pageSize=${pageSize}` + (appliedFilter.status ? '&status=' + appliedFilter.status : ''))
    ]).then(([allData, pageData]) => {
      if (cancelled) return

      // 全部订单用于统计（始终用全量数据，不受status过滤影响）
      const allOrders = (allData.data || allData).records || allData.list || [];
      const pending = allOrders.filter(o => o.status === 'pending').length;
      const paid = allOrders.filter(o => o.status === 'paid').length;
      const completed = allOrders.filter(o => o.status === 'completed').length;
      const cancelledCnt = allOrders.filter(o => o.status === 'cancelled').length;
      const refunded = allOrders.filter(o => o.status === 'refunded').length;
      const totalAll = pending + paid + completed + cancelledCnt + refunded;

      setCounts({
        all: totalAll,
        pending,
        paid,
        completed,
        cancelled: cancelledCnt,
        refunded,
      });
      setTotal(appliedFilter.status ? (pageData.data || pageData).total || (pageData.data || pageData).records?.length || 0 : totalAll);

      // 当前页数据用于显示
      const orders2 = (pageData.data || pageData).records || pageData.list || [];
      setOrders(orders2);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return
      setOrders([])
      setCounts({ all: 0, pending: 0, paid: 0, completed: 0, cancelled: 0, refunded: 0 })
      setTotal(0)
      setLoading(false);
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, currentPage, pageSize, appliedFilter])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const paginationNumbers = useMemo(() => buildPager(totalPages, currentPage), [totalPages, currentPage])

  const handleReset = () => {
    setOrderNo('')
    setKeyword('')
    setStatus('')
    setDateRange('')
    setActiveTab('all')
    setCurrentPage(1)
    setAppliedFilter({ orderNo: '', keyword: '', status: '', dateRange: '' })
  }

  const handleSearch = () => {
    setCurrentPage(1)
    setAppliedFilter({
      orderNo,
      keyword,
      status,
      dateRange
    })
  }

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey)
    setStatus(tabKey === 'all' ? '' : tabKey)
    setAppliedFilter((prev) => ({ ...prev, status: tabKey === 'all' ? '' : tabKey }))
    setCurrentPage(1)
  }

  const handleRequestRefund = async (item) => {
    try {
      await requestJson(`/api/orders/${item.id}/request-refund`, { method: 'POST' })
      window.alert(`已发起退款申请：${item.orderNo}`)
      navigate('/refund')
    } catch (error) {
      window.alert(error.message || '发起退款失败')
    }
  }

  return (
    <div className="order-list-v2">
      <div className="breadcrumb-chips">
        <button className="crumb-chip" onClick={() => navigate('/workbench')}>工作台</button>
      </div>

      <div className="order-kpi-grid">
        {kpis.map((item) => (
          <div className="order-kpi-card" key={item.title}>
            <div className="kpi-title">
              <span className={`kpi-dot ${item.dotClass || 'dot-orange'}`} />
              <span>{item.title}</span>
            </div>
            <div className="kpi-body">
              <div>
                <div className="kpi-label">成交量</div>
                <div className="kpi-number">{item.count || 0}</div>
              </div>
              <div>
                <div className="kpi-label">成交金额</div>
                <div className="kpi-amount">{formatCurrency(item.amount)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="order-panel">
        <div className="order-tabs-v2">
          {ORDER_STATUS_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              className={`order-tab-v2 ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}（{counts[tab.key] || 0}）
            </button>
          ))}
        </div>

        <div className="order-filters-v2">
          <div className="filter-group-v2">
            <label>订单号</label>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="请输入订单号" />
          </div>
          <div className="filter-group-v2">
            <label>用户信息</label>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="请输入姓名/手机号" />
          </div>
          <div className="filter-group-v2">
            <label>订单状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">请选择订单状态，可多选</option>
              {ORDER_STATUS_OPTIONS.filter((item) => item.key !== 'all').map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group-v2">
            <label>下单日期</label>
            <input value={dateRange} onChange={(e) => setDateRange(e.target.value)} placeholder="开始日期-结束日期" />
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
                <th>订单号</th>
                <th>用户信息</th>
                <th>商品信息</th>
                <th>订单金额（元）</th>
                <th>实付金额（元）</th>
                <th>平台分账（元）</th>
                <th>租户分账（元）</th>
                <th>下单时间</th>
                <th>订单状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty-v2">暂无订单数据</td>
                </tr>
              )}
              {orders.map((item, index) => (
                <tr key={item.id}>
                  <td>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td>{item.orderNo}</td>
                  <td>{`${item.memberName || item.patient || ""}${maskPhone(item.memberPhone || item.phone)}`}</td>
                  <td>{item.productName}</td>
                  <td>{formatCurrency(item.originalPrice)}</td>
                  <td>{formatCurrency(item.payAmount)}</td>
                  <td>{formatCurrency(0)}</td>
                  <td>{formatCurrency(0)}</td>
                  <td>{formatDateTime(item.createTime)}</td>
                  <td>
                    <span className={`status-pill-v2 ${getStatusClass(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                  </td>
                  <td className="op-links-v2">
                    <button onClick={() => navigate(`/orders/${item.id}`)}>查看</button>
                    {(item.status === 'paid' || item.status === 'completed') && (
                      <button onClick={() => handleRequestRefund(item)}>申请退款</button>
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
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>上一页</button>
            {paginationNumbers.map((number, index) => (
              typeof number === 'number'
                ? (
                  <button
                    key={`${number}-${index}`}
                    className={currentPage === number ? 'active' : ''}
                    onClick={() => setCurrentPage(number)}
                  >
                    {number}
                  </button>
                )
                : <span key={`ellipsis-${index}`} className="ellipsis-v2">...</span>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>下一页</button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
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
                const value = Number(e.target.value)
                if (!Number.isNaN(value) && value >= 1 && value <= totalPages) setCurrentPage(value)
              }}
            />
            <span>页</span>
          </div>
        </div>
      </div>
    </div>
  )
}

