<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-header class="app-header">
        <div class="header-left" @click="$router.push('/')">
          <el-icon :size="24"><DataAnalysis /></el-icon>
          <span class="app-title">规则波动分析系统</span>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { DataAnalysis } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body, #app {
  height: 100%;
  background: #f0f2f5;
}
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.app-header {
  background: #001529;
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 56px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  cursor: pointer;
}
.app-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
}
.app-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
