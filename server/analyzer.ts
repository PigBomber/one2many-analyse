import JSZip from 'jszip'
import type { PackageAnalysis, RunData, RoundData, RuleAuditResult, PackageMeta } from './types.js'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

function extractShortConclusion(conclusion: string): string {
  if (!conclusion) return ''
  const maxLen = 120
  if (conclusion.length <= maxLen) return conclusion
  return conclusion.slice(0, maxLen) + '...'
}

function extractRunIndex(fileName: string): number {
  const match = fileName.match(/run-(\d+)-/)
  return match ? parseInt(match[1], 10) : 0
}

function extractTaskId(fileName: string): string {
  const match = fileName.match(/task-(\d+)/)
  return match ? match[1] : ''
}

export async function parseZip(buffer: Buffer): Promise<PackageAnalysis> {
  const zip = await JSZip.loadAsync(buffer)

  const overviewText = await zip.file('overview.json')?.async('string')
  if (!overviewText) throw new Error('overview.json not found in zip')
  const overview = JSON.parse(overviewText)

  const meta: PackageMeta = {
    packageId: randomUUID(),
    fileName: '',
    taskId: overview.task?.id || '',
    caseName: overview.task?.caseName || '',
    createdAt: overview.task?.createdAt || new Date().toISOString(),
    totalRuns: overview.analysis?.summary?.completedRuns || 0,
    totalRounds: 0,
  }

  const rounds: RoundData[] = []

  const roundFolders = new Set<string>()
  for (const filePath of Object.keys(zip.files)) {
    const match = filePath.match(/^rounds\/(round-\d+)\//)
    if (match) roundFolders.add(match[1])
  }

  for (const roundFolder of [...roundFolders].sort()) {
    const summaryText = await zip.file(`rounds/${roundFolder}/summary.json`)?.async('string')
    if (!summaryText) continue

    const summaryJson = JSON.parse(summaryText)
    const roundIndex = parseInt(roundFolder.replace('round-', ''), 10)

    const runs: RunData[] = []
    const runFiles = Object.keys(zip.files)
      .filter(f => f.startsWith(`rounds/${roundFolder}/run-`) && f.endsWith('.json'))
      .sort()

    for (const runFile of runFiles) {
      const runText = await zip.file(runFile)?.async('string')
      if (!runText) continue

      const runJson = JSON.parse(runText)
      const fileName = path.basename(runFile)
      const runIndex = extractRunIndex(fileName)
      const taskId = extractTaskId(fileName)

      const ruleAuditResults: RuleAuditResult[] = (runJson.rule_audit_results || []).map(
        (r: any) => ({
          ruleId: r.rule_id,
          ruleSummary: r.rule_summary || '',
          result: r.result || '不涉及',
          conclusion: r.conclusion || '',
        })
      )

      const ruleImpacts: RunData['ruleImpacts'] = []
      for (const dim of runJson.dimension_results || []) {
        for (const item of dim?.item_results || []) {
          for (const ri of item?.rule_impacts || []) {
            ruleImpacts.push({
              ruleId: ri.rule_id,
              dimensionName: dim.dimension_name || '',
              itemName: item.item_name || '',
              scoreDelta: ri.score_delta || 0,
              reason: ri.reason || '',
            })
          }
        }
      }

      runs.push({
        runIndex,
        taskId,
        totalScore: runJson.overall_conclusion?.total_score ?? 0,
        hardGateTriggered: runJson.overall_conclusion?.hard_gate_triggered ?? false,
        ruleAuditResults,
        ruleImpacts,
      })
    }

    rounds.push({
      roundIndex,
      capturedAt: summaryJson.capturedAt || '',
      runs: runs.sort((a, b) => a.runIndex - b.runIndex),
      summary: summaryJson.summary,
      ruleReport: summaryJson.ruleReport || [],
      riskReport: summaryJson.riskReport || [],
    })
  }

  meta.totalRounds = rounds.length

  if (rounds.length > 0 && rounds[0].runs.length > 0) {
    meta.totalRuns = rounds.reduce((acc, r) => acc + r.runs.length, 0)
  }

  return { meta, rounds }
}

export async function saveAnalysis(analysis: PackageAnalysis, dataDir: string): Promise<string> {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const filePath = path.join(dataDir, `${analysis.meta.packageId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2), 'utf-8')
  return analysis.meta.packageId
}

export function loadAnalysis(packageId: string, dataDir: string): PackageAnalysis | null {
  const filePath = path.join(dataDir, `${packageId}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

export function listPackages(dataDir: string): PackageMeta[] {
  if (!fs.existsSync(dataDir)) return []
  return fs
    .readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'))
      return data.meta as PackageMeta
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function aggregateAnalysis(analysis: PackageAnalysis) {
  const round = analysis.rounds[0]
  if (!round) throw new Error('No round data found')

  const scoreTrend = round.runs.map(r => ({
    runIndex: r.runIndex,
    taskId: r.taskId,
    totalScore: r.totalScore,
  }))

  const ruleIds = new Set<string>()
  for (const run of round.runs) {
    for (const r of run.ruleAuditResults) {
      ruleIds.add(r.ruleId)
    }
  }

  const targetRuleIds = new Set(round.ruleReport.map(r => r.ruleId))

  const ruleMatrix: {
    ruleId: string
    ruleSummary: string
    runIndex: number
    result: string
    conclusion: string
    shortConclusion: string
  }[] = []

  for (const ruleId of [...targetRuleIds]) {
    const ruleSummary = round.ruleReport.find(r => r.ruleId === ruleId)?.summary || ''
    for (const run of round.runs) {
      const audit = run.ruleAuditResults.find(r => r.ruleId === ruleId)
      ruleMatrix.push({
        ruleId,
        ruleSummary,
        runIndex: run.runIndex,
        result: audit?.result || '不涉及',
        conclusion: audit?.conclusion || '',
        shortConclusion: extractShortConclusion(audit?.conclusion || ''),
      })
    }
  }

  return {
    meta: analysis.meta,
    summary: round.summary,
    ruleReport: round.ruleReport,
    riskReport: round.riskReport,
    scoreTrend,
    ruleMatrix,
    rounds: analysis.rounds,
  }
}
