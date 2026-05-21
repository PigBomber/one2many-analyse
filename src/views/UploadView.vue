<template>
  <div class="upload-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><UploadFilled /></el-icon>
              <span>上传分析包</span>
            </div>
          </template>
          <el-upload
            ref="uploadRef"
            class="zip-uploader"
            drag
            :auto-upload="false"
            :limit="1"
            accept=".zip"
            :on-change="onFileChange"
            :on-exceed="onExceed"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              拖拽 ZIP 文件到此处，或 <em>点击选择</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                仅支持 consistency-*-results.zip 格式的分析包
              </div>
            </template>
          </el-upload>
          <el-button
            type="primary"
            :loading="uploading"
            :disabled="!selectedFile"
            @click="doUpload"
            style="margin-top: 16px; width: 100%"
          >
            {{ uploading ? '解析中...' : '开始分析' }}
          </el-button>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Folder /></el-icon>
              <span>历史分析包</span>
            </div>
          </template>
          <el-table :data="packages" stripe style="width: 100%" v-loading="loading">
            <el-table-column prop="taskId" label="任务ID" width="80" />
            <el-table-column prop="caseName" label="案例名称" show-overflow-tooltip />
            <el-table-column prop="totalRuns" label="运行次数" width="90" align="center" />
            <el-table-column label="上传时间" width="170">
              <template #default="{ row }">
                {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <el-button type="primary" link @click="$router.push(`/dashboard/${row.packageId}`)">
                  查看看板
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loading && packages.length === 0" description="暂无分析数据" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UploadFilled, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { uploadZip, getPackages } from '../composables/useAnalysis'
import type { PackageMeta } from '../types'

const router = useRouter()
const uploadRef = ref()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const loading = ref(false)
const packages = ref<PackageMeta[]>([])

onMounted(() => {
  loadPackages()
})

async function loadPackages() {
  loading.value = true
  try {
    packages.value = await getPackages()
  } finally {
    loading.value = false
  }
}

function onFileChange(file: UploadFile) {
  selectedFile.value = file.raw || null
}

function onExceed() {
  ElMessage.warning('一次只能上传一个文件，请先移除已选文件')
}

async function doUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    const result = await uploadZip(selectedFile.value)
    ElMessage.success(`分析包解析成功！共 ${result.meta.totalRuns} 次运行`)
    router.push(`/dashboard/${result.packageId}`)
  } catch (err: any) {
    ElMessage.error(`上传失败: ${err.response?.data?.error || err.message}`)
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.upload-page {
  max-width: 1200px;
  margin: 0 auto;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.zip-uploader :deep(.el-upload-dragger) {
  padding: 40px 0;
}
</style>
