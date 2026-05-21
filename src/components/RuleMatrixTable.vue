<template>
  <div class="matrix-table-wrapper">
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="col-rule">规则</th>
          <th v-for="run in runIndexes" :key="run" class="col-run">Run{{ run }}</th>
          <th class="col-rate">不满足率</th>
          <th class="col-stability">稳定性</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in tableRows" :key="row.ruleId" class="matrix-row" @click="goDetail(row.ruleId)">
          <td class="col-rule">
            <span class="rule-id" :title="row.ruleId">{{ row.ruleId }}</span>
          </td>
          <td v-for="run in runIndexes" :key="run" class="col-run">
            <span :class="['cell-badge', getCellClass(row.cells[run])]">
              {{ getCellSymbol(row.cells[run]) }}
            </span>
          </td>
          <td class="col-rate">
            <span :class="['rate-value', getRateClass(row.unsatisfiedRate)]">
              {{ row.unsatisfiedRate }}%
            </span>
          </td>
          <td class="col-stability">
            <el-tag :type="getStabilityType(row.stability)" size="small" effect="dark">
              {{ row.stability }}
            </el-tag>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { RuleHeatmapCell, RuleReportItem, ScoreTrendItem } from '../types'

const props = defineProps<{
  ruleMatrix: RuleHeatmapCell[]
  ruleReport: RuleReportItem[]
  scoreTrend: ScoreTrendItem[]
  packageId: string
}>()

const router = useRouter()

const ruleIds = computed(() => props.ruleReport.map(r => r.ruleId))

const runIndexes = computed(() => {
  const indexes = new Set(props.ruleMatrix.map(r => r.runIndex))
  return [...indexes].sort((a, b) => a - b)
})

interface TableRow {
  ruleId: string
  cells: Record<number, string>
  unsatisfiedRate: number
  stability: string
}

const tableRows = computed<TableRow[]>(() => {
  return ruleIds.value.map(ruleId => {
    const report = props.ruleReport.find(r => r.ruleId === ruleId)
    const cells: Record<number, string> = {}
    for (const runIdx of runIndexes.value) {
      const cell = props.ruleMatrix.find(c => c.ruleId === ruleId && c.runIndex === runIdx)
      cells[runIdx] = cell?.result || '不涉及'
    }
    return {
      ruleId,
      cells,
      unsatisfiedRate: report?.unsatisfiedRate ?? 0,
      stability: report?.stability || '',
    }
  })
})

function getCellClass(result: string): string {
  switch (result) {
    case '不满足': return 'cell-fail'
    case '满足': return 'cell-pass'
    case '待人工复核': return 'cell-review'
    default: return 'cell-na'
  }
}

function getCellSymbol(result: string): string {
  switch (result) {
    case '不满足': return 'x'
    case '满足': return '√'
    case '待人工复核': return '!'
    default: return '-'
  }
}

function getRateClass(rate: number): string {
  if (rate >= 70) return 'rate-high'
  if (rate >= 30) return 'rate-mid'
  return 'rate-low'
}

function getStabilityType(stability: string): 'danger' | 'warning' | 'success' | 'info' {
  switch (stability) {
    case '稳定不满足': return 'danger'
    case '判定波动': return 'warning'
    case '稳定满足或不涉及': return 'success'
    default: return 'info'
  }
}

function goDetail(ruleId: string) {
  router.push(`/rule/${props.packageId}/${encodeURIComponent(ruleId)}`)
}
</script>

<style scoped>
.matrix-table-wrapper {
  overflow-x: auto;
}
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.matrix-table th {
  background: #f5f7fa;
  padding: 10px 8px;
  text-align: center;
  font-weight: 600;
  color: #606266;
  border-bottom: 2px solid #ebeef5;
  white-space: nowrap;
}
.matrix-table td {
  padding: 8px;
  text-align: center;
  border-bottom: 1px solid #ebeef5;
}
.matrix-row {
  cursor: pointer;
  transition: background .15s;
}
.matrix-row:hover {
  background: #ecf5ff;
}
.col-rule {
  text-align: left !important;
  min-width: 160px;
  max-width: 200px;
}
.col-run {
  min-width: 48px;
}
.col-rate {
  min-width: 70px;
}
.col-stability {
  min-width: 100px;
}
.rule-id {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: #303133;
  font-weight: 500;
}
.cell-badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 13px;
}
.cell-fail {
  background: #F56C6C;
  color: #fff;
}
.cell-pass {
  background: #67C23A;
  color: #fff;
}
.cell-review {
  background: #E6A23C;
  color: #fff;
}
.cell-na {
  background: #C0C4CC;
  color: #fff;
}
.rate-value {
  font-weight: 700;
  font-size: 14px;
}
.rate-high {
  color: #F56C6C;
}
.rate-mid {
  color: #E6A23C;
}
.rate-low {
  color: #67C23A;
}
</style>
