import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { requestJson } from '../utils/http'

function money(value = 0) {
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function InfoCard({ title, lines }) {
  return (
    <div className="order-detail-card">
      <h4>{title}</h4>
      <ul>
        {lines.map((line) => (
          <li key={line.label}>
            <span>{line.label}</span>
            <strong>{line.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const EMPTY_DETAIL = {
  base: { orderNo: '-', patient: '-', product: '-', orderAmount: 0 },
  payment: { method: '-', status: '-', createdAt: '-', paidAt: '-' },
  receiver: { method: '-', status: '-', createdAt: '-', paidAt: '-' },
  settlement: { amount: 0, platformRate: 10, platformAmount: 0, tenantRate: 90, tenantAmount: 0 },
  refund: { amount: 0, platform: 0, tenant: 0, status: '-' },
  serviceItems: [],
  usedItems: []
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(EMPTY_DETAIL)
  const [error, setError] = useState('')

  const loadDetail = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await requestJson(`/api/orders/${id}`)
      const d = result.data || {}
      // Map flat API response to nested detail structure
      const detail = {
        base: {
          orderNo: d.orderNo || '-',
          patient: d.memberName || '-',
          product: d.productName || '-',
          orderAmount: d.payAmount || 0,
        },
        payment: {
          method: (d.payMethod === "balance" ? "余额支付" : d.payMethod === "wechat" ? "微信支付" : d.payMethod === "alipay" ? "支付宝" : d.payMethod) || '-',
          status: d.status === 'pending' ? '待支付' : d.status === 'paid' ? '已支付' : d.status === 'completed' ? '已完成' : d.status === 'cancelled' ? '已取消' : d.status === 'refunded' ? '已退款' : d.status || '-',
          createdAt: d.createTime ? d.createTime.replace('T', ' ').substring(0, 19) : '-',
          paidAt: d.paidTime ? d.paidTime.replace('T', ' ').substring(0, 19) : '-',
        },
        receiver: {
          method: '-',
          status: '-',
          createdAt: '-',
          paidAt: '-',
        },
        settlement: {
          amount: d.payAmount || 0,
          platformRate: 10,
          platformAmount: Math.round((d.payAmount || 0) * 0.1 * 100) / 100,
          tenantRate: 90,
          tenantAmount: Math.round((d.payAmount || 0) * 0.9 * 100) / 100,
        },
        refund: {
          amount: d.refundAmount || 0,
          platform: Math.round((d.refundAmount || 0) * 0.1 * 100) / 100,
          tenant: Math.round((d.refundAmount || 0) * 0.9 * 100) / 100,
          status: d.refundTime ? '已退款' : '-',
        },
        serviceItems: [],
        usedItems: [],
      }
      setDetail(detail)
    } catch (err) {
      setError(err.message || '订单详情加载失败')
      setDetail(EMPTY_DETAIL)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className="order-detail-v2">
      <div className="breadcrumb-chips">
        <button className="crumb-chip" onClick={() => navigate('/workbench')}>工作台</button>
        <button className="crumb-chip active" onClick={() => navigate('/orders')}>订单详情</button>
      </div>

      <div className="order-detail-panel">
        <div className="section-title-row">
          <h3>1.订单信息</h3>
          <div className="filter-actions-v2">
            <button className="btn-primary" onClick={loadDetail}>查询</button>
            <button className="btn-secondary" onClick={() => navigate('/orders')}>返回列表</button>
          </div>
        </div>

        {error && <div className="table-empty-v2">{error}</div>}

        <div className="order-detail-grid">
          <InfoCard
            title="基本信息"
            lines={[
              { label: '订单号：', value: detail.base.orderNo },
              { label: '患者信息：', value: detail.base.patient },
              { label: '商品名称：', value: detail.base.product },
              { label: '订单金额：', value: money(detail.base.orderAmount) }
            ]}
          />

          <InfoCard
            title="支付信息"
            lines={[
              { label: '支付方式：', value: detail.payment.method },
              { label: '支付状态：', value: detail.payment.status },
              { label: '创建时间：', value: detail.payment.createdAt },
              { label: '支付时间：', value: detail.payment.paidAt }
            ]}
          />

          <InfoCard
            title="收货信息"
            lines={[
              { label: '支付方式：', value: detail.receiver.method },
              { label: '支付状态：', value: detail.receiver.status },
              { label: '创建时间：', value: detail.receiver.createdAt },
              { label: '支付时间：', value: detail.receiver.paidAt }
            ]}
          />

          <InfoCard
            title="分账信息"
            lines={[
              { label: '订单金额：', value: money(detail.settlement.amount) },
              { label: `平台分账(${detail.settlement.platformRate}%)：`, value: money(detail.settlement.platformAmount) },
              { label: `租户分账(${detail.settlement.tenantRate}%)：`, value: money(detail.settlement.tenantAmount) }
            ]}
          />

          <InfoCard
            title="退款信息"
            lines={[
              { label: '退款金额：', value: money(detail.refund.amount) },
              { label: `平台退款(${detail.settlement.platformRate}%)：`, value: money(detail.refund.platform) },
              { label: `租户退款(${detail.settlement.tenantRate}%)：`, value: money(detail.refund.tenant) },
              { label: '退款状态：', value: detail.refund.status }
            ]}
          />
        </div>

        <div className="order-detail-tables">
          <div className="detail-table-box">
            <h3>服务项目</h3>
            <table className="order-table-v2">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>服务项目</th>
                  <th>总数量</th>
                  <th>剩余数量</th>
                </tr>
              </thead>
              <tbody>
                {detail.serviceItems.length === 0 && (
                  <tr><td colSpan={4} className="table-empty-v2">暂无服务项目</td></tr>
                )}
                {detail.serviceItems.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.total}</td>
                    <td>{item.remain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="detail-table-box">
            <h3>使用记录</h3>
            <table className="order-table-v2">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>使用时间</th>
                  <th>使用项目</th>
                </tr>
              </thead>
              <tbody>
                {detail.usedItems.length === 0 && (
                  <tr><td colSpan={3} className="table-empty-v2">暂无使用记录</td></tr>
                )}
                {detail.usedItems.map((item, index) => (
                  <tr key={`${item.id}-${item.time}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{item.time}</td>
                    <td>{item.item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="detail-foot-note">订单ID：{id} {loading ? '（加载中）' : ''}</div>
      </div>
    </div>
  )
}

