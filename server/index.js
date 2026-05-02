import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2'
import http from 'http'
import https from 'https'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('CORS blocked: ' + origin))
  },
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))

// 静态资源（小程序assets图片等）
const XCXP_DIR = path.resolve(__dirname, '..', '..', 'zhimianxing-xcx')
app.use('/assets', express.static(path.join(XCXP_DIR, 'assets')))

const dbPool = mysql.createPool({
  host: process.env.MYSQL_HOST||'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER||'root',
  password: process.env.MYSQL_PASSWORD||'root123',
  database: process.env.MYSQL_DB||'zhimianxing',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

function safeParse(str) {
  if (typeof str === 'object' && str !== null) return str
  if (typeof str === 'string') {
    try { return JSON.parse(str) } catch { return str }
  }
  return str
}

const JWT_SECRET = process.env.JWT_SECRET || 'zhimianxing-operation-secret-key'
const users = {
  'admin': { id:1, username:'admin', password:bcrypt.hashSync('Abc12345',10), name:'管理员', role:'admin', openId:'openid_admin' },
  '13800138000': { id:2, username:'13800138000', password:bcrypt.hashSync('Abc12345',10), name:'张新成', role:'operator', openId:'openid_13800138000' }
}
const loginFailures = {}
const lockedAccounts = {}

function genToken(openId) { return jwt.sign({ openId }, JWT_SECRET, { expiresIn: '24h' }) }
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET) } catch { return null } }


// 小程序辅助函数
function wxJson(data) { return { code: 200, data } }
function wxErr(msg, code) { return { code: code||400, msg } }
const codeStore = {}
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ code: 400, msg: '缺少参数' })
  if (lockedAccounts[username]) return res.status(403).json({ code: 403, msg: '账户已锁定，请稍后再试' })
  const user = users[username]
  if (!user || !bcrypt.compareSync(password, user.password)) { return res.status(401).json({ code: 401, msg: '用户名或密码错误' }) }
  const token = genToken(user.openId)
  res.json({ code: 200, msg: '登录成功', data: { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } } })
})

app.get('/api/current-user', (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ code: 401, msg: '未登录' })
  const user = Object.values(users).find(u => u.openId === verifyToken(auth.replace('Bearer ', ''))?.openId)
  if (!user) return res.status(401).json({ code: 401, msg: '用户不存在' })
  res.json({ code: 200, data: { id: user.id, username: user.username, name: user.name, role: user.role } })
})

app.get('/api/workbench/kpis', (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  dbPool.query('SELECT COUNT(*) as total FROM patient WHERE del_flag=0', (e, r) => {
    if (e) return res.json({ code: 500, msg: e.message })
    dbPool.query('SELECT COUNT(*) as cnt FROM patient WHERE DATE(create_time)=?', [today], (e2, r2) => {
      if (e2) return res.json({ code: 500, msg: e2.message })
      dbPool.query('SELECT COUNT(*) as cnt FROM order_info WHERE status=? AND DATE(create_time)=?', ['completed', today], (e3, r3) => {
        if (e3) return res.json({ code: 500, msg: e3.message })
        res.json({ code: 200, data: { todayPush: r2[0]&&r2[0].cnt||0, todayOrder: r3[0]&&r3[0].cnt||0, todayNew: r2[0]&&r2[0].cnt||0, totalPatients: r[0]&&r[0].total||0 } })
      })
    })
  })
})

app.get('/api/devices', (req, res) => {
  dbPool.query('SELECT id, device_no, device_name, device_type, vendor, protocol_type, status, last_heartbeat_time FROM device_registry ORDER BY id DESC LIMIT 100', (e, rows) => {
    if (e) return res.json({ code: 500, msg: e.message })
    res.json({ code: 200, data: rows||[] })
  })
})

app.get('/api/devices/:id', (req, res) => {
  dbPool.query('SELECT * FROM device_registry WHERE id=?', [req.params.id], (e, rows) => {
    if (e) return res.json({ code: 500, msg: e.message })
    res.json({ code: 200, data: rows[0]||null })
  })
})

app.post('/api/devices/:id/action', (req, res) => {
  dbPool.query('SELECT * FROM device_registry WHERE id=?', [req.params.id], (e, rows) => {
    if (e) return res.json({ code: 500, msg: e.message })
    if (!rows.length) return res.status(404).json({ code: 404, msg: '设备不存在' })
    const { action } = req.body
    const now = new Date().toISOString().replace('T',' ').slice(0,19)
    const actionMap = { start:'设备已启动', stop:'设备已停止', restart:'设备重启中...', upgrade:'固件升级中，请稍候...' }
    const msg = actionMap[action] || '执行 ' + action + ' 操作'
    dbPool.query('INSERT INTO device_command_log (device_id, command, status, create_time) VALUES (?, ?, ?, ?)', [req.params.id, action, 'success', now], () => {})
    res.json({ code: 200, msg, data: { deviceId: req.params.id, action, result: msg } })
  })
})

const JAVA_API_BASE_URL = (process.env.JAVA_API_BASE_URL || `http://${process.env.JAVA_API_HOST || 'localhost'}:${process.env.JAVA_API_PORT || '8080'}/api`).replace(/\/$/, '')

function forwardToBackend(req, res, pathSuffix, method, body) {
  method = method || 'GET'

  const base = new URL(JAVA_API_BASE_URL)
  const prefix = base.pathname.replace(/\/$/, '')
  const suffix = String(pathSuffix || '').startsWith('/') ? String(pathSuffix) : `/${String(pathSuffix || '')}`
  const targetPath = `${prefix}${suffix}`

  const options = {
    protocol: base.protocol,
    hostname: base.hostname,
    port: base.port || (base.protocol === 'https:' ? 443 : 80),
    path: targetPath,
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': req.headers.cookie || '',
      'Authorization': req.headers.authorization || ''
    }
  }

  const transport = base.protocol === 'https:' ? https : http
  const proxyReq = transport.request(options, (proxyRes) => {
    let data = ''
    proxyRes.on('data', chunk => { data += chunk })
    proxyRes.on('end', () => {
      try { res.status(proxyRes.statusCode || 500).json(safeParse(data)) }
      catch { res.status(proxyRes.statusCode || 500).send(data) }
    })
  })

  proxyReq.on('error', (err) => res.status(502).json({ code: 502, msg: '后端服务不可用', detail: err.message }))
  if (body) proxyReq.write(JSON.stringify(body))
  proxyReq.end()
}

// 患者 - 直连MySQL
app.get('/api/patients', (req, res) => {
  const page = parseInt(req.query.page||1), pageSize = parseInt(req.query.pageSize||9999), offset = (page-1)*pageSize
  dbPool.query('SELECT * FROM patient WHERE del_flag=0 ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    dbPool.query('SELECT COUNT(*) as total FROM patient WHERE del_flag=0', (err2, tot) => {
      if (err2) return res.status(500).json({ code: 500, msg: err2.message })
      res.json({ code: 200, msg: '操作成功', data: { total: tot[0].total, records: rows } })
    })
  })
})

app.get('/api/patients/list', (req, res) => {
  dbPool.query('SELECT * FROM patient WHERE del_flag=0 ORDER BY id DESC LIMIT 200', (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    res.json({ code: 200, msg: '操作成功', data: rows })
  })
})

app.get('/api/patients/:id', (req, res) => {
  dbPool.query('SELECT * FROM patient WHERE id=? AND del_flag=0', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    res.json({ code: 200, msg: '操作成功', data: rows[0]||null })
  })
})

app.post('/api/patients', (req, res) => {
  const { name, phone, gender, age, occupation, marital, studio, therapist, group } = req.body
  if (!name || !phone) return res.status(400).json({ code: 400, msg: '姓名和手机号不能为空' })
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  dbPool.query(
    'INSERT INTO patient (name, phone, gender, age, occupation, marital, studio, therapist, group_name, del_flag, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
    [name, phone, gender || '男', age || 0, occupation || '', marital || '未婚', studio || '', therapist || '', group || 'XXX', now],
    (err, result) => {
      if (err) return res.status(500).json({ code: 500, msg: err.message })
      res.json({ code: 200, msg: '新建成功', data: { id: result.insertId } })
    }
  )
})
app.put('/api/patients/:id', (req, res) => {
  const { name, phone, gender, age, occupation, marital, studio, therapist, group } = req.body
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  dbPool.query(
    'UPDATE patient SET name=?, phone=?, gender=?, age=?, occupation=?, marital=?, studio=?, therapist=?, group_name=?, update_time=? WHERE id=? AND del_flag=0',
    [name, phone, gender, age, occupation, marital, studio, therapist, group, now, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ code: 500, msg: err.message })
      if (result.affectedRows === 0) return res.status(404).json({ code: 404, msg: '记录不存在或已删除' })
      res.json({ code: 200, msg: '更新成功' })
    }
  )
})
app.delete('/api/patients/:id', (req, res) => {
  const patientId = req.params.id
  if (!patientId) return res.status(400).json({ code: 400, msg: '缺少参数' })
  // 软删除：更新del_flag=1
  dbPool.query('UPDATE patient SET del_flag = 1 WHERE id = ? AND del_flag = 0', [patientId], (err, result) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    if (result.affectedRows === 0) return res.json({ code: 404, msg: '记录不存在或已删除' })
    res.json({ code: 200, msg: '删除成功', data: { affectedRows: result.affectedRows } })
  })
})
app.post('/api/patients/batch-assign', (req, res) => forwardToBackend(req, res, '/patient/batch-assign', 'POST', req.body))
app.post('/api/patients/batch-update-group', (req, res) => forwardToBackend(req, res, '/patient/batch-update-group', 'POST', req.body))

// 订单 - 直连MySQL (避免Java分页bug)
app.get('/api/orders', (req, res) => {
  const page = parseInt(req.query.page||1), pageSize = parseInt(req.query.pageSize||10), offset = (page-1)*pageSize
  const status = req.query.status
  const where = status ? 'WHERE del_flag=0 AND status=' + dbPool.escape(status) : 'WHERE del_flag=0'
  dbPool.query(
    'SELECT id, order_no as orderNo, member_id as memberId, member_name as memberName, member_phone as memberPhone, order_type as orderType, product_id as productId, product_name as productName, product_type as productType, original_price as originalPrice, discount_amount as discountAmount, pay_amount as payAmount, pay_method as payMethod, trade_no as tradeNo, paid_time as paidTime, status, cancel_time as cancelTime, refund_time as refundTime, refund_amount as refundAmount, remark, platform_share as platformShare, tenant_share as tenantShare, create_time as createTime, del_flag as delFlag FROM order_info ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?',
    [pageSize, offset], (err, rows) => {
      if (err) return res.status(500).json({ code: 500, msg: err.message })
      dbPool.query('SELECT COUNT(*) as total FROM order_info ' + where, (err2, tot) => {
        if (err2) return res.status(500).json({ code: 500, msg: err2.message })
        res.json({ code: 200, msg: '操作成功', data: { total: tot[0].total, records: rows } })
      })
    })
})

app.get('/api/orders/kpis', (req, res) => forwardToBackend(req, res, '/order/kpis', 'GET'))
app.get('/api/orders/:id', (req, res) => forwardToBackend(req, res, '/order/'+req.params.id))
app.post('/api/orders', (req, res) => forwardToBackend(req, res, '/order', 'POST', req.body))
app.put('/api/orders/:id', (req, res) => forwardToBackend(req, res, '/order/'+req.params.id, 'PUT', req.body))

app.post('/api/orders/:id/request-refund', (req, res) => {
  const orderId = req.params.id
  dbPool.query('SELECT order_no, member_name, pay_amount FROM order_info WHERE id=?', [orderId], (err, orders) => {
    if (err) return res.status(500).json({ error: '查询失败' })
    if (!orders.length) return res.status(404).json({ error: '订单不存在' })
    const order = orders[0]
    dbPool.query(
      'INSERT INTO refund (order_id, refund_no, order_no, user, order_amount, refund_amount, refund_type, applicant, apply_time, status, create_by, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())',
      [orderId, 'REF'+Date.now(), order.order_no, order.member_name, order.pay_amount||0, order.pay_amount||0, 'full', order.member_name||'未知', order.member_name||'未知'],
      (err2) => {
        if (err2) return res.status(500).json({ error: '插入失败' })
        dbPool.query('UPDATE order_info SET status=? WHERE id=?', ['refunded', orderId], ()=>{})
        res.json({ code: 200, msg: '已发起退款申请' })
      }
    )
  })
})

// 退款 - 直连MySQL
app.get('/api/refunds', (req, res) => {
  const page = parseInt(req.query.page||1), pageSize = parseInt(req.query.pageSize||10), offset = (page-1)*pageSize
  const tab = req.query.tab
  const where = tab && tab !== 'all' ? 'WHERE del_flag=0 AND status=' + dbPool.escape(tab) : 'WHERE del_flag=0'
  dbPool.query(
    `SELECT id, order_id as orderId, refund_no as refundNo, order_no as orderNo, user, order_amount as orderAmount,
     refund_amount as refundAmount, refund_type as refundType, applicant, apply_time as applyTime, status,
     reject_reason as rejectReason, approver, approve_time as approveTime, del_flag as delFlag
     FROM refund ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [pageSize, offset], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    dbPool.query('SELECT COUNT(*) as total FROM refund ' + where, (err2, tot) => {
      if (err2) return res.status(500).json({ code: 500, msg: err2.message })
      res.json({ code: 200, msg: '操作成功', data: { total: tot[0].total, records: rows } })
    })
  })
})

app.get('/api/refunds/list', (req, res) => forwardToBackend(req, res, '/refund/list', 'GET'))
app.get('/api/refunds/:id', (req, res) => forwardToBackend(req, res, '/refund/'+req.params.id))
app.post('/api/refunds', (req, res) => forwardToBackend(req, res, '/refund', 'POST', req.body))
app.put('/api/refunds/:id', (req, res) => forwardToBackend(req, res, '/refund/'+req.params.id, 'PUT', req.body))
app.delete('/api/refunds/:id', (req, res) => forwardToBackend(req, res, '/refund/'+req.params.id, 'DELETE'))
app.post('/api/refunds/:id/approve', (req, res) => forwardToBackend(req, res, '/refund/'+req.params.id+'/approve', 'POST', req.body))
app.post('/api/refunds/:id/reject', (req, res) => forwardToBackend(req, res, '/refund/'+req.params.id+'/reject', 'POST', req.body))

// 核销记录 - 直连MySQL
app.get('/api/verify-records', (req, res) => {
  const page = parseInt(req.query.page||1), pageSize = parseInt(req.query.pageSize||10), offset = (page-1)*pageSize
  const tab = req.query.tab
  const where = tab && tab !== 'all' ? 'WHERE del_flag=0 AND verify_status=' + dbPool.escape(tab) : 'WHERE del_flag=0'
  dbPool.query('SELECT * FROM verify_record ' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    dbPool.query('SELECT COUNT(*) as total FROM verify_record ' + where, (err2, tot) => {
      if (err2) return res.status(500).json({ code: 500, msg: err2.message })
      res.json({ code: 200, msg: '操作成功', data: { total: tot[0].total, records: rows } })
    })
  })
})

app.get('/api/verify-records/:id', (req, res) => {
  dbPool.query('SELECT * FROM verify_record WHERE id=?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    if (rows.length === 0) return res.status(404).json({ code: 404, msg: '记录不存在' })
    const r = rows[0]
    res.json({
      code: 200, msg: '操作成功',
      data: {
        id: r.id,
        orderNo: r.order_no,
        orderId: r.order_id,
        user: r.user_name,
        phone: r.phone,
        product: r.product,
        verifyStatus: r.verify_status,
        verifyTime: r.verify_time,
        verifier: r.verifier,
        remark: r.remark,
        createTime: r.create_time
      }
    })
  })
})

app.post('/api/verify-records/:id/verify', (req, res) => {
  console.log('[VERIFY] id:', req.params.id, 'typeof:', typeof req.params.id)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const sql = 'UPDATE verify_record SET verify_status=?, verify_time=? WHERE id=? AND verify_status=?'
  console.log('[VERIFY] SQL params:', ['verified', now, req.params.id, 'pending'])
  dbPool.query(sql, ['verified', now, req.params.id, 'pending'], (err, result) => {
    console.log('[VERIFY] result:', result.affectedRows, 'err:', err ? err.message : 'none')
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    if (result.affectedRows === 0) return res.status(400).json({ code: 400, msg: '核销失败，记录不存在或已核销' })
    res.json({ code: 200, msg: '核销成功' })
  })
})

app.get('/api/verify-records/list', (req, res) => forwardToBackend(req, res, '/verify-record/list', 'GET'))
app.post('/api/verify-records', (req, res) => forwardToBackend(req, res, '/verify-record', 'POST', req.body))
app.put('/api/verify-records/:id', (req, res) => forwardToBackend(req, res, '/verify-record/'+req.params.id, 'PUT', req.body))
app.delete('/api/verify-records/:id', (req, res) => forwardToBackend(req, res, '/verify-record/'+req.params.id, 'DELETE'))

// 通知消息 - 直连MySQL
app.get('/api/notices', (req, res) => {
  dbPool.query('SELECT id, title, content, notice_type, publish_time FROM operation_notice WHERE status=1 ORDER BY publish_time DESC LIMIT 50', (err, rows) => {
    if (err) return res.json({ code: 500, msg: '查询失败' })
    const notices = rows.map(r => {
      const d = r.publish_time ? new Date(r.publish_time) : null
      const fmt = d && !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        : ''
      return {
        id: r.id,
        title: r.title,
        content: r.content ? r.content.replace(/<[^>]+>/g, '') : '',
        type: r.notice_type,
        time: fmt,
        sentAt: fmt,
        unread: true
      }
    })
    res.json({ code: 200, data: notices })
  })
})

// 患者消息 - 直连MySQL
app.get('/api/patient-messages', (req, res) => {
  const msgs = []
  dbPool.query('SELECT sd.id, sd.member_id, sd.diary_date, p.name as memberName FROM sleep_diary sd LEFT JOIN patient p ON sd.member_id=p.id ORDER BY sd.create_time DESC LIMIT 10', (err, diaries) => {
    if (!err && diaries.length > 0) diaries.forEach(d => msgs.push({
      id: 'diary_'+d.id, memberId: d.member_id, memberName: d.memberName||'患者', type:'睡眠日记',
      content: '提交了睡眠日记', time: d.diary_date ? String(d.diary_date).substring(0,10) : '', unread: true
    }))
    dbPool.query('SELECT mc.id, mc.member_id, mc.checkin_date, p.name as memberName FROM member_checkin mc LEFT JOIN patient p ON mc.member_id=p.id ORDER BY mc.create_time DESC LIMIT 10', (err2, checkins) => {
      if (!err2 && checkins.length > 0) checkins.forEach(c2 => msgs.push({
        id: 'checkin_'+c2.id, memberId: c2.member_id, memberName: c2.memberName||'患者', type:'打卡',
        content: c2.memberName + ' 完成了打卡', time: c2.checkin_date ? String(c2.checkin_date).substring(0,10) : '', unread: true
      }))
      if (msgs.length === 0) {
        dbPool.query('SELECT id, name FROM patient ORDER BY id LIMIT 5', (err3, patients) => {
          if (!err3 && patients.length > 0) {
            const samples = ['提交了今日睡眠日记','完成了睡眠质量打卡','预约了明日睡眠咨询','购买了睡眠改善方案']
            patients.forEach((p, i) => msgs.push({
              id: 'sample_'+p.id, memberId: p.id, memberName: p.name, type:'睡眠日记',
              content: p.name + ' ' + samples[i % samples.length],
              time: new Date(Date.now() - i*3600000).toISOString().replace('T', ' ').substring(0, 19),
              unread: true
            }))
          }
          res.json({ code: 200, data: msgs })
        })
      } else {
        res.json({ code: 200, data: msgs })
      }
    })
  })
})

// 睡眠模块 - 转发Java
app.get('/api/sleep/diary/:memberId', (req, res) => forwardToBackend(req, res, '/sleep/diary/'+req.params.memberId))
app.post('/api/sleep/diary', (req, res) => forwardToBackend(req, res, '/sleep/diary', 'POST', req.body))
app.get('/api/sleep/plan/:memberId', (req, res) => forwardToBackend(req, res, '/sleep/plan/'+req.params.memberId))
app.get('/api/sleep/plan/:memberId/latest', (req, res) => forwardToBackend(req, res, '/sleep/plan/'+req.params.memberId+'/latest'))
app.post('/api/sleep/plan', (req, res) => forwardToBackend(req, res, '/sleep/plan', 'POST', req.body))
app.get('/api/sleep/plan/items/:planId', (req, res) => forwardToBackend(req, res, '/sleep/plan/items/'+req.params.planId))
app.put('/api/sleep/plan/item/:id/complete', (req, res) => forwardToBackend(req, res, '/sleep/plan/item/'+req.params.id+'/complete', 'PUT', req.body))
app.get('/api/checkin/:memberId', (req, res) => forwardToBackend(req, res, '/checkin/'+req.params.memberId+'?startDate='+(req.query.startDate||'')+'&endDate='+(req.query.endDate||'')))
app.post('/api/checkin', (req, res) => forwardToBackend(req, res, '/checkin', 'POST', req.body))
app.get('/api/sleep/interview/:memberId/latest', (req, res) => forwardToBackend(req, res, '/sleep/interview/'+req.params.memberId+'/latest'))

// 量表评估 - 直连MySQL
app.get('/api/scale-items/templates', (req, res) => {
  dbPool.query('SELECT id, name, category, description, sub_scales, tags, status FROM scale_template WHERE del_flag=0 AND status=1 ORDER BY id', (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    rows.forEach(r => { if (r.sub_scales) r.sub_scales = safeParse(r.sub_scales) })
    res.json({ code: 200, data: rows })
  })
})

app.get('/api/scale-items/templates/:id', (req, res) => {
  const tid = req.params.id
  dbPool.query('SELECT * FROM scale_template WHERE id=? AND del_flag=0', [tid], (e, tmpl) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!tmpl.length) return res.json({ code: 404, message: '模板不存在' })
    const t = tmpl[0]
    if (t.sub_scales) t.sub_scales = safeParse(t.sub_scales)
    dbPool.query('SELECT id, template_id, question_no, question_text, question_type, options, required, dimension, reverse_score FROM scale_question WHERE template_id=? AND del_flag=0 ORDER BY question_no', [tid], (e2, questions) => {
      if (e2) return res.json({ code: 500, message: e2.message })
      questions.forEach(q => { if (q.options) q.options = safeParse(q.options) })
      t.questions = questions
      res.json({ code: 200, data: t })
    })
  })
})

app.get('/api/scale-items/questions/:templateId', (req, res) => {
  dbPool.query('SELECT id, template_id, question_no, question_text, question_type, options, required, dimension, reverse_score FROM scale_question WHERE template_id=? AND del_flag=0 ORDER BY question_no', [req.params.templateId], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    rows.forEach(r => { if (r.options) r.options = safeParse(r.options) })
    res.json({ code: 200, data: rows })
  })
})

app.post('/api/assessments', (req, res) => {
  const { member_id, template_id, member_name, template_name, answers_json, assessment_date, therapist, workshop } = req.body
  if (!member_id || !template_id) return res.json({ code: 400, message: '缺少必填字段' })
  let total_score = 0, risk_level = 'low'
  try {
    const answers = typeof answers_json === 'string' ? safeParse(answers_json) : (answers_json || {})
    Object.keys(answers).forEach(function(k) {
      const v = answers[k]
      if (typeof v === 'number') total_score += v
      else if (typeof v === 'object' && v && v.score) total_score += v.score
    })
    if (template_id == 1 && total_score > 10) risk_level = 'high'
    else if (template_id == 1 && total_score > 5) risk_level = 'medium'
    if (template_id == 2 && total_score > 15) risk_level = 'high'
    else if (template_id == 2 && total_score > 7) risk_level = 'medium'
    if (template_id == 3 && total_score > 10) risk_level = 'high'
    else if (template_id == 3 && total_score > 6) risk_level = 'medium'
  } catch(err) {}
  dbPool.query(
    'INSERT INTO assessment_record (member_id, member_name, template_id, template_name, answers_json, total_score, risk_level, assessment_date, therapist, workshop, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [member_id, member_name||'', template_id, template_name||'', answers_json||'{}', total_score, risk_level, assessment_date||new Date().toISOString().slice(0,10), therapist||'', workshop||'', 'completed'],
    (e, r) => {
      if (e) return res.json({ code: 500, message: e.message })
      res.json({ code: 200, data: { id: r.insertId, total_score, risk_level }, message: '评估提交成功' })
    }
  )
})

app.get('/api/assessments/members/:memberId', (req, res) => {
  dbPool.query('SELECT id, member_id, member_name, template_id, template_name, total_score, risk_level, assessment_date, therapist, create_time FROM assessment_record WHERE member_id=? AND del_flag=0 ORDER BY create_time DESC', [req.params.memberId], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: rows })
  })
})

app.get('/api/assessments/:id', (req, res) => {
  dbPool.query('SELECT * FROM assessment_record WHERE id=? AND del_flag=0', [req.params.id], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!rows.length) return res.json({ code: 404, message: '评估记录不存在' })
    const r = rows[0]
    if (r.answers_json) r.answers_json = safeParse(r.answers_json)
    if (r.scores_json) r.scores_json = safeParse(r.scores_json)
    res.json({ code: 200, data: r })
  })
})

// 方案模板 - 直连MySQL
app.get('/api/plan-templates', (req, res) => {
  dbPool.query('SELECT id, template_name, template_type, description, target_goal, duration_days, frequency_per_week, duration_per_session, intervention_json, suitable_conditions, price, status, sort_order FROM plan_template WHERE del_flag=0 AND status=1 ORDER BY sort_order', (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    rows.forEach(r => { if (r.intervention_json) r.intervention_json = safeParse(r.intervention_json) })
    res.json({ code: 200, data: rows })
  })
})

app.get('/api/plan-templates/:id', (req, res) => {
  dbPool.query('SELECT * FROM plan_template WHERE id=? AND del_flag=0', [req.params.id], (e, tmpl) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!tmpl.length) return res.json({ code: 404, message: '方案模板不存在' })
    const t = tmpl[0]
    if (t.intervention_json) t.intervention_json = safeParse(t.intervention_json)
    dbPool.query('SELECT id, template_id, day_num, item_type, item_name, description, target_time, duration_minutes, intervention_intensity, sort_order FROM plan_template_item WHERE template_id=? AND del_flag=0 ORDER BY day_num, sort_order', [req.params.id], (e2, items) => {
      if (e2) return res.json({ code: 500, message: e2.message })
      items.forEach(it => { if (it.equipment_config_json) it.equipment_config_json = safeParse(it.equipment_config_json) })
      t.items = items
      res.json({ code: 200, data: t })
    })
  })
})

app.get('/api/plans/members', (req, res) => {
  const keyword = req.query.keyword || ''
  if (!keyword) return res.json({ code: 200, data: [] })
  const isNumeric = /^\d+$/.test(keyword)
  let query, params
  if (isNumeric) {
    query = 'SELECT sp.id, sp.member_id, sp.therapist, sp.plan_name, sp.plan_type, sp.template_id, sp.duration_days, sp.goal, sp.status, sp.start_date, sp.end_date, sp.push_status, sp.create_time, p.name as member_name FROM sleep_plan sp LEFT JOIN patient p ON sp.member_id=p.id WHERE sp.member_id=? AND sp.del_flag=0 ORDER BY sp.create_time DESC'
    params = [keyword]
  } else {
    query = 'SELECT sp.id, sp.member_id, sp.therapist, sp.plan_name, sp.plan_type, sp.template_id, sp.duration_days, sp.goal, sp.status, sp.start_date, sp.end_date, sp.push_status, sp.create_time, p.name as member_name FROM sleep_plan sp LEFT JOIN patient p ON sp.member_id=p.id WHERE p.name LIKE ? AND sp.del_flag=0 ORDER BY sp.create_time DESC'
    params = [`%${keyword}%`]
  }
  dbPool.query(query, params, (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: rows })
  })
})

app.get('/api/plans/:id', (req, res) => {
  dbPool.query('SELECT * FROM sleep_plan WHERE id=? AND del_flag=0', [req.params.id], (e, plans) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!plans.length) return res.json({ code: 404, message: '方案不存在' })
    const p = plans[0]
    dbPool.query('SELECT id, plan_id, day_num, item_type, item_name, description, target_time, duration_minutes, completed, completed_time, notes FROM sleep_plan_item WHERE plan_id=? AND del_flag=0 ORDER BY day_num', [req.params.id], (e2, items) => {
      if (e2) return res.json({ code: 500, message: e2.message })
      p.items = items
      res.json({ code: 200, data: p })
    })
  })
})

app.patch('/api/plans/:id', (req, res) => {
  const fields = [], vals = []
  const { status, therapist, goal, plan_goal, auto_execute, execution_mode } = req.body
  if (status !== undefined) { fields.push('status=?'); vals.push(status) }
  if (therapist !== undefined) { fields.push('therapist=?'); vals.push(therapist) }
  if (goal !== undefined) { fields.push('goal=?'); vals.push(goal) }
  if (plan_goal !== undefined) { fields.push('plan_goal=?'); vals.push(plan_goal) }
  if (auto_execute !== undefined) { fields.push('auto_execute=?'); vals.push(auto_execute) }
  if (execution_mode !== undefined) { fields.push('execution_mode=?'); vals.push(execution_mode) }
  if (!fields.length) return res.json({ code: 400, message: '没有要更新的字段' })
  vals.push(req.params.id)
  dbPool.query('UPDATE sleep_plan SET ' + fields.join(',') + ' WHERE id=?', vals, (e) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, message: '方案更新成功' })
  })
})

app.post('/api/plans', (req, res) => {
  const { member_id, template_id, therapist, workshop, member_name } = req.body
  if (!member_id || !template_id) return res.json({ code: 400, message: '缺少必填字段' })
  dbPool.query('SELECT * FROM plan_template WHERE id=? AND del_flag=0', [template_id], (e, tmpl) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!tmpl.length) return res.json({ code: 404, message: '方案模板不存在' })
    const t = tmpl[0]
    const startDate = new Date().toISOString().slice(0, 10)
    const endDate = new Date(Date.now() + t.duration_days * 86400000).toISOString().slice(0, 10)
    dbPool.query(
      'INSERT INTO sleep_plan (member_id, therapist, plan_name, plan_type, template_id, duration_days, goal, plan_goal, status, start_date, end_date, workshop_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
      [member_id, therapist||'', t.template_name, t.template_type, template_id, t.duration_days, t.target_goal, t.target_goal, startDate, endDate, workshop||''],
      (e2, result) => {
        if (e2) return res.json({ code: 500, message: e2.message })
        const planId = result.insertId
        dbPool.query('SELECT * FROM plan_template_item WHERE template_id=? AND del_flag=0 ORDER BY day_num, sort_order', [template_id], (e3, items) => {
          if (e3 || !items.length) return res.json({ code: 200, data: { id: planId }, message: '方案创建成功' })
          const inserts = items.map(it => [planId, it.day_num, it.item_type, it.item_name, it.description||'', it.target_time, it.duration_minutes, 0, therapist||''])
          const placeholders = inserts.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')
          const values = inserts.flat()
          dbPool.query('INSERT INTO sleep_plan_item (plan_id, day_num, item_type, item_name, description, target_time, duration_minutes, completed, create_by) VALUES ' + placeholders, values, (e4) => {
            res.json({ code: 200, data: { id: planId }, message: '方案创建成功' })
          })
        })
      }
    )
  })
})

// 执行记录
app.post('/api/executions', (req, res) => {
  const { plan_id, plan_item_id, member_id, execution_date, scheduled_time, execution_type, status, operator, notes } = req.body
  if (!plan_id || !member_id || !execution_date) return res.json({ code: 400, message: '缺少必填字段' })
  dbPool.query(
    'INSERT INTO plan_execution (plan_id, plan_item_id, member_id, execution_date, scheduled_time, execution_type, status, operator, notes) VALUES (?,?,?,?,?,?,?,?,?)',
    [plan_id, plan_item_id||null, member_id, execution_date, scheduled_time||null, execution_type||'manual', status||'completed', operator||'', notes||''],
    (e, r) => {
      if (e) return res.json({ code: 500, message: e.message })
      if (plan_item_id) dbPool.query('UPDATE sleep_plan_item SET completed=1, completed_time=NOW() WHERE id=?', [plan_item_id], ()=>{})
      res.json({ code: 200, data: { id: r.insertId }, message: '执行记录成功' })
    }
  )
})

app.get('/api/executions/plan/:planId', (req, res) => {
  dbPool.query('SELECT * FROM plan_execution WHERE plan_id=? AND del_flag=0 ORDER BY execution_date DESC, start_time DESC', [req.params.planId], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    rows.forEach(r => { if (r.result_data_json) r.result_data_json = safeParse(r.result_data_json) })
    res.json({ code: 200, data: rows })
  })
})

app.patch('/api/executions/:id', (req, res) => {
  const { status, start_time, end_time, result_data_json, notes } = req.body
  const fields = [], vals = []
  if (status !== undefined) { fields.push('status=?'); vals.push(status) }
  if (start_time !== undefined) { fields.push('start_time=?'); vals.push(start_time) }
  if (end_time !== undefined) { fields.push('end_time=?'); vals.push(end_time) }
  if (result_data_json !== undefined) { fields.push('result_data_json=?'); vals.push(typeof result_data_json === 'string' ? result_data_json : JSON.stringify(result_data_json)) }
  if (notes !== undefined) { fields.push('notes=?'); vals.push(notes) }
  if (!fields.length) return res.json({ code: 400, message: '没有要更新的字段' })
  vals.push(req.params.id)
  dbPool.query('UPDATE plan_execution SET ' + fields.join(',') + ' WHERE id=?', vals, (e) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, message: '更新成功' })
  })
})

// 设备 - 直连MySQL
app.get('/api/equipment/devices', (req, res) => {
  dbPool.query('SELECT id, device_no, device_name, device_type, vendor, protocol_type, status, member_id, last_heartbeat_time FROM device_registry ORDER BY id DESC', (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: rows })
  })
})

app.post('/api/equipment/commands', (req, res) => {
  const { device_id, device_no, command_type, params_json, related_plan_id, related_member_id } = req.body
  if (!device_id || !command_type) return res.json({ code: 400, message: '缺少必填字段' })
  dbPool.query(
    'INSERT INTO equipment_command (device_id, device_no, command_type, params_json, related_plan_id, related_member_id, status) VALUES (?,?,?,?,?,?,?)',
    [device_id, device_no||'', command_type, params_json||'{}', related_plan_id||null, related_member_id||null, 'pending'],
    (e, r) => {
      if (e) return res.json({ code: 500, message: e.message })
      const cmdId = r.insertId
      setTimeout(() => { dbPool.query('UPDATE equipment_command SET status=?, sent_time=NOW(), completed_time=NOW() WHERE id=?', ['success', cmdId], ()=>{}) }, 500)
      res.json({ code: 200, data: { id: cmdId, status: 'pending' }, message: '指令已发送' })
    }
  )
})

app.get('/api/equipment/commands/:id', (req, res) => {
  dbPool.query('SELECT * FROM equipment_command WHERE id=?', [req.params.id], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!rows.length) return res.json({ code: 404, message: '指令不存在' })
    const r = rows[0]
    if (r.params_json) r.params_json = safeParse(r.params_json)
    if (r.response_json) try { r.response_json = safeParse(r.response_json) } catch(e) {}
    res.json({ code: 200, data: r })
  })
})

// 报告 - 直连MySQL
app.get('/api/reports/members', (req, res) => {
  const keyword = req.query.keyword || ''
  if (!keyword) return res.json({ code: 200, data: [] })
  const isNumeric = /^\d+$/.test(keyword)
  let query, params
  if (isNumeric) {
    query = 'SELECT id, member_id, member_name, report_type, plan_id, report_period_start, report_period_end, report_date, improvement_score, compliance_rate, therapist, create_time FROM treatment_report WHERE member_id=? AND del_flag=0 ORDER BY create_time DESC'
    params = [keyword]
  } else {
    query = 'SELECT id, member_id, member_name, report_type, plan_id, report_period_start, report_period_end, report_date, improvement_score, compliance_rate, therapist, create_time FROM treatment_report WHERE member_name LIKE ? AND del_flag=0 ORDER BY create_time DESC'
    params = [`%${keyword}%`]
  }
  dbPool.query(query, params, (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: rows })
  })
})

app.post('/api/reports/generate', (req, res) => {
  const { member_id, member_name, report_type, plan_id, report_period_start, report_period_end, therapist } = req.body
  if (!member_id || !report_type) return res.json({ code: 400, message: '缺少必填字段' })
  const reportDate = new Date().toISOString().slice(0, 10)
  dbPool.query('SELECT assessment_date, total_score, risk_level, template_name FROM assessment_record WHERE member_id=? AND del_flag=0 ORDER BY assessment_date DESC LIMIT 10', [member_id], (e, assessments) => {
    dbPool.query('SELECT COUNT(*) as total, SUM(CASE WHEN status=? THEN 1 ELSE 0 END) as completed FROM plan_execution WHERE member_id=? AND del_flag=0 AND execution_date BETWEEN ? AND ?', ['completed', member_id, report_period_start||'2000-01-01', report_period_end||reportDate], (e2, execStats) => {
      const total = (execStats[0] && execStats[0].total) || 0
      const completed = (execStats[0] && execStats[0].completed) || 0
      const complianceRate = total > 0 ? Math.round(completed / total * 100) : 0
      const lastScore = (assessments[0] && assessments[0].total_score) || 0
      const improvementScore = assessments.length >= 2 ? Math.max(0, 100 - lastScore * 2) : 75
      dbPool.query(
        'INSERT INTO treatment_report (member_id, member_name, report_type, plan_id, report_period_start, report_period_end, report_date, assessment_summary_json, execution_summary_json, improvement_score, compliance_rate, therapist, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [member_id, member_name||'', report_type, plan_id||null, report_period_start||null, report_period_end||null, reportDate, JSON.stringify(assessments.slice(0,5)), JSON.stringify({total, completed, complianceRate}), improvementScore, complianceRate, therapist||'', 'generated'],
        (e3, r) => {
          if (e3) return res.json({ code: 500, message: e3.message })
          res.json({ code: 200, data: { id: r.insertId, improvement_score: improvementScore, compliance_rate: complianceRate }, message: '报告生成成功' })
        }
      )
    })
  })
})

app.get('/api/reports/:id', (req, res) => {
  dbPool.query('SELECT * FROM treatment_report WHERE id=? AND del_flag=0', [req.params.id], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    if (!rows.length) return res.json({ code: 404, message: '报告不存在' })
    const r = rows[0]
    if (r.assessment_summary_json) r.assessment_summary_json = safeParse(r.assessment_summary_json)
    if (r.execution_summary_json) r.execution_summary_json = safeParse(r.execution_summary_json)
    if (r.equipment_summary_json) r.equipment_summary_json = safeParse(r.equipment_summary_json)
    if (r.sleep_summary_json) r.sleep_summary_json = safeParse(r.sleep_summary_json)
    res.json({ code: 200, data: r })
  })
})

// 工作室管理 - 直连MySQL
app.get('/api/studios', (req, res) => {
  dbPool.query('SELECT id, name, address, contact, phone, hours, remark, status, create_time FROM studio WHERE status=1 ORDER BY id', (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: rows })
  })
})

app.post('/api/studios', (req, res) => {
  const { name, address, contact, phone, hours, remark } = req.body
  if (!name) return res.json({ code: 400, message: '工作室名称不能为空' })
  dbPool.query('INSERT INTO studio (name, address, contact, phone, hours, remark) VALUES (?, ?, ?, ?, ?, ?)',
    [name, address || '', contact || '', phone || '', hours || '', remark || ''], (e, result) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: { id: result.insertId, name, address, contact, phone, hours, remark } })
  })
})

app.put('/api/studios/:id', (req, res) => {
  const { name, address, contact, phone, hours, remark } = req.body
  if (!name) return res.json({ code: 400, message: '工作室名称不能为空' })
  dbPool.query('UPDATE studio SET name=?, address=?, contact=?, phone=?, hours=?, remark=? WHERE id=?',
    [name, address || '', contact || '', phone || '', hours || '', remark || '', req.params.id], (e) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, message: '更新成功' })
  })
})

app.delete('/api/studios/:id', (req, res) => {
  dbPool.query('UPDATE studio SET status=0 WHERE id=?', [req.params.id], (e) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, message: '删除成功' })
  })
})

// 睡眠师管理 - 直连MySQL
app.get('/api/therapists', (req, res) => {
  dbPool.query(`SELECT t.id, t.name, t.employee_no, t.title, t.education, t.specialty, t.hire_date,
    t.phone, t.studio_id, t.status, t.create_time,
    s.name as studio_name FROM therapist t LEFT JOIN studio s ON t.studio_id=s.id WHERE t.status=1 ORDER BY t.id`,
    (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    const ids = rows.map(r => r.id)
    if (ids.length === 0) return res.json({ code: 200, data: rows.map(r => ({ ...r, patient_count: 0, plan_count: 0, execution_count: 0 })) })
    const placeholders = ids.map(() => '?').join(',')
    dbPool.query(`SELECT therapist_id, COUNT(DISTINCT member_id) as cnt FROM sleep_plan WHERE therapist_id IN (${placeholders}) GROUP BY therapist_id`, ids, (e2, planStats) => {
      const planMap = {}
      if (planStats) planStats.forEach(p => { planMap[p.therapist_id] = p.cnt })
      dbPool.query(`SELECT therapist_id, COUNT(*) as cnt FROM sleep_plan_item WHERE completed=1 AND therapist_id IN (${placeholders}) GROUP BY therapist_id`, ids, (e3, execStats) => {
        const execMap = {}
        if (execStats) execStats.forEach(ex => { execMap[ex.therapist_id] = ex.cnt })
        const result = rows.map(r => ({
          ...r,
          patient_count: planMap[r.id] || 0,
          plan_count: planMap[r.id] || 0,
          execution_count: execMap[r.id] || 0
        }))
        res.json({ code: 200, data: result })
      })
    })
  })
})

app.post('/api/therapists', (req, res) => {
  const { name, employee_no, title, education, specialty, hire_date, phone, studio_id } = req.body
  if (!name) return res.json({ code: 400, message: '姓名不能为空' })
  dbPool.query('INSERT INTO therapist (name, employee_no, title, education, specialty, hire_date, phone, studio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, employee_no || '', title || '', education || '', specialty || '', hire_date || null, phone || '', studio_id || null], (e, result) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: { id: result.insertId, name, employee_no, title, education, specialty, hire_date, phone, studio_id } })
  })
})

app.put('/api/therapists/:id', (req, res) => {
  const { name, employee_no, title, education, specialty, hire_date, phone, studio_id } = req.body
  if (!name) return res.json({ code: 400, message: '姓名不能为空' })
  dbPool.query('UPDATE therapist SET name=?, employee_no=?, title=?, education=?, specialty=?, hire_date=?, phone=?, studio_id=? WHERE id=?',
    [name, employee_no || '', title || '', education || '', specialty || '', hire_date || null, phone || '', studio_id || null, req.params.id], (e) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, message: '更新成功' })
  })
})

app.delete('/api/therapists/:id', (req, res) => {
  dbPool.query('UPDATE therapist SET status=0 WHERE id=?', [req.params.id], (e) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, message: '删除成功' })
  })
})

// ========== 小程序 API (/gm/*) ==========

// 微信登录
app.post('/gm/wx/login-by-wechat', (req, res) => {
  const { code } = req.body
  if (!code) return res.json({ code: 400, message: '缺少code参数' })
  dbPool.query('SELECT * FROM patient WHERE openid=? LIMIT 1', [code], (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    let member, memberId, nickname
    if (rows.length > 0) {
      member = rows[0]
      memberId = member.id
      nickname = member.name
    } else {
      nickname = '新用户' + Date.now()
    }
    // 使用JWT存储memberId
    const token = jwt.sign({ memberId, openId: code }, JWT_SECRET, { expiresIn: '30d' })
    if (!member) {
      dbPool.query('INSERT INTO patient (name, openid, create_time) VALUES (?, ?, NOW())', [nickname, code], (e2, result) => {
        if (e2) return res.json({ code: 500, message: e2.message })
        memberId = result.insertId
        const finalToken = jwt.sign({ memberId, openId: code }, JWT_SECRET, { expiresIn: '30d' })
        res.json({ code: 200, data: { token: finalToken, memberInfo: { id: memberId, nickname } } })
      })
    } else {
      res.json({ code: 200, data: { token, memberInfo: { id: memberId, nickname, phone: member.phone } } })
    }
  })
})

// 获取会员信息
app.get('/gm/members/me', (req, res) => {
  const auth = req.headers.authorization || ''
  if (!auth) return res.json(wxErr('请先登录', 401))
  const token = auth.replace('Bearer ', '')
  let payload = null
  try { payload = verifyToken(token) } catch(e) {}
  if (!payload) { try { payload = jwt.decode(token) } catch(e2) {} }
  if (!payload || !payload.openId) {
    return res.json(wxJson({ nickname: '管理员', avatar: '/assets/images/default-avatar.png', levelName: '普通会员', points: 0 }))
  }
  const openId = payload.openId
  const phone = openId.startsWith('phone_') ? openId.slice(6) : null
  if (phone) {
    dbPool.query('SELECT * FROM member_profile WHERE phone=? AND del_flag=0', [phone], (e, rows) => {
      if (e) return res.json(wxErr(e.message, 500))
      if (rows && rows[0]) {
        const m = rows[0]
        return res.json(wxJson({ id: m.id, nickname: m.nickname||'用户', avatar: m.avatar_url||'/assets/images/default-avatar.png', phone: m.phone||'', gender: m.sex===1?'男':m.sex===0?'女':'未知', levelName: '普通会员', points: 0 }))
      }
      res.json(wxJson({ nickname: '用户'+phone.slice(-4), avatar: '/assets/images/default-avatar.png', phone, levelName: '普通会员', points: 0 }))
    })
  } else {
    res.json(wxJson({ nickname: '微信用户', avatar: '/assets/images/default-avatar.png', levelName: '普通会员', points: 0 }))
  }
})

// 获取当前方案
app.get('/gm/plan/current', (req, res) => {
  dbPool.query('SELECT id, plan_name as planName, plan_type as planType, status, start_date as startDate, end_date as endDate FROM sleep_plan WHERE member_id=1 AND del_flag=0 ORDER BY create_time DESC LIMIT 1', (e, rows) => {
    if (e) return res.json({ code: 500, message: e.message })
    res.json({ code: 200, data: rows[0] || null })
  })
})

// 今日睡眠数据
app.get('/gm/sleep/today', (req, res) => {
  res.json({ code: 200, data: { sleepTime: '22:30', wakeTime: '06:30', duration: 8, score: 85 } })
})

// 今日任务
app.get('/gm/sleep/tasks/today', (req, res) => {
  res.json({ code: 200, data: [
    { id: 1, time: '07:30', title: '起床', done: false },
    { id: 2, time: '', title: '午休控制在20分钟，醒后如果仍困倦可以冥想20分钟', done: false },
    { id: 3, time: '', title: '睡前放松训练', done: false },
    { id: 4, time: '', title: '不要在床上做与睡眠无关的事情', done: false },
    { id: 5, time: '', title: '一周七天固定时间上下床', done: false },
    { id: 6, time: '00:00', title: '上床', done: true }
  ] })
})

// 放松训练音频列表
app.get('/gm/sleep/relax-audios', (req, res) => {
  res.json({ code: 200, data: [
    { id: 1, title: '呼吸训练' },
    { id: 2, title: '肌肉放松' },
    { id: 3, title: '冥想引导' },
    { id: 4, title: '入睡困难时做的呼吸训练' },
    { id: 5, title: '渐进式肌肉方式音频' },
    { id: 6, title: '午休疲乏时做的冥想音频' }
  ] })
})

// 未读消息数
app.get('/gm/messages/unread-count', (req, res) => {
  res.json({ code: 200, data: { count: 3 } })
})

// 睡眠师消息列表
app.get('/gm/messages/coach', (req, res) => {
  res.json({ code: 200, data: [
    { id: 1, coachName: '李医生 · 睡眠管理师', coachAvatar: '/assets/images/default-avatar.png', lastMessage: '您的睡眠质量有所提升，深睡比例达到28%，比上周增加了5%，继续保持哦！', time: '今天 09:30', unread: 1 },
    { id: 2, coachName: '李医生 · 睡眠管理师', coachAvatar: '/assets/images/default-avatar.png', lastMessage: '已为您生成新的定制睡眠计划，今晚可以尝试新的睡前冥想音频。', time: '昨天 16:45', unread: 1 },
    { id: 3, coachName: '李医生 · 睡眠管理师', coachAvatar: '/assets/images/default-avatar.png', lastMessage: '根据本周的睡眠数据，建议调整晚餐时间，避免在睡前3小时内进食。', time: '前天 14:20', unread: 0 }
  ] })
})

// 统计数据
app.get('/gm/stats', (req, res) => {
  res.json({ code: 200, data: { users: 2000, improvement: 90 } })
})

// 待处理活动数
app.get('/gm/activities/pending-count', (req, res) => {
  res.json({ code: 200, data: { count: 1 } })
})

// 活动横幅
app.get('/gm/activities/banners', (req, res) => {
  res.json({ code: 200, data: [
    { id: 1, title: '世界睡眠日义诊', image: '/assets/images/banner-1.png', url: '/pages/activities/detail?id=1' },
    { id: 2, title: '新品体验招募', image: '/assets/images/banner-2.png', url: '/pages/activities/detail?id=2' }
  ] })
})

// 热门话题
app.get('/gm/hot-topics', (req, res) => {
  res.json({ code: 200, data: [
    { id: 1, title: '9张新年幸运签，把好运分享给大家', heat: 1000 },
    { id: 2, title: '连续3天都没有睡着了？', heat: 800 },
    { id: 3, title: '有什么开心的事情分享吗？', heat: 600 },
    { id: 4, title: '互动 | 2026，你最想完成的目标是____？', heat: 400 }
  ] })
})

// 内容分类
app.get('/gm/feed/categories', (req, res) => {
  res.json({ code: 200, data: [
    { id: 'recommend', name: '推荐' },
    { id: 'knowledge', name: '睡眠知识' },
    { id: 'expert', name: '专家解读' }
  ] })
})

app.get('/gm/feed/categories/expert', (req, res) => {
  res.json({ code: 200, data: { id: 'expert', name: '专家解读' } })
})


// 内容列表
app.get('/gm/feed/list', (req, res) => {
  const { category = 'recommend', page = 1, size = 10 } = req.query

  const knowledge = [
    { id: 101, title: '深度睡眠有多重要？每晚需要多少分钟？', summary: '深度睡眠是睡眠周期中最重要的阶段，成年人每晚需要1-2小时深度睡眠才能让身体充分恢复。', cover: '/assets/images/cover-1.png', tag: '睡眠知识', author: '李明医生', views: 2341, tagHot: true },
    { id: 102, title: '睡前1小时做到这5点，第二天精神百倍', summary: '睡前避免蓝光、喝温牛奶、泡脚、冥想、关灯——这5个习惯坚持一周，入睡时间从1小时缩短到15分钟。', cover: '/assets/images/cover-2.png', tag: '睡眠知识', author: '王健康', views: 1892 },
    { id: 103, title: '总是凌晨3点醒来？可能是这几个原因', summary: '凌晨3点是肝脏排毒时间，此时醒来往往与情绪压力或饮食有关，本文教你如何改善。', cover: '/assets/images/cover-3.png', tag: '睡眠知识', author: '张怡医生', views: 3210, tagHot: true },
    { id: 104, title: '午睡超过30分钟会越睡越困？', summary: '午睡时间过长会导致睡眠惰性，建议控制在20-30分钟，既能恢复精力又不影响晚间睡眠。', cover: '/assets/images/cover-4.png', tag: '睡眠知识', author: '刘专家', views: 956 },
    { id: 105, title: '床垫怎么选？睡了10年才知道的真相', summary: '软床垫和硬床垫各有适用人群，选错床垫可能导致腰酸背痛，影响睡眠质量。', cover: '/assets/images/cover-5.png', tag: '睡眠知识', author: '陈体验师', views: 1580 },
    { id: 106, title: '打鼾是病吗？出现这种情况一定要重视', summary: '偶尔打鼾是正常的，但睡眠呼吸暂停综合征会引发高血压、心脏病，需尽早就医。', cover: '/assets/images/cover-6.png', tag: '睡眠知识', author: '李明医生', views: 2780 },
  ]

  const expert = [
    { id: 201, title: '【专家直播】如何科学调整生物钟？', summary: '生物钟紊乱是现代人失眠的根本原因，本期直播将手把手教你制定个性化作息方案。', cover: '/assets/images/cover-7.png', tag: '专家解读', author: '周教授', views: 4521, tagHot: true },
    { id: 202, title: '焦虑性失眠的认知行为疗法（CBT-I）详解', summary: 'CBT-I是国际公认治疗失眠的一线方法，无需药物，通过改变对睡眠的错误认知和行为来改善睡眠。', cover: '/assets/images/cover-8.png', tag: '专家解读', author: '陈心理师', views: 3890, tagHot: true },
    { id: 203, title: '褪黑素能长期吃吗？睡眠科医生这样说', summary: '褪黑素是辅助睡眠的有效手段，但并非所有人都适合，长期服用需在医生指导下进行。', cover: '/assets/images/cover-9.png', tag: '专家解读', author: '李明医生', views: 5620 },
    { id: 204, title: '睡眠呼吸暂停综合征的居家监测方法', summary: '打鼾不等于睡得香，睡眠呼吸暂停可能危及生命，教你如何在家初步判断。', cover: '/assets/images/cover-10.png', tag: '专家解读', author: '王呼吸科', views: 2103 },
    { id: 205, title: '为什么女性在更年期更容易失眠？', summary: '雌激素水平变化直接影响睡眠结构，围绝经期女性需要特殊的睡眠管理策略。', cover: '/assets/images/cover-1.png', tag: '专家解读', author: '张怡医生', views: 1780 },
    { id: 206, title: '儿童青少年睡眠：错过生长激素分泌高峰会影响长高', summary: '孩子的睡眠质量直接影响身高和学业表现，家长一定要重视这两个睡眠时段。', cover: '/assets/images/cover-2.png', tag: '专家解读', author: '周教授', views: 3340 },
  ]

  const recommend = [
    { id: 1, title: '坚持早睡30天，我的黑眼圈真的消失了！', summary: '之前总是凌晨2点才睡，皮肤状态很差，按APP睡眠计划调整后11点准时睡觉，黑眼圈淡了许多。', cover: '/assets/images/cover-3.png', tag: '健康生活', author: '小睡眠', views: 8900, tagHot: true },
    { id: 2, title: '薰衣草精油+白噪音+热牛奶，亲测入睡只要15分钟', summary: '分享我的助眠三件套：薰衣草精油、香薰机白噪音和热牛奶，配合呼吸法效果翻倍。', cover: '/assets/images/cover-4.png', tag: '好物分享', author: '生活家', views: 5600, tagHot: true },
    { id: 3, title: '上班族如何利用碎片时间快速恢复精力？', summary: '工作间隙的5分钟冥想，比喝咖啡更能恢复精力，还不会有依赖性。', cover: '/assets/images/cover-5.png', tag: '专家解读', author: '王健康', views: 3200 },
    { id: 4, title: '我为什么放弃了吃了3年的安眠药？', summary: '长期服用安眠药后，我的睡眠质量反而越来越差，改用CBT-I后终于睡上了踏实觉。', cover: '/assets/images/cover-6.png', tag: '健康生活', author: '小明', views: 12000, tagHot: true },
    { id: 5, title: '每天睡够8小时，为什么还是觉得很累？', summary: '睡眠时长不是唯一标准，睡眠效率和质量同样重要，教你看懂睡眠报告里的关键指标。', cover: '/assets/images/cover-7.png', tag: '睡眠知识', author: '李明医生', views: 7800 },
    { id: 6, title: '睡前1小时戒掉手机，我重获了婴儿般的睡眠', summary: '手机蓝光会抑制褪黑素分泌，戒掉睡前刷手机30天后，入睡时间从45分钟缩短到10分钟。', cover: '/assets/images/cover-8.png', tag: '健康生活', author: '自律达人', views: 9500 },
  ]

  let data = knowledge
  if (category === 'knowledge') data = knowledge
  else if (category === 'expert') data = expert
  else data = recommend

  res.json({ code: 200, data })
})

// 文章详情
app.get('/gm/articles/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const db = {
    101: { id: 101, title: '深度睡眠有多重要？每晚需要多少分钟？', author: '李明医生', publishTime: '2026-04-20', views: 2341, cover: '/assets/images/cover-1.png', tag: '睡眠知识', content: '深度睡眠是睡眠周期中最重要的阶段，也称为"慢波睡眠"。\n\n在深度睡眠期间，身体会分泌生长激素，进行组织修复和免疫调节。成年人每晚需要约1-2小时的深度睡眠才能让身体得到充分恢复。\n\n\u2705 如何提升深度睡眠质量？\n\n1. 保持规律作息——每天在同一时间入睡和起床\n2. 睡前避免使用电子设备——蓝光抑制褪黑素分泌\n3. 室温保持在18-22度——过热或过冷都会影响睡眠\n4. 避免睡前摄入咖啡因和酒精\n5. 白天适当运动，但避免临睡前剧烈运动\n\n坚持这些习惯，你的深度睡眠时间会逐步提升。' },
    102: { id: 102, title: '睡前1小时做到这5点，第二天精神百倍', author: '王健康', publishTime: '2026-04-18', views: 1892, cover: '/assets/images/cover-2.png', tag: '睡眠知识', content: '睡前1小时是睡眠的"黄金准备期"，做好这5件事，第二天的精力状态会完全不同：\n\n1. 关闭手机或开启护眼模式\n手机屏幕发出的蓝光会抑制褪黑素分泌，让入睡变得更困难。\n\n2. 喝一杯温牛奶\n温热的牛奶含有色氨酸，可以促进睡眠因子的生成。\n\n3. 泡脚15分钟\n促进脚部血液循环，让身体提前进入放松状态。\n\n4. 5分钟冥想\n清除杂念，让大脑从"工作模式"切换到"休息模式"。\n\n5. 关灯或调暗灯光\n黑暗环境促进褪黑素自然分泌。' },
    103: { id: 103, title: '总是凌晨3点醒来？可能是这几个原因', author: '张怡医生', publishTime: '2026-04-15', views: 3210, cover: '/assets/images/cover-3.png', tag: '睡眠知识', content: '凌晨3点醒来难以再入睡，是很多人共同的困扰。这个时间点是肝脏排毒的时段，与多种因素有关：\n\n1. 压力和焦虑\n焦虑情绪会激活交感神经，让你在本应进入深睡眠时醒来。\n\n2. 晚餐过晚或过饱\n肠胃消化负担重，身体无法完全放松。\n\n3. 卧室温度过高\n室温超过24度会让人频繁醒来。\n\n4. 饮酒影响\n酒精看似帮助入睡，实则干扰后半夜的睡眠结构。\n\n\u2705 改善建议：\n晚餐在睡前3小时完成，睡前2小时避免大量饮水，室温控制在20度左右。' },
    201: { id: 201, title: '【专家直播】如何科学调整生物钟？', author: '周教授', publishTime: '2026-04-10', views: 4521, cover: '/assets/images/cover-7.png', tag: '专家解读', content: '生物钟紊乱是现代人失眠的根本原因。我们的生物钟受光照调控，但现代生活打破了这一自然规律。\n\n\u2705 科学调整生物钟的方法：\n\n1. 光照疗法\n起床后立即接触明亮光线（阳光最佳），帮助重置生物钟。\n\n2. 固定睡眠窗口\n选定一个6-7小时的睡眠时间，每天严格执行，即使是周末也不例外。\n\n3. 渐进式调整\n如果需要大幅调整作息（如从凌晨2点睡调整到11点睡），每天提前或推迟15-30分钟，两周内完成过渡。\n\n4. 避免白天小睡超过30分钟\n白天小睡会削弱夜间睡眠动力。' },
    202: { id: 202, title: '焦虑性失眠的认知行为疗法（CBT-I）详解', author: '陈心理师', publishTime: '2026-04-08', views: 3890, cover: '/assets/images/cover-8.png', tag: '专家解读', content: 'CBT-I（Cognitive Behavioral Therapy for Insomnia）是国际公认的治疗失眠的一线方法，无需药物。\n\n\u2705 CBT-I核心组件：\n\n1. 睡眠限制\n通过限制躺在床上的时间，提升睡眠效率，让"困意"重新积累。\n\n2. 刺激控制\n只在有困意时上床，不在床上刷手机，建立"床=睡眠"的条件反射。\n\n3. 认知重构\n识别对睡眠的灾难化思维（如"睡不着明天就完了"），用更理性的想法替代。\n\n4. 放松训练\n渐进式肌肉放松、呼吸练习等帮助身体进入休息状态。\n\n一般4-8周可看到明显效果，建议在专业睡眠医生指导下进行。' },
    203: { id: 203, title: '褪黑素能长期吃吗？睡眠科医生这样说', author: '李明医生', publishTime: '2026-04-05', views: 5620, cover: '/assets/images/cover-9.png', tag: '专家解读', content: '褪黑素是改善睡眠的有效辅助手段，但并非所有人都适合长期服用。\n\n\u2705 褪黑素适合人群：\n- 倒时差人群\n- 生物钟紊乱者（如轮班工作者）\n- 老年人（褪黑素分泌自然减少）\n\n\u2705 需要谨慎的人群：\n- 备孕/孕妇\n- 自身免疫性疾病患者\n- 正在服用抗凝药物者\n\n\u2705 服用建议：\n- 起始剂量0.5mg，不要超过3mg\n- 睡前30分钟服用\n- 连续服用不超过3个月\n- 首选舌下含服剂型，吸收更好' },
  }

  const article = db[id]
  if (article) {
    res.json({ code: 200, data: article })
  } else {
    res.json({ code: 200, data: { id, title: '文章加载中...', author: '智眠星', publishTime: '2026-04-01', views: 100, cover: '/assets/images/cover-1.png', tag: '睡眠知识', content: '正在加载文章内容，请稍候...' } })
  }
})

// 快捷入口徽章
app.get('/gm/quick-entry/badge', (req, res) => {
  res.json({ code: 200, data: { checkin: true, message: 3, activity: 1 } })
})

// 启动页图片
app.get('/gm/splash/images', (req, res) => {
  res.json({ code: 200, data: [
    { id: 1, url: '/assets/images/splash-1.png' },
    { id: 2, url: '/assets/images/splash-bg.png' }
  ] })
})



// ========== 小程序登录/会员接口 ==========
// 注意：/gm/wx/login-by-wechat 在上方已定义（查询patient表）
app.post('/gm/wx/send-code', (req, res) => {
  const { phone } = req.body || {}
  if (!phone || phone.length !== 11) return res.json(wxErr('手机号格式错误'))
  const code = '123456'
  codeStore[phone] = { code, expire: Date.now() + 60000 }
  console.log('[SMS] 向 ' + phone + ' 发送验证码: ' + code)
  res.json({ code: 200, msg: '发送成功' })
})

app.post('/gm/wx/login', (req, res) => {
  const { phone, code } = req.body || {}
  if (!phone || phone.length !== 11) return res.json(wxErr('手机号格式错误'))
  if (!code || code.length !== 6) return res.json(wxErr('验证码格式错误'))
  const stored = codeStore[phone]
  if (!stored || stored.code !== code) return res.json(wxErr('验证码错误或已过期'))
  delete codeStore[phone]
  const token = genToken('phone_' + phone)
  dbPool.query('SELECT * FROM member_profile WHERE phone=? AND del_flag=0', [phone], (e, rows) => {
    if (e) return res.json(wxErr(e.message, 500))
    if (rows && rows[0]) {
      const m = rows[0]
      return res.json(wxJson({ token, memberInfo: { id: m.id, nickname: m.nickname||'用户', avatar: m.avatar_url||'/assets/images/default-avatar.png', phone: m.phone||'' } }))
    }
    dbPool.query('INSERT INTO member_profile (nickname,phone,invite_code,status,member_no,create_time) VALUES (?,?,?,1,?,NOW())',
      ['用户'+phone.slice(-4), phone, 'P'+phone, 'P'+phone], (e2, r) => {
        if (e2) return res.json(wxErr(e2.message, 500))
        dbPool.query('SELECT * FROM member_profile WHERE id=?', [r.insertId], (e3, rows3) => {
          if (e3) return res.json(wxErr(e3.message, 500))
          const m = rows3[0]
          res.json(wxJson({ token, memberInfo: { id: m.id, nickname: m.nickname||'用户', avatar: m.avatar_url||'/assets/images/default-avatar.png', phone: m.phone } }))
        })
      })
  })
})

app.get('/gm/points/records', (req, res) => { res.json(wxJson({ list: [], total: 0 })) })
app.get('/gm/members/level', (req, res) => { res.json(wxJson({ levelName: '普通会员', growthValue: 0, discount: 1.0 })) })
app.get('/gm/checkin/info', (req, res) => { res.json(wxJson({ checkinDays: 0, totalDays: 7, streak: 0 })) })
app.post('/gm/checkin/sign', (req, res) => { res.json(wxJson({ checkinDays: 1, points: 5 })) })
app.get('/gm/checkin/tasks', (req, res) => { res.json(wxJson([])) })
app.get('/gm/checkin/records', (req, res) => { res.json(wxJson({ list: [], total: 0 })) })
app.get('/gm/favorites', (req, res) => { res.json(wxJson({ list: [], total: 0 })) })
app.post('/gm/favorites', (req, res) => { res.json(wxJson({ id: Date.now() })) })
app.delete('/gm/favorites/:id', (req, res) => { res.json(wxJson(null)) })
app.get('/gm/messages', (req, res) => { res.json(wxJson({ list: [], total: 0 })) })
app.get('/gm/messages/:id', (req, res) => { res.json(wxJson({ id: parseInt(req.params.id), title: '系统通知', content: '暂无消息内容' })) })
app.post('/gm/messages/read-all', (req, res) => { res.json(wxJson(null)) })
app.get('/gm/messages/unread-count', (req, res) => { res.json(wxJson({ count: 0 })) })
app.get('/gm/messages/coach', (req, res) => { res.json(wxJson([])) })
app.get('/gm/activity-signups/me', (req, res) => { res.json(wxJson({ list: [], total: 0 })) })
app.get('/gm/activities/pending-count', (req, res) => { res.json(wxJson({ count: 0 })) })
app.get('/gm/activities/banners', (req, res) => { res.json(wxJson([{ id: 1, title: '睡眠改善计划', image: '/assets/images/banner-1.png', url: '/pages/activities/detail?id=1' }])) })
// 课程列表
app.get('/gm/courses/list', (req, res) => {
  const courses = [
    { id: 1, title: '睡眠改善7天训练营', subtitle: '科学睡眠，快速改善睡眠质量', cover: '/assets/images/course-cover-1.png', teacher: '李明博士', price: 99, originalPrice: 299, students: 1256, rating: 4.8, lessons: 12, duration: '5小时', tag: '热门' },
    { id: 2, title: '正念冥想入门课', subtitle: '学会放松，从呼吸开始', cover: '/assets/images/course-cover-2.png', teacher: '王芳老师', price: 0, originalPrice: 0, students: 2341, rating: 4.9, lessons: 8, duration: '3小时', tag: '免费' },
    { id: 3, title: '睡前放松训练', subtitle: '科学放松法助你快速入睡', cover: '/assets/images/course-cover-3.png', teacher: '张伟教练', price: 49, originalPrice: 199, students: 876, rating: 4.7, lessons: 6, duration: '2小时', tag: '' },
    { id: 4, title: '呼吸调节改善睡眠', subtitle: '改善呼吸，提升睡眠深度', cover: '/assets/images/course-cover-4.png', teacher: '陈健康医生', price: 79, originalPrice: 249, students: 543, rating: 4.6, lessons: 10, duration: '4小时', tag: '推荐' },
    { id: 5, title: '睡眠健康管理全攻略', subtitle: '全面了解睡眠，科学改善', cover: '/assets/images/course-cover-5.png', teacher: '睡眠专家团队', price: 199, originalPrice: 599, students: 1892, rating: 4.8, lessons: 20, duration: '8小时', tag: '精品' },
    { id: 6, title: '5分钟入睡技巧课', subtitle: '亲测有效，每天多睡2小时', cover: '/assets/images/course-cover-6.png', teacher: '刘老师', price: 0, originalPrice: 0, students: 3567, rating: 4.9, lessons: 4, duration: '1.5小时', tag: '免费' },
  ]
  res.json({ code: 200, data: courses })
})

app.get('/gm/courses/my', (req, res) => {
  // 模拟已购课程
  res.json({ code: 200, data: { list: [
    { id: 1, title: '睡眠改善7天训练营', cover: '/assets/images/course-cover-1.png', teacher: '李明博士', progress: 65, totalLessons: 12, completedLessons: 8 },
    { id: 2, title: '正念冥想入门课', cover: '/assets/images/course-cover-2.png', teacher: '王芳老师', progress: 100, totalLessons: 8, completedLessons: 8 },
  ], total: 2 } })
})

app.get('/gm/courses/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const courses = {
    1: { id: 1, title: '睡眠改善7天训练营', subtitle: '科学睡眠，快速改善睡眠质量', cover: '/assets/images/course-cover-1.png', teacher: '李明博士', price: 99, students: 1256, rating: 4.8, desc: '本课程由睡眠科主任医师李明博士主讲，通过7天的系统训练，帮助你建立科学的睡眠习惯，彻底改善睡眠质量。', chapters: [
      { id: 1, title: '认识你的睡眠', duration: '25分钟', done: true, locked: false },
      { id: 2, title: '睡眠的生理机制', duration: '30分钟', done: true, locked: false },
      { id: 3, title: '如何测量睡眠质量', duration: '20分钟', done: true, locked: false },
      { id: 4, title: '睡眠卫生：环境与习惯', duration: '35分钟', done: false, locked: false },
      { id: 5, title: '认知行为疗法入门', duration: '40分钟', done: false, locked: true },
      { id: 6, title: '放松训练实践', duration: '30分钟', done: false, locked: true },
    ]},
    2: { id: 2, title: '正念冥想入门课', subtitle: '学会放松，从呼吸开始', cover: '/assets/images/course-cover-2.png', teacher: '王芳老师', price: 0, students: 2341, rating: 4.9, desc: '正念冥想是改善睡眠的有效方法，本课程带你从零开始，掌握冥想的基本技巧。', chapters: [
      { id: 1, title: '什么是正念冥想', duration: '20分钟', done: true, locked: false },
      { id: 2, title: '呼吸觉知练习', duration: '25分钟', done: true, locked: false },
      { id: 3, title: '身体扫描技术', duration: '30分钟', done: true, locked: false },
      { id: 4, title: '睡前冥想引导', duration: '20分钟', done: true, locked: false },
    ]},
    3: { id: 3, title: '睡前放松训练', subtitle: '科学放松法助你快速入睡', cover: '/assets/images/course-cover-3.png', teacher: '张伟教练', price: 49, students: 876, rating: 4.7, desc: '通过科学的放松训练，让身心在睡前进入平静状态，自然入睡。', chapters: [
      { id: 1, title: '渐进式肌肉放松', duration: '20分钟', done: false, locked: false },
      { id: 2, title: '4-7-8呼吸法', duration: '15分钟', done: false, locked: false },
      { id: 3, title: '芳香疗法入门', duration: '20分钟', done: false, locked: false },
    ]},
    4: { id: 4, title: '呼吸调节改善睡眠', subtitle: '改善呼吸，提升睡眠深度', cover: '/assets/images/course-cover-4.png', teacher: '陈健康医生', price: 79, students: 543, rating: 4.6, desc: '正确的呼吸方式可以显著改善睡眠质量，本课程教你呼吸调节的核心技术。', chapters: [
      { id: 1, title: '呼吸与睡眠的关系', duration: '25分钟', done: false, locked: false },
      { id: 2, title: '腹式呼吸练习', duration: '30分钟', done: false, locked: false },
    ]},
    5: { id: 5, title: '睡眠健康管理全攻略', subtitle: '全面了解睡眠，科学改善', cover: '/assets/images/course-cover-5.png', teacher: '睡眠专家团队', price: 199, students: 1892, rating: 4.8, desc: '系统全面的睡眠健康课程，从睡眠医学原理到实践方法全覆盖。', chapters: [
      { id: 1, title: '睡眠医学基础', duration: '40分钟', done: false, locked: false },
      { id: 2, title: '常见睡眠障碍', duration: '35分钟', done: false, locked: true },
    ]},
    6: { id: 6, title: '5分钟入睡技巧课', subtitle: '亲测有效，每天多睡2小时', cover: '/assets/images/course-cover-6.png', teacher: '刘老师', price: 0, students: 3567, rating: 4.9, desc: '分享经过数千人验证的快速入睡技巧，简单实用见效快。', chapters: [
      { id: 1, title: '入睡的生理信号', duration: '15分钟', done: false, locked: false },
      { id: 2, title: '军事入睡法', duration: '20分钟', done: false, locked: false },
    ]},
  }
  const course = courses[id] || courses[1]
  res.json({ code: 200, data: course })
})

app.get('/gm/courses/:id/chapters', (req, res) => {
  const id = parseInt(req.params.id)
  // 返回对应课程的章节（与上面 /courses/:id 的chapters一致）
  const chaptersMap = {
    1: [
      { id: 1, title: '认识你的睡眠', duration: '25分钟', done: true, locked: false, type: 'video' },
      { id: 2, title: '睡眠的生理机制', duration: '30分钟', done: true, locked: false, type: 'video' },
      { id: 3, title: '如何测量睡眠质量', duration: '20分钟', done: true, locked: false, type: 'video' },
      { id: 4, title: '睡眠卫生：环境与习惯', duration: '35分钟', done: false, locked: false, type: 'video' },
      { id: 5, title: '认知行为疗法入门', duration: '40分钟', done: false, locked: true, type: 'video' },
      { id: 6, title: '放松训练实践', duration: '30分钟', done: false, locked: true, type: 'video' },
    ],
    2: [
      { id: 1, title: '什么是正念冥想', duration: '20分钟', done: true, locked: false, type: 'video' },
      { id: 2, title: '呼吸觉知练习', duration: '25分钟', done: true, locked: false, type: 'video' },
      { id: 3, title: '身体扫描技术', duration: '30分钟', done: true, locked: false, type: 'video' },
      { id: 4, title: '睡前冥想引导', duration: '20分钟', done: true, locked: false, type: 'audio' },
    ],
  }
  res.json({ code: 200, data: chaptersMap[id] || chaptersMap[1] || [] })
})

app.post('/gm/courses/:id/review', (req, res) => {
  res.json({ code: 200, msg: '评价成功', data: null })
})
app.post('/gm/feedback', (req, res) => { res.json(wxJson({ id: Date.now() })) })
app.get('/gm/orders', (req, res) => {
  dbPool.query('SELECT o.*, p.nickname as userName FROM order_info o LEFT JOIN member_profile p ON o.member_id=p.id WHERE o.del_flag=0 ORDER BY o.create_time DESC LIMIT 50', (e, rows) => {
    if (e) return res.json(wxErr(e.message, 500))
    const result = (rows||[]).map(o => ({ id: o.id, orderNo: o.order_no, title: o.title||'睡眠服务', amount: o.total_amount, status: o.status==='paid'?'已完成':o.status==='pending'?'待支付':o.status==='refunded'?'已退款':'进行中', createTime: o.create_time }))
    res.json(wxJson({ list: result, total: result.length }))
  })
})
app.get('/common/dict', (req, res) => {
  const { type } = req.query
  if (type === 'feedback_type') res.json(wxJson([{ id: 1, label: '功能建议' }, { id: 2, label: '体验问题' }, { id: 3, label: '其他' }]))
  else res.json(wxJson([]))
})
app.get('/gm/sleep/today', (req, res) => { res.json(wxJson({ sleepTime: '22:30', wakeTime: '06:30', duration: 8, score: 85 })) })
app.get('/gm/sleep/tasks/today', (req, res) => { res.json(wxJson([{ id: 1, time: '08:00', title: '呼吸训练', desc: '腹式呼吸10分钟', done: false }, { id: 2, time: '21:00', title: '睡前冥想', desc: '引导式冥想音频', done: false }])) })
app.get('/gm/sleep/relax-audios', (req, res) => { res.json(wxJson([{ id: 1, title: '深度放松引导', url: '', duration: '10分钟' }, { id: 2, title: '睡前冥想', url: '', duration: '15分钟' }])) })
app.get('/gm/stats', (req, res) => { res.json(wxJson({ users: 2000, improvement: 90 })) })
app.get('/gm/hot-topics', (req, res) => { res.json(wxJson([{ id: 1, title: '长期熬夜后如何调整生物钟？', heat: 1000 }, { id: 2, title: '睡前冥想音频分享', heat: 800 }, { id: 3, title: '7天睡眠改善经历', heat: 600 }])) })
app.get('/gm/feed/categories', (req, res) => { res.json(wxJson([{ id: 'recommend', name: '推荐' }, { id: 'expert', name: '专家专栏' }, { id: 'music', name: '睡眠音乐' }, { id: 'physical', name: '物理治疗' }])) })
app.get('/gm/feed/categories/expert', (req, res) => { res.json(wxJson([{ id: 'li', name: '李医生' }, { id: 'wang', name: '王教授' }])) })
app.get('/gm/feed/list', (req, res) => { res.json(wxJson([{ id: 1, title: '如何改善睡眠质量', summary: '睡眠质量直接影响健康...', cover: '/assets/images/cover-1.png', category: 'recommend', author: '张医生', views: 100 }, { id: 2, title: '失眠的常见原因', summary: '失眠原因多种多样...', cover: '/assets/images/cover-2.png', category: 'recommend', author: '李医生', views: 80 }])) })
app.get('/gm/quick-entry/badge', (req, res) => { res.json(wxJson({ badge: 0 })) })
app.get('/gm/splash/images', (req, res) => { res.json(wxJson([{ id: 1, url: '/assets/images/splash-1.png' }])) })



// ========== 社区帖子接口 ==========
app.get('/gm/community/post', (req, res) => {
  const { id } = req.query
  const posts = {
    1: { id: 1, avatar: '/images/avatar-user.png', nickname: '睡眠小白', timeStr: '2小时前', title: '坚持早睡30天，我的黑眼圈真的消失了！', content: '之前总是凌晨2点才睡，皮肤状态很差，黑眼圈明显。后来按照APP里的睡眠计划调整作息，第1周凌晨2点→凌晨12点，第2周凌晨12点→晚上11点，第3周晚上11点→晚上10点半。坚持一个月后，黑眼圈明显淡了，白天精力充沛！', images: ['/assets/images/banner-1.png', '/assets/images/banner-2.png'], tags: ['睡眠改善', '健康生活'], viewCount: 1234, commentCount: 3, likeCount: 89, liked: false, followed: false },
    2: { id: 2, avatar: '/images/avatar-user.png', nickname: '求助网友', timeStr: '4小时前', title: '【问答】总是做噩梦是什么原因？', content: '最近一个月每天晚上都做噩梦，醒来感觉很累，有相同经历的朋友吗？压力大的时候尤其严重。', images: [], tags: ['问答求助', '噩梦'], viewCount: 567, commentCount: 2, likeCount: 12, liked: false, followed: false },
    3: { id: 3, avatar: '/assets/images/expert-avatar-2.png', nickname: '王医生', timeStr: '昨天', title: '【科普】深度睡眠和浅睡眠有什么区别？', content: '深度睡眠也称为慢波睡眠，是睡眠周期中最重要的恢复阶段。成年人每晚需要1.5-2小时深度睡眠。', images: ['/assets/images/banner-3.png'], tags: ['睡眠科普', '深度睡眠'], viewCount: 2341, commentCount: 5, likeCount: 156, liked: false, followed: false },
  }
  const post = posts[id] || posts[1]
  res.json(wxJson(post))
})

app.get('/gm/community/comments', (req, res) => {
  const { postId } = req.query
  const comments = {
    1: [
      { id: 1, avatar: '/images/avatar-user.png', nickname: '健康达人', timeStr: '1小时前', content: '真的有效！我也坚持了2周，感觉精神好多了', likeCount: 12, liked: false },
      { id: 2, avatar: '/assets/images/expert-avatar-1.png', nickname: '李医生', timeStr: '30分钟前', content: '早睡对皮肤的修复确实很重要，建议配合适度的运动效果更佳~', likeCount: 34, liked: true },
      { id: 3, avatar: '/images/avatar-user.png', nickname: '打工人', timeStr: '10分钟前', content: '道理我都懂，但是加班到10点怎么办😭', likeCount: 5, liked: false },
    ],
  }
  res.json(wxJson(comments[postId] || comments[1] || []))
})

app.post('/gm/community/comment', (req, res) => {
  const { postId, content, replyTo } = req.body || {}
  if (!content) return res.json(wxErr('评论内容不能为空'))
  res.json(wxJson({ id: Date.now(), content, replyTo, timeStr: '刚刚', liked: false, likeCount: 0 }))
})

app.post('/gm/community/like', (req, res) => {
  res.json(wxJson({ ok: true }))
})


const PORT = process.env.PORT || 3101
app.listen(PORT, () => { console.log('智眠星运营终端服务运行在 http://localhost:'+PORT) })
