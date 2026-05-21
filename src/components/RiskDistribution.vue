<template>
  <div ref="chartRef" style="width:100%;height:320px"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import type { RiskReportItem } from '../types'

const props = defineProps<{ riskReport: RiskReportItem[] }>()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

onMounted(() => {
  chart = echarts.init(chartRef.value!)
  renderChart()
  window.addEventListener('resize', () => chart?.resize())
})

watch(() => props.riskReport, renderChart, { deep: true })

function renderChart() {
  if (!chart || !props.riskReport.length) return

  const grouped: Record<string, { level: string; stability: string; count: number }> = {}
  for (const r of props.riskReport) {
    const key = `${r.level}-${r.stability}`
    if (!grouped[key]) grouped[key] = { level: r.level, stability: r.stability, count: 0 }
    grouped[key].count++
  }

  const items = Object.values(grouped)
  const levelColors: Record<string, string> = { high: '#F56C6C', medium: '#E6A23C', low: '#409EFF' }
  const stabilityPatterns: Record<string, string> = { '稳定出现': '实心', '偶发出现在': '斜线', '判定波动': '点状' }

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}<br/>数量: <b>${params.value}</b>`
      },
    },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: {
        formatter: '{b}\n{c}个',
        fontSize: 12,
      },
      data: items.map(item => ({
        name: `[${item.level}] ${item.stability}`,
        value: item.count,
        itemStyle: { color: levelColors[item.level] || '#909399' },
      })),
    }],
  }, true)
}
</script>
