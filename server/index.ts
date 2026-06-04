import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { parseZip, saveAnalysis, loadAnalysis, listPackages, aggregateAnalysis } from './analyzer.js'
import { generateReport, diagnoseRule } from './llm.js'

function ts(): string {
  return new Date().toISOString()
}

function logReq(method: string, url: string, status: number, elapsed: number, extra?: string) {
  const msg = `[${ts()}] ${method} ${url} -> ${status} (${elapsed}ms)`
  console.log(extra ? `${msg} ${extra}` : msg)
}

const app = express()
const PORT = 3000
const DATA_DIR = path.resolve('data')
const UPLOAD_DIR = path.resolve('uploads')
const REPORTS_DIR = path.resolve('data/reports')

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })

app.use(cors())
app.use(express.json())

app.use((req, _res, next) => {
  const start = Date.now()
  const originalEnd = _res.end.bind(_res)
  ;(_res as any).end = function (...args: any[]) {
    const elapsed = Date.now() - start
    logReq(req.method, req.originalUrl, _res.statusCode, elapsed)
    return originalEnd(...args)
  }
  next()
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const start = Date.now()
  try {
    if (!req.file) {
      console.warn(`[${ts()}] POST /api/upload - no file uploaded`)
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    console.log(`[${ts()}] POST /api/upload - received file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`)

    const analysis = await parseZip(req.file.buffer)
    analysis.meta.fileName = req.file.originalname
    console.log(`[${ts()}] POST /api/upload - parsed zip: ${analysis.rounds.length} rounds, ${analysis.meta.totalRuns} runs`)

    const packageId = await saveAnalysis(analysis, DATA_DIR)
    console.log(`[${ts()}] POST /api/upload - saved analysis: packageId=${packageId}`)

    const savedPath = path.join(UPLOAD_DIR, `${packageId}.zip`)
    fs.writeFileSync(savedPath, req.file.buffer)

    generateReport(aggregateAnalysis(analysis))
      .then(report => {
        fs.writeFileSync(path.join(REPORTS_DIR, `${packageId}.md`), report, 'utf-8')
        console.log(`[${ts()}] Auto AI report generated for ${packageId}`)
      })
      .catch(err => {
        console.error(`[${ts()}] Auto-generate report failed for ${packageId}:`, err.message)
      })

    logReq('POST', '/api/upload', 200, Date.now() - start, `packageId=${packageId}`)
    res.json({ packageId, meta: analysis.meta })
  } catch (err: any) {
    console.error(`[${ts()}] Upload error:`, err.message, err.stack)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/packages', (_req, res) => {
  try {
    const packages = listPackages(DATA_DIR)
    console.log(`[${ts()}] GET /api/packages - returned ${packages.length} packages`)
    res.json(packages)
  } catch (err: any) {
    console.error(`[${ts()}] GET /api/packages error:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/analysis/:packageId', (req, res) => {
  try {
    const { packageId } = req.params
    console.log(`[${ts()}] GET /api/analysis/${packageId}`)
    const analysis = loadAnalysis(packageId, DATA_DIR)
    if (!analysis) {
      console.warn(`[${ts()}] GET /api/analysis/${packageId} - not found`)
      res.status(404).json({ error: 'Package not found' })
      return
    }
    const aggregated = aggregateAnalysis(analysis)
    console.log(`[${ts()}] GET /api/analysis/${packageId} - OK, ${aggregated.ruleMatrix.length} matrix cells`)
    res.json(aggregated)
  } catch (err: any) {
    console.error(`[${ts()}] GET /api/analysis/${req.params.packageId} error:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ai/report/:packageId', (req, res) => {
  try {
    const { packageId } = req.params
    const reportPath = path.join(REPORTS_DIR, `${packageId}.md`)
    if (fs.existsSync(reportPath)) {
      const report = fs.readFileSync(reportPath, 'utf-8')
      console.log(`[${ts()}] GET /api/ai/report/${packageId} - found cached report (${report.length} chars)`)
      res.json({ report })
      return
    }
    console.log(`[${ts()}] GET /api/ai/report/${packageId} - no cached report`)
    res.json({ report: '' })
  } catch (err: any) {
    console.error(`[${ts()}] GET /api/ai/report/${req.params.packageId} error:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ai/report/:packageId', async (req, res) => {
  const start = Date.now()
  try {
    const { packageId } = req.params
    console.log(`[${ts()}] POST /api/ai/report/${packageId} - regenerating report...`)
    const analysis = loadAnalysis(packageId, DATA_DIR)
    if (!analysis) {
      console.warn(`[${ts()}] POST /api/ai/report/${packageId} - package not found`)
      res.status(404).json({ error: 'Package not found' })
      return
    }
    const aggregated = aggregateAnalysis(analysis)
    const report = await generateReport(aggregated)
    fs.writeFileSync(path.join(REPORTS_DIR, `${packageId}.md`), report, 'utf-8')
    console.log(`[${ts()}] POST /api/ai/report/${packageId} - done in ${Date.now() - start}ms (${report.length} chars)`)
    res.json({ report })
  } catch (err: any) {
    console.error(`[${ts()}] POST /api/ai/report/${req.params.packageId} error:`, err.message, err.stack)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ai/diagnose/:packageId/:ruleId', async (req, res) => {
  const start = Date.now()
  try {
    const { packageId, ruleId } = req.params
    console.log(`[${ts()}] POST /api/ai/diagnose/${packageId}/${ruleId} - diagnosing...`)
    const analysis = loadAnalysis(packageId, DATA_DIR)
    if (!analysis) {
      console.warn(`[${ts()}] POST /api/ai/diagnose/${packageId}/${ruleId} - package not found`)
      res.status(404).json({ error: 'Package not found' })
      return
    }
    const aggregated = aggregateAnalysis(analysis)
    const report = await diagnoseRule(aggregated, ruleId)
    console.log(`[${ts()}] POST /api/ai/diagnose/${packageId}/${ruleId} - done in ${Date.now() - start}ms`)
    res.json({ report })
  } catch (err: any) {
    console.error(`[${ts()}] POST /api/ai/diagnose/${req.params.packageId}/${req.params.ruleId} error:`, err.message, err.stack)
    res.status(500).json({ error: err.message })
  }
})

const DIST_DIR = path.resolve('dist')
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[${ts()}] Server running on http://localhost:${PORT}`)
  console.log(`[${ts()}] GLM_API_KEY: ${process.env.GLM_API_KEY ? 'configured' : 'NOT SET'}`)
  console.log(`[${ts()}] DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? 'configured' : 'NOT SET'}`)
})
