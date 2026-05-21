import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { parseZip, saveAnalysis, loadAnalysis, listPackages, aggregateAnalysis } from './analyzer.js'
import { generateReport, diagnoseRule } from './llm.js'

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const analysis = await parseZip(req.file.buffer)
    analysis.meta.fileName = req.file.originalname

    const packageId = await saveAnalysis(analysis, DATA_DIR)

    const savedPath = path.join(UPLOAD_DIR, `${packageId}.zip`)
    fs.writeFileSync(savedPath, req.file.buffer)

    generateReport(aggregateAnalysis(analysis))
      .then(report => {
        fs.writeFileSync(path.join(REPORTS_DIR, `${packageId}.md`), report, 'utf-8')
        console.log(`AI report generated for ${packageId}`)
      })
      .catch(err => {
        console.error(`Auto-generate report failed for ${packageId}:`, err.message)
      })

    res.json({ packageId, meta: analysis.meta })
  } catch (err: any) {
    console.error('Upload error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/packages', (_req, res) => {
  try {
    const packages = listPackages(DATA_DIR)
    res.json(packages)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/analysis/:packageId', (req, res) => {
  try {
    const analysis = loadAnalysis(req.params.packageId, DATA_DIR)
    if (!analysis) {
      res.status(404).json({ error: 'Package not found' })
      return
    }
    const aggregated = aggregateAnalysis(analysis)
    res.json(aggregated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ai/report/:packageId', (req, res) => {
  try {
    const reportPath = path.join(REPORTS_DIR, `${req.params.packageId}.md`)
    if (fs.existsSync(reportPath)) {
      res.json({ report: fs.readFileSync(reportPath, 'utf-8') })
      return
    }
    res.json({ report: '' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ai/report/:packageId', async (req, res) => {
  try {
    const analysis = loadAnalysis(req.params.packageId, DATA_DIR)
    if (!analysis) {
      res.status(404).json({ error: 'Package not found' })
      return
    }
    const aggregated = aggregateAnalysis(analysis)
    const report = await generateReport(aggregated)
    fs.writeFileSync(path.join(REPORTS_DIR, `${req.params.packageId}.md`), report, 'utf-8')
    res.json({ report })
  } catch (err: any) {
    console.error('AI report error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ai/diagnose/:packageId/:ruleId', async (req, res) => {
  try {
    const analysis = loadAnalysis(req.params.packageId, DATA_DIR)
    if (!analysis) {
      res.status(404).json({ error: 'Package not found' })
      return
    }
    const aggregated = aggregateAnalysis(analysis)
    const report = await diagnoseRule(aggregated, req.params.ruleId)
    res.json({ report })
  } catch (err: any) {
    console.error('AI diagnose error:', err)
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
  console.log(`Server running on http://localhost:${PORT}`)
})
