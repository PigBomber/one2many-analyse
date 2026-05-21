<template>
  <div ref="chartRef" style="width:100%;height:300px"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import type { RuleReportItem } from '../types'

const props = defineProps<{ ruleReport: RuleReportItem[] }>()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function getStabilityColor(stability: string): string {
  switch (stability) {
    case '稳定不满足': return '#F56C6C'
    case '判定波动': return '#E6A23C'
    case '稳定满足或不涉及': return '#67C23A'
    default: return '#909399'
  }
}

onMounted(() => {
  chart = echarts.init(chartRef.value!)
  renderChart()
  window.addEventListener('resize', () => chart?.resize())
})

watch(() => props.ruleReport, renderChart, { deep: true })

function renderChart() {
  if (!chart) return
  const sorted = [...props.ruleReport].sort((a, b) => b.unsatisfiedRate - a.unsatisfiedRate)

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const d = params[0]
        const rule = sorted[d.dataIndex]
        return `<b>${rule.ruleId}</b><br/>不满足率: <b>${rule.unsatisfiedRate}%</b><br/>稳定性: ${rule.stability}<br/><br/>${rule.summary.slice(0, 150)}...`
      },
    },
    grid: { left: 180, right: 40, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(r => r.ruleId),
      axisLabel: { fontSize: 11, width: 170, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      data: sorted.map(r => ({
        value: r.unsatisfiedRate,
        itemStyle: {
          color: getStabilityColor(r.stability),
          borderRadius: [0, 4, 4, 0],
        },
      })),
      barMaxWidth: 24,
      label: {
        show: true,
        position: 'right',
        formatter: '{c}%',
        fontSize: 11,
      },
    }],
  }, true)
}
</script>
