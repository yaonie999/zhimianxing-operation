import React, { useMemo, useState, useEffect } from 'react'

const INITIAL_DEVICES = [
  {
    id: 'S1-001',
    name: '神经调控设备 S1-001',
    online: true,
    model: 'S1',
    firmware: 'v2.2.5',
    lastActive: '2 分钟前',
    servedCount: 23,
    runtimeHours: 72,
  },
  {
    id: 'S1-002',
    name: '神经调控设备 S1-002',
    online: true,
    model: 'S1',
    firmware: 'v2.2.5',
    lastActive: '3 分钟前',
    servedCount: 18,
    runtimeHours: 65,
  },
  {
    id: 'P3-015',
    name: '生理指标监测终端 P3-015',
    online: false,
    model: 'P3',
    firmware: 'v1.6.3',
    lastActive: '2 小时前',
    servedCount: 0,
    runtimeHours: 12,
  },
]

const FOUND_DEVICES = [
  { id: 'N-1001', name: '环境调控设备 N1001' },
  { id: 'N-1002', name: '神经调控设备 N1002' },
]

const LOGS = [
  { time: '2025-01-31 14:30:22', text: '设备自检完成，系统运行正常' },
  { time: '2025-01-31 14:30:22', text: '固件检查完成，当前为最新版本 v2.2.5' },
  { time: '2025-01-31 14:30:22', text: '患者张三使用设备治疗，参数已同步' },
]

const PARAMS_BY_MODEL = {
  S1: [
    { name: '刺激强度', value: '45%' },
    { name: '脉冲频率', value: '10Hz' },
    { name: '单次时长', value: '20 分钟' },
  ],
  P3: [
    { name: '采样频率', value: '1 秒/次' },
    { name: '血氧阈值', value: '92%' },
    { name: '报警延迟', value: '15 秒' },
  ],
}

function DeviceRow({ device, onDetail, onMore }) {
  return (
    <div className="device-row-v2">
      <div className="device-left-v2">
        <span className="device-icon-v2">☒</span>
        <span className="device-name-v2">{device.name}</span>
        <span className={`device-dot-v2 ${device.online ? 'online' : 'offline'}`} />
        <span className="device-status-text-v2">{device.online ? '在线' : '离线'}</span>
      </div>
      <div className="device-right-v2">
        <button className="link-action-v2" onClick={() => onDetail(device)}>
          详情
        </button>
        <button className="link-action-v2" onClick={() => onMore(device)}>
          更多操作
        </button>
      </div>
    </div>
  )
}

export default function DeviceManagePage() {
  const [devices, setDevices] = useState([])
  const [currentDevice, setCurrentDevice] = useState(null)
  const [activeAction, setActiveAction] = useState('params')
  const [moreMenuFor, setMoreMenuFor] = useState(null)
  const [logs, setLogs] = useState([])
  const [deviceLoading, setDeviceLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [scanStatus, setScanStatus] = useState('idle')
  const [scanResults, setScanResults] = useState([])

  const runningStatus = useMemo(() => {
    if (!currentDevice) return { text: '离线', className: 'offline' }
    return {
      text: currentDevice.online ? '在线' : '离线',
      className: currentDevice.online ? 'online' : 'offline',
    }
  }, [currentDevice])

  const openAddDialog = () => {
    setShowAddDialog(true)
    setScanStatus('searching')
    setScanResults([])
    window.setTimeout(() => {
      setScanStatus('found')
      setScanResults(FOUND_DEVICES)
    }, 1600)
  }

  // 从后端加载设备列表
  useEffect(() => {
    let cancelled = false
    async function loadDevices() {
      setDeviceLoading(true)
      try {
        const res = await fetch('/api/devices')
        if (res.ok) {
          const data = await res.json()
          if (cancelled) return
          const list = data.list || []
          setDevices(list)
          if (list.length > 0 && !currentDevice) {
            setCurrentDevice(list[0])
          }
        }
      } catch (_) { /* 静默 */ } finally {
        if (!cancelled) setDeviceLoading(false)
      }
    }
    loadDevices()
    return () => { cancelled = true }
  }, [])

  // 加载设备日志
  const loadDeviceLogs = async (deviceId) => {
    if (!deviceId) return
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/devices/${deviceId}/logs`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (_) { /* 静默 */ } finally {
      setLogsLoading(false)
    }
  }

  // 切换设备时加载日志
  useEffect(() => {
    if (currentDevice) loadDeviceLogs(currentDevice.id)
  }, [currentDevice?.id])

  const connectDevice = (device) => {
    const newDevice = {
      id: device.id,
      name: device.name,
      online: true,
      model: 'S1',
      firmware: 'v2.2.5',
      lastActive: '刚刚',
      servedCount: 0,
      runtimeHours: 0,
    }
    setDevices((prev) => [newDevice, ...prev])
    setCurrentDevice(newDevice)
    setShowAddDialog(false)
    setScanStatus('idle')
    setScanResults([])
  }

  const handleMoreAction = async (action) => {
    setMoreMenuFor(null)
    if (!currentDevice) return

    if (action === 'delete') {
      const ok = window.confirm(`确认删除设备「${currentDevice.name}」？`)
      if (!ok) return
      // 删除本地记录（后端暂无删除接口，先本地模拟）
      setDevices((prev) => prev.filter((item) => item.id !== currentDevice.id))
      setCurrentDevice((prev) =>
        prev?.id === currentDevice.id ? null : prev,
      )
      return
    }

    // 调用设备操作 API
    try {
      const res = await fetch(`/api/devices/${currentDevice.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const data = await res.json()
        // 更新日志
        setLogs(prev => [{
          time: data.time || new Date().toLocaleString('zh-CN', { hour12: false }),
          text: data.message || `执行 ${action} 操作成功`,
        }, ...prev])
        if (action === 'start' || action === 'stop' || action === 'restart') {
          // 更新设备在线状态
          setDevices(prev => prev.map(d =>
            d.id === currentDevice.id ? { ...d, online: action === 'start', lastActive: '刚刚' } : d
          ))
          setCurrentDevice(prev => prev ? { ...prev, online: action === 'start', lastActive: '刚刚' } : prev)
        }
        window.alert(data.message || '操作成功')
      } else {
        window.alert('操作失败')
      }
    } catch (_) {
      window.alert('操作失败，请检查网络')
    }
    setActiveAction(action)
  }

  const handleRunDevice = async () => {
    if (!currentDevice) {
      window.alert('请先选择设备')
      return
    }
    setActiveAction('params')
    try {
      const res = await fetch(`/api/devices/${currentDevice.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(prev => [{
          time: data.time || new Date().toLocaleString('zh-CN', { hour12: false }),
          text: data.message || `${currentDevice.name} 已开始运行`,
        }, ...prev])
        window.alert(data.message || '已开始运行')
      } else {
        window.alert('启动失败')
      }
    } catch (_) {
      window.alert('启动失败，请检查网络')
    }
  }

  const handleRefreshLogs = () => {
    if (!currentDevice) return
    loadDeviceLogs(currentDevice.id)
  }

  return (
    <div className="device-v2">
      <div className="device-list-card-v2">
        <div className="device-list-head-v2">
          <h3>设备管理</h3>
          <button className="btn-primary" onClick={openAddDialog}>
            添加设备
          </button>
        </div>

        <div className="device-list-body-v2">
          {deviceLoading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#999' }}>加载中...</div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#999' }}>暂无设备</div>
          ) : (
            devices.map((device) => (
            <div key={device.id} className="device-row-wrap-v2">
              <DeviceRow
                device={device}
                onDetail={(item) => {
                  setCurrentDevice(item)
                  setActiveAction('params')
                }}
                onMore={(item) => setMoreMenuFor(moreMenuFor === item.id ? null : item.id)}
              />
              {moreMenuFor === device.id && (
                <div className="device-more-menu-v2">
                  <button onClick={() => { setCurrentDevice(device); handleMoreAction('params') }}>
                    设备参数
                  </button>
                  <button onClick={() => { setCurrentDevice(device); handleMoreAction('reboot') }}>
                    重启设备
                  </button>
                  <button onClick={() => { setCurrentDevice(device); handleMoreAction('upgrade') }}>
                    固件升级
                  </button>
                  <button onClick={() => { setCurrentDevice(device); handleMoreAction('debug') }}>
                    调试模式
                  </button>
                  <button className="danger" onClick={() => { setCurrentDevice(device); handleMoreAction('delete') }}>
                    删除设备
                  </button>
                </div>
              )}
            </div>
          ))
          )}
        </div>
      </div>

      <div className="device-detail-card-v2">
        <div className="device-detail-head-v2">
          <h3>设备详情</h3>
          <div className="detail-tabs-v2">
            <button
              className={activeAction === 'params' ? 'active' : ''}
              onClick={() => setActiveAction('params')}
            >
              设备参数
            </button>
            <button
              className={activeAction === 'reboot' ? 'active' : ''}
              onClick={() => setActiveAction('reboot')}
            >
              重启设备
            </button>
            <button
              className={activeAction === 'upgrade' ? 'active' : ''}
              onClick={() => setActiveAction('upgrade')}
            >
              固件升级
            </button>
            <button
              className={activeAction === 'debug' ? 'active' : ''}
              onClick={() => setActiveAction('debug')}
            >
              调试模式
            </button>
            <button
              className={activeAction === 'delete' ? 'active' : ''}
              onClick={() => setActiveAction('delete')}
            >
              删除设备
            </button>
            <button className="run-btn" onClick={handleRunDevice}>开始运行</button>
          </div>
        </div>

        {currentDevice ? (
          <div className="device-detail-body-v2">
            <div className="device-info-grid-v2">
              <section>
                <h4>设置信息</h4>
                <p>
                  <span>设备名称</span>
                  <strong>{currentDevice.name}</strong>
                </p>
                <p>
                  <span>设备ID</span>
                  <strong>{currentDevice.id}</strong>
                </p>
                <p>
                  <span>设备型号</span>
                  <strong>{currentDevice.model}</strong>
                </p>
                <p>
                  <span>固件版本</span>
                  <strong>{currentDevice.firmware}</strong>
                </p>
                <p>
                  <span>最后活动</span>
                  <strong>{currentDevice.lastActive}</strong>
                </p>
                <div className="device-param-box-v2">
                  <div className="device-param-title-v2">设备参数（按型号动态加载）</div>
                  {(PARAMS_BY_MODEL[currentDevice.model] || []).map((item) => (
                    <div className="device-param-row-v2" key={item.name}>
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4>运行状态</h4>
                <p>
                  <span>今日服务患者</span>
                  <strong>{currentDevice.servedCount} 人</strong>
                </p>
                <p>
                  <span>累计运行时间</span>
                  <strong>{currentDevice.runtimeHours} 小时</strong>
                </p>
                <p>
                  <span>状态</span>
                  <strong className={`dot-state-v2 ${runningStatus.className}`}>
                    <i />
                    {runningStatus.text}
                  </strong>
                </p>
                {activeAction !== 'params' && (
                  <div className="device-action-tip-v2">
                    当前操作：{
                      activeAction === 'reboot'
                        ? '重启设备'
                        : activeAction === 'upgrade'
                          ? '固件升级'
                          : activeAction === 'debug'
                            ? '调试模式'
                            : activeAction === 'delete'
                              ? '删除设备'
                              : '设备参数'
                    }
                  </div>
                )}
              </section>
            </div>

            <div className="device-log-v2">
              <div className="device-log-head-v2">
                <h4>设备日志</h4>
                <button className="btn-primary" onClick={handleRefreshLogs}>刷新日志</button>
              </div>
              {logsLoading ? (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#999', fontSize: 13 }}>加载中...</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#999', fontSize: 13 }}>暂无日志</div>
              ) : (
                logs.map((log, index) => (
                <div className="device-log-item-v2" key={`${log.time}-${index}`}>
                  <div className="time">{log.time}</div>
                  <div className="text">{log.text}</div>
                </div>
              ))
              )}
            </div>
          </div>
        ) : (
          <div className="device-empty-v2">当前无设备，请先添加设备。</div>
        )}
      </div>

      {showAddDialog && (
        <div className="modal-overlay" onClick={() => setShowAddDialog(false)}>
          <div
            className="modal-content device-add-dialog-v2"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>添加设备</h3>
              <button className="close-btn" onClick={() => setShowAddDialog(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="dialog-tip-v2">
                确保你的设备已打开并可被发现，在下面选择要连接的设备。
              </p>
              {scanStatus === 'searching' && (
                <div className="searching-v2">
                  <div className="scan-spinner" />
                  <span>查找中</span>
                </div>
              )}
              {scanStatus === 'found' && (
                <div className="found-list-v2">
                  {scanResults.map((item) => (
                    <div key={item.id} className="found-item-v2">
                      <span>{item.name}</span>
                      <button onClick={() => connectDevice(item)}>连接</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddDialog(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
