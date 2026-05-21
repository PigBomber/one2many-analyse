<template>
  <div class="dashboard-page" v-loading="loading">
    <template v-if="data">
      <div class="page-nav">
        <el-button @click="$router.push('/')"><el-icon><ArrowLeft /></el-icon>返回列表</el-button>
        <span class="page-title">{{ data.meta.caseName }} ({{ data.meta.taskId }})</span>
      </div>

      <el-card shadow="hover">
        <template #header><span class="section-title">规则波动明细表</span></template>
        <RuleMatrixTable
          :rule-matrix="data.ruleMatrix"
          :rule-report="data.ruleReport"
          :score-trend="data.scoreTrend"
          :package-id="packageId"
        />
      </el-card>

      <ScoreOverviewCards :summary="data.summary" />

      <el-row :gutter="16" style="margin-top: 16px">
        <el-col :span="12">
          <el-card shadow="hover">
            <template #header><span class="section-title">评分趋势</span></template>
            <ScoreTrendChart :score-trend="data.scoreTrend" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover">
            <template #header><span class="section-title">风险分布</span></template>
            <RiskDistribution :risk-report="data.riskReport" />
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="hover" style="margin-top: 16px">
        <template #header>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="section-title">规则判定波动矩阵</span>
            <div class="legend">
              <span class="legend-item"><span class="dot" style="background:#F56C6C"></span>不满足</span>
              <span class="legend-item"><span class="dot" style="background:#67C23A"></span>满足</span>
              <span class="legend-item"><span class="dot" style="background:#E6A23C"></span>待复核</span>
              <span class="legend-item"><span class="dot" style="background:#909399"></span>不涉及</span>
            </div>
          </div>
        </template>
        <RuleHeatmapChart
          :rule-matrix="data.ruleMatrix"
          :rule-report="data.ruleReport"
          :package-id="packageId"
        />
      </el-card>

      <el-row :gutter="16" style="margin-top: 16px">
        <el-col :span="24">
          <el-card shadow="hover">
            <template #header><span class="section-title">规则稳定性排行</span></template>
            <RuleStabilityBar :rule-report="data.ruleReport" />
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="hover" style="margin-top: 16px">
        <template #header>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="section-title">AI 波动分析报告</span>
            <el-button type="primary" :loading="generatingReport" @click="doGenerateReport">
              重新生成
            </el-button>
          </div>
        </template>
        <div v-if="reportContent" class="report-content" v-html="renderedReport"></div>
        <div v-else-if="generatingReport" class="ai-loading">
          <el-icon class="is-loading" :size="20"><Loading /></el-icon>
          <span>GLM 5.1 正在分析波动原因，请稍候...</span>
        </div>
        <el-empty v-else description="等待自动分析" :image-size="80" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Loading } from '@element-plus/icons-vue'
import { getAnalysis, getReport, regenerateReport } from '../composables/useAnalysis'
import type { AggregatedAnalysis } from '../types'
import ScoreOverviewCards from '../components/ScoreOverviewCards.vue'
import ScoreTrendChart from '../components/ScoreTrendChart.vue'
import RuleHeatmapChart from '../components/RuleHeatmapChart.vue'
import RuleMatrixTable from '../components/RuleMatrixTable.vue'
import RuleStabilityBar from '../components/RuleStabilityBar.vue'
import RiskDistribution from '../components/RiskDistribution.vue'

const route = useRoute()
const packageId = route.params.packageId as string

const loading = ref(true)
const data = ref<AggregatedAnalysis | null>(null)
const generatingReport = ref(false)
const reportContent = ref('')

onMounted(async () => {
  try {
    data.value = await getAnalysis(packageId)
    loadReport()
  } finally {
    loading.value = false
  }
})

async function loadReport() {
  try {
    let report = await getReport(packageId)
    if (report) {
      reportContent.value = report
      return
    }
    generatingReport.value = true
    const pollTimer = setInterval(async () => {
      try {
        report = await getReport(packageId)
        if (report) {
          reportContent.value = report
          generatingReport.value = false
          clearInterval(pollTimer)
        }
      } catch { /* ignore */ }
    }, 3000)
    setTimeout(() => {
      clearInterval(pollTimer)
      generatingReport.value = false
    }, 120000)
  } catch {
    generatingReport.value = false
  }
}

async function doGenerateReport() {
  generatingReport.value = true
  reportContent.value = ''
  try {
    reportContent.value = await regenerateReport(packageId)
  } catch {
    reportContent.value = ''
  } finally {
    generatingReport.value = false
  }
}

const renderedReport = computed(() => {
  if (!reportContent.value) return ''
  return reportContent.value
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
</script>

<style scoped>
.dashboard-page {
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
  font-weight: 600;
  color: #303133;
}
.section-title {
  font-weight: 600;
  font-size: 15px;
}
.legend {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
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
.ai-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
</style>
