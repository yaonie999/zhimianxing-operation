import express from 'express'
import mysql from 'mysql2'
const app = express()
app.use(express.json())
const dbPool = mysql.createPool({ host: 'localhost', user: 'root', password: 'root123', database: 'zhimianxing', waitForConnections: true, connectionLimit: 5 })
app.get('/test', (req, res) => res.json({ ok: 1 }))
app.get('/api/patients', (req, res) => {
  dbPool.query('SELECT * FROM patient LIMIT 2', (err, rows) => {
    if (err) return res.json({ error: err.message })
    res.json({ total: rows.length, records: rows.map(r => ({id:r.id,name:r.name})) })
  })
})
const PORT = process.env.PORT || 3999
app.listen(PORT, '0.0.0.0', () => { console.log('Test OK on port ' + PORT) })
