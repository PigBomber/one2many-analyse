<template>
  <div class="rule-detail-page" v-loading="loading">
    <template v-if="data">
      <div class="page-nav">
        <el-button @click="$router.push(`/dashboard/${packageId}`)">
          <el-icon><ArrowLeft /></el-icon>返回看板
        </el-button>
        <span class="page-title">{{ ruleId }}</span>
        <el-tag :type="stabilityTag" size="large">{{ ruleReport?.stability }}</el-tag>
      </div>

      <el-card shadow="hover" style="margin-bottom: 16px">
        <template #header><span class="section-title">规则定义</span></template>
        <p class="rule-summary">{{ ruleReport?.summary }}</p>
        <el-row :gutter="24" style="margin-top: 12px">
          <el-col :span="6">
            <el-statistic title="不满足率" :value="ruleReport?.unsatisfiedRate ?? 0" suffix="%" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="不满足次数" :value="ruleReport?.unsatisfiedCount ?? 0" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="总运行次数" :value="data.summary.completedRuns" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="一致性" :value="data.summary.consistencyPercentage" suffix="%" />
          </el-col>
        </el-row>
      </el-card>

      <el-row :gutter="16">
        <el-col :span="10">
          <el-card shadow="hover">
            <template #header><span class="section-title">逐 Run 判定折线</span></template>
            <div ref="miniChartRef" style="width:100%;height:300px"></div>
          </el-card>
        </el-col>
        <el-col :span="14">
          <el-card shadow="hover">
            <template #header><span class="section-title">逐 Run 判定详情</span></template>
            <el-table :data="runDetails" stripe style="width:100%" max-height="400">
              <el-table-column prop="runIndex" label="Run" width="70" align="center">
                <template #default="{ row }">
                  Run{{ row.runIndex }}
                </template>
              </el-table-column>
              <el-table-column prop="result" label="判定" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="resultTagType(row.result)" size="small">{{ row.result }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="conclusion" label="判定理由" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="conclusion-text">{{ row.conclusion }}</span>
                </template>
              </el-table-column>
              <el-table-column width="60" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="showFullConclusion(row)">
                    详情
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="hover" style="margin-top: 16px">
        <template #header>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="section-title">AI 原因诊断</span>
            <el-button type="primary" :loading="diagnosing" @click="doDiagnose">
              {{ diagnoseContent ? '重新诊断' : '开始诊断' }}
            </el-button>
          </div>
        </template>
        <div v-if="diagnoseContent" class="report-content" v-html="renderedDiagnose"></div>
        <el-empty v-else description="点击「开始诊断」调用 GLM 5.1 分析判定不一致的原因" :image-size="80" />
      </el-card>

      <el-dialog v-model="dialogVisible" :title="`Run${dialogRun.runIndex} 判定详情`" width="640px">
        <div class="dialog-conclusion">{{ dialogRun.conclusion }}</div>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { getAnalysis, diagnoseRule } from '../composables/useAnalysis'
import type { AggregatedAnalysis, RuleHeatmapCell } from '../types'

const route = useRoute()
const packageId = route.params.packageId as string
const ruleId = decodeURIComponent(route.params.ruleId as string)

const loading = ref(true)
const data = ref<AggregatedAnalysis | null>(null)
const diagnosing = ref(false)
const diagnoseContent = ref('')
const dialogVisible = ref(false)
const dialogRun = ref<any>({})
const miniChartRef = ref<HTMLDivElement>()
let miniChart: echarts.ECharts | null = null

const ruleReport = computed(() => data.value?.ruleReport.find(r => r.ruleId === ruleId))
const runDetails = computed(() =>
  data.value?.ruleMatrix.filter(c => c.ruleId === ruleId).sort((a, b) => a.runIndex - b.runIndex) || []
)

const stabilityTag = computed(() => {
  const s = ruleReport.value?.stability
  if (s === '判定波动') return 'warning'
  if (s === '稳定不满足') return 'danger'
  return 'success'
})

function resultTagType(result: string) {
  switch (result) {
    case '不满足': return 'danger'
    case '满足': return 'success'
    case '待人工复核': return 'warning'
    default: return 'info'
  }
}

function showFullConclusion(row: RuleHeatmapCell) {
  dialogRun.value = row
  dialogVisible.value = true
}

const renderedDiagnose = computed(() => {
  if (!diagnoseContent.value) return ''
  return diagnoseContent.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
})

onMounted(async () => {
  try {
    data.value = await getAnalysis(packageId)
    await nextTick()
    renderMiniChart()
  } finally {
    loading.value = false
  }
})

function renderMiniChart() {
  if (!miniChartRef.value || !runDetails.value.length) return
  miniChart = echarts.init(miniChartRef.value)
  const details = runDetails.value
  miniChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (p: any) => {
        const d = details[p[0].dataIndex]
        return `Run${d.runIndex}<br/>判定: <b>${d.result}</b>`
      },
    },
    grid: { left: 50, right: 30, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: details.map(d => `Run${d.runIndex}`),
    },
    yAxis: {
      type: 'value',
      min: -0.5,
      max: 1.5,
      axisLabel: {
        formatter: (v: number) => v === 1 ? '满足' : v === 0 ? '不满足' : '',
      },
    },
    series: [{
      type: 'line',
      data: details.map(d => d.result === '满足' ? 1 : d.result === '不满足' ? 0 : 0.5),
      step: 'middle',
      symbol: 'circle',
      symbolSize: 10,
      lineStyle: { width: 2, color: '#409EFF' },
      itemStyle: {
        color: (params: any) => {
          const d = details[params.dataIndex]
          return d.result === '满足' ? '#67C23A' : d.result === '不满足' ? '#F56C6C' : '#E6A23C'
        },
      },
    }],
  }, true)
  window.addEventListener('resize', () => miniChart?.resize())
}

async function doDiagnose() {
  diagnosing.value = true
  try {
    diagnoseContent.value = await diagnoseRule(packageId, ruleId)
  } finally {
    diagnosing.value = false
  }
}
</script>

<style scoped>
.rule-detail-page {
  max-width: 1400px;
  margin: 0 auto;
}
.page-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}
.section-title {
  font-weight: 600;
  font-size: 15px;
}
.rule-summary {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  background: #f5f7fa;
  padding: 12px 16px;
  border-radius: 6px;
}
.conclusion-text {
  font-size: 13px;
  color: #606266;
}
.report-content {
  line-height: 1.8;
  font-size: 14px;
  color: #303133;
}
.report-content h1 { font-size: 20px; margin: 16px 0 8px; }
.report-content h2 { font-size: 17px; margin: 14px 0 6px; color: #409EFF; }
.report-content h3 { font-size: 15px; margin: 12px 0 4px; }
.report-content code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
.dialog-conclusion {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  color: #303133;
}
</style>
