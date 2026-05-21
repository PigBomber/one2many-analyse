export interface PackageMeta {
  packageId: string
  fileName: string
  taskId: string
  caseName: string
  createdAt: string
  uploadedAt: string
  totalRuns: number
  totalRounds: number
  averageScore: number
  consistencyPercentage: number
  conclusion: string
}

export interface RuleAuditResult {
  ruleId: string
  ruleSummary: string
  result: '满足' | '不满足' | '不涉及' | '待人工复核'
  conclusion: string
}

export interface RunData {
  runIndex: number
  taskId: string
  totalScore: number
  hardGateTriggered: boolean
  ruleAuditResults: RuleAuditResult[]
  ruleImpacts: {
    ruleId: string
    dimensionName: string
    itemName: string
    scoreDelta: number
    reason: string
  }[]
}

export interface RoundData {
  roundIndex: number
  capturedAt: string
  runs: RunData[]
  summary: {
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
  ruleReport: {
    ruleId: string
    summary: string
    unsatisfiedCount: number
    unsatisfiedRate: number
    conclusionSample: string
    runIndexes: number[]
    stability: string
  }[]
  riskReport: {
    key: string
    level: string
    title: string
    appearanceCount: number
    appearanceRate: number
    evidenceSample: string
    stability: string
  }[]
}

export interface PackageAnalysis {
  meta: PackageMeta
  rounds: RoundData[]
}

export interface RuleHeatmapCell {
  ruleId: string
  runIndex: number
  result: string
  conclusion: string
  shortConclusion: string
}

export interface AggregatedAnalysis {
  meta: PackageMeta
  summary: RoundData['summary']
  ruleReport: RoundData['ruleReport']
  riskReport: RoundData['riskReport']
  scoreTrend: { runIndex: number; taskId: string; totalScore: number }[]
  ruleMatrix: RuleHeatmapCell[]
  rounds: RoundData[]
}

export interface AiReportResponse {
  report: string
}
