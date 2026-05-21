<template>
  <div ref="chartRef" style="width:100%;height:320px"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import type { ScoreTrendItem } from '../types'

const props = defineProps<{ scoreTrend: ScoreTrendItem[] }>()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

onMounted(() => {
  chart = echarts.init(chartRef.value!)
  renderChart()
  window.addEventListener('resize', () => chart?.resize())
})

watch(() => props.scoreTrend, renderChart, { deep: true })

function renderChart() {
  if (!chart) return
  const sorted = [...props.scoreTrend].sort((a, b) => a.runIndex - b.runIndex)
  chart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (p: any) => {
        const d = p[0]
        return `Run${d.name}<br/>总分: <b>${d.value}</b>分`
      },
    },
    grid: { left: 50, right: 30, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: sorted.map(s => s.runIndex),
      axisLabel: { formatter: 'Run{value}' },
    },
    yAxis: {
      type: 'value',
      min: (value: { min: number }) => Math.floor(value.min / 10) * 10,
      axisLabel: { formatter: '{value}' },
    },
    series: [{
      type: 'line',
      data: sorted.map(s => s.totalScore),
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: '#409EFF' },
      itemStyle: { color: '#409EFF' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.3)' },
          { offset: 1, color: 'rgba(64,158,255,0.02)' },
        ]),
      },
      markLine: {
        silent: true,
        data: [{ type: 'average', name: '平均' }],
        lineStyle: { color: '#E6A23C', type: 'dashed' },
      },
    }],
  }, true)
}
</script>
