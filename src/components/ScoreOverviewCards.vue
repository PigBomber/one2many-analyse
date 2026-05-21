<template>
  <el-row :gutter="16">
    <el-col :span="4" v-for="card in cards" :key="card.label">
      <div class="stat-card" :style="{ borderTop: `3px solid ${card.color}` }">
        <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
        <div class="stat-label">{{ card.label }}</div>
      </div>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SummaryData } from '../types'

const props = defineProps<{ summary: SummaryData }>()

const cards = computed(() => [
  { label: '平均分', value: props.summary.averageScore.toFixed(1), color: '#409EFF' },
  { label: '一致性', value: `${props.summary.consistencyPercentage}%`, color: props.summary.consistencyPercentage >= 80 ? '#67C23A' : '#F56C6C' },
  { label: '标准差', value: props.summary.scoreStandardDeviation.toFixed(2), color: '#E6A23C' },
  { label: '最低分', value: props.summary.minScore, color: '#F56C6C' },
  { label: '最高分', value: props.summary.maxScore, color: '#67C23A' },
  { label: '平均风险项', value: props.summary.averageRiskCount.toFixed(1), color: '#909399' },
])
</script>

<style scoped>
.stat-card {
  background: #fff;
  border-radius: 6px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
</style>
