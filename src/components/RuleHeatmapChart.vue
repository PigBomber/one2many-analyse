<template>
  <div ref="chartRef" style="width:100%;height:420px"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import type { RuleHeatmapCell, RuleReportItem } from '../types'

const props = defineProps<{
  ruleMatrix: RuleHeatmapCell[]
  ruleReport: RuleReportItem[]
  packageId: string
}>()

const router = useRouter()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function getResultColor(result: string): string {
  switch (result) {
    case '不满足': return '#F56C6C'
    case '满足': return '#67C23A'
    case '待人工复核': return '#E6A23C'
    default: return '#C0C4CC'
  }
}

function getResultValue(result: string): number {
  switch (result) {
    case '不满足': return 0
    case '满足': return 1
    case '待人工复核': return 2
    default: return 3
  }
}

onMounted(() => {
  chart = echarts.init(chartRef.value!)
  renderChart()
  window.addEventListener('resize', () => chart?.resize())

  chart.on('click', (params: any) => {
    if (params.data && props.packageId) {
      const ruleId = params.data[3]
      if (ruleId) {
        router.push(`/rule/${props.packageId}/${encodeURIComponent(ruleId)}`)
      }
    }
  })
})

watch(() => props.ruleMatrix, renderChart, { deep: true })

function renderChart() {
  if (!chart) return

  const ruleIds = [...new Set(props.ruleReport.map(r => r.ruleId))]
  const runIndexes = [...new Set(props.ruleMatrix.map(r => r.runIndex))].sort((a, b) => a - b)

  const data: any[] = []
  for (const ruleId of ruleIds) {
    for (const runIdx of runIndexes) {
      const cell = props.ruleMatrix.find(c => c.ruleId === ruleId && c.runIndex === runIdx)
      if (cell) {
        data.push([
          ruleIds.indexOf(ruleId),
          runIndexes.indexOf(runIdx),
          getResultValue(cell.result),
          cell.ruleId,
          cell.result,
          cell.shortConclusion,
        ])
      }
    }
  }

  const rateAnnotations = ruleIds.map((ruleId, idx) => {
    const report = props.ruleReport.find(r => r.ruleId === ruleId)
    return {
      coord: [idx, runIndexes.length - 0.5],
      value: `${report?.unsatisfiedRate ?? 0}%`,
      itemStyle: { color: '#606266' },
      fontSize: 11,
      fontWeight: 'bold',
    }
  })

  chart.setOption({
    tooltip: {
      formatter: (params: any) => {
        const d = params.data
        return `<b>${d[3]}</b><br/>Run${runIndexes[d[1]]}: <span style="color:${getResultColor(d[4])}">${d[4]}</span><br/><br/>${d[5] || ''}`
      },
    },
    grid: {
      left: 180,
      right: 80,
      top: 10,
      bottom: 40,
    },
    xAxis: {
      type: 'category',
      data: runIndexes.map(r => `Run${r}`),
      splitArea: { show: true },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: ruleIds,
      axisLabel: { fontSize: 11, width: 170, overflow: 'truncate' },
      inverse: true,
    },
    visualMap: {
      min: 0,
      max: 3,
      show: false,
      inRange: {
        color: ['#F56C6C', '#67C23A', '#E6A23C', '#C0C4CC'],
      },
    },
    series: [{
      type: 'heatmap',
      data,
      label: {
        show: true,
        formatter: (params: any) => {
          const val = params.data[2]
          return val === 0 ? 'x' : val === 1 ? '√' : val === 2 ? '!' : '-'
        },
        fontSize: 13,
        fontWeight: 'bold',
        color: '#fff',
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.3)' },
      },
      itemStyle: { borderWidth: 2, borderColor: '#fff', borderRadius: 3 },
    }, {
      type: 'scatter',
      data: rateAnnotations,
      symbolSize: 0.1,
      label: {
        show: true,
        formatter: (params: any) => params.data.value,
        fontSize: 11,
        fontWeight: 'bold' as const,
        color: '#606266',
      },
      tooltip: { show: false },
      silent: true,
    }],
  }, true)
}
</script>
