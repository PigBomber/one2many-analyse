export interface PackageMeta {
  packageId: string
  fileName: string
  taskId: string
  caseName: string
  createdAt: string
  totalRuns: number
  totalRounds: number
}

export interface RuleHeatmapCell {
  ruleId: string
  ruleSummary: string
  runIndex: number
  result: string
  conclusion: string
  shortConclusion: string
}

export interface ScoreTrendItem {
  runIndex: number
  taskId: string
  totalScore: number
}

export interface RuleReportItem {
  ruleId: string
  summary: string
  unsatisfiedCount: number
  unsatisfiedRate: number
  conclusionSample: string
  runIndexes: number[]
  stability: string
}

export interface RiskReportItem {
  key: string
  level: string
  title: string
  appearanceCount: number
  appearanceRate: number
  evidenceSample: string
  stability: string
}

export interface SummaryData {
  completedRuns: number
  failedRuns: number
  consistencyPercentage: number
  averageScore: number
  medianScore: number
  minScore: number
  maxScore: number
  scoreStandardDeviation: number
  averageRuleUnsatisfactionRatio: number
  averageRiskCount: number
  conclusion: string
}

export interface AggregatedAnalysis {
  meta: PackageMeta
  summary: SummaryData
  ruleReport: RuleReportItem[]
  riskReport: RiskReportItem[]
  scoreTrend: ScoreTrendItem[]
  ruleMatrix: RuleHeatmapCell[]
}
