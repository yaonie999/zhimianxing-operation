import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2'
import http from 'http'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const dbPool = mysql.createPool({
  host: process.env.MYSQL_HOST||'localhost',
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

function forwardToBackend(req, res, pathSuffix, method, body) {
  method = method || 'GET'
  const options = {
    hostname: process.env.JAVA_API_HOST||'localhost',
    port: parseInt(process.env.JAVA_API_PORT||'8080'),
    path: '/api'+pathSuffix,
    method,
    headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.cookie||'' }
  }
  const proxyReq = http.request(options, (proxyRes) => {
    let data = ''
    proxyRes.on('data', chunk => { data += chunk })
    proxyRes.on('end', () => {
      try { res.status(proxyRes.statusCode).json(safeParse(data)) }
      catch { res.status(proxyRes.statusCode).send(data) }
    })
  })
  proxyReq.on('error', () => res.status(502).json({ code: 502, msg: '后端服务不可用' }))
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
  dbPool.query(
    'SELECT id, order_no as orderNo, member_id as memberId, member_name as memberName, member_phone as memberPhone, order_type as orderType, product_id as productId, product_name as productName, product_type as productType, original_price as originalPrice, discount_amount as discountAmount, pay_amount as payAmount, pay_method as payMethod, trade_no as tradeNo, paid_time as paidTime, status, cancel_time as cancelTime, refund_time as refundTime, refund_amount as refundAmount, remark, platform_share as platformShare, tenant_share as tenantShare, create_time as createTime, del_flag as delFlag FROM order_info ORDER BY id DESC LIMIT ? OFFSET ?',
    [pageSize, offset], (err, rows) => {
      if (err) return res.status(500).json({ code: 500, msg: err.message })
      dbPool.query('SELECT COUNT(*) as total FROM order_info', (err2, tot) => {
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
  dbPool.query(
    `SELECT id, order_id as orderId, refund_no as refundNo, order_no as orderNo, user, order_amount as orderAmount,
     refund_amount as refundAmount, refund_type as refundType, applicant, apply_time as applyTime, status,
     reject_reason as rejectReason, approver, approve_time as approveTime, del_flag as delFlag
     FROM refund ORDER BY id DESC LIMIT ? OFFSET ?`,
    [pageSize, offset], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    dbPool.query('SELECT COUNT(*) as total FROM refund', (err2, tot) => {
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
  dbPool.query('SELECT * FROM verify_record ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset], (err, rows) => {
    if (err) return res.status(500).json({ code: 500, msg: err.message })
    dbPool.query('SELECT COUNT(*) as total FROM verify_record', (err2, tot) => {
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

const PORT = process.env.PORT || 3101
app.listen(PORT, () => { console.log('智眠星运营终端服务运行在 http://localhost:'+PORT) })
